import { FileSystemAdapter, Platform, TFile, TFolder } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import {
    CARE_NOTE,
    REGISTRY_NOTE,
    connect,
    config,
    findings,
    parseNote,
    registryFrom,
    safePath,
    type CareConfig,
    type Finding,
    type Note,
    type Registry
} from './model';

export interface Snapshot {
    notes: Note[];
    findings: Finding[];
    registry: Registry;
    config: CareConfig;
    time: Date;
    warnings: string[];
}
const services = new WeakMap<NotebookNavigatorPlugin, CareService>();
export function careService(plugin: NotebookNavigatorPlugin): CareService {
    let service = services.get(plugin);
    if (!service) {
        service = new CareService(plugin);
        services.set(plugin, service);
    }
    return service;
}
function physicalChecker(plugin: NotebookNavigatorPlugin): (path: string) => Promise<boolean> {
    const adapter = plugin.app.vault.adapter;
    interface DesktopFs {
        lstat(path: string): Promise<{ isSymbolicLink(): boolean }>;
    }
    let fs: DesktopFs | null = null;
    if (Platform.isDesktop && adapter instanceof FileSystemAdapter) {
        const runtime = window as unknown as { require?: (name: string) => unknown };
        if (typeof runtime.require !== 'function') throw new Error('Desktop-Pfadprüfung nicht verfügbar.');
        fs = runtime.require('node:fs/promises') as DesktopFs;
    }
    const checked = new Map<string, boolean>();
    return async (path: string): Promise<boolean> => {
        if (!safePath(path)) return false;
        if (!fs || !(adapter instanceof FileSystemAdapter)) return true;
        try {
            let parent = '';
            for (const part of path.split('/')) {
                parent = parent ? `${parent}/${part}` : part;
                let regular = checked.get(parent);
                if (regular === undefined) {
                    regular = !(await fs.lstat(adapter.getFullPath(parent))).isSymbolicLink();
                    checked.set(parent, regular);
                }
                if (!regular) return false;
            }
            return true;
        } catch {
            return false;
        }
    };
}
export class CareService {
    private cache = new Map<string, { mtime: number; size: number; content: string }>();
    private running: Promise<Snapshot> | null = null;
    private latest: Snapshot | null = null;
    constructor(private plugin: NotebookNavigatorPlugin) {}
    async scan(force = false): Promise<Snapshot> {
        if (this.running) return this.running;
        if (!force && this.latest && Date.now() - this.latest.time.getTime() < 2000) return this.latest;
        this.running = this.collect();
        try {
            this.latest = await this.running;
            return this.latest;
        } finally {
            this.running = null;
        }
    }
    async assertRegular(path: string): Promise<void> {
        if (!(await physicalChecker(this.plugin)(path))) throw new Error('Dateipfad wurde geändert oder ist nicht regulär. Neu prüfen.');
    }
    private async collect(): Promise<Snapshot> {
        const vault = this.plugin.app.vault;
        const settingsFile = vault.getAbstractFileByPath(CARE_NOTE);
        if (!(settingsFile instanceof TFile)) throw new Error(`${CARE_NOTE} fehlt.`);
        const registryFile = vault.getAbstractFileByPath(REGISTRY_NOTE);
        if (!(registryFile instanceof TFile)) throw new Error(`${REGISTRY_NOTE} fehlt.`);
        // Check direct paths as well as descendants before any content read.
        const physical = physicalChecker(this.plugin);
        if (!(await physical(REGISTRY_NOTE)) || !(await physical(CARE_NOTE))) {
            throw new Error('Pflegenotiz und Typregister müssen reguläre Vault-Dateien sein.');
        }
        const settingsNote = parseNote(CARE_NOTE, await vault.read(settingsFile), { version: 1, types: [] });
        if (settingsNote.yamlError) throw new Error(`Pflegekonfiguration: ${settingsNote.yamlError}`);
        const raw: unknown = settingsNote.meta.pf_order;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('pf_order mit ausdrücklichen Bereichen fehlt.');
        const roots = (raw as Record<string, unknown>).roots;
        if (!Array.isArray(roots) || !roots.length || roots.some((path: unknown) => typeof path !== 'string' || !safePath(path))) {
            throw new Error('Pflegekonfiguration: Quellenbereiche prüfen.');
        }
        const cfg = config(raw);
        const registry = registryFrom(await vault.read(registryFile));
        const warnings: string[] = [];
        const files = new Map<string, TFile>();
        let visited = 0,
            capped = false,
            skipped = 0;
        const walk = async (node: TFile | TFolder): Promise<void> => {
            if (!safePath(node.path) || (!cfg.archive && (node.path === '06 Archiv' || node.path.startsWith('06 Archiv/')))) return;
            if (++visited > 25000 || files.size >= 5000) {
                capped = true;
                return;
            }
            if (!(await physical(node.path))) {
                skipped++;
                return;
            }
            if (node instanceof TFile) {
                if (node.extension === 'md') files.set(node.path, node);
            } else {
                for (const child of node.children) {
                    // Do not enter a blocked, hidden or symlinked directory.
                    if (safePath(child.path) && (child instanceof TFolder || child instanceof TFile)) await walk(child);
                    if (capped) break;
                }
            }
        };
        for (const path of cfg.roots) {
            if (!safePath(path) || (!cfg.archive && path === '06 Archiv')) continue;
            const root = vault.getAbstractFileByPath(path);
            if (root instanceof TFile || root instanceof TFolder) await walk(root);
            else warnings.push(`Bereich fehlt: ${path}`);
            if (capped) break;
        }
        if (capped) warnings.push('Prüfung begrenzt: maximal 5.000 Notizen / 25.000 Knoten. Bereich verkleinern.');
        if (skipped) warnings.push(`${skipped} Verknüpfungen oder nicht zugängliche Pfade ausgelassen.`);
        const notes: Note[] = [];
        const pending = [...files.values()];
        let index = 0;
        const read = async () => {
            while (index < pending.length) {
                const file = pending[index++];
                if (file.stat.size > 2000000) {
                    warnings.push(`Datei über 2 MB ausgelassen: ${file.path}`);
                    continue;
                }
                try {
                    const cached = this.cache.get(file.path);
                    const content =
                        cached?.mtime === file.stat.mtime && cached.size === file.stat.size ? cached.content : await vault.read(file);
                    this.cache.set(file.path, { content, mtime: file.stat.mtime, size: file.stat.size });
                    notes.push(parseNote(file.path, content, registry));
                } catch {
                    warnings.push(`Datei konnte nicht geprüft werden: ${file.path}`);
                }
            }
        };
        await Promise.all(Array.from({ length: 6 }, read));
        for (const path of this.cache.keys()) if (!files.has(path)) this.cache.delete(path);
        notes.sort((a, b) => a.path.localeCompare(b.path));
        connect(notes);
        return { notes, findings: findings(notes, registry, cfg), registry, config: cfg, time: new Date(), warnings };
    }
}
