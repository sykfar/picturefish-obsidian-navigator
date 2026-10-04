import { MarkdownRenderChild, Modal, Setting, TFile, type MarkdownPostProcessorContext } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { getCurrentLanguage } from '../../i18n';
import { showNotice } from '../../utils/noticeUtils';
import {
    CARE_NOTE,
    ISSUES,
    REGISTRY_NOTE,
    applyType,
    config,
    patchType,
    safePath,
    value,
    type CareConfig,
    type Finding,
    type Issue,
    type Note
} from './model';
import { careService, type Snapshot } from './service';
const display = (text: string): string => (text.includes('999_classified_confidential') ? 'Referenz außerhalb des Prüfumfangs' : text);
const t = (de: string, en: string): string => (getCurrentLanguage() === 'de' ? de : en);
const labels = (): Record<Issue, string> => ({
    types: t('Typ fehlt', 'Missing type'),
    yaml: t('YAML prüfen', 'Check YAML'),
    review: t('Noch nicht geprüft', 'Not reviewed'),
    stale: t('Prüfung fällig', 'Review due'),
    evidence: t('Belegfeld prüfen', 'Check evidence field'),
    entry: t('Eintrittspunkt-Kandidat', 'Entry point candidate'),
    inbox: t('Inbox liegen geblieben', 'Aging inbox note'),
    links: t('Link-Kandidaten', 'Link candidates'),
    unknown: t('Typ ungeklärt', 'Unregistered type'),
    fields: t('Profilfelder prüfen', 'Check profile fields')
});
const steps = (): Record<Issue, string> => ({
    types: t('Funktion der Notiz wählen und Vorschau prüfen.', 'Choose the function of this note and preview.'),
    yaml: t('Doppeltes oder ungültiges Feld im Quelltext korrigieren.', 'Correct duplicate or invalid fields in the source.'),
    review: t('Inhalt prüfen. reviewed danach bewusst setzen.', 'Review the content before deliberately setting reviewed.'),
    stale: t('Aktualität des Inhalts erneut prüfen.', 'Review whether the content is still current.'),
    evidence: t(
        'Vorhandene Belege im Text prüfen; nur bei Bedarf evidence ergänzen.',
        'Check existing evidence in the text; add evidence if needed.'
    ),
    entry: t(
        'Verlinkung aus README, CLAUDE, Offenen Punkten oder Dashboard prüfen.',
        'Check entry links from README, CLAUDE, open issues or a dashboard.'
    ),
    inbox: t('Verwendung klären und bewusst einsortieren.', 'Clarify the use and deliberately file the note.'),
    links: t(
        'Ziel und Namensmehrdeutigkeit prüfen; kein bestätigter defekter Link.',
        'Check the target and ambiguity; this is not a confirmed broken link.'
    ),
    unknown: t(
        'Bestehenden Wert prüfen und bei Bedarf im Typregister ergänzen.',
        'Check the existing value and extend the registry if appropriate.'
    ),
    fields: t('Profil prüfen und nur belegte Angaben ergänzen.', 'Check the profile and add only known information.')
});
async function saveConfig(plugin: NotebookNavigatorPlugin, file: TFile, cfg: CareConfig): Promise<void> {
    await careService(plugin).assertRegular(file.path);
    await plugin.app.fileManager.processFrontMatter(file, fm => {
        const fields = fm as Record<string, unknown>;
        const previous = fields.pf_order;
        fields.pf_order = { ...(previous && typeof previous === 'object' ? previous : {}), ...cfg };
    });
}
class CareSettings extends Modal {
    constructor(
        private plugin: NotebookNavigatorPlugin,
        private file: TFile,
        private snapshot: Snapshot,
        private done: () => void
    ) {
        super(plugin.app);
    }
    onOpen(): void {
        this.contentEl.addClass('pf-order-settings');
        this.contentEl.createEl('h2', { text: t('Pflegeübersicht anpassen', 'Configure care overview') });
        const cfg = config(this.snapshot.config);
        let roots = cfg.roots.join('\n');
        new Setting(this.contentEl)
            .setName(t('Quellenbereiche', 'Source folders'))
            .setDesc(
                t(
                    'Ein Bereich je Zeile. Kein Vault-Root, keine Systemordner und keine verknüpften Verzeichnisse.',
                    'One source per line. No vault root, system folders or linked directories.'
                )
            )
            .addTextArea(input =>
                input.setValue(roots).onChange(v => {
                    roots = v;
                })
            );
        new Setting(this.contentEl).setName(t('Archiv einbeziehen', 'Include archive')).addToggle(input =>
            input.setValue(cfg.archive).onChange(v => {
                cfg.archive = v;
            })
        );
        for (const [key, name] of [
            ['inboxDays', t('Inbox-Alter in Tagen', 'Inbox age in days')],
            ['reviewDays', t('Prüfintervall in Tagen', 'Review interval in days')]
        ] as const) {
            new Setting(this.contentEl).setName(name).addText(input =>
                input.setValue(String(cfg[key])).onChange(v => {
                    cfg[key] = Number(v);
                })
            );
        }
        new Setting(this.contentEl).setName(t('Zeilen je Seite', 'Rows per page')).addDropdown(input =>
            input
                .addOptions({ '10': '10', '25': '25', '50': '50' })
                .setValue(String(cfg.pageSize))
                .onChange(v => {
                    cfg.pageSize = Number(v);
                })
        );
        new Setting(this.contentEl).setName(t('Tabellenabstand', 'Table spacing')).addDropdown(input =>
            input
                .addOption('inherit', t('Vault-Einstellung', 'Vault setting'))
                .addOption('compact', t('Kompakter Abstand', 'Compact spacing'))
                .setValue(cfg.density)
                .onChange(v => {
                    cfg.density = v === 'compact' ? 'compact' : 'inherit';
                })
        );
        this.contentEl.createEl('h3', { text: t('Prüfprofile', 'Checks') });
        for (const rule of ISSUES) {
            new Setting(this.contentEl).setName(labels()[rule]).addToggle(input =>
                input.setValue(cfg.issues.includes(rule)).onChange(v => {
                    cfg.issues = v ? [...cfg.issues, rule] : cfg.issues.filter(i => i !== rule);
                })
            );
        }
        this.contentEl.createEl('h3', { text: t('Notizfamilien', 'Note families') });
        const families = [...new Set(this.snapshot.registry.types.map(d => d.family)), 'Ungeklärt'];
        let chosen = cfg.families.length ? [...cfg.families] : [...families];
        for (const family of families) {
            new Setting(this.contentEl).setName(family).addToggle(input =>
                input.setValue(chosen.includes(family)).onChange(v => {
                    chosen = v ? [...chosen, family] : chosen.filter(f => f !== family);
                })
            );
        }
        this.contentEl.createEl('h3', { text: t('Bewusste Ausnahmen', 'Conscious exceptions') });
        this.contentEl.createEl('p', {
            text: t(
                'Eine Ausnahme gilt nur für die geprüfte Dateifassung und Registerversion. Änderungen machen sie erneut prüfbar.',
                'Exceptions apply only to the checked file revision and registry version. Changes make the finding reviewable again.'
            )
        });
        for (const exception of [...cfg.exceptions]) {
            new Setting(this.contentEl)
                .setName(`${exception.path} · ${labels()[exception.rule]}`)
                .setDesc(exception.reason)
                .addButton(button =>
                    button.setButtonText(t('Entfernen', 'Remove')).onClick(() => {
                        cfg.exceptions = cfg.exceptions.filter(e => e !== exception);
                        button.setDisabled(true);
                    })
                );
        }
        const error = this.contentEl.createEl('p', { cls: 'pf-order-error', attr: { role: 'alert' } });
        new Setting(this.contentEl)
            .addButton(b => b.setButtonText(t('Abbrechen', 'Cancel')).onClick(() => this.close()))
            .addButton(b =>
                b
                    .setButtonText(t('Speichern', 'Save'))
                    .setCta()
                    .onClick(async () => {
                        const paths = roots
                            .split('\n')
                            .map(p => p.trim())
                            .filter(Boolean);
                        if (
                            !paths.length ||
                            paths.some(p => !safePath(p)) ||
                            !chosen.length ||
                            [cfg.inboxDays, cfg.reviewDays].some(n => !Number.isInteger(n) || n < 1 || n > 3650)
                        ) {
                            error.setText(t('Bereiche, Familien und Tageswerte prüfen.', 'Check folders, families and day values.'));
                            return;
                        }
                        cfg.roots = [...new Set(paths)];
                        cfg.families = chosen.length === families.length ? [] : chosen;
                        b.setDisabled(true);
                        try {
                            await saveConfig(this.plugin, this.file, cfg);
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
class ExceptionModal extends Modal {
    constructor(
        private plugin: NotebookNavigatorPlugin,
        private file: TFile,
        private finding: Finding,
        private snapshot: Snapshot,
        private done: () => void
    ) {
        super(plugin.app);
    }
    onOpen(): void {
        this.contentEl.createEl('h2', { text: t('Bewusste Ausnahme begründen', 'Explain a conscious exception') });
        this.contentEl.createEl('p', { text: `${this.finding.note.path} · ${labels()[this.finding.rule]}` });
        let reason = '';
        new Setting(this.contentEl).setName(t('Begründung', 'Reason')).addTextArea(input =>
            input.onChange(v => {
                reason = v.trim();
            })
        );
        const error = this.contentEl.createEl('p', { cls: 'pf-order-error', attr: { role: 'alert' } });
        new Setting(this.contentEl)
            .addButton(b => b.setButtonText(t('Abbrechen', 'Cancel')).onClick(() => this.close()))
            .addButton(b =>
                b
                    .setButtonText(t('Ausnahme speichern', 'Save exception'))
                    .setCta()
                    .onClick(async () => {
                        if (!reason) {
                            error.setText(t('Bitte die fachliche Begründung angeben.', 'Please provide the reason.'));
                            return;
                        }
                        try {
                            await careService(this.plugin).assertRegular(this.finding.note.path);
                            const note = this.plugin.app.vault.getAbstractFileByPath(this.finding.note.path);
                            if (!(note instanceof TFile) || (await this.plugin.app.vault.read(note)) !== this.finding.note.content) {
                                error.setText(t('Die Notiz wurde geändert. Neu prüfen.', 'The note has changed. Check again.'));
                                return;
                            }
                            b.setDisabled(true);
                            const cfg = config(this.plugin.app.metadataCache.getFileCache(this.file)?.frontmatter?.pf_order);
                            cfg.exceptions = cfg.exceptions.filter(e => e.path !== note.path || e.rule !== this.finding.rule);
                            cfg.exceptions.push({
                                path: note.path,
                                rule: this.finding.rule,
                                reason,
                                signature: this.finding.note.signature,
                                version: this.snapshot.registry.version
                            });
                            await saveConfig(this.plugin, this.file, cfg);
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
class CareView extends MarkdownRenderChild {
    private snapshot: Snapshot | null = null;
    private mode: 'overview' | 'workshop' = 'overview';
    private area = '';
    private family = '';
    private issue: Issue | '' = '';
    private query = '';
    private page = 0;
    private selected = '';
    private showExceptions = false;
    private allNotes = false;
    private timer: number | null = null;
    private revision = 0;
    constructor(
        private plugin: NotebookNavigatorPlugin,
        private file: TFile,
        element: HTMLElement
    ) {
        super(element);
    }
    onload(): void {
        void this.refresh();
        const queue = (file: TFile) => {
            if (!safePath(file.path)) return;
            if (this.timer !== null) window.clearTimeout(this.timer);
            this.timer = window.setTimeout(() => {
                this.timer = null;
                void this.refresh();
            }, 1200);
        };
        this.registerEvent(this.plugin.app.metadataCache.on('changed', queue));
        this.registerEvent(
            this.plugin.app.vault.on('delete', file => {
                if (file instanceof TFile) queue(file);
            })
        );
        this.registerEvent(
            this.plugin.app.vault.on('rename', file => {
                if (file instanceof TFile) queue(file);
            })
        );
        this.register(() => {
            this.revision++;
            if (this.timer !== null) window.clearTimeout(this.timer);
        });
    }
    private current(): Snapshot {
        if (!this.snapshot) throw new Error('Prüflauf noch nicht verfügbar.');
        return this.snapshot;
    }
    private async refresh(): Promise<void> {
        const revision = ++this.revision;
        if (!this.snapshot) {
            this.containerEl.empty();
            this.containerEl.createEl('p', {
                text: t('Ausgewählte Bereiche werden geprüft …', 'Checking selected folders …'),
                attr: { role: 'status' }
            });
        }
        try {
            const snapshot = await careService(this.plugin).scan(true);
            if (revision !== this.revision) return;
            this.snapshot = snapshot;
            this.render();
        } catch (e) {
            if (revision !== this.revision) return;
            this.containerEl.empty();
            this.containerEl.createEl('p', {
                text: String(e instanceof Error ? e.message : e),
                cls: 'pf-order-error',
                attr: { role: 'alert' }
            });
        }
    }
    private button(parent: HTMLElement, text: string, run: () => void, cls = ''): HTMLButtonElement {
        const b = parent.createEl('button', { text, cls });
        b.onclick = run;
        return b;
    }
    private open(path: string, line?: number, source = false): void {
        if (!safePath(path)) return;
        const file = this.plugin.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            void this.plugin.app.workspace
                .getLeaf(false)
                .openFile(file, { eState: { line: line ?? 0 }, state: { mode: source ? 'source' : 'preview' }, active: true });
        }
    }
    private link(parent: HTMLElement, path: string, label?: string): void {
        if (!safePath(path)) return;
        const a = parent.createEl('a', { text: label ?? path.replace(/\.md$/, '').split('/').pop(), cls: 'internal-link', href: path });
        a.onclick = e => {
            e.preventDefault();
            this.open(path);
        };
    }
    private visible(): Finding[] {
        return this.current().findings.filter(
            f =>
                (this.showExceptions || !f.exception) &&
                (!this.area || f.note.path.split('/')[0] === this.area) &&
                (!this.family || f.note.family === this.family) &&
                (!this.issue || f.rule === this.issue) &&
                (!this.query || f.note.path.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()))
        );
    }
    private render(): void {
        const snapshot = this.snapshot;
        if (!snapshot) return;
        const root = createDiv({ cls: `pf-order pf-order-${snapshot.config.density}` });
        const header = root.createDiv({ cls: 'pf-order-header' });
        const intro = header.createDiv();
        intro.createEl('p', { text: t('Ordnung im Vault', 'Vault organization'), cls: 'pf-order-muted' });
        intro.createEl('h1', {
            text: this.mode === 'overview' ? t('Lose Enden', 'Loose ends') : t('Eine Notiz einordnen', 'Classify a note')
        });
        intro.createEl('p', {
            text: `${snapshot.time.toLocaleString(getCurrentLanguage())} · ${snapshot.notes.filter(n => !n.path.startsWith('Templates/')).length} ${t('Inhaltsnoten geprüft', 'content notes checked')} · ${t('Register', 'Registry')} v${snapshot.registry.version}`,
            cls: 'pf-order-muted'
        });
        const actions = header.createDiv({ cls: 'pf-order-actions' });
        this.button(actions, t('Aktualisieren', 'Refresh'), () => {
            void this.refresh();
        });
        this.button(actions, t('Anpassen', 'Configure'), () =>
            new CareSettings(this.plugin, this.file, snapshot, () => {
                void this.refresh();
            }).open()
        );
        const tabs = root.createDiv({ cls: 'pf-order-tabs', attr: { role: 'group', 'aria-label': t('Ansicht', 'View') } });
        for (const [id, label] of [
            ['overview', t('Pflegeübersicht', 'Care overview')],
            ['workshop', t('Notizwerkstatt', 'Note workshop')]
        ] as const) {
            const b = this.button(tabs, label, () => {
                this.mode = id;
                this.render();
            });
            b.setAttribute('aria-pressed', String(this.mode === id));
        }
        const filters = root.createDiv({ cls: 'pf-order-filters' });
        const dropdown = (
            label: string,
            options: string[],
            current: string,
            change: (value: string) => void,
            names?: Record<string, string>
        ) => {
            const field = filters.createEl('label', { text: label });
            const select = field.createEl('select');
            select.createEl('option', { value: '', text: t('Alle', 'All') });
            for (const option of options) select.createEl('option', { value: option, text: names?.[option] ?? option });
            select.value = current;
            select.onchange = () => {
                change(select.value);
                this.page = 0;
                this.render();
            };
        };
        dropdown(
            t('Bereich', 'Area'),
            [...new Set(snapshot.notes.map(n => n.path.split('/')[0]))].filter(p => p !== 'Templates'),
            this.area,
            v => {
                this.area = v;
            }
        );
        dropdown(
            t('Familie', 'Family'),
            [...new Set(snapshot.notes.map(n => n.family))].filter(p => p !== 'Vorlagen'),
            this.family,
            v => {
                this.family = v;
            }
        );
        dropdown(
            t('Befund', 'Finding'),
            snapshot.config.issues,
            this.issue,
            v => {
                this.issue = v as Issue | '';
            },
            labels()
        );
        const queryLabel = filters.createEl('label', { text: t('Notiz suchen', 'Find note') });
        const search = queryLabel.createEl('input', { type: 'search', value: this.query });
        search.onchange = () => {
            this.query = search.value;
            this.page = 0;
            this.render();
        };
        const check = (label: string, enabled: boolean, run: (enabled: boolean) => void) => {
            const l = filters.createEl('label', { cls: 'pf-order-check' });
            const input = l.createEl('input', { type: 'checkbox' });
            input.checked = enabled;
            l.createSpan({ text: label });
            input.onchange = () => run(input.checked);
        };
        check(t('Archiv', 'Archive'), snapshot.config.archive, enabled => {
            void saveConfig(this.plugin, this.file, { ...snapshot.config, archive: enabled })
                .then(() => this.refresh())
                .catch(e => showNotice(String(e)));
        });
        check(t('Ausnahmen anzeigen', 'Show exceptions'), this.showExceptions, enabled => {
            this.showExceptions = enabled;
            this.page = 0;
            this.render();
        });
        if (this.mode === 'overview') this.overview(root);
        else this.workshop(root);
        const coverage = root.createEl('details', { cls: 'pf-order-coverage' });
        coverage.createEl('summary', { text: t('Prüfumfang, Regeln und Grenzen', 'Scope, rules and limits') });
        coverage.createEl('p', {
            text: `${t('Ausdrückliche Bereiche', 'Explicit folders')}: ${snapshot.config.roots.filter(p => snapshot.config.archive || p !== '06 Archiv').join(', ')}`
        });
        coverage.createEl('p', {
            text: t(
                'Zählungen können sich überschneiden. Vorlagen zählen separat. Verknüpfte Verzeichnisse und Systemordner werden ausgelassen. Link- und Eintrittspunkt-Befunde sind Kandidaten: dynamische Abfragen, Canvas, externe Manuskripte und nicht gewählte Bereiche sind ungeprüft. Literaturverwendung erfasst erkennbare Pandoc-Verweise im geprüften Markdown. Ein Prüflauf setzt kein reviewed.',
                'Counts may overlap. Templates are separate. Linked directories and system folders are excluded. Link and entry findings are candidates: dynamic queries, canvas, external manuscripts and unselected folders are unchecked. Literary usage covers recognizable Pandoc references in checked Markdown. Scanning never sets reviewed.'
            )
        });
        coverage.createEl('p', {
            text: `${t('Inbox-Schwelle', 'Inbox threshold')}: ${snapshot.config.inboxDays} · ${t('Prüfintervall', 'Review interval')}: ${snapshot.config.reviewDays} ${t('Tage', 'days')} · ${t('Grenzen', 'Limits')}: 5.000 / 25.000 / 2 MB`
        });
        coverage.createEl('p', {
            text: `${t('Aktive Familien', 'Active families')}: ${snapshot.config.families.join(', ') || t('Alle', 'All')} · ${t('Prüfungen', 'Checks')}: ${snapshot.config.issues.map(rule => labels()[rule]).join(', ') || t('Keine', 'None')}`
        });
        this.link(coverage, REGISTRY_NOTE, t('Typregister und Prüfprofile', 'Type registry and profiles'));
        this.link(coverage, 'Dashboard/Startseite.md', t('Startseite', 'Homepage'));
        for (const warning of snapshot.warnings) root.createEl('p', { text: warning, cls: 'pf-order-warning' });
        this.containerEl.empty();
        this.containerEl.appendChild(root);
    }
    private overview(root: HTMLElement): void {
        const snapshot = this.current();
        const active = snapshot.findings.filter(f => !f.exception);
        const cards = root.createDiv({ cls: 'pf-order-stats' });
        for (const rule of ['types', 'yaml', 'review'] as const) {
            const card = cards.createDiv({ cls: 'pf-order-card' });
            card.createEl('p', { text: labels()[rule] });
            const count = active.filter(f => f.rule === rule).length;
            this.button(
                card,
                String(count),
                () => {
                    this.issue = rule;
                    this.area = '';
                    this.page = 0;
                    this.render();
                },
                'pf-order-number'
            );
            card.createEl('small', {
                text:
                    rule === 'yaml'
                        ? t('Quelltext zuerst korrigieren', 'Correct the source first')
                        : t('Hinweis zur bewussten Pflege', 'Deliberate maintenance hint')
            });
        }
        const matrix = root.createDiv({ cls: 'pf-order-card' });
        matrix.createEl('h2', { text: t('Wo entstehen offene Stellen?', 'Where are the gaps?') });
        matrix.createEl('p', {
            text: t(
                'Eine Zelle filtert die Befunde. Gezählt werden unterschiedliche Notizen je Bereich und Regel.',
                'Select a cell to filter findings. Each area and rule counts distinct notes.'
            ),
            cls: 'pf-order-muted'
        });
        const table = matrix.createEl('table', { cls: 'pf-order-matrix' });
        const head = table.createEl('thead').createEl('tr');
        head.createEl('th', { text: t('Bereich', 'Area') });
        const rules = ['types', 'yaml', 'review', 'entry'] as const;
        for (const rule of rules) head.createEl('th', { text: labels()[rule] });
        const body = table.createEl('tbody');
        const areas = [...new Set(snapshot.notes.map(n => n.path.split('/')[0]))].filter(p => p !== 'Templates');
        const max = Math.max(
            1,
            ...areas.flatMap(area => rules.map(rule => active.filter(f => f.rule === rule && f.note.path.split('/')[0] === area).length))
        );
        for (const area of areas) {
            const row = body.createEl('tr');
            row.createEl('th', { text: area, attr: { scope: 'row' } });
            for (const rule of rules) {
                const count = active.filter(f => f.rule === rule && f.note.path.split('/')[0] === area).length;
                const cell = row.createEl('td');
                const level = count === 0 ? 0 : Math.max(1, Math.ceil((count / max) * 4));
                const b = this.button(
                    cell,
                    String(count),
                    () => {
                        this.area = area;
                        this.issue = rule;
                        this.page = 0;
                        this.render();
                    },
                    `pf-order-heat pf-order-heat-${level}`
                );
                b.setAttribute('aria-label', `${area}: ${labels()[rule]}, ${count}`);
            }
        }
        const visible = this.visible();
        const work = root.createDiv({ cls: 'pf-order-card' });
        work.createEl('h2', { text: `${t('Gezielt bearbeiten', 'Review deliberately')} · ${visible.length}` });
        const workTable = work.createEl('table', { cls: 'pf-order-findings' });
        const heading = workTable.createEl('thead').createEl('tr');
        for (const label of [t('Einordnung', 'Classification'), t('Notiz', 'Note'), t('Nächster Schritt', 'Next step')]) {
            heading.createEl('th', { text: label });
        }
        const rows = workTable.createEl('tbody');
        const page = this.paginate(visible);
        for (const finding of page) {
            const row = rows.createEl('tr');
            row.createEl('td', {
                text: finding.exception
                    ? t('Bewusste Ausnahme', 'Conscious exception')
                    : finding.severity === 'error'
                      ? t('Fehler', 'Error')
                      : finding.severity === 'candidate'
                        ? t('Kandidat', 'Candidate')
                        : t('Hinweis', 'Hint'),
                cls: `pf-order-${finding.severity}`
            });
            const note = row.createEl('td');
            this.button(
                note,
                finding.note.path.replace(/\.md$/, '').split('/').pop() ?? '',
                () => {
                    this.selected = finding.note.path;
                    this.mode = 'workshop';
                    this.render();
                },
                'pf-order-link'
            );
            note.createEl('small', { text: finding.note.path });
            const next = row.createEl('td');
            next.createEl('strong', { text: labels()[finding.rule] });
            next.createEl('p', { text: finding.exception?.reason ?? steps()[finding.rule] });
        }
        if (!visible.length) work.createEl('p', { text: t('Keine Befunde für diese Auswahl.', 'No findings for this selection.') });
        this.pager(work, visible.length);
    }
    private paginate<T>(items: T[]): T[] {
        const size = this.current().config.pageSize;
        this.page = Math.min(this.page, Math.max(0, Math.ceil(items.length / size) - 1));
        return items.slice(this.page * size, (this.page + 1) * size);
    }
    private pager(parent: HTMLElement, count: number): void {
        const pager = parent.createDiv({ cls: 'pf-order-actions' });
        this.button(pager, t('Zurück', 'Previous'), () => {
            this.page--;
            this.render();
        }).disabled = this.page === 0;
        pager.createSpan({ text: `${this.page + 1} / ${Math.max(1, Math.ceil(count / this.current().config.pageSize))}` });
        this.button(pager, t('Weiter', 'Next'), () => {
            this.page++;
            this.render();
        }).disabled = (this.page + 1) * this.current().config.pageSize >= count;
    }
    private workshop(root: HTMLElement): void {
        const snapshot = this.current();
        const content = snapshot.notes.filter(n => !n.path.startsWith('Templates/'));
        const valid = content.filter(n => !n.yamlError);
        const typed = valid.filter(n => n.type).length;
        const meter = root.createDiv({ cls: 'pf-order-card' });
        meter.createEl('h2', { text: t('Was bin ich?', 'What am I?') });
        meter.createEl('p', {
            text: `${typed} / ${valid.length} ${t('gültige Inhaltsnoten mit Typ; YAML-Fehler separat', 'valid content notes with a type; YAML errors counted separately')}`
        });
        const progress = meter.createEl('progress', {
            attr: { max: String(valid.length || 1), value: String(typed), 'aria-label': t('Typ-Abdeckung', 'Type coverage') }
        });
        progress.addClass('pf-order-progress');
        const families = meter.createDiv({ cls: 'pf-order-actions' });
        for (const family of [...new Set(snapshot.registry.types.map(d => d.family)), 'Ungeklärt']) {
            this.button(families, `${family} · ${content.filter(n => n.family === family).length}`, () => {
                this.family = family;
                this.page = 0;
                this.render();
            });
        }
        const grid = root.createDiv({ cls: 'pf-order-workshop' });
        const queue = grid.createDiv({ cls: 'pf-order-card' });
        queue.createEl('h2', { text: t('Arbeitsliste', 'Work queue') });
        const toggle = this.button(queue, this.allNotes ? t('Nur Befunde', 'Findings only') : t('Alle Notizen', 'All notes'), () => {
            this.allNotes = !this.allNotes;
            this.page = 0;
            this.render();
        });
        toggle.setAttribute('aria-pressed', String(this.allNotes));
        const visibleFindings = this.visible();
        const paths = new Set(visibleFindings.map(f => f.note.path));
        const notes = this.allNotes
            ? content.filter(
                  n =>
                      (!this.area || n.path.split('/')[0] === this.area) &&
                      (!this.family || n.family === this.family) &&
                      (!this.query || n.path.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()))
              )
            : content.filter(n => paths.has(n.path));
        if (!this.selected || !notes.some(n => n.path === this.selected)) this.selected = notes[0]?.path ?? '';
        for (const note of this.paginate(notes)) {
            const row = queue.createDiv({ cls: 'pf-order-queue-row' });
            const b = this.button(
                row,
                (note.path.split('/').pop() ?? '').replace(/\.md$/, ''),
                () => {
                    this.selected = note.path;
                    this.render();
                },
                'pf-order-link'
            );
            b.setAttribute('aria-pressed', String(this.selected === note.path));
            row.createEl('small', { text: note.path });
            row.createEl('small', {
                text:
                    visibleFindings
                        .filter(f => f.note === note)
                        .map(f => labels()[f.rule])
                        .join(' · ') ||
                    note.type ||
                    t('Typ fehlt', 'Missing type')
            });
        }
        if (!notes.length) queue.createEl('p', { text: t('Keine Notizen für diese Auswahl.', 'No notes for this selection.') });
        this.pager(queue, notes.length);
        const inspector = grid.createDiv({ cls: 'pf-order-card' });
        const note = content.find(n => n.path === this.selected);
        if (note) this.inspect(inspector, note);
        else inspector.createEl('p', { text: t('Eine Notiz auswählen.', 'Select a note.') });
        root.createEl('p', {
            text: t(
                'Ordnung ohne neue Ordner: PARA bleibt. Typen beschreiben die Funktion; Quellen und Verknüpfungen zeigen den Zusammenhang.',
                'Organization without new folders: PARA stays. Types describe function; sources and links show context.'
            ),
            cls: 'pf-order-muted'
        });
    }
    private inspect(parent: HTMLElement, note: Note): void {
        const snapshot = this.current();
        parent.createEl('h2', { text: (note.path.split('/').pop() ?? '').replace(/\.md$/, '') });
        parent.createEl('small', { text: note.path, cls: 'pf-order-muted' });
        this.button(parent, t('Quelltext öffnen', 'Open source'), () => this.open(note.path, note.errorLine, true));
        if (note.yamlError) {
            parent.createEl('p', { text: display(note.yamlError), cls: 'pf-order-error' });
            const start = Math.max(0, note.errorLine - 2);
            parent.createEl('pre').createEl('code', {
                text: display(note.content)
                    .split('\n')
                    .slice(start, start + 7)
                    .map((line, i) => `${start + i + 1}: ${line}`)
                    .join('\n')
            });
            parent.createEl('p', { text: steps().yaml });
            return;
        }
        const info = parent.createEl('dl', { cls: 'pf-order-meta' });
        for (const [label, field] of [
            [t('Was bin ich?', 'What am I?'), note.type || t('Noch offen', 'Undecided')],
            [t('Familie', 'Family'), note.family],
            ['Status', value(note.meta.status ?? note.meta.lesestatus) || '—'],
            [t('Datum', 'Date'), value(note.meta.date ?? note.meta.created) || '—'],
            ['reviewed', value(note.meta.reviewed) || '—']
        ]) {
            info.createEl('dt', { text: label });
            info.createEl('dd', { text: field });
        }
        parent.createEl('h3', { text: t('Herkunft', 'Provenance') });
        const provenance = ['quelle', 'evidence', 'sources', 'source', 'autor', 'url', 'ausgabe', 'fundstelle', 'seiten'].filter(
            key => note.meta[key] !== undefined && note.meta[key] !== null && note.meta[key] !== ''
        );
        for (const key of provenance) {
            parent.createEl('p', {
                text: display(`${key}: ${typeof note.meta[key] === 'string' ? note.meta[key] : JSON.stringify(note.meta[key])}`)
            });
        }
        for (const path of note.sources) this.link(parent, path);
        if (!provenance.length) {
            parent.createEl('p', {
                text: t(
                    'Keine Herkunftsfelder erkannt. Quellen können bereits im Text stehen.',
                    'No provenance fields recognized. Sources may already be in the text.'
                )
            });
        }
        parent.createEl('h3', { text: t('Verwendung', 'Usage') });
        if (note.meta.published_as) {
            parent.createEl('p', {
                text: display(
                    `published_as: ${typeof note.meta.published_as === 'string' ? note.meta.published_as : JSON.stringify(note.meta.published_as)}`
                )
            });
        }
        for (const path of note.published) this.link(parent, path);
        for (const [label, paths] of [
            [t('Verlinkt von', 'Linked from'), note.incoming],
            [t('Literaturverweise', 'Literature references'), note.citations],
            [t('Quelle dieser Zitate', 'Source of these quotes'), note.quoteUses]
        ] as const) {
            const group = parent.createDiv({ cls: 'pf-order-use' });
            group.createEl('strong', { text: `${label} · ${paths.length}` });
            for (const path of paths.slice(0, 10)) this.link(group, path);
            if (paths.length > 10) group.createEl('small', { text: t('Weitere Verwendungen vorhanden.', 'More uses exist.') });
        }
        parent.createEl('small', {
            text: t(
                'Nur statisch erkennbare Verwendung im Prüfumfang. Externe und dynamische Verwendung bleibt ungeprüft.',
                'Only statically recognizable usage in scope. External and dynamic usage is unchecked.'
            ),
            cls: 'pf-order-muted'
        });
        for (const finding of snapshot.findings.filter(f => f.note === note)) {
            const row = parent.createDiv({ cls: 'pf-order-finding' });
            row.createEl('strong', { text: labels()[finding.rule] });
            row.createEl('p', { text: steps()[finding.rule] });
            if (finding.detail) row.createEl('small', { text: finding.detail });
            if (finding.exception) {
                row.createEl('p', { text: `${t('Bewusste Ausnahme', 'Conscious exception')}: ${finding.exception.reason}` });
            } else {
                this.button(row, t('Bewusste Ausnahme', 'Conscious exception'), () =>
                    new ExceptionModal(this.plugin, this.file, finding, snapshot, () => {
                        void this.refresh();
                    }).open()
                );
            }
        }
        parent.createEl('h3', { text: t('Funktion wählen', 'Choose function') });
        const select = parent.createEl('select', { attr: { 'aria-label': t('Neuer Notiztyp', 'New note type') } });
        select.createEl('option', { text: t('Bitte auswählen', 'Please choose'), value: '' });
        for (const definition of snapshot.registry.types) {
            select.createEl('option', { value: definition.type, text: `${definition.label} · ${definition.type}` });
        }
        select.value = snapshot.registry.types.some(d => d.type === note.type) ? note.type : '';
        const preview = parent.createDiv({ cls: 'pf-order-preview' });
        let confirmedType = '';
        const error = parent.createEl('p', { cls: 'pf-order-error', attr: { role: 'alert' } });
        const actions = parent.createDiv({ cls: 'pf-order-actions' });
        const apply = this.button(
            actions,
            t('Übernehmen', 'Apply'),
            () => {
                const file = this.plugin.app.vault.getAbstractFileByPath(note.path);
                if (!(file instanceof TFile) || !confirmedType) return;
                const typeToApply = confirmedType;
                apply.disabled = true;
                select.disabled = true;
                void careService(this.plugin)
                    .assertRegular(file.path)
                    .then(() => this.plugin.app.vault.process(file, current => applyType(current, note.content, typeToApply)))
                    .then(() => {
                        showNotice(t('Typ übernommen. Andere Felder bleiben erhalten.', 'Type applied. Other fields preserved.'));
                        return this.refresh();
                    })
                    .catch(e => {
                        error.setText(String(e instanceof Error ? e.message : e));
                        confirmedType = '';
                        select.disabled = false;
                    });
            },
            'mod-cta'
        );
        apply.disabled = true;
        const propose = () => {
            error.empty();
            preview.empty();
            confirmedType = '';
            if (!select.value || select.value === note.type) {
                apply.disabled = true;
                error.setText(t('Einen anderen Typ auswählen.', 'Choose a different type.'));
                return;
            }
            try {
                patchType(note.content, select.value);
                preview.createEl('pre').createEl('code', { text: `${note.type ? `- type: ${note.type}\n` : ''}+ type: ${select.value}` });
                preview.createEl('p', {
                    text: t(
                        'Nur type wird geändert. Inhalt, Datum, reviewed, Quellen und weitere Metadaten bleiben erhalten.',
                        'Only type changes. Content, dates, reviewed, sources and other metadata are preserved.'
                    )
                });
                confirmedType = select.value;
                apply.disabled = false;
            } catch (e) {
                error.setText(String(e instanceof Error ? e.message : e));
                apply.disabled = true;
            }
        };
        const previewButton = this.button(actions, t('Vorschau', 'Preview'), propose);
        actions.insertBefore(previewButton, apply);
        select.onchange = () => {
            confirmedType = '';
            apply.disabled = true;
            preview.empty();
        };
        const template = snapshot.registry.types.find(d => d.type === select.value)?.template;
        if (template && safePath(template)) {
            this.button(parent, t('Passende vorhandene Vorlage öffnen', 'Open existing matching template'), () => this.open(template));
        }
    }
}
export function registerVaultCare(plugin: NotebookNavigatorPlugin): void {
    plugin.registerMarkdownCodeBlockProcessor('pf-order', (_source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        if (ctx.sourcePath !== CARE_NOTE) return;
        const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
        if (file instanceof TFile) ctx.addChild(new CareView(plugin, file, el));
    });
    plugin.addCommand({
        id: 'open-vault-care',
        name: t('Pflegeübersicht und Notizwerkstatt öffnen', 'Open care overview and note workshop'),
        callback: () => {
            const file = plugin.app.vault.getAbstractFileByPath(CARE_NOTE);
            if (file instanceof TFile) {
                void plugin.app.workspace.getLeaf(false).openFile(file, { state: { mode: 'preview' }, active: true });
            } else showNotice(`${CARE_NOTE} fehlt.`);
        }
    });
}
