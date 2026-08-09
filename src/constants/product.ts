/*
 * Picturefish Obsidian Navigator - independent fork of Notebook Navigator
 *
 * Runtime-facing identifiers live here so upstream merges can keep the inherited
 * implementation names without sharing state or registrations with the original plugin.
 */

export const PRODUCT_ID = 'picturefish-obsidian-navigator';
export const PRODUCT_NAME = 'Picturefish Obsidian Navigator';
export const PRODUCT_REPOSITORY = 'sykfar/picturefish-obsidian-navigator';

/** Accepted only as an explicit, one-way settings import source. */
export const UPSTREAM_PLUGIN_ID = 'notebook-navigator';

export const PRODUCT_VISIBLE_EVENT = `${PRODUCT_ID}-visible`;
export const PRODUCT_STORAGE_PREFIX = PRODUCT_ID;
export const PRODUCT_DATABASE_PREFIX = 'picturefish-obsidian-navigator';

export function createProductDatabaseName(area: 'cache' | 'icons', appId: string): string {
    return `${PRODUCT_DATABASE_PREFIX}/${area}/${appId}`;
}

export function isUpstreamPluginEnabled(enabledPluginIds: ReadonlySet<string> | undefined): boolean {
    return enabledPluginIds?.has(UPSTREAM_PLUGIN_ID) === true;
}
