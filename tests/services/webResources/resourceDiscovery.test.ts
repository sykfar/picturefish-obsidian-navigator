import { describe, expect, it } from 'vitest';
import { discoverLocalWebResource, discoverWebResourceUrls } from '../../../src/services/webResources/resourceDiscovery';

describe('discoverLocalWebResource', () => {
    it('returns a candidate for local HTML documents', () => {
        expect(discoverLocalWebResource(' Research/Export.HTML ')).toEqual({
            kind: 'local-html',
            path: 'Research/Export.HTML'
        });
    });

    it('does not classify Markdown or empty paths as web resources', () => {
        expect(discoverLocalWebResource('Research/Note.md')).toBeNull();
        expect(discoverLocalWebResource('   ')).toBeNull();
    });
});

describe('discoverWebResourceUrls', () => {
    it('extracts normalized URLs from strings and string arrays', () => {
        expect(
            discoverWebResourceUrls({
                url: ' https://Example.com/research ',
                source: ['https://example.com/research', 'https://example.org/source'],
                canonical_url: 'https://example.net/canonical'
            })
        ).toEqual([
            { kind: 'external-url', property: 'url', url: 'https://example.com/research' },
            { kind: 'external-url', property: 'source', url: 'https://example.org/source' },
            { kind: 'external-url', property: 'canonical_url', url: 'https://example.net/canonical' }
        ]);
    });

    it('filters unsupported URLs, non-string values, and unconfigured properties', () => {
        expect(
            discoverWebResourceUrls(
                {
                    url: 'javascript:alert(1)',
                    source: { href: 'https://example.com' },
                    unrelated: 'https://ignored.example'
                },
                ['url', 'source']
            )
        ).toEqual([]);
    });

    it('supports an explicit property allowlist and de-duplicates normalized URLs', () => {
        expect(discoverWebResourceUrls({ reference: ['https://EXAMPLE.com', 'https://example.com/'] }, ['reference'])).toEqual([
            { kind: 'external-url', property: 'reference', url: 'https://example.com/' }
        ]);
    });
});
