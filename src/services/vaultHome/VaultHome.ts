import { MarkdownRenderChild, Modal, Setting, TFile, TFolder, setIcon, type MarkdownPostProcessorContext } from 'obsidian';
import { showNotice } from '../../utils/noticeUtils';
import type NotebookNavigatorPlugin from '../../main';
import { homeConfig, homeHeading, localDate, safeHomeFolder, type HomeConfig } from './config';
import { getCurrentLanguage } from '../../i18n';
import { careService } from '../vaultCare/service';
import { CARE_NOTE } from '../vaultCare/model';

const scalar = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
const text = () =>
    getCurrentLanguage() === 'de'
        ? {
              name: 'Name für die Begrüßung',
              daily: 'Daily Note öffnen',
              dailyMissing: 'Bitte Daily Notes in Obsidian aktivieren.',
              configureShort: 'Anpassen',
              sub: 'Dein nächster Schritt, ohne den ganzen Vault zu durchsuchen.',
              configure: 'Startseite anpassen',
              refresh: 'Aktualisieren',
              tasks: 'Heute im Blick',
              recent: 'Weiterarbeiten',
              projects: 'Aktive Projekte',
              inbox: 'Inbox sichten',
              reading: 'Leseliste und Quellen',
              freshness: 'Wissenspflege',
              loose: 'Lose Enden',
              empty: 'Keine passenden Einträge in den gewählten Bereichen.',
              sources: 'Quellen',
              limit: 'Einträge je Modul',
              density: 'Dichte',
              standard: 'Standard',
              compact: 'Kompakt',
              startup: 'Beim Vault-Start öffnen',
              enabled: 'Anzeigen',
              up: 'Nach oben',
              down: 'Nach unten',
              save: 'Speichern',
              cancel: 'Abbrechen',
              scope: 'Ein Ordner je Zeile. Nur ausdrücklich einbezogene Bereiche werden gelesen.',
              invalid: 'Ungültiger oder gesperrter Quellenbereich.',
              missing: 'Bereich nicht vorhanden',
              capped: 'Auswertung begrenzt: Bereich verkleinern.',
              updated: 'Stand',
              stale: 'Prüfung fällig',
              unknown: 'Noch nicht geprüft',
              fault: 'Modul konnte nicht geladen werden',
              view: 'Lesenotiz öffnen',
              guide: 'Quellen und Zitate',
              capture: 'Magazinartikel erfassen',
              quote: 'Zitat erfassen',
              cite: 'Quelle referenzieren'
          }
        : {
              name: 'Name for your greeting',
              daily: 'Open daily note',
              dailyMissing: 'Please enable Daily Notes in Obsidian.',
              configureShort: 'Customize',
              sub: 'Your next step, without searching the entire vault.',
              configure: 'Configure homepage',
              refresh: 'Refresh',
              tasks: 'Today',
              recent: 'Continue working',
              projects: 'Active projects',
              inbox: 'Review inbox',
              reading: 'Reading and sources',
              freshness: 'Knowledge upkeep',
              loose: 'Loose ends',
              empty: 'No matching entries in the selected folders.',
              sources: 'Sources',
              limit: 'Entries per module',
              density: 'Density',
              standard: 'Standard',
              compact: 'Compact',
              startup: 'Open when Vault starts',
              enabled: 'Show',
              up: 'Move up',
              down: 'Move down',
              save: 'Save',
              cancel: 'Cancel',
              scope: 'One folder per line. Only explicitly selected folders are read.',
              invalid: 'Invalid or restricted source folder.',
              missing: 'Folder missing',
              capped: 'Limited scan: narrow the source folders.',
              updated: 'As of',
              stale: 'Review due',
              unknown: 'Not reviewed yet',
              fault: 'Unable to load module',
              view: 'Open reading note',
              guide: 'Sources and quotes',
              capture: 'Capture article',
              quote: 'Capture quote',
              cite: 'Reference source'
          };

