/*
 * Picturefish Obsidian Navigator - pure Web Resource discovery helpers.
 *
 * Discovery only returns safe candidates. It never reads HTML, performs a
 * network request, or opens a resource.
 */

import { evaluateWebResourceUrl, isLocalWebResourcePath } from './urlPolicy';

export const DEFAULT_WEB_RESOURCE_URL_PROPERTIES = ['url', 'source', 'canonical_url'] as const;

export interface LocalWebResourceCandidate {
    kind: 'local-html';
    path: string;
}

export interface ExternalWebResourceCandidate {
    kind: 'external-url';
    property: string;
    url: string;
}

export type WebResourceCandidate = LocalWebResourceCandidate | ExternalWebResourceCandidate;

/** Return a local HTML candidate for a vault path, without inspecting its contents. */
export function discoverLocalWebResource(path: string): LocalWebResourceCandidate | null {
    const normalizedPath = path.trim();
    return normalizedPath.length > 0 && isLocalWebResourcePath(normalizedPath) ? { kind: 'local-html', path: normalizedPath } : null;
}

function getStringValues(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === 'string');
    }

    return [];
}

/** Extract unique, policy-approved external URLs from configured frontmatter properties. */
export function discoverWebResourceUrls(
    properties: Record<string, unknown>,
    propertyNames: readonly string[] = DEFAULT_WEB_RESOURCE_URL_PROPERTIES
): ExternalWebResourceCandidate[] {
    const candidates: ExternalWebResourceCandidate[] = [];
    const seen = new Set<string>();

    for (const property of propertyNames) {
        for (const value of getStringValues(properties[property])) {
            const result = evaluateWebResourceUrl(value);
            if (!result.allowed || !result.normalizedUrl || seen.has(result.normalizedUrl)) {
                continue;
            }

            seen.add(result.normalizedUrl);
            candidates.push({ kind: 'external-url', property, url: result.normalizedUrl });
        }
    }

    return candidates;
}
