import { safePath } from '../vaultCare/model';
import { localDate } from '../vaultHome/config';

export const DASHBOARD_NOTE = 'Dashboard/Dashboards.md';
export const GROUPS = [
    { id: 'projects', label: 'Projekte & Produkte', question: 'Was läuft, was hängt zusammen, was wurde geliefert?' },
    { id: 'tasks', label: 'Aufgaben', question: 'Was ist fällig, in Arbeit oder bewusst geparkt?' },
    { id: 'sources', label: 'Wissen & Quellen', question: 'Welches Material kann ich lesen, verbinden und zitieren?' },
    { id: 'publish', label: 'Publizieren', question: 'Was ist geplant, veröffentlicht und ausgewertet?' },
    { id: 'personal', label: 'Persönlich', question: 'Was möchte ich im persönlichen Bereich verfolgen?' },
    { id: 'care', label: 'Vault & Pflege', question: 'Wo fehlen Angaben, Belege oder geprüfte Zusammenhänge?' }
] as const;
export type Scope = 'tasks' | 'books' | 'activity' | 'clips';
export interface DashboardEntry {
    path: string;
    label: string;
    area: string;
    source: string;
    legacy: boolean;
    lead: boolean;
    stand: string;
}
export interface DashboardConfig {
    entries: DashboardEntry[];
    favorites: string[];
    visible: string[];
    sources: Record<Scope, string[]>;
}
export interface Page extends Record<string, unknown> {
    file: { path: string; name: string; folder: string; tasks?: unknown; [key: string]: unknown };
}
export interface TaskRecord {
    id: string;
    text: string;
    path: string;
    line?: number;
    due: string;
    scheduled: string;
    doneDate: string;
    completed: boolean;
    done: boolean;
    parked: boolean;
    status: string;
    workState: string;
    project: string;
    priority: string;
    links: string;
    recurring: boolean;
    /** Tagged `#an/ki`: work for an AI system, hidden from Alexander's default view. */
    forAi: boolean;
}
export type TaskAudience = 'ich' | 'ki' | 'alle';
/** `#an/ki` exactly; `#ki` or `#an/kinderbuch` are topics, not assignments. */
const AI_TAG = /(?:^|\s)#an\/ki(?=$|[\s,.;:!?)\]])/i;
export function byAudience(records: TaskRecord[], audience: TaskAudience): TaskRecord[] {
    return audience === 'alle' ? records : records.filter(r => r.forAi === (audience === 'ki'));
}
export function dashboardConfig(raw: unknown): DashboardConfig {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('pf_dashboards fehlt.');
    const r = raw as Record<string, unknown>;
    const entries: DashboardEntry[] = [];
    const paths = new Set<string>();
    for (const v of Array.isArray(r.entries) ? r.entries : []) {
        if (!v || typeof v !== 'object') continue;
        const e = v as Record<string, unknown>;
        if (
            typeof e.path !== 'string' ||
            !safePath(e.path) ||
            !e.path.startsWith('Dashboard/') ||
            !e.path.endsWith('.md') ||
            paths.has(e.path)
        ) {
            continue;
        }
        if (!GROUPS.some(g => g.id === e.area)) continue;
        paths.add(e.path);
        entries.push({
            path: e.path,
            label: (scalar(e.label) || e.path).slice(0, 120),
            area: String(e.area),
            source: scalar(e.source),
            legacy: e.legacy === true,
            lead: e.lead === true,
            stand: scalar(e.stand)
        });
    }
    if (!entries.length) throw new Error('Dashboard-Verzeichnis enthält keine gültigen Ansichten.');
    const list = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);
    const sources = {} as Record<Scope, string[]>;
    const rawSources = r.sources && typeof r.sources === 'object' ? (r.sources as Record<string, unknown>) : {};
    for (const scope of ['tasks', 'books', 'activity', 'clips'] as const) {
        const input = list(rawSources[scope]);
        if (!input.length || input.some(p => !safePath(p) || p.endsWith('.md'))) throw new Error(`Quellenbereich prüfen: ${scope}`);
        sources[scope] = input;
    }
    const visible = list(r.visible).filter(id => GROUPS.some(g => g.id === id));
    if (!visible.length) throw new Error('Mindestens einen Dashboard-Bereich wählen.');
    return { entries, favorites: list(r.favorites).filter(p => paths.has(p)), visible, sources };
}
const scalar = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
export function taskState(status: unknown, completed: boolean, state: unknown): string {
    if (completed || ['done', 'completed', 'erledigt', 'abgeschlossen', 'cancelled', 'canceled'].includes(scalar(status).toLowerCase())) {
        return 'done';
    }
    const s = scalar(state ?? status).toLowerCase();
    return ['parked', 'someday', 'geparkt'].includes(s)
        ? 'parked'
        : ['in-progress', 'in progress', 'progress', 'wip', 'in-arbeit'].includes(s)
          ? 'wip'
          : 'backlog';
}
export function taskRecords(path: string, meta: Record<string, unknown>, body: string): TaskRecord[] {
    const projectRaw = meta.projects ?? meta.project;
    const first: unknown = Array.isArray(projectRaw) ? projectRaw[0] : projectRaw;
    const project =
        first && typeof first === 'object' && 'path' in first
            ? String(first.path)
            : scalar(first) || path.split('/').slice(-2, -1)[0] || 'ohne Projekt';
    const base = {
        path,
        project,
        links: [meta.related, meta.use_cases, meta.custom_functions].flat().map(scalar).filter(Boolean).join(' · ')
    };
    const result: TaskRecord[] = [];
    const date = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}$/.test(scalar(v).slice(0, 10)) ? scalar(v).slice(0, 10) : '');
    if (meta.type === 'task' || meta.taskSourceType === 'taskNotes') {
        const state = taskState(meta.status, false, meta.work_state ?? meta.kanban_state);
        result.push({
            ...base,
            id: `${path}::note`,
            text: scalar(meta.title ?? meta.titel) || (path.split('/').pop() ?? path).replace(/\.md$/, ''),
            due: date(meta.due),
            scheduled: date(meta.scheduled),
            doneDate: date(meta.completed ?? meta.completion),
            completed: state === 'done',
            done: state === 'done',
            parked: state === 'parked',
            status: state === 'done' ? 'done' : 'open',
            workState: state,
            priority: scalar(meta.priority) || 'normal',
            recurring: Boolean(meta.recurrence),
            forAi: [meta.tags].flat().some(tag => scalar(tag).replace(/^#/, '').toLowerCase() === 'an/ki')
        });
    }
    let fence = '';
    let frontmatter = body.startsWith('---\n') || body.startsWith('---\r\n');
    body.split(/\r?\n/).forEach((line, index) => {
        if (frontmatter) {
            if (index && /^---\s*$/.test(line)) frontmatter = false;
            return;
        }
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
        if (marker) {
            if (!fence) fence = marker;
            else if (marker[0] === fence[0] && marker.length >= fence.length) fence = '';
            return;
        }
        if (fence) return;
        const match = /^\s*(?:[-*+]|\d+\.)\s+\[([^\]])\]\s+(.+)$/.exec(line);
        if (!match) return;
        const done = /[xX-]/.test(match[1]);
        const state = taskState(
            done ? 'done' : 'open',
            done,
            /#(?:status\/)?(?:parked|someday)\b/i.test(match[2])
                ? 'parked'
                : /#(?:status\/)?(?:wip|in-progress)\b/i.test(match[2])
                  ? 'wip'
                  : undefined
        );
        const stamp = (icon: string, key: string) =>
            new RegExp(`(?:${icon}|\\[?${key}::?)\\s*(\\d{4}-\\d{2}-\\d{2})`).exec(line)?.[1] ?? '';
        result.push({
            ...base,
            id: `${path}::line:${index}`,
            line: index,
            text: match[2],
            due: stamp('📅', 'due'),
            scheduled: stamp('⏳', 'scheduled'),
            doneDate: stamp('✅', 'completion'),
            completed: done,
            done,
            parked: state === 'parked',
            status: done ? 'done' : 'open',
            workState: state,
            priority: /⏫/.test(line) ? 'highest' : /🔼/.test(line) ? 'high' : scalar(meta.priority) || 'normal',
            recurring: /🔁|\brepeat::?/.test(line),
            forAi: AI_TAG.test(match[2])
        });
    });
    return result;
}
export function taskList(records: TaskRecord[], mode: string, now = new Date()): TaskRecord[] {
    const today = localDate(now);
    const week = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
    const threeDays = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3));
    return records
        .filter(r => (mode === 'done' ? r.done && r.doneDate >= threeDays : !r.done && !r.parked))
        .filter(r => {
            switch (mode) {
                case 'today':
                    return r.due === today || r.scheduled === today;
                case 'overdue':
                    return !!r.due && r.due < today;
                case 'week':
                    return !!r.due && r.due >= today && r.due < week;
                case 'focus':
                    return (!!r.due && r.due <= today) || r.priority === 'highest';
                case 'high':
                    return ['highest', 'high', '1', '2'].includes(r.priority);
                case 'undated':
                    return !r.due;
                case 'recurring':
                    return r.recurring;
                case 'home':
                    return !r.due || r.due <= today || r.scheduled === today;
                default:
                    return true;
            }
        })
        .sort(
            (a, b) =>
                (mode === 'projects' ? a.project.localeCompare(b.project) : 0) ||
                (a.due || '9999').localeCompare(b.due || '9999') ||
                a.path.localeCompare(b.path) ||
                (a.line ?? -1) - (b.line ?? -1)
        );
}
