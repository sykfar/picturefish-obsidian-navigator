import { describe, expect, it } from 'vitest';
import { evaluateWebResourceUrl, isLocalWebResourcePath } from '../../../src/services/webResources/urlPolicy';

describe('evaluateWebResourceUrl', () => {
    it('allows HTTPS and returns a normalized URL', () => {
        expect(evaluateWebResourceUrl(' https://Example.com/research?q=1 ')).toEqual({
            allowed: true,
            normalizedUrl: 'https://example.com/research?q=1',
            rejection: null
        });
    });

    it('allows HTTP for explicitly configured local-network resources', () => {
        expect(evaluateWebResourceUrl('http://localhost:8080/status').allowed).toBe(true);
    });

    it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///tmp/page.html'])(
        'rejects dangerous or unsupported protocol %s',
        value => {
            expect(evaluateWebResourceUrl(value)).toMatchObject({ allowed: false, rejection: 'unsupported-protocol' });
        }
    );

    it('rejects URLs with embedded credentials', () => {
        expect(evaluateWebResourceUrl('https://user:password@example.com')).toMatchObject({
            allowed: false,
            rejection: 'embedded-credentials'
        });
    });

    it('rejects malformed, empty, and control-character input', () => {
        expect(evaluateWebResourceUrl('')).toMatchObject({ allowed: false, rejection: 'empty' });
        expect(evaluateWebResourceUrl('not a URL')).toMatchObject({ allowed: false, rejection: 'invalid-url' });
        expect(evaluateWebResourceUrl('https://example.com/\nnext')).toMatchObject({
            allowed: false,
            rejection: 'control-character'
        });
        expect(evaluateWebResourceUrl('\thttps://example.com')).toMatchObject({
            allowed: false,
            rejection: 'control-character'
        });
        expect(evaluateWebResourceUrl('https://example.com\n')).toMatchObject({
            allowed: false,
            rejection: 'control-character'
        });
    });
});

describe('isLocalWebResourcePath', () => {
    it('recognizes html and htm files case-insensitively', () => {
        expect(isLocalWebResourcePath('Exports/report.html')).toBe(true);
        expect(isLocalWebResourcePath('Exports/report.HTM')).toBe(true);
    });

    it('does not classify markdown or extensionless paths as HTML', () => {
        expect(isLocalWebResourcePath('Notes/report.md')).toBe(false);
        expect(isLocalWebResourcePath('Exports/report')).toBe(false);
    });
});