/** Metadata first; body reads only for Tasks, with hard limits and scoped traversal. */
function homeFiles(plugin: NotebookNavigatorPlugin, folders: string[], moduleId?: string): { files: TFile[]; warnings: string[] } {
    const files = new Map<string, TFile>();
    const warnings: string[] = [];
    let visited = 0;
    const walk = (node: TFile | TFolder): void => {
        if (++visited > 1500 || files.size >= 500) return;
        if (node.path.split('/').includes('999_classified_confidential')) return;
        if (node instanceof TFile) {
            if (node.extension === 'md') files.set(node.path, node);
        } else for (const child of node.children) if (child instanceof TFile || child instanceof TFolder) walk(child);
    };
    for (const folder of folders) {
        if (!safeHomeFolder(folder)) continue;
        const root = plugin.app.vault.getAbstractFileByPath(folder);
        if (root instanceof TFolder) {
            if (moduleId === 'projects' || moduleId === 'recent') {
                for (const child of root.children) {
                    if (child instanceof TFile) walk(child);
                    else if (child instanceof TFolder && !child.path.split('/').includes('999_classified_confidential')) {
                        for (const file of child.children) {
                            if (file instanceof TFile && (moduleId !== 'projects' || file.basename === 'README')) walk(file);
                        }
                    }
                }
            } else walk(root);
        } else warnings.push(`${text().missing}: ${folder}`);
    }
    if (visited > 1500 || files.size >= 500) warnings.push(text().capped);
    return { files: [...files.values()], warnings };
}

class HomeSettings extends Modal {
    constructor(
        private plugin: NotebookNavigatorPlugin,
        private file: TFile
    ) {
        super(plugin.app);
    }
    onOpen(): void {
        this.contentEl.addClass('pf-home-settings');
        this.contentEl.createEl('h2', { text: text().configure });
        const config = homeConfig(this.app.metadataCache.getFileCache(this.file)?.frontmatter?.pf_home);
        new Setting(this.contentEl)
            .setName(text().name)
            .addText(t => t.setValue(config.name).onChange(v => (config.name = v.trim().slice(0, 80))));
        let startup = this.plugin.settings.homepage.source === 'file' && this.plugin.settings.homepage.file === this.file.path;
        new Setting(this.contentEl).setName(text().limit).addDropdown(d => {
            for (const n of [3, 5, 10]) d.addOption(String(n), String(n));
            d.setValue(String(config.limit)).onChange(v => (config.limit = Number(v)));
        });
        new Setting(this.contentEl).setName(text().density).addDropdown(d =>
            d
                .addOption('standard', text().standard)
                .addOption('compact', text().compact)
                .setValue(config.density)
                .onChange(v => (config.density = v as HomeConfig['density']))
        );
        new Setting(this.contentEl).setName(text().startup).addToggle(t => t.setValue(startup).onChange(v => (startup = v)));
        const list = this.contentEl.createDiv();
        const render = (): void => {
            list.empty();
            config.modules.forEach((module, index) => {
                const group = list.createDiv({ cls: 'pf-home-config-module' });
                new Setting(group)
                    .setName(text()[module.id])
                    .addToggle(t =>
                        t
                            .setTooltip(text().enabled)
                            .setValue(module.enabled)
                            .onChange(v => (module.enabled = v))
                    )
                    .addButton(b =>
                        b
                            .setButtonText('↑')
                            .setTooltip(text().up)
                            .setDisabled(index === 0)
                            .onClick(() => {
                                [config.modules[index - 1], config.modules[index]] = [config.modules[index], config.modules[index - 1]];
                                render();
                            })
                    )
                    .addButton(b =>
                        b
                            .setButtonText('↓')
                            .setTooltip(text().down)
                            .setDisabled(index === config.modules.length - 1)
                            .onClick(() => {
                                [config.modules[index + 1], config.modules[index]] = [config.modules[index], config.modules[index + 1]];
                                render();
                            })
                    );
                new Setting(group)
                    .setName(text().sources)
                    .setDesc(text().scope)
                    .addTextArea(t =>
                        t.setValue(module.folders.join('\n')).onChange(
                            v =>
                                (module.folders = v
                                    .split('\n')
                                    .map(s => s.trim())
                                    .filter(Boolean))
                        )
                    );
            });
        };
        render();
        const error = this.contentEl.createEl('p', { attr: { role: 'alert' } });
        new Setting(this.contentEl)
            .addButton(b => b.setButtonText(text().cancel).onClick(() => this.close()))
            .addButton(b =>
                b
                    .setButtonText(text().save)
                    .setCta()
                    .onClick(async () => {
                        if (config.modules.some(module => module.folders.some(folder => !safeHomeFolder(folder)))) {
                            error.setText(text().invalid);
                            return;
                        }
                        b.setDisabled(true);
                        try {
                            await this.app.fileManager.processFrontMatter(this.file, fm => {
                                (fm as Record<string, unknown>).pf_home = config;
                            });
                            if (startup) {
                                this.plugin.settings.homepage = { ...this.plugin.settings.homepage, source: 'file', file: this.file.path };
                            } else if (this.plugin.settings.homepage.file === this.file.path) {
                                this.plugin.settings.homepage = { ...this.plugin.settings.homepage, source: 'none', file: null };
                            }
                            await this.plugin.saveSettingsAndUpdate();
                            this.close();
                        } catch (e) {
                            error.setText(String(e instanceof Error ? e.message : e));
                            b.setDisabled(false);
                        }
                    })
            );
    }
    onClose(): void {
        this.contentEl.empty();
    }
}

