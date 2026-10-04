import { describe, expect, it } from 'vitest';
import { isValidNewNoteTitle, newNotePath } from '../../src/utils/noteCreationPolicy';

describe('new note basename boundary', () => {
    it.each(['', ' ', '.', '..', '../outside', 'a/b', 'a\\b', 'a:b', 'a\u0000b', 'a\nb'])('rejects %j', title => {
        expect(isValidNewNoteTitle(title)).toBe(false);
    });
    it('preserves a Unicode title and resolves the vault root without a leading slash', () => {
        expect(isValidNewNoteTitle('Über Verantwortung #1')).toBe(true);
        expect(newNotePath('/', ' Über Verantwortung #1 ')).toBe('Über Verantwortung #1.md');
        expect(newNotePath('02 Projekte/Learnings', 'Eine Notiz')).toBe('02 Projekte/Learnings/Eine Notiz.md');
    });
});
