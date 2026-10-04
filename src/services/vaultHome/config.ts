/** The home note is the only configuration source. */
export const MODULES = ['tasks', 'recent', 'projects', 'inbox', 'reading', 'freshness', 'loose'] as const;
export type ModuleId = (typeof MODULES)[number];
export interface HomeModule {
    id: ModuleId;
    enabled: boolean;
    folders: string[];
}
export interface HomeConfig {
    name: string;
    limit: number;
    density: 'standard' | 'compact';
    modules: HomeModule[];
}
const defaults: Record<ModuleId, string[]> = {
    tasks: ['05 Daily Notes', '02 Projekte'],
    recent: ['02 Projekte', '01 Inbox'],
    projects: ['02 Projekte'],
    inbox: ['01 Inbox'],
    reading: ['04 Ressourcen/Bücher', '04 Ressourcen/Zeitschriften'],
    freshness: ['02 Projekte', '04 Ressourcen/Software-Entwicklung'],
    loose: []
};
export function safeHomeFolder(path: string): boolean {
    const parts = path.split('/');
    return (
        ['01 Inbox', '02 Projekte', '03 Bereiche', '04 Ressourcen', '05 Daily Notes', 'Dashboard'].includes(parts[0]) &&
        !parts.some(part => !part || part === '.' || part === '..' || part === '999_classified_confidential')
    );
}
export function homeConfig(raw: unknown): HomeConfig {
    const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const input = Array.isArray(data.modules) ? data.modules : MODULES.map(id => ({ id }));
    const seen = new Set<string>();
    const modules: HomeModule[] = [];
    for (const value of input) {
        if (!value || typeof value !== 'object') continue;
        const module = value as Record<string, unknown>;
        const id = module.id as ModuleId;
        if (!MODULES.includes(id) || seen.has(id)) continue;
        seen.add(id);
        const folders = Array.isArray(module.folders)
            ? module.folders.filter((folder): folder is string => typeof folder === 'string' && safeHomeFolder(folder))
            : [...defaults[id]];
        modules.push({ id, enabled: module.enabled !== false, folders });
    }
    for (const id of MODULES) if (!seen.has(id)) modules.push({ id, enabled: false, folders: [...defaults[id]] });
    return {
        name: typeof data.name === 'string' ? data.name.trim().slice(0, 80) : '',
        limit: [3, 5, 10].includes(Number(data.limit)) ? Number(data.limit) : 5,
        density: data.density === 'compact' ? 'compact' : 'standard',
        modules
    };
}
export function localDate(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Presentation uses local time; task due dates keep the ISO calendar helper. */
export function homeHeading(name: string, language: string, date = new Date()): { date: string; greeting: string } {
    const hour = date.getHours();
    const german = language === 'de';
    const greeting = german
        ? hour >= 5 && hour < 11
            ? 'Guten Morgen'
            : hour >= 11 && hour < 18
              ? 'Guten Tag'
              : 'Guten Abend'
        : hour >= 5 && hour < 11
          ? 'Good morning'
          : hour >= 11 && hour < 18
            ? 'Good afternoon'
            : 'Good evening';
    return {
        date: date.toLocaleDateString(german ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        greeting: `${greeting}${name ? `, ${name}` : ''}.`
    };
}
