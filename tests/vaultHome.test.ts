import { expect, it } from 'vitest';
import { homeConfig, safeHomeFolder, localDate } from '../src/services/vaultHome/config';
it('allows explicit safe folders and rejects root, traversal and restricted sources', () => {
    expect(safeHomeFolder('04 Ressourcen/Zeitschriften')).toBe(true);
    for (const path of [
        '',
        '/',
        '04 Ressourcen/../01 Kontext',
        '04 Ressourcen//',
        '999_classified_confidential',
        '04 Ressourcen/999_classified_confidential'
    ])
        expect(safeHomeFolder(path)).toBe(false);
});
it('keeps chosen order and disabled/empty modules and sanitizes malformed input', () => {
    const config = homeConfig({
        limit: 10,
        density: 'compact',
        modules: [
            { id: 'reading', enabled: true, folders: [] },
            { id: 'tasks', enabled: false, folders: ['02 Projekte'] },
            { id: 'reading' },
            { id: 'unknown' }
        ]
    });
    expect(config.modules[0]).toEqual({ id: 'reading', enabled: true, folders: [] });
    expect(config.modules[1].enabled).toBe(false);
    expect(config.modules).toHaveLength(6);
    expect(homeConfig({ limit: 1000 }).limit).toBe(5);
});
it('uses the local calendar date', () => {
    expect(localDate(new Date(2026, 9, 4, 0, 1))).toBe('2026-10-04');
});
