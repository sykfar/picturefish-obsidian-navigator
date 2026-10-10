import { describe, expect, it } from 'vitest';
import {
    applyType,
    calendar,
    config,
    connect,
    findings,
    parseNote,
    patchType,
    registryFrom,
    safePath,
    type Registry
} from '../src/services/vaultCare/model';
const registry: Registry = {
    version: 1,
    types: [
        {
            type: 'knowledge',
            label: 'Wissen',
            family: 'Wissen',
            aliases: [],
            required: ['status', 'date|created'],
            review: true,
            evidence: true,
            entry: true,
            template: ''
        },
        {
            type: 'project-context',
            label: 'Projekt',
            family: 'Projektarbeit',
            aliases: ['project'],
            required: [],
            review: false,
            evidence: false,
            entry: false,
            template: ''
        },
        {
            type: 'buch',
            label: 'Buch',
            family: 'Quellen',
            aliases: [],
            required: ['titel', 'autor', 'lesestatus'],
            review: false,
            evidence: false,
            entry: false,
            template: ''
        }
    ]
};
const note = (path: string, fm: string, body = '') => parseNote(path, `---\n${fm}\n---\n${body}`, registry);
describe('scoped metadata care', () => {
    it('rejects root, hidden paths, traversal, restricted descendants and separators', () => {
        for (const path of [
            '',
            '/',
            '999_classified_confidential',
            '04 Ressourcen/999_classified_confidential/x.md',
            '04 Ressourcen/../x.md',
            '02 Projekte/.git/x',
            '02 Projekte/node_modules/x',
            '02 Projekte\\x',
            '02 Projekte//x'
        ])
            expect(safePath(path)).toBe(false);
        expect(safePath('02 Projekte/test/README.md')).toBe(true);
        expect(config({ roots: ['02 Projekte', '999_classified_confidential'], exceptions: [null, { path: 'bad' }] }).roots).toEqual([
            '02 Projekte'
        ]);
    });
    it('detects duplicate and malformed YAML without interpreting metadata', () => {
        const n = note('02 Projekte/x.md', 'type: knowledge\nupdated: a\nupdated: b');
        expect(n.yamlError).toContain('unique');
        expect(n.errorLine).toBe(3);
        expect(findings([n], registry, config({})).map(f => f.rule)).toEqual(['yaml']);
        expect(parseNote('02 Projekte/x.md', '---\ntype: note\nbody', registry).yamlError).toContain('---');
        expect(note('02 Projekte/x.md', '- one').yamlError).toBeTruthy();
    });
    it('keeps legacy types and applies source profiles without artificial general fields', () => {
        const old = note('02 Projekte/x.md', 'type: project');
        expect(old.family).toBe('Projektarbeit');
        expect(findings([old], registry, config({}))).toEqual([]);
        const book = note('04 Ressourcen/Bücher/x.md', 'type: buch\ntitel: Titel\nautor: Autor\nlesestatus: offen');
        expect(findings([book], registry, config({}))).toEqual([]);
        const special = note('04 Ressourcen/x.md', 'type: uncommon');
        expect(findings([special], registry, config({})).map(f => f.rule)).toEqual(['unknown']);
        expect(special.type).toBe('uncommon');
    });
    it('separates missing review from stale review and excludes inactive history and templates', () => {
        const fresh = note(
            '04 Ressourcen/a.md',
            'type: knowledge\nstatus: aktiv\ncreated: 2026-10-01\nreviewed: 2026-10-01\nevidence: [known]'
        );
        const missing = note('04 Ressourcen/b.md', 'type: knowledge\nstatus: aktiv\nreviewed: null');
        const stale = note('04 Ressourcen/c.md', 'type: knowledge\nreviewed: 2026-01-01');
        const archived = note('06 Archiv/d.md', 'type: knowledge');
        const inactive = note('04 Ressourcen/e.md', 'type: knowledge\nstatus: abgeloest');
        const template = note('Templates/x.md', 'type: knowledge\ndate: <% code %>');
        const found = findings([fresh, missing, stale, archived, inactive, template], registry, config({}), new Date(2026, 9, 4));
        expect(found.filter(f => f.rule === 'review').map(f => f.note.path)).toEqual([missing.path]);
        expect(found.filter(f => f.rule === 'stale').map(f => f.note.path)).toEqual([stale.path]);
        expect(found.filter(f => f.note === archived || f.note === template)).toEqual([]);
        expect(found.some(f => f.note === fresh && f.rule === 'fields')).toBe(false);
        expect(calendar('2026-02-30')).toBeNull();
        expect(calendar('2026-02-28')).not.toBeNull();
    });
    it('binds exceptions to content and registry version', () => {
        const n = note('01 Inbox/x.md', 'status: draft');
        const cfg = config({ exceptions: [{ path: n.path, rule: 'types', reason: 'bewusst', signature: n.signature, version: 1 }] });
        expect(findings([n], registry, cfg)[0].exception?.reason).toBe('bewusst');
        expect(findings([parseNote(n.path, n.content + '\nchanged', registry)], registry, cfg)[0].exception).toBeUndefined();
        expect(findings([n], { ...registry, version: 2 }, cfg)[0].exception).toBeUndefined();
    });
});
describe('static usage evidence', () => {
    it('distinguishes ordinary backlinks, entry points, quote sources and citations', () => {
        const source = note('04 Ressourcen/Quelle.md', 'type: buch\ncitekey: ref');
        const text = note(
            '02 Projekte/Text.md',
            'type: article\npublished_as: "[[Published]]"',
            '[[Quelle]]\n[@ref, S. 4]\nIm Sinne von @ref.'
        );
        const quote = note('04 Ressourcen/Zitat.md', 'type: zitat\nquelle: "[[Quelle]]"');
        const entry = note('02 Projekte/README.md', 'type: index', '[[Quelle]]');
        const code = note('02 Projekte/Code.md', 'type: note', '```md\n[[Quelle]] [@ref]\n```\n`[[Quelle]] [@ref]`\nmail@ref und $@ref$');
        connect([source, text, quote, entry, code]);
        expect(source.incoming).toEqual([text.path, quote.path, entry.path]);
        expect(source.entries).toEqual([entry.path]);
        expect(source.citations).toEqual([text.path]);
        expect(source.quoteUses).toEqual([quote.path]);
        connect([source, text, quote, entry, code]);
        expect(source.incoming).toHaveLength(3);
    });
    it('retains ambiguous or out of scope links as candidates without reading targets', () => {
        const a = note('02 Projekte/A/same.md', 'type: note');
        const b = note('02 Projekte/B/same.md', 'type: note');
        const source = note(
            '02 Projekte/A/x.md',
            'type: note',
            '[[same]] [[missing]] [[999_classified_confidential/secret]] [[https://example.com]]'
        );
        connect([a, b, source]);
        expect(a.incoming).toEqual([source.path]); // Local file takes precedence.
        const ambiguous = note('04 Ressourcen/x.md', 'type: note', '[[same]]');
        connect([a, b, source, ambiguous]);
        expect(ambiguous.links).toEqual(['same']);
        expect(source.links).toEqual(['missing']);
    });
    it('does not infer a citation when citekeys are ambiguous', () => {
        const a = note('04 Ressourcen/a.md', 'citekey: duplicate');
        const b = note('04 Ressourcen/b.md', 'citekey: duplicate');
        const c = note('02 Projekte/c.md', 'type: article', '[@duplicate]');
        connect([a, b, c]);
        expect(a.citations).toEqual([]);
        expect(b.citations).toEqual([]);
    });
});
describe('lossless type preview and confirmation', () => {
    it('changes only the scalar with comments, dates, unknown metadata and CRLF preserved', () => {
        const original =
            '\uFEFF---\r\ntype: old # keep\r\nreviewed: null\r\ncustom: [one, two]\r\ncoauthored_by: Human\r\n---\r\n# Body\r\n';
        expect(patchType(original, 'knowledge')).toBe(original.replace('type: old', 'type: "knowledge"'));
        expect(applyType(original, original, 'knowledge')).toBe(patchType(original, 'knowledge'));
    });
    it('inserts a type without inventing any other metadata or changing the body', () => {
        expect(patchType('---\nstatus: draft\n---\nBody', 'article')).toBe('---\ntype: "article"\nstatus: draft\n---\nBody');
        expect(patchType('Body', 'note')).toBe('---\ntype: "note"\n---\nBody');
    });
    it('handles empty type values without breaking YAML or changing another field', () => {
        for (const field of ['type:', 'type: ', 'type: null', 'type: ~', 'type: # preserve']) {
            const original = `---\n${field}\nstatus: draft\n---\nBody`;
            const patched = patchType(original, 'note');
            expect(parseNote('01 Inbox/x.md', patched, registry).type).toBe('note');
            expect(patched).toContain('\nstatus: draft\n---\nBody');
        }
    });
    it('rejects duplicate, complex, anchored and stale data without an overwrite', () => {
        for (const original of [
            '---\ntype: old\ntype: twice\n---\nBody',
            '---\ntype: [old]\n---\nBody',
            '---\ntype: &name old\n---\nBody',
            '---\ntype: |\n  old\n---\nBody'
        ])
            expect(() => patchType(original, 'knowledge')).toThrow();
        expect(() => applyType('Changed', 'Original', 'note')).toThrow('inzwischen');
        expect(() => patchType('Body', 'x\nstatus: bad')).toThrow();
    });
    it('reads the versioned Vault registry and fails closed on duplicate aliases', () => {
        const content = '---\npf_types:\n  version: 1\n  types:\n    - {type: note, family: Orientierung, aliases: [legacy]}\n---';
        expect(registryFrom(content).types[0].aliases).toEqual(['legacy']);
        expect(() => registryFrom(content.replace('aliases: [legacy]', 'aliases: [note]'))).toThrow('doppelte');
        expect(() => registryFrom('---\nstatus: aktiv\n---')).toThrow('pf_types');
    });
});
