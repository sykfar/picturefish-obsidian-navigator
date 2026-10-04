// Citation grammar matches Picturefish Buchstudio (CF-0132); no unscoped index is consumed.
/**
 * Finds Pandoc citations in Markdown.
 *
 * Handles `[@key, S. 42]`, `[@a; @b]`, `[-@key]` and `@key` in prose, and skips
 * anything inside fenced code, inline code or an email address — a citation that
 * fires inside a code block would be a false positive in every diagnostic.
 */

interface CitationRef {
    key: string;
    /** Text after the key inside the bracket, e.g. `S. 42`. */
    locator: string;
    /** `[-@key]`: the author name is suppressed in the rendering. */
    suppressAuthor: boolean;
}

interface CitationMatch {
    /** Offset of the whole citation in the source. */
    start: number;
    end: number;
    /** Raw source text of the citation, e.g. `[@a, S. 42; @b]`. */
    raw: string;
    /** One entry per key; a bracket may hold several. */
    refs: CitationRef[];
    /** True for a bare `@key` outside brackets. */
    inline: boolean;
}

const KEY_CHARS = /[A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*/;

interface Span {
    start: number;
    end: number;
}

/** Regions the scanner must not look at: fenced code, inline code, math. */
function protectedSpans(text: string): Span[] {
    const spans: Span[] = [];

    const fence = /^(\s*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\2\s*$/gm;
    for (let match = fence.exec(text); match !== null; match = fence.exec(text)) {
        spans.push({ start: match.index, end: match.index + match[0].length });
    }

    const inline = /(`+)(?:(?!\1)[\s\S])*\1/g;
    for (let match = inline.exec(text); match !== null; match = inline.exec(text)) {
        spans.push({ start: match.index, end: match.index + match[0].length });
    }

    const math = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g;
    for (let match = math.exec(text); match !== null; match = math.exec(text)) {
        spans.push({ start: match.index, end: match.index + match[0].length });
    }

    return spans.sort((a, b) => a.start - b.start);
}

function isProtected(spans: Span[], position: number): boolean {
    for (const span of spans) {
        if (position < span.start) return false;
        if (position < span.end) return true;
    }
    return false;
}

/** Parses the inside of a bracket into refs. Returns null when it is not a citation. */
function parseBracketBody(body: string): CitationRef[] | null {
    const refs: CitationRef[] = [];

    for (const chunk of body.split(';')) {
        const part = chunk.trim();
        if (!part) continue;

        const at = part.indexOf('@');
        if (at === -1) return null;

        const prefix = part.slice(0, at).trim();
        const suppressAuthor = prefix === '-';
        // A prefix other than `-` means author-in-text or a comment; not supported yet.
        if (prefix && !suppressAuthor) return null;

        const rest = part.slice(at + 1);
        const keyMatch = rest.match(new RegExp(`^${KEY_CHARS.source}`));
        if (!keyMatch) return null;

        const key = keyMatch[0].replace(/[.,;:]+$/, '');
        const locator = rest
            .slice(key.length)
            .replace(/^[\s,]+/, '')
            .trim();
        refs.push({ key, locator, suppressAuthor });
    }

    return refs.length > 0 ? refs : null;
}

export function scanCitations(text: string): CitationMatch[] {
    const spans = protectedSpans(text);
    const matches: CitationMatch[] = [];

    // Bracketed citations first; they are the canonical form.
    for (let index = 0; index < text.length; index++) {
        if (text[index] !== '[') continue;
        if (isProtected(spans, index)) continue;

        let depth = 1;
        let cursor = index + 1;
        while (cursor < text.length && depth > 0) {
            const char = text[cursor];
            if (char === '[') depth += 1;
            else if (char === ']') depth -= 1;
            else if (char === '\n' && text[cursor + 1] === '\n') break;
            cursor += 1;
        }
        if (depth !== 0) continue;

        const raw = text.slice(index, cursor);
        const body = raw.slice(1, -1);
        if (!body.includes('@')) continue;

        // `[[wikilink]]` and `[text](url)` are not citations.
        if (text[index + 1] === '[') continue;
        if (text[cursor] === '(') continue;

        const refs = parseBracketBody(body);
        if (!refs) continue;

        matches.push({ start: index, end: cursor, raw, refs, inline: false });
        index = cursor - 1;
    }

    // Bare `@key` outside brackets, ignoring emails and anything already matched.
    const bare = new RegExp(`(^|[\\s(])@(${KEY_CHARS.source})`, 'g');
    for (let match = bare.exec(text); match !== null; match = bare.exec(text)) {
        const at = match.index + (match[1]?.length ?? 0);
        if (isProtected(spans, at)) continue;
        if (matches.some(existing => at >= existing.start && at < existing.end)) continue;

        const key = (match[2] ?? '').replace(/[.,;:]+$/, '');
        if (!key) continue;
        matches.push({
            start: at,
            end: at + key.length + 1,
            raw: `@${key}`,
            refs: [{ key, locator: '', suppressAuthor: false }],
            inline: true
        });
    }

    return matches.sort((a, b) => a.start - b.start);
}
