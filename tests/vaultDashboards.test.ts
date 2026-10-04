import { expect, it } from 'vitest';
import { dashboardConfig, taskRecords, taskState, taskList, type Page } from '../src/services/vaultDashboards/model';
import { classifyBook, bookRead } from '../src/services/vaultDashboards/books';
const cfg = () => ({
    entries: [{ path: 'Dashboard/Book.md', label: 'Book', area: 'sources' }],
    favorites: ['Dashboard/Book.md', 'Dashboard/Book.md'],
    visible: ['sources'],
    sources: { tasks: ['TaskForge'], books: ['04 Ressourcen/Bücher'], activity: ['02 Projekte'], clips: ['Clippings'] }
});
it('fails closed on absent, root, hidden and unsafe sources and deduplicates only navigation paths', () => {
    expect(dashboardConfig(cfg()).favorites).toHaveLength(1);
    for (const path of [
        '',
        '/',
        '04 Ressourcen/.system',
        '04 Ressourcen/../02 Projekte',
        '999_classified_confidential',
        'TaskForge/999_classified_confidential'
    ]) {
        expect(() => dashboardConfig({ ...cfg(), sources: { ...cfg().sources, tasks: [path] } })).toThrow();
    }
    expect(() => dashboardConfig(null)).toThrow();
    expect(() => dashboardConfig({ ...cfg(), visible: [] })).toThrow();
});
it('keeps identical tasks on separate lines and ignores YAML, fenced examples and parked/completed work', () => {
    const body =
        '---\nexample: "- [ ] Not a task"\n---\n- [ ] Same 📅 2026-10-05\n- [ ] Same 📅 2026-10-05\n```md\n- [ ] Example\n```\n- [ ] Parked #status/parked 📅 2026-10-04\n- [x] Done #parked ✅ 2026-10-05\n- [ ] Later 📅 2026-10-06\n';
    const records = taskRecords('TaskForge/P.md', {}, body);
    expect(records).toHaveLength(5);
    expect(new Set(records.map(r => r.id)).size).toBe(5);
    expect(records[0].line).toBe(3);
    expect(taskList(records, 'today', new Date(2026, 9, 5, 0, 1))).toHaveLength(2);
    expect(taskList(records, 'overdue', new Date(2026, 9, 5))).toHaveLength(0);
    expect(taskList(records, 'done', new Date(2026, 9, 5))).toHaveLength(1);
    expect(taskState('done', true, 'parked')).toBe('done');
});
it('normalizes TaskNotes notes, scheduled dates, status and priorities without conflating subtasks', () => {
    const notes = taskRecords(
        'TaskNotes/N.md',
        { type: 'task', title: 'Parent', status: 'open', work_state: 'wip', scheduled: '2026-10-05', due: '2026-10-06' },
        '- [ ] Child ⏫'
    );
    expect(notes.map(t => t.id)).toEqual(['TaskNotes/N.md::note', 'TaskNotes/N.md::line:0']);
    expect(taskList(notes, 'today', new Date(2026, 9, 5))).toHaveLength(1);
    expect(taskList(notes, 'high', new Date(2026, 9, 5))).toHaveLength(1);
    expect(taskList(notes, 'undated', new Date(2026, 9, 5))).toHaveLength(1);
});
it('all book perspectives preserve explicit classifications and treat false read values as unread', () => {
    const page = {
        file: { path: '04 Ressourcen/Bücher/B.md', name: 'B', folder: '04 Ressourcen/Bücher' },
        bereich: 'Eigene Zuordnung',
        unterthema: 'Eigenes Thema',
        tags: ['leadership'],
        gelesen: 'false'
    } as Page;
    expect(classifyBook(page)).toMatchObject({ area: 'Eigene Zuordnung', topic: 'Eigenes Thema', read: false });
    expect(bookRead({ gelesen: false, lesestatus: 'gelesen' })).toBe(false);
    expect(bookRead({ gelesen: ' true ' })).toBe(true);
    expect(bookRead({ lesestatus: 'gelesen' })).toBe(true);
});

it('keeps project groups contiguous across different due dates', () => {
    const records = [
        ...taskRecords('TaskForge/A.md', { project: 'A' }, '- [ ] First 📅 2026-10-05\n- [ ] Third 📅 2026-10-07'),
        ...taskRecords('TaskForge/B.md', { project: 'B' }, '- [ ] Second 📅 2026-10-06')
    ];
    expect(taskList(records, 'projects', new Date(2026, 9, 5)).map(r => r.project)).toEqual(['A', 'A', 'B']);
});
