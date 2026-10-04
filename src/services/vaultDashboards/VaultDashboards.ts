import { MarkdownRenderChild, Modal, Setting, TFile, type MarkdownPostProcessorContext } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { getCurrentLanguage } from '../../i18n';
import { showNotice } from '../../utils/noticeUtils';
import { careService, physicalChecker } from '../vaultCare/service';
import { CARE_NOTE } from '../vaultCare/model';
import {
    DASHBOARD_NOTE,
    GROUPS,
    dashboardConfig,
    taskList,
    taskState,
    type DashboardConfig,
    type DashboardEntry,
    type Page,
    type Scope,
    type TaskRecord
} from './model';
import { classifyBook, bookRead } from './books';
import { DashboardService } from './service';
const t = (de: string, en: string): string => (getCurrentLanguage() === 'de' ? de : en);
interface Dv {
    page(path: string): Page | undefined;
    array<T>(items: T[]): { array(): T[]; [key: string]: unknown };
    paragraph(text: string): unknown;
    el(tag: string, text: string): HTMLElement;
}
export class DashboardApi {
    readonly service: DashboardService;
    readonly classifyBook = classifyBook;
    readonly bookRead = bookRead;
    readonly taskState = taskState;
    readonly taskList = taskList;
    constructor(readonly plugin: NotebookNavigatorPlugin) {
        this.service = new DashboardService(plugin);
    }
    async pages(scope: Scope, dv: Dv): Promise<ReturnType<Dv['array']>> {
        const result = await this.service.pages(scope, dv);
        result.warnings.forEach(w => dv.paragraph(w));
        return dv.array(result.pages);
    }
    async files(scope: Scope): Promise<TFile[]> {
        return (await this.service.collect(scope)).files;
    }
    async tasks(dv?: Dv): Promise<TaskRecord[]> {
        const result = await this.service.tasks();
        if (dv) result.warnings.forEach(w => dv.paragraph(w));
        return result.records;
    }
    async renderTasks(dv: Dv, mode: string): Promise<void> {
        const records = taskList(await this.tasks(dv), mode);
        const limit = mode === 'focus' ? 5 : mode === 'overdue' ? 10 : mode === 'projects' ? 30 : mode === 'done' ? 20 : 100;
        const container = dv.el('div', '');
        container.addClass('pf-dash-task-list');
        if (!records.length) {
            container.createEl('p', {
                text: t('Keine passenden Aufgaben im gewählten Umfang.', 'No matching tasks in the selected scope.')
            });
        }
        let group = '';
        for (const r of records.slice(0, limit)) {
            const current = mode === 'projects' ? r.project : mode === 'week' ? r.due : '';
            if (current && current !== group) {
                container.createEl('h3', { text: current });
                group = current;
            }
            const row = container.createDiv({ cls: 'pf-home-row' });
            link(this, row, r.path, r.text, r.line);
            row.createEl('small', { text: `${r.project} · ${r.priority} · ${r.due || t('ohne Datum', 'no date')}` });
        }
        if (records.length > limit) {
            container.createEl('p', { text: `${records.length} ${t('Aufgaben, Anzeige begrenzt.', 'tasks, display limited.')}` });
        }
    }
    async bookCover(page: Page): Promise<TFile | null> {
        const raw: unknown = Array.isArray(page.cover) ? page.cover[0] : page.cover;
        const target =
            raw && typeof raw === 'object' && 'path' in raw
                ? String(raw.path)
                : (typeof raw === 'string' ? raw : '')
                      .replace(/^!?\[\[/, '')
                      .replace(/\]\]$/, '')
                      .split('|')[0];
        const root = '07 Anhänge/Bücher/';
        const candidates = [
            target.startsWith(root) ? target : `${root}${target}`,
            `${root}${target.split('/').pop()}`,
            ...['jpg', 'jpeg', 'png', 'webp'].map(ext => `${root}${page.file.name}.${ext}`)
        ];
        const physical = physicalChecker(this.plugin);
        for (const path of candidates) {
            if (!path.startsWith(root) || !/\.(?:png|jpe?g|webp)$/i.test(path) || !(await physical(path))) continue;
            const file = this.plugin.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) return file;
        }
        return null;
    }
    async coverMap(pages: Page[]): Promise<Record<string, TFile | null>> {
        const results = await Promise.all(pages.map(async p => [p.file.path, await this.bookCover(p)] as const));
        return Object.fromEntries(results);
    }
}
function link(api: DashboardApi, parent: HTMLElement, path: string, label: string, line?: number): HTMLAnchorElement {
    const a = parent.createEl('a', { text: label, href: path, cls: 'internal-link' });
    a.onclick = e => {
        e.preventDefault();
        void api.service.open(path, e.ctrlKey || e.metaKey, line).catch(e => showNotice(String(e)));
    };
    return a;
}
async function save(api: DashboardApi, cfg: DashboardConfig, expected: string): Promise<void> {
    const file = api.plugin.app.vault.getAbstractFileByPath(DASHBOARD_NOTE);
    if (!(file instanceof TFile) || !(await physicalChecker(api.plugin)(file.path))) throw new Error('Dashboard-Konfiguration fehlt.');
    await api.plugin.app.fileManager.processFrontMatter(file, fm => {
        const fields = fm as Record<string, unknown>;
        const latest = dashboardConfig(fields.pf_dashboards);
        if (JSON.stringify(latest) !== expected) {
            throw new Error(t('Konfiguration wurde verändert. Erneut öffnen.', 'Configuration changed. Reopen settings.'));
        }
        fields.pf_dashboards = {
            ...(fields.pf_dashboards && typeof fields.pf_dashboards === 'object' ? fields.pf_dashboards : {}),
            favorites: cfg.favorites,
            visible: cfg.visible,
            sources: cfg.sources
        };
    });
}
export class DashboardSettings extends Modal {
    constructor(
        private api: DashboardApi,
        private done: () => void = () => {}
    ) {
        super(api.plugin.app);
    }
    onOpen(): void {
        this.contentEl.addClass('pf-dash-settings');
        void this.build().catch(e => this.contentEl.createEl('p', { text: String(e), attr: { role: 'alert' } }));
    }
    private async build(): Promise<void> {
        const cfg = await this.api.service.config();
        const expected = JSON.stringify(cfg);
        this.contentEl.createEl('h2', { text: t('Dashboard-Einstieg anpassen', 'Customize dashboard entry') });
        this.contentEl.createEl('p', {
            text: t(
                'Favoriten, Reihenfolge und Bereiche gelten für beide Navigationen.',
                'Favorites, order and areas apply to both navigators.'
            )
        });
        const favorites = this.contentEl.createDiv();
        const render = () => {
            favorites.empty();
            favorites.createEl('h3', { text: t('Favoriten und Reihenfolge', 'Favorites and order') });
            cfg.favorites.forEach((path, index) => {
                const entry = cfg.entries.find(e => e.path === path);
                if (!entry) return;
                new Setting(favorites)
                    .setName(entry.label)
                    .addButton(b =>
                        b
                            .setButtonText('↑')
                            .setTooltip(t('Nach oben', 'Move up'))
                            .setDisabled(index === 0)
                            .onClick(() => {
                                [cfg.favorites[index - 1], cfg.favorites[index]] = [cfg.favorites[index], cfg.favorites[index - 1]];
                                render();
                            })
                    )
                    .addButton(b =>
                        b.setButtonText(t('Entfernen', 'Remove')).onClick(() => {
                            cfg.favorites = cfg.favorites.filter(p => p !== path);
                            render();
                        })
                    );
            });
            new Setting(favorites).setName(t('Favorit hinzufügen', 'Add favorite')).addDropdown(d => {
                d.addOption('', t('Ansicht wählen …', 'Choose a view …'));
                for (const entry of cfg.entries.filter(e => !cfg.favorites.includes(e.path) && !e.legacy)) {
                    d.addOption(entry.path, entry.label);
                }
                d.onChange(path => {
                    if (path) {
                        cfg.favorites.push(path);
                        render();
                    }
                });
            });
        };
        render();
        this.contentEl.createEl('h3', { text: t('Sichtbare Bereiche', 'Visible areas') });
        for (const g of GROUPS) {
            new Setting(this.contentEl).setName(g.label).addToggle(v =>
                v.setValue(cfg.visible.includes(g.id)).onChange(on => {
                    cfg.visible = on ? [...cfg.visible, g.id] : cfg.visible.filter(id => id !== g.id);
                })
            );
        }
        const sources = this.contentEl.createEl('details');
        sources.createEl('summary', { text: t('Gemeinsame Datenquellen', 'Shared sources') });
        for (const [scope, name] of [
            ['tasks', 'Aufgaben'],
            ['books', 'Bibliothek'],
            ['activity', 'Vault-Aktivität'],
            ['clips', 'Web-Clips']
        ] as const) {
            new Setting(sources)
                .setName(name)
                .setDesc(t('Ein ausdrücklich einbezogener Ordner je Zeile.', 'One explicitly included folder per line.'))
                .addTextArea(v =>
                    v.setValue(cfg.sources[scope].join('\n')).onChange(text => {
                        cfg.sources[scope] = text
                            .split('\n')
                            .map(s => s.trim())
                            .filter(Boolean);
                    })
                );
        }
        const error = this.contentEl.createEl('p', { attr: { role: 'alert' }, cls: 'pf-home-warning' });
        new Setting(this.contentEl)
            .addButton(b => b.setButtonText(t('Abbrechen', 'Cancel')).onClick(() => this.close()))
            .addButton(b =>
                b
                    .setButtonText(t('Auswahl übernehmen', 'Apply selection'))
                    .setCta()
                    .onClick(async () => {
                        b.setDisabled(true);
                        try {
                            dashboardConfig(cfg);
                            await save(this.api, cfg, expected);
                            this.close();
                            this.done();
                        } catch (e) {
                            error.setText(String(e));
                            b.setDisabled(false);
                        }
                    })
            );
    }
    onClose(): void {
        this.contentEl.empty();
    }
}
export async function dashboardModule(api: DashboardApi, parent: HTMLElement): Promise<void> {
    const cfg = await api.service.config();
    parent.addClass('pf-dash-module');
    const head = parent.createDiv({ cls: 'pf-home-card-header' });
    head.createEl('h2', { text: t('Deine Dashboards', 'Your dashboards') });
    link(api, head, DASHBOARD_NOTE, t('Alle Dashboards ansehen →', 'View all dashboards →'));
    const favorites = parent.createDiv({ cls: 'pf-dash-favorites' });
    const selected = cfg.favorites
        .map(p => cfg.entries.find(e => e.path === p))
        .filter((e): e is DashboardEntry => !!e && cfg.visible.includes(e.area));
    if (!selected.length) {
        favorites.createEl('p', {
            text: t('Über „Dashboard-Einstieg anpassen“ wählst du deine Favoriten.', 'Choose favorites in dashboard settings.')
        });
    }
    for (const e of selected) {
        const card = favorites.createDiv({ cls: 'pf-dash-favorite' });
        link(api, card, e.path, e.label);
        card.createEl('small', { text: GROUPS.find(g => g.id === e.area)?.label ?? e.area });
        if (e.stand) card.createEl('small', { text: e.stand });
    }
    const areas = parent.createDiv({ cls: 'pf-dash-links' });
    for (const g of GROUPS.filter(g => cfg.visible.includes(g.id))) {
        const b = areas.createEl('button', { text: g.label });
        b.onclick = () => {
            pendingGroup = g.id;
            void api.service.open(DASHBOARD_NOTE).catch(e => showNotice(String(e)));
        };
    }
    const configure = parent.createEl('button', {
        text: t('Dashboard-Einstieg anpassen', 'Customize dashboard entry'),
        cls: 'pf-dash-configure'
    });
    configure.onclick = () => new DashboardSettings(api).open();
}
let pendingGroup = '';
class DashboardView extends MarkdownRenderChild {
    private group = '';
    private legacy = false;
    private search = '';
    private revision = 0;
    constructor(
        private api: DashboardApi,
        el: HTMLElement
    ) {
        super(el);
    }
    onload(): void {
        this.group = pendingGroup;
        pendingGroup = '';
        void this.render();
        this.registerEvent(
            this.api.plugin.app.metadataCache.on('changed', file => {
                if (file.path === DASHBOARD_NOTE) void this.render();
            })
        );
        this.register(() => {
            this.revision++;
        });
    }
    private async render(): Promise<void> {
        const revision = ++this.revision;
        try {
            const cfg = await this.api.service.config();
            if (revision !== this.revision) return;
            this.containerEl.empty();
            const root = this.containerEl.createDiv({ cls: 'pf-home pf-dash' });
            const header = root.createDiv({ cls: 'pf-home-header' });
            const intro = header.createDiv();
            intro.createEl('p', {
                text: `${GROUPS.length} ${t('Bereiche', 'areas')} · ${cfg.entries.length} ${t('vorhandene Fachansichten', 'existing views')}`,
                cls: 'pf-home-eyebrow'
            });
            intro.createEl('h1', { text: t('Deine Dashboards', 'Your dashboards') });
            intro.createEl('p', {
                text: t('Ein Einstieg für Arbeit, Quellen und die Pflege deines Vaults.', 'One entry for work, sources and vault care.'),
                cls: 'pf-home-subtitle'
            });
            header.createEl('button', { text: t('Anpassen', 'Customize') }).onclick = () =>
                new DashboardSettings(this.api, () => {
                    void this.render();
                }).open();
            const tabs = root.createDiv({
                cls: 'pf-dash-tabs',
                attr: { role: 'group', 'aria-label': t('Dashboard-Bereich', 'Dashboard area') }
            });
            for (const g of [{ id: '', label: t('Bereiche', 'Areas') }, ...GROUPS.filter(g => cfg.visible.includes(g.id))]) {
                const b = tabs.createEl('button', { text: g.label, attr: { 'aria-pressed': String(this.group === g.id) } });
                b.onclick = () => {
                    this.group = g.id;
                    void this.render();
                };
            }
            const toolbar = root.createDiv({ cls: 'pf-dash-toolbar' });
            const search = toolbar.createEl('input', {
                type: 'search',
                placeholder: t('Dashboard suchen …', 'Search dashboards …'),
                attr: { 'aria-label': t('Dashboard suchen', 'Search dashboards') }
            });
            search.value = this.search;
            const label = toolbar.createEl('label');
            const toggle = label.createEl('input', { type: 'checkbox' });
            toggle.checked = this.legacy;
            label.appendText(t('Bisherige Spezialansichten', 'Previous special views'));
            const result = root.createDiv({ attr: { 'aria-live': 'polite' } });
            const draw = () => {
                result.empty();
                const q = this.search.toLocaleLowerCase();
                const entries = cfg.entries.filter(
                    e =>
                        cfg.visible.includes(e.area) &&
                        (!this.group || e.area === this.group) &&
                        (this.legacy || !e.legacy) &&
                        (!q || [e.label, e.path, e.source].join(' ').toLocaleLowerCase().includes(q))
                );
                if (!this.group && !q) {
                    const grid = result.createDiv({ cls: 'pf-dash-area-grid' });
                    for (const g of GROUPS.filter(g => cfg.visible.includes(g.id))) {
                        const all = cfg.entries.filter(e => e.area === g.id);
                        const lead = all.find(e => e.lead);
                        const card = grid.createDiv({ cls: 'pf-home-card pf-dash-area' });
                        card.createEl('small', {
                            text: `${all.length} ${t('vorhandene Ansichten', 'existing views')}${all.some(e => e.legacy) ? ` · ${all.filter(e => e.legacy).length} ${t('bisherige Spezialansichten', 'special views')}` : ''}`
                        });
                        card.createEl('h2', { text: g.label });
                        card.createEl('p', { text: g.question });
                        if (lead) link(this.api, card, lead.path, `${lead.label} ${t('ansehen', 'view')} →`);
                        const b = card.createEl('button', { text: t('Alle Perspektiven →', 'All perspectives →') });
                        b.onclick = () => {
                            this.group = g.id;
                            void this.render();
                        };
                    }
                } else {
                    result.createEl('p', { text: `${entries.length} ${t('Ansichten', 'views')}` });
                    if (!entries.length) {
                        result.createEl('p', {
                            text: t(
                                'Keine passende Ansicht. Suchbegriff ändern oder Spezialansichten einblenden.',
                                'No matching view. Change the query or show special views.'
                            )
                        });
                    }
                    for (const e of entries) {
                        const row = result.createDiv({ cls: 'pf-dash-catalog-row' });
                        const title = row.createDiv();
                        link(this.api, title, e.path, e.label);
                        title.createEl('small', {
                            text: e.legacy
                                ? t('Bisherige Spezialansicht', 'Previous special view')
                                : GROUPS.find(g => g.id === e.area)?.label
                        });
                        const source = row.createDiv({ cls: 'pf-dash-source' });
                        source.createEl('small', { text: e.source });
                        if (e.stand) source.createEl('small', { text: e.stand });
                        const exists = this.api.plugin.app.vault.getAbstractFileByPath(e.path) instanceof TFile;
                        if (!exists) {
                            source.createEl('small', { text: t('Zielnotiz fehlt', 'Target note missing'), cls: 'pf-home-warning' });
                        }
                        const starred = cfg.favorites.includes(e.path);
                        const b = row.createEl('button', {
                            text: starred ? '★' : '☆',
                            attr: {
                                'aria-pressed': String(starred),
                                'aria-label': `${starred ? t('Favorit entfernen', 'Remove favorite') : t('Als Favorit wählen', 'Choose favorite')}: ${e.label}`
                            }
                        });
                        b.disabled = !exists;
                        b.onclick = () => {
                            const expected = JSON.stringify(cfg);
                            cfg.favorites = starred ? cfg.favorites.filter(p => p !== e.path) : [...cfg.favorites, e.path];
                            void save(this.api, cfg, expected)
                                .then(() => this.render())
                                .catch(e => {
                                    showNotice(String(e));
                                    void this.render();
                                });
                        };
                    }
                }
            };
            search.oninput = () => {
                this.search = search.value;
                draw();
            };
            toggle.onchange = () => {
                this.legacy = toggle.checked;
                draw();
            };
            draw();
            root.createEl('p', {
                text: t(
                    'Atlas: Snapshot vom 20. August 2026. LinkedIn-Resonanz: importierte Daten. Die Übersicht öffnet Fachansichten erst bei Auswahl.',
                    'Atlas: August 20, 2026 snapshot. LinkedIn: imported data. Views open only when selected.'
                ),
                cls: 'pf-home-warning'
            });
        } catch (e) {
            if (revision === this.revision) {
                this.containerEl.empty();
                this.containerEl.createEl('p', { text: String(e), attr: { role: 'alert' } });
            }
        }
    }
}
class PerspectiveView extends MarkdownRenderChild {
    constructor(
        private api: DashboardApi,
        private path: string,
        private group: string,
        el: HTMLElement
    ) {
        super(el);
    }
    onload(): void {
        void this.render();
    }
    private async render(): Promise<void> {
        try {
            const cfg = await this.api.service.config();
            const container = this.containerEl.createDiv({ cls: 'pf-dash-links' });
            link(this.api, container, DASHBOARD_NOTE, t('Alle Dashboards', 'All dashboards'));
            const entries = cfg.entries.filter(e =>
                this.group === 'books'
                    ? e.area === 'sources' && cfg.sources.books.some(p => e.source.includes(p) || e.path.startsWith('Dashboard/Bücher'))
                    : this.group === 'atlas'
                      ? e.path.startsWith('Dashboard/Projektatlas/')
                      : this.group === 'activity'
                        ? e.area === 'care'
                        : e.area === this.group
            );
            for (const e of entries) {
                const a = link(this.api, container, e.path, e.label);
                if (e.path === this.path) a.setAttribute('aria-current', 'page');
            }
        } catch (e) {
            this.containerEl.createEl('p', { text: String(e), attr: { role: 'alert' } });
        }
    }
}
class FreshnessView extends MarkdownRenderChild {
    constructor(
        private api: DashboardApi,
        el: HTMLElement
    ) {
        super(el);
    }
    onload(): void {
        void this.render();
    }
    private async render(): Promise<void> {
        try {
            const s = await careService(this.api.plugin).scan();
            const root = this.containerEl.createDiv({ cls: 'pf-home pf-dash-freshness' });
            link(this.api, root, CARE_NOTE, t('Pflegeübersicht und Notizwerkstatt öffnen', 'Open care overview and workshop'));
            const active = s.findings.filter(f => !f.exception && (f.rule === 'review' || f.rule === 'stale'));
            const notes = [...new Map(active.map(f => [f.note.path, f.note])).values()];
            root.createEl('p', {
                text: `${notes.length} ${t('Notizen ohne bestätigten oder aktuellen Prüfstand', 'notes missing a confirmed or current review')} · ${s.time.toLocaleTimeString()} · ${t('gemeinsamer Prüfumfang aus Lose Enden', 'shared scope from Loose ends')}`
            });
            for (const n of notes.slice(0, 100)) {
                const row = root.createDiv({ cls: 'pf-home-row' });
                link(this.api, row, n.path, n.path);
                row.createEl('small', {
                    text: `${n.type} · reviewed: ${typeof n.meta.reviewed === 'string' ? n.meta.reviewed : t('fehlt', 'missing')}`
                });
            }
            if (notes.length > 100) {
                root.createEl('p', {
                    text: t('Anzeige auf 100 begrenzt. Alle Befunde in Lose Enden.', 'Display limited to 100. All findings in Loose ends.')
                });
            }
            s.warnings.forEach(w => root.createEl('p', { text: w, cls: 'pf-home-warning' }));
        } catch (e) {
            this.containerEl.createEl('p', { text: String(e), attr: { role: 'alert' } });
        }
    }
}
export function registerVaultDashboards(plugin: NotebookNavigatorPlugin): DashboardApi {
    const api = new DashboardApi(plugin);
    plugin.registerMarkdownCodeBlockProcessor('pf-dashboards', (_s: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        if (ctx.sourcePath === DASHBOARD_NOTE) ctx.addChild(new DashboardView(api, el));
    });
    plugin.registerMarkdownCodeBlockProcessor('pf-perspectives', (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        ctx.addChild(new PerspectiveView(api, ctx.sourcePath, source.trim(), el));
    });
    plugin.registerMarkdownCodeBlockProcessor('pf-freshness', (_s: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        ctx.addChild(new FreshnessView(api, el));
    });
    plugin.addCommand({
        id: 'open-vault-dashboards',
        name: t('Dashboard-Übersicht öffnen', 'Open dashboard overview'),
        callback: () => {
            void api.service.open(DASHBOARD_NOTE).catch(e => showNotice(String(e)));
        }
    });
    plugin.addCommand({
        id: 'configure-vault-dashboards',
        name: t('Dashboard-Einstieg anpassen', 'Customize dashboard entry'),
        callback: () => new DashboardSettings(api).open()
    });
    return api;
}
