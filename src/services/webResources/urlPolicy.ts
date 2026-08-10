/*
 * Picturefish Obsidian Navigator - security policy for web resources.
 *
 * This module deliberately has no Obsidian, DOM, or network dependencies. Keep
 * URL validation here so every future Web Resource action can share the same
 * deny-by-default behavior.
 */

export type WebResourceUrlRejection =
    'empty' | 'control-character' | 'invalid-url' | 'unsupported-protocol' | 'missing-host' | 'embedded-credentials';

export interface WebResourceUrlPolicyResult {
    allowed: boolean;
    normalizedUrl: string | null;
    rejection: WebResourceUrlRejection | null;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const BLOCKED_PROTOCOLS = new Set(['data:', 'javascript:', 'vbscript:']);

function rejected(rejection: WebResourceUrlRejection): WebResourceUrlPolicyResult {
    return { allowed: false, normalizedUrl: null, rejection };
}

/** Validate an external web URL without performing any network access. */
export function evaluateWebResourceUrl(value: string): WebResourceUrlPolicyResult {
    const candidate = value.trim();
    if (candidate.length === 0) {
        return rejected('empty');
    }

    if (
        [...candidate].some(character => {
            const code = character.charCodeAt(0);
            return code <= 0x1f || code === 0x7f;
        })
    ) {
        return rejected('control-character');
    }

    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return rejected('invalid-url');
    }

    const protocol = parsed.protocol.toLowerCase();
    if (BLOCKED_PROTOCOLS.has(protocol) || !ALLOWED_PROTOCOLS.has(protocol)) {
        return rejected('unsupported-protocol');
    }

    if (parsed.hostname.length === 0) {
        return rejected('missing-host');
    }

    if (parsed.username.length > 0 || parsed.password.length > 0) {
        return rejected('embedded-credentials');
    }

    return { allowed: true, normalizedUrl: parsed.toString(), rejection: null };
}

/** Identify local HTML documents without reading or executing their contents. */
export function isLocalWebResourcePath(path: string): boolean {
    return /\.html?$/iu.test(path.trim());
}
