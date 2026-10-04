import { TFile, TFolder } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { physicalChecker } from '../vaultCare/service';
import { safePath } from '../vaultCare/model';
import { DASHBOARD_NOTE, dashboardConfig, taskRecords, type DashboardConfig, type TaskRecord, type Scope, type Page } from './model';

export class DashboardService {
    private cached = new Map<string, { mtime: number; size: number; body: string }>();
    constructor(private plugin: NotebookNavigatorPlugin) {}
    async config(): Promise<DashboardConfig> {
        const file = this.plugin.app.vault.getAbstractFileByPath(DASHBOARD_NOTE);
        if (!(file instanceof TFile) || !(await physicalChecker(this.plugin)(file.path))) {
            throw new Error('Reguläre Dashboard-Konfiguration fehlt.');
        }
        return dashboardConfig(this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.pf_dashboards);
    }
    async collect(scope: Scope): Promise<{ files: TFile[]; warnings: string[] }> {
        const cfg = await this.config();
        return this.collectRoots(cfg.sources[scope]);
    }
    async collectRoots(roots: string[]): Promise<{ files: TFile[]; warnings: string[] }> {
        if (!roots.length || roots.some(p => !safePath(p) || p.endsWith('.md'))) {
            throw new Error('Ausdrückliche reguläre Quellenbereiche nötig.');
        }
        const physical = physicalChecker(this.plugin);
        const files = new Map<string, TFile>();
        const warnings: string[] = [];
        let visited = 0;
        let skipped = 0;
        const walk = async (node: TFile | TFolder): Promise<void> => {
            if (!safePath(node.path) || visited >= 25000 || files.size >= 5000) return;
            if (!(await physical(node.path))) {
                skipped++;
                return;
            }
            visited++;
            if (node instanceof TFile) {
                if (node.extension === 'md') {
                    if (node.stat.size > 2000000) warnings.push(`Datei über 2 MB ausgelassen: ${node.path}`);
                    else files.set(node.path, node);
                }
            } else {
                for (const child of node.children) {
                    if (safePath(child.path) && (child instanceof TFile || child instanceof TFolder)) await walk(child);
                    if (visited >= 25000 || files.size >= 5000) break;
                }
            }
        };
        for (const path of roots) {
            const node = this.plugin.app.vault.getAbstractFileByPath(path);
            if (node instanceof TFile || node instanceof TFolder) await walk(node);
            else warnings.push(`Bereich nicht eingerichtet: ${path}`);
        }
        if (visited >= 25000 || files.size >= 5000) warnings.push('Auswertung begrenzt: Quellen verkleinern.');
        if (skipped) warnings.push(`${skipped} verknüpfte oder nicht zugängliche Pfade ausgelassen.`);
        return { files: [...files.values()], warnings };
    }
    async read(file: TFile): Promise<string> {
        if (!(await physicalChecker(this.plugin)(file.path))) throw new Error('Dateipfad geändert. Neu prüfen.');
        const cached = this.cached.get(file.path);
        if (cached?.mtime === file.stat.mtime && cached.size === file.stat.size) return cached.body;
        const body = await this.plugin.app.vault.cachedRead(file);
        this.cached.set(file.path, { mtime: file.stat.mtime, size: file.stat.size, body });
        return body;
    }
    async tasks(): Promise<{ records: TaskRecord[]; warnings: string[] }> {
        const { files, warnings } = await this.collect('tasks');
        const records: TaskRecord[] = [];
        let i = 0;
        const read = async () => {
            while (i < files.length) {
                const file = files[i++];
                // Query pages and templates are not source tasks; TaskForge smart lists are views.
                if (/\/(?:Templates|SmartLists|Kalender|Kanban)\//i.test(file.path)) continue;
                try {
                    records.push(
                        ...taskRecords(
                            file.path,
                            this.plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {},
                            await this.read(file)
                        )
                    );
                } catch {
                    warnings.push(`Aufgaben nicht lesbar: ${file.path}`);
                }
            }
        };
        await Promise.all(Array.from({ length: 6 }, read));
        return { records: [...new Map(records.map(r => [r.id, r])).values()], warnings };
    }
    async pages(scope: Scope, dv: { page(path: string): Page | undefined }): Promise<{ pages: Page[]; warnings: string[] }> {
        const { files, warnings } = await this.collect(scope);
        const physical = physicalChecker(this.plugin);
        const pages: Page[] = [];
        for (const file of files) {
            if (!(await physical(file.path))) continue;
            const page = dv.page(file.path);
            if (page) pages.push(page);
        }
        return { pages, warnings };
    }
    async open(path: string, newLeaf = false, line?: number): Promise<void> {
        if (!safePath(path) || !(await physicalChecker(this.plugin)(path))) throw new Error('Ziel fehlt oder ist nicht regulär.');
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) throw new Error(`Zielnotiz fehlt: ${path}`);
        await this.plugin.app.workspace.getLeaf(newLeaf).openFile(file, line === undefined ? undefined : { eState: { line } });
    }
}
