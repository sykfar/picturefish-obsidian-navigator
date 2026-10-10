import { FileSystemAdapter, Platform, TFile, TFolder } from 'obsidian';
import { afterEach, expect, it, vi } from 'vitest';
import type NotebookNavigatorPlugin from '../src/main';
import { DashboardService } from '../src/services/vaultDashboards/service';
import { DASHBOARD_NOTE } from '../src/services/vaultDashboards/model';
afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(Platform, 'isDesktop');
});
it('never traverses protected, hidden or symlinked folders and merges overlapping sources without duplicate tasks', async () => {
    Reflect.set(Platform, 'isDesktop', true);
    const root = new TFolder('TaskForge');
    const nested = new TFolder('TaskForge/P');
    const good = new TFile('TaskForge/P/T.md');
    nested.children = [good];
    const enter = vi.fn(() => {
        throw new Error('Forbidden traversal');
    });
    const blocked = ['TaskForge/999_classified_confidential', 'TaskForge/.hidden', 'TaskForge/linked'].map(p => new TFolder(p));
    blocked.forEach(f => Object.defineProperty(f, 'children', { get: enter }));
    root.children = [...blocked, nested];
    const config = {
        entries: [{ path: 'Dashboard/Tasks.md', area: 'tasks' }],
        visible: ['tasks'],
        sources: { tasks: ['TaskForge', 'TaskForge/P'], books: ['04 Ressourcen/Bücher'], activity: ['02 Projekte'], clips: ['Clippings'] }
    };
    const files = new Map([
        [root.path, root],
        [nested.path, nested],
        [DASHBOARD_NOTE, new TFile(DASHBOARD_NOTE)]
    ]);
    const read = vi.fn(async () => '- [ ] Task 📅 2026-10-05');
    const lstat = vi.fn(async (path: string) => ({ isSymbolicLink: () => path.endsWith('/linked') }));
    vi.stubGlobal('window', { require: () => ({ lstat }) });
    const adapter = Object.assign(new FileSystemAdapter(), { getFullPath: (p: string) => '/vault/' + p });
    const plugin = {
        app: {
            vault: { adapter, getAbstractFileByPath: (p: string) => files.get(p), cachedRead: read },
            metadataCache: { getFileCache: () => ({ frontmatter: { pf_dashboards: config } }) }
        }
    } as unknown as NotebookNavigatorPlugin;
    const service = new DashboardService(plugin);
    const result = await service.tasks();
    expect(result.records).toHaveLength(1);
    expect(enter).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
    expect(lstat.mock.calls.some(([p]) => p.includes('999_classified_confidential') || p.includes('.hidden'))).toBe(false);
});
it('checks direct targets before content reads and fails closed if the configuration note is linked', async () => {
    Reflect.set(Platform, 'isDesktop', true);
    const read = vi.fn();
    vi.stubGlobal('window', { require: () => ({ lstat: async () => ({ isSymbolicLink: () => true }) }) });
    const adapter = Object.assign(new FileSystemAdapter(), { getFullPath: (p: string) => '/vault/' + p });
    const plugin = {
        app: { vault: { adapter, getAbstractFileByPath: (p: string) => new TFile(p), cachedRead: read } }
    } as unknown as NotebookNavigatorPlugin;
    const service = new DashboardService(plugin);
    await expect(service.config()).rejects.toThrow();
    await expect(service.read(new TFile('TaskForge/T.md'))).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
});
