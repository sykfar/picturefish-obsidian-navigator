import { scanCitations } from './citations';
import { isMap, isScalar, LineCounter, parseDocument } from 'yaml';

export const CARE_NOTE = 'Dashboard/Lose Enden.md';
export const REGISTRY_NOTE = '04 Ressourcen/Software-Entwicklung/Notiztypen und Prüfprofile.md';
const ROOTS = [
    '01 Kontext',
    '01 Inbox',
    '02 Projekte',
    '03 Bereiche',
    '04 Ressourcen',
    '05 Daily Notes',
    '06 Archiv',
    '07 Anhänge',
    'Dashboard',
    'Templates',
    '99 published',
    '99 linkedIn',
    'Clippings',
    'TaskForge',
    'TaskNotes',
    'Salerno',
    'RIS'
];
export const ISSUES = ['types', 'yaml', 'review', 'stale', 'evidence', 'entry', 'inbox', 'links', 'unknown', 'fields'] as const;
export type Issue = (typeof ISSUES)[number];
export interface Definition {
    type: string;
    label: string;
    family: string;
    required: string[];
    aliases: string[];
    review: boolean;
    evidence: boolean;
    entry: boolean;
    template: string;
}
export interface Registry {
    version: number;
    types: Definition[];
}
export interface Exception {
    path: string;
    rule: Issue;
    reason: string;
    signature: string;
    version: number;
}
export interface CareConfig {
    roots: string[];
    archive: boolean;
    families: string[];
    issues: Issue[];
    inboxDays: number;
    reviewDays: number;
    pageSize: number;
    density: 'inherit' | 'compact';
    exceptions: Exception[];
}
export interface Note {
    path: string;
    content: string;
    signature: string;
    meta: Record<string, unknown>;
    body: string;
    yamlError: string;
    errorLine: number;
    type: string;
    family: string;
    definition?: Definition;
    incoming: string[];
    entries: string[];
    citations: string[];
    published: string[];
    sources: string[];
    quoteUses: string[];
    links: string[];
}
export interface Finding {
    note: Note;
    rule: Issue;
    severity: 'error' | 'hint' | 'candidate';
    detail: string;
    exception?: Exception;
}
export const value = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
export function safePath(path: string): boolean {
    if (path === 'CLAUDE.md' || path === 'README.md') return true;
    const parts = path.split('/');
    return (
        ROOTS.includes(parts[0]) &&
        !parts.some(
            p =>
                !p ||
                p === '.' ||
                p === '..' ||
                p.startsWith('.') ||
                p === 'node_modules' ||
                p === '999_classified_confidential' ||
                p.includes('\\')
        )
    );
}
export function config(raw: unknown): CareConfig {
    const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const bounded = (v: unknown, fallback: number) => (Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 3650 ? Number(v) : fallback);
    return {
        roots: Array.isArray(data.roots)
            ? [...new Set(data.roots.filter((v): v is string => typeof v === 'string' && safePath(v)))]
            : [...ROOTS, 'CLAUDE.md', 'README.md'],
        archive: data.archive === true,
        families: Array.isArray(data.families) ? data.families.filter((v): v is string => typeof v === 'string') : [],
        issues: Array.isArray(data.issues) ? data.issues.filter((v): v is Issue => ISSUES.includes(v as Issue)) : [...ISSUES],
        inboxDays: bounded(data.inboxDays, 30),
        reviewDays: bounded(data.reviewDays, 90),
        pageSize: [10, 25, 50].includes(Number(data.pageSize)) ? Number(data.pageSize) : 25,
        density: data.density === 'compact' ? 'compact' : 'inherit',
        exceptions: Array.isArray(data.exceptions)
            ? data.exceptions.filter((input: unknown): input is Exception => {
                  if (!input || typeof input !== 'object') return false;
                  const v = input as Record<string, unknown>;
                  return (
                      typeof v.path === 'string' &&
                      safePath(v.path) &&
                      ISSUES.includes(v.rule as Issue) &&
                      typeof v.reason === 'string' &&
                      !!v.reason.trim() &&
                      typeof v.signature === 'string' &&
                      typeof v.version === 'number'
                  );
              })
            : []
    };
}
function frontmatter(content: string): { yaml: string; start: number; end: number } | null {
    const open = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(content);
    if (!open) return null;
    const close = /^---[ \t]*\r?$/m.exec(content.slice(open[0].length));
    if (!close) throw new Error('Frontmatter: abschließendes --- fehlt.');
    return {
        yaml: content.slice(open[0].length, open[0].length + close.index),
        start: open[0].length,
        end: open[0].length + close.index + close[0].length
    };
}
function signature(content: string): string {
    // Two independent hashes and length bind a conscious exception to this exact revision.
    let a = 2166136261,
        b = 5381;
    for (let i = 0; i < content.length; i++) {
        a = Math.imul(a ^ content.charCodeAt(i), 16777619);
        b = Math.imul(b, 33) ^ content.charCodeAt(i);
    }
    return `${content.length}:${a >>> 0}:${b >>> 0}`;
}
export function parseNote(path: string, content: string, registry: Registry): Note {
    const note: Note = {
        path,
        content,
        signature: signature(content),
        meta: {},
        body: content,
        yamlError: '',
        errorLine: 0,
        type: '',
        family: 'Ungeklärt',
        incoming: [],
        entries: [],
        citations: [],
        published: [],
        sources: [],
        quoteUses: [],
        links: []
    };
    try {
        const fm = frontmatter(content);
        if (fm) {
            const lines = new LineCounter();
            const doc = parseDocument(fm.yaml, { uniqueKeys: true, lineCounter: lines, prettyErrors: false });
            if (doc.errors.length) {
                note.errorLine = lines.linePos(doc.errors[0].pos[0]).line; // Opening fence adds one; editor positions are zero based.
                throw new Error(doc.errors[0].message);
            }
            if (!isMap(doc.contents)) throw new Error('Frontmatter muss eine Zuordnung aus Feldern und Werten sein.');
            note.meta = doc.toJS() as Record<string, unknown>;
            note.body = content.slice(fm.end);
        }
        note.type = value(note.meta.type).trim();
        note.definition = registry.types.find(t => t.type === note.type || t.aliases.includes(note.type));
        note.family = path.startsWith('Templates/') ? 'Vorlagen' : (note.definition?.family ?? 'Ungeklärt');
    } catch (e) {
        note.yamlError = e instanceof Error ? e.message : String(e);
    }
    return note;
}
export function registryFrom(content: string): Registry {
    const parsed = parseNote(REGISTRY_NOTE, content, { version: 1, types: [] });
    if (parsed.yamlError) throw new Error(`Typregister: ${parsed.yamlError}`);
    const raw = parsed.meta.pf_types as Record<string, unknown> | undefined;
    if (!raw || !Number.isInteger(raw.version) || Number(raw.version) < 1 || !Array.isArray(raw.types)) {
        throw new Error('Typregister pf_types fehlt oder ist ungültig.');
    }
    const types: Definition[] = raw.types.map((item: unknown) => {
        if (!item || typeof item !== 'object') throw new Error('Ungültiger Typ im Register.');
        const d = item as Record<string, unknown>;
        if (typeof d.type !== 'string' || !d.type || typeof d.family !== 'string') throw new Error('Typ und Familie sind erforderlich.');
        const list = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
        return {
            type: d.type,
            label: value(d.label) || d.type,
            family: d.family,
            aliases: list(d.aliases),
            required: list(d.required),
            review: d.review === true,
            evidence: d.evidence === true,
            entry: d.entry === true,
            template: value(d.template)
        };
    });
    const keys = types.flatMap(t => [t.type, ...t.aliases]);
    if (new Set(keys).size !== keys.length) throw new Error('Typregister enthält doppelte Typwerte oder Aliase.');
    return { version: Number(raw.version), types };
}
function stripped(body: string): string {
    let fence = '';
    return body
        .split('\n')
        .map(line => {
            const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
            if (marker) {
                if (!fence) fence = marker[1][0];
                else if (fence === marker[1][0]) fence = '';
                return '';
            }
            return fence ? '' : line.replace(/(`+)[\s\S]*?\1/g, '');
        })
        .join('\n');
}
function refs(text: string): string[] {
    const wiki = [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map(m => m[1]);
    const markdown = [...text.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"\n]*")?\)/g)].map(m => m[1]);
    return [...wiki, ...markdown].filter(p => !/^[a-z][a-z\d+.-]*:/i.test(p) && !p.includes('999_classified_confidential'));
}
function metaText(v: unknown): string {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(metaText).join('\n');
    if (v && typeof v === 'object') return Object.values(v).map(metaText).join('\n');
    return '';
}
export function connect(notes: Note[]): void {
    const names = new Map<string, Note[]>();
    const add = (key: string, n: Note) => {
        const list = names.get(key) ?? [];
        if (!list.includes(n)) list.push(n);
        names.set(key, list);
    };
    for (const n of notes) {
        add(n.path.replace(/\.md$/i, ''), n);
        add((n.path.split('/').pop() ?? '').replace(/\.md$/i, ''), n);
        const aliases = n.meta.aliases;
        for (const alias of Array.isArray(aliases) ? aliases : typeof aliases === 'string' ? [aliases] : []) {
            if (typeof alias === 'string') add(alias, n);
        }
        n.incoming = [];
        n.entries = [];
        n.citations = [];
        n.published = [];
        n.sources = [];
        n.quoteUses = [];
        n.links = [];
    }
    const resolve = (raw: string, origin: string): Note | undefined => {
        let target: string;
        try {
            target = decodeURIComponent(raw.split('#')[0]).replace(/\.md$/i, '');
        } catch {
            return;
        }
        if (!target || target.includes('999_classified_confidential') || target.startsWith('/') || target.includes('\\')) return;
        const normalized: string[] = origin.split('/').slice(0, -1);
        for (const part of target.split('/')) {
            if (part === '..') normalized.pop();
            else if (part !== '.') normalized.push(part);
        }
        const relative = normalized.join('/');
        const exact = names.get(relative) ?? names.get(target);
        return exact?.length === 1 ? exact[0] : undefined;
    };
    const citeKeys = new Map<string, Note[]>();
    for (const n of notes) {
        const key = value(n.meta.citekey);
        if (key) {
            const list = citeKeys.get(key) ?? [];
            list.push(n);
            citeKeys.set(key, list);
        }
    }
    for (const source of notes) {
        if (source.yamlError || source.path.startsWith('Templates/')) continue;
        const clean = stripped(source.body);
        for (const ref of refs(`${clean}\n${metaText(source.meta)}`)) {
            const target = resolve(ref, source.path);
            if (!target) {
                if (!source.links.includes(ref)) source.links.push(ref);
                continue;
            }
            if (target === source) continue;
            if (!target.incoming.includes(source.path)) target.incoming.push(source.path);
            if (/(?:^|\/)(README|CLAUDE|Offene Punkte)\.md$/.test(source.path) || source.path.startsWith('Dashboard/')) {
                if (!target.entries.includes(source.path)) target.entries.push(source.path);
            }
        }
        for (const [field, results] of [
            ['published_as', source.published],
            ['quelle', source.sources],
            ['evidence', source.sources],
            ['sources', source.sources]
        ] as const) {
            for (const ref of refs(metaText(source.meta[field]))) {
                const target = resolve(ref, source.path);
                if (target && !results.includes(target.path)) results.push(target.path);
            }
        }
        if (source.type === 'zitat') {
            for (const ref of refs(metaText(source.meta.quelle))) {
                const target = resolve(ref, source.path);
                if (target && !target.quoteUses.includes(source.path)) target.quoteUses.push(source.path);
            }
        }
        for (const match of scanCitations(source.body)) {
            for (const ref of match.refs) {
                const targets = citeKeys.get(ref.key);
                if (targets?.length !== 1 && !source.links.includes(`@${ref.key}`)) source.links.push(`@${ref.key}`);
                if (targets?.length === 1 && !targets[0].citations.includes(source.path)) targets[0].citations.push(source.path);
            }
        }
    }
}
export function calendar(value: unknown): number | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === 'string' ? value : '');
    if (!match) return null;
    const y = Number(match[1]),
        m = Number(match[2]),
        d = Number(match[3]);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.getTime() : null;
}
function present(v: unknown): boolean {
    return Array.isArray(v) ? v.some(present) : v !== null && v !== undefined && v !== '';
}
export function findings(notes: Note[], registry: Registry, cfg: CareConfig, now = new Date()): Finding[] {
    const result: Finding[] = [];
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    for (const note of notes) {
        if (
            note.path.startsWith('Templates/') ||
            (!cfg.archive && note.path.startsWith('06 Archiv/')) ||
            (cfg.families.length && !cfg.families.includes(note.family))
        ) {
            continue;
        }
        const add = (rule: Issue, severity: Finding['severity'], detail = '') => {
            if (!cfg.issues.includes(rule)) return;
            const exception = cfg.exceptions.find(
                e => e.path === note.path && e.rule === rule && e.signature === note.signature && e.version === registry.version
            );
            result.push({ note, rule, severity, detail, exception });
        };
        if (note.yamlError) {
            add('yaml', 'error', note.yamlError);
            continue;
        }
        if (!note.type) add('types', 'hint');
        else if (!note.definition) add('unknown', 'hint', note.type);
        const definition = note.definition;
        if (definition) {
            const missing = definition.required.filter(field => !field.split('|').some(f => present(note.meta[f])));
            if (
                definition.required.some(field => field.split('|').some(f => f === 'date' || f === 'created')) &&
                present(note.meta.date ?? note.meta.created) &&
                calendar(note.meta.date ?? note.meta.created) === null
            ) {
                missing.push('date/created: ISO-Datum prüfen');
            }
            if (missing.length) add('fields', 'hint', missing.join(', '));
            const historical =
                ['abgeloest', 'abgeschlossen', 'deprecated', 'superseded'].includes(value(note.meta.status)) ||
                present(note.meta.superseded_by);
            if (!historical) {
                if (definition.review) {
                    const date = calendar(note.meta.reviewed);
                    if (date === null || date > today) add('review', 'hint', present(note.meta.reviewed) ? 'Ungültiges Prüfdatum' : '');
                    else if (today - date > cfg.reviewDays * 86400000) add('stale', 'hint');
                }
                if (definition.evidence && !present(note.meta.evidence)) add('evidence', 'hint');
                if (definition.entry && !note.entries.length) add('entry', 'candidate');
            }
        }
        if (note.path.startsWith('01 Inbox/')) {
            const date = calendar(note.meta.date ?? note.meta.created);
            if (date === null) add('fields', 'hint', 'Inbox-Alter ungeklärt: date/created fehlt oder ist ungültig.');
            if (date !== null && today - date > cfg.inboxDays * 86400000) add('inbox', 'hint');
        }
        if (note.links.length) add('links', 'candidate', note.links.slice(0, 5).join(', '));
    }
    return result;
}
/** Lossless type-only change. Content review, dates and unrelated fields stay untouched. */
export function patchType(content: string, type: string): string {
    if (!/^[\p{L}\p{N}][\p{L}\p{N}_ -]*$/u.test(type)) throw new Error('Ungültiger Typwert.');
    const fm = frontmatter(content);
    const newline = content.includes('\r\n') ? '\r\n' : '\n';
    if (!fm) {
        const bom = content.startsWith('\uFEFF') ? '\uFEFF' : '';
        return `${bom}---${newline}type: ${JSON.stringify(type)}${newline}---${newline}${content.slice(bom.length)}`;
    }
    const doc = parseDocument(fm.yaml, { uniqueKeys: true });
    if (doc.errors.length || !isMap(doc.contents)) throw new Error('YAML zuerst im Quelltext korrigieren.');
    const pair = doc.contents.items.find(p => isScalar(p.key) && p.key.value === 'type');
    if (!pair) return `${content.slice(0, fm.start)}type: ${JSON.stringify(type)}${newline}${content.slice(fm.start)}`;
    if (
        !isScalar(pair.value) ||
        !pair.value.range ||
        pair.value.type === 'BLOCK_LITERAL' ||
        pair.value.type === 'BLOCK_FOLDED' ||
        pair.value.anchor ||
        pair.value.tag
    ) {
        throw new Error('Komplexes Typfeld bitte im Quelltext bearbeiten.');
    }
    const [start, end] = pair.value.range;
    const before = content.slice(0, fm.start + start);
    const after = content.slice(fm.start + end);
    return `${before}${before.endsWith(':') ? ' ' : ''}${JSON.stringify(type)}${after.startsWith('#') ? ' ' : ''}${after}`;
}
export function applyType(current: string, expected: string, type: string): string {
    if (current !== expected) throw new Error('Die Notiz wurde inzwischen geändert. Neu laden und erneut prüfen.');
    return patchType(current, type);
}
