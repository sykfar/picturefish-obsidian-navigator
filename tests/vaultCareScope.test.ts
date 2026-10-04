import { FileSystemAdapter, Platform, TFile, TFolder } from 'obsidian';
import { afterEach, expect, it, vi } from 'vitest';
import type NotebookNavigatorPlugin from '../src/main';
import { CareService } from '../src/services/vaultCare/service';
import { CARE_NOTE, REGISTRY_NOTE } from '../src/services/vaultCare/model';
afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(Platform, 'isDesktop');
});
it('never enters protected, hidden, symlinked or excluded archive directories and checks direct paths before reading', async () => {
    Reflect.set(Platform, 'isDesktop', true);
    const root = new TFolder('02 Projekte');
    const protectedFolder = new TFolder('02 Projekte/999_classified_confidential');
    const hidden = new TFolder('02 Projekte/.system');
    const linked = new TFolder('02 Projekte/linked');
    const enter = vi.fn(() => {
        throw new Error('Forbidden traversal');
    });
    for (const folder of [protectedFolder, hidden, linked]) Object.defineProperty(folder, 'children', { get: enter });
    const good = new TFile('02 Projekte/good.md');
    const big = new TFile('02 Projekte/big.md');
    Reflect.set(big.stat, 'size', 2000001);
    root.children = [protectedFolder, hidden, linked, good, big];
    const archive = new TFolder('06 Archiv');
    Object.defineProperty(archive, 'children', { get: enter });
    const files = new Map<string, TFile | TFolder>([
        [root.path, root],
        [archive.path, archive],
        [CARE_NOTE, new TFile(CARE_NOTE)],
        [REGISTRY_NOTE, new TFile(REGISTRY_NOTE)]
    ]);
    const read = vi.fn(async (file: TFile) => {
        if (file.path === CARE_NOTE) return '---\npf_order:\n  roots: [02 Projekte, 06 Archiv]\n---';
        if (file.path === REGISTRY_NOTE) return '---\npf_types:\n  version: 1\n  types: [{type: note, family: Orientierung}]\n---';
        if (file.path === good.path) return '---\ntype: note\n---\nBody';
        throw new Error('Unexpected read');
    });
    const lstat = vi.fn(async (path: string) => ({ isSymbolicLink: () => path === '/vault/02 Projekte/linked' }));
    vi.stubGlobal('window', { require: () => ({ lstat }) });
    const adapter = Object.assign(new FileSystemAdapter(), { getFullPath: (path: string) => `/vault/${path}` });
    const plugin = {
        app: { vault: { adapter, getAbstractFileByPath: (path: string) => files.get(path), read } }
    } as unknown as NotebookNavigatorPlugin;
    const service = new CareService(plugin);
    const result = await service.scan(true);
    expect(result.notes.map(n => n.path)).toEqual([good.path]);
    expect(enter).not.toHaveBeenCalled();
    expect(read.mock.calls.map(([file]) => file.path)).toEqual([CARE_NOTE, REGISTRY_NOTE, good.path]);
    expect(
        lstat.mock.calls.some(
            ([path]) => path.includes('999_classified_confidential') || path.includes('.system') || path.includes('06 Archiv')
        )
    ).toBe(false);
    expect(result.warnings.some(w => w.includes('2 MB'))).toBe(true);
    await service.scan(true);
    expect(read.mock.calls.filter(([file]) => file.path === good.path)).toHaveLength(1);
    Reflect.set(good.stat, 'mtime', 100);
    await service.scan(true);
    expect(read.mock.calls.filter(([file]) => file.path === good.path)).toHaveLength(2);
});
it('rejects a symlinked care note before reading any content', async () => {
    Reflect.set(Platform, 'isDesktop', true);
    const read = vi.fn();
    vi.stubGlobal('window', {
        require: () => ({ lstat: async (path: string) => ({ isSymbolicLink: () => path.endsWith('Lose Enden.md') }) })
    });
    const adapter = Object.assign(new FileSystemAdapter(), { getFullPath: (path: string) => `/vault/${path}` });
    const plugin = {
        app: { vault: { adapter, getAbstractFileByPath: (path: string) => new TFile(path), read } }
    } as unknown as NotebookNavigatorPlugin;
    await expect(new CareService(plugin).scan()).rejects.toThrow('reguläre');
    expect(read).not.toHaveBeenCalled();
});

it('fails closed when source configuration is missing or unsafe', async () => {
    for (const text of ['---\nstatus: aktiv\n---', '---\npf_order: {roots: [999_classified_confidential]}\n---']) {
        const read = vi.fn(async () => text);
        const plugin = {
            app: { vault: { adapter: {}, getAbstractFileByPath: (path: string) => new TFile(path), read } }
        } as unknown as NotebookNavigatorPlugin;
        await expect(new CareService(plugin).scan()).rejects.toThrow();
        expect(read).toHaveBeenCalledTimes(1);
    }
});
