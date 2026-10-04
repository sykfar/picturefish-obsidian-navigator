import { expect, it } from 'vitest';
import { homeConfig, safeHomeFolder, localDate, homeHeading } from '../src/services/vaultHome/config';
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
    expect(config.modules).toHaveLength(8);
    expect(homeConfig({ limit: 1000 }).limit).toBe(5);
});
it('uses the local calendar date', () => {
    expect(localDate(new Date(2026, 9, 4, 0, 1))).toBe('2026-10-04');
});

it('uses local time for the approved greeting without changing task date comparisons', () => {
    for (const [hour, greeting] of [
        [0, 'Guten Abend'],
        [5, 'Guten Morgen'],
        [10, 'Guten Morgen'],
        [11, 'Guten Tag'],
        [17, 'Guten Tag'],
        [18, 'Guten Abend']
    ] as const) {
        const date = new Date(2026, 9, 4, hour);
        expect(homeHeading('Alexander', 'de', date)).toEqual({ date: 'Sonntag, 4. Oktober 2026', greeting: `${greeting}, Alexander.` });
        expect(localDate(date)).toBe('2026-10-04');
    }
    expect(homeHeading('', 'en', new Date(2026, 9, 4, 9)).greeting).toBe('Good morning.');
});
it('keeps personalization optional and bounds names in malformed settings', () => {
    expect(homeConfig({ name: '  Alexander  ' }).name).toBe('Alexander');
    expect(homeConfig({ name: 17 }).name).toBe('');
    expect(homeConfig({ name: 'a'.repeat(200) }).name).toHaveLength(80);
});