class HomeView extends MarkdownRenderChild {
    private revision = 0;
    private refreshTimer: number | null = null;
    constructor(
        private plugin: NotebookNavigatorPlugin,
        private file: TFile,
        element: HTMLElement
    ) {
        super(element);
    }
    onload(): void {
        void this.render();
        this.registerEvent(
            this.plugin.app.metadataCache.on('changed', () => {
                if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
                this.refreshTimer = window.setTimeout(() => {
                    this.refreshTimer = null;
                    void this.render();
                }, 600);
            })
        );
        this.register(() => {
            this.revision++;
            if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
        });
    }
    private link(parent: HTMLElement, file: TFile, label: string, line?: number): void {
        const link = parent.createEl('a', { text: label, cls: 'internal-link', href: file.path });
        link.onclick = event => {
            event.preventDefault();
            void this.plugin.app.workspace
                .getLeaf(event.ctrlKey || event.metaKey)
                .openFile(file, line === undefined ? undefined : { eState: { line } });
        };
    }
    private async render(): Promise<void> {
        const revision = ++this.revision;
        const config = homeConfig(this.plugin.app.metadataCache.getFileCache(this.file)?.frontmatter?.pf_home);
        const root = createDiv();
        root.className = `pf-home pf-home-${config.density}`;
        const header = root.createDiv({ cls: 'pf-home-header' });
        const heading = homeHeading(config.name, getCurrentLanguage());
        const intro = header.createDiv({ cls: 'pf-home-intro' });
        intro.createEl('p', { text: heading.date, cls: 'pf-home-eyebrow' });
        intro.createEl('h1', { text: heading.greeting });
        intro.createEl('p', { text: text().sub, cls: 'pf-home-subtitle' });
        const configure = header.createEl('button', { text: text().configureShort, cls: 'pf-home-configure' });
        configure.onclick = () => new HomeSettings(this.plugin, this.file).open();
        const actions = header.createDiv({ cls: 'pf-home-actions' });
        const commands = this.plugin.app as unknown as { commands: { executeCommandById(id: string): boolean } };
        const daily = actions.createEl('button', { text: text().daily });
        daily.onclick = () => {
            if (!commands.commands.executeCommandById('daily-notes')) showNotice(text().dailyMissing);
        };
        for (const [id, label] of [
            ['capture-article', text().capture],
            ['capture-quote', text().quote]
        ]) {
            const button = actions.createEl('button', { text: label });
            button.onclick = () => {
                if (!commands.commands.executeCommandById(`picturefish-zitate:${id}`)) showNotice('Picturefish Zitate aktivieren.');
            };
        }
        const grid = root.createDiv({ cls: 'pf-home-grid' });
        const fm = (file: TFile): Record<string, unknown> => this.plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        for (const module of config.modules.filter(m => m.enabled)) {
            const card = grid.createDiv({ cls: 'pf-home-card' });
            const cardHeader = card.createDiv({ cls: 'pf-home-card-header' });
            cardHeader.createEl('h2', { text: text()[module.id] });
            cardHeader.createEl('small', { text: `max. ${config.limit}` });
            const { files, warnings } = homeFiles(this.plugin, module.folders, module.id);
            const content = card.createDiv({ cls: 'pf-home-list' });
            let count = 0;
            try {
                if (module.id === 'loose') {
                    const snapshot = await careService(this.plugin).scan();
                    if (revision !== this.revision) return;
                    const active = snapshot.findings.filter(f => !f.exception);
                    const care = this.plugin.app.vault.getAbstractFileByPath(CARE_NOTE);
                    if (care instanceof TFile) {
                        const row = content.createDiv({ cls: 'pf-home-row' });
                        this.link(
                            row,
                            care,
                            getCurrentLanguage() === 'de'
                                ? 'Pflegeübersicht und Notizwerkstatt öffnen'
                                : 'Open care overview and note workshop'
                        );
                        row.createEl('small', {
                            text: `${active.filter(f => f.rule === 'types').length} ${getCurrentLanguage() === 'de' ? 'ohne Typ' : 'without type'} · ${active.filter(f => f.rule === 'yaml').length} YAML · ${active.filter(f => f.rule === 'review').length} ${text().unknown}`
                        });
                        row.createEl('small', {
                            text: `${snapshot.notes.filter(n => !n.path.startsWith('Templates/')).length} ${getCurrentLanguage() === 'de' ? 'Inhaltsnoten geprüft' : 'content notes checked'} · ${snapshot.time.toLocaleTimeString()} · ${getCurrentLanguage() === 'de' ? 'Bereiche und Prüfungen in Lose Enden konfigurierbar' : 'Scope and checks configured in Loose ends'}`
                        });
                        count++;
                    }
                    for (const warning of snapshot.warnings) card.createEl('p', { text: warning, cls: 'pf-home-warning' });
                    card.createEl('small', {
                        text:
                            getCurrentLanguage() === 'de' ? 'Quelle: gemeinsame Live-Pflegeübersicht' : 'Source: shared live care overview'
                    });
                    continue;
                }
                const sorted = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime);
                const candidates = sorted.filter(file => {
                    const data = fm(file);
                    switch (module.id) {
                        case 'projects':
                            return (
                                (file.basename === 'README' || ['project', 'project-context'].includes(scalar(data.type))) &&
                                ['aktiv', 'active', 'in-arbeit'].includes(scalar(data.status))
                            );
                        case 'reading':
                            return (
                                ['buch', 'zeitschriftenartikel'].includes(String(data.type)) &&
                                !['gelesen', 'abgeschlossen', 'done'].includes(String(data.lesestatus ?? data.status))
                            );
                        case 'freshness':
                            return (
                                ['knowledge', 'decision', 'learning'].includes(String(data.type)) &&
                                (!data.reviewed || Date.now() - new Date(scalar(data.reviewed)).getTime() > 90 * 86400000)
                            );
                        default:
                            return true;
                    }
                });
                if (module.id === 'tasks') {
                    for (const file of candidates.slice(0, 100)) {
                        const body = await this.plugin.app.vault.cachedRead(file);
                        if (revision !== this.revision) return;
                        const lines = body.slice(0, 100000).split('\n');
                        let fenced = false;
                        for (let line = 0; line < lines.length; line++) {
                            if (/^\s*(```|~~~)/.test(lines[line])) {
                                fenced = !fenced;
                                continue;
                            }
                            if (fenced || !/^\s*[-*] \[ \] /.test(lines[line])) continue;
                            const due = /(?:📅|due::?)\s*(\d{4}-\d{2}-\d{2})/.exec(lines[line]);
                            if (due && due[1] > localDate()) continue;
                            const row = content.createDiv({ cls: 'pf-home-row pf-home-task' });
                            const marker = row.createSpan({ cls: 'pf-home-task-mark', attr: { 'aria-hidden': 'true' } });
                            setIcon(marker, 'square');
                            this.link(row, file, lines[line].replace(/^\s*[-*] \[ \] /, ''), line);
                            row.createEl('small', { text: file.basename });
                            if (++count >= config.limit) break;
                        }
                        if (count >= config.limit) break;
                    }
                    if (candidates.length > 100) warnings.push(text().capped);
                } else {
                    for (const file of candidates.slice(0, config.limit)) {
                        const data = fm(file);
                        const row = content.createDiv({ cls: 'pf-home-row' });
                        const title =
                            data.titel ??
                            data.title ??
                            (file.basename === 'README'
                                ? file.parent?.name
                                : file.basename === 'CLAUDE'
                                  ? `${file.parent?.name} · CLAUDE`
                                  : file.basename);
                        this.link(row, file, scalar(title));
                        const status =
                            module.id === 'freshness'
                                ? `${text().stale}: ${scalar(data.reviewed) || text().unknown}`
                                : `${scalar(data.lesestatus ?? data.status)} · ${new Date(file.stat.mtime).toLocaleDateString(getCurrentLanguage())}`;
                        row.createEl('small', { text: status });
                        count++;
                    }
                }
            } catch (e) {
                warnings.push(`${text().fault}: ${String(e instanceof Error ? e.message : e)}`);
            }
            if (!count) content.createEl('p', { text: text().empty, cls: 'pf-home-empty' });
            card.createEl('small', { text: `${text().sources}: ${module.folders.join(', ') || '—'}` });
            for (const warning of warnings) card.createEl('p', { text: warning, cls: 'pf-home-warning' });
        }
        const footer = root.createDiv({ cls: 'pf-home-footer' });
        const refresh = footer.createEl('button', { text: text().refresh });
        refresh.onclick = () => {
            void this.render();
        };
        const cite = footer.createEl('button', { text: text().cite });
        cite.onclick = () => {
            if (!commands.commands.executeCommandById('picturefish-zitate:insert-reference')) showNotice('Picturefish Zitate aktivieren.');
        };
        footer.createEl('small', { text: `${text().updated}: ${new Date().toLocaleTimeString()} · ${text().guide}` });
        for (const path of ['Dashboard/00-Vault-Cockpit.md', 'Dashboard/22-Wissensfrische.md', '04 Ressourcen/Zeitschriften/README.md']) {
            const file = this.plugin.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) this.link(footer, file, path.includes('Zeitschriften') ? text().guide : file.basename);
        }
        if (revision === this.revision) {
            this.containerEl.empty();
            this.containerEl.appendChild(root);
        }
    }
}

export function registerVaultHome(plugin: NotebookNavigatorPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor('pf-home', (_source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (file instanceof TFile && safeHomeFolder(file.parent?.path ?? '')) ctx.addChild(new HomeView(plugin, file, el));
    });
    plugin.addCommand({
        id: 'configure-vault-home',
        name: text().configure,
        callback: () => {
            const path = plugin.settings.homepage.file ?? 'Dashboard/Startseite.md';
            const file = plugin.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) new HomeSettings(plugin, file).open();
            else showNotice('Dashboard/Startseite.md fehlt.');
        }
    });
}
