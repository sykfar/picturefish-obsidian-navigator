/*
 * Picturefish Obsidian Navigator - runtime namespace regression tests.
 */

import { describe, expect, it } from 'vitest';
import {
    PRODUCT_ID,
    PRODUCT_STORAGE_PREFIX,
    PRODUCT_VISIBLE_EVENT,
    UPSTREAM_PLUGIN_ID,
    createProductDatabaseName,
    isUpstreamPluginEnabled
} from '../../src/constants/product';
import {
    NOTEBOOK_NAVIGATOR_CALENDAR_VIEW,
    NOTEBOOK_NAVIGATOR_FOLDER_NOTE_SIDEBAR_VIEW,
    NOTEBOOK_NAVIGATOR_VIEW,
    STORAGE_KEYS
} from '../../src/types';

describe('Picturefish runtime identity', () => {
    it('uses a plugin id distinct from upstream', () => {
        expect(PRODUCT_ID).toBe('picturefish-obsidian-navigator');
        expect(PRODUCT_ID).not.toBe(UPSTREAM_PLUGIN_ID);
    });

    it('namespaces every registered view', () => {
        expect(NOTEBOOK_NAVIGATOR_VIEW).toBe(PRODUCT_ID);
        expect(NOTEBOOK_NAVIGATOR_CALENDAR_VIEW).toBe(`${PRODUCT_ID}-calendar`);
        expect(NOTEBOOK_NAVIGATOR_FOLDER_NOTE_SIDEBAR_VIEW).toBe(`${PRODUCT_ID}-folder-note-sidebar`);
    });

    it('namespaces every active localStorage key without reusing upstream state', () => {
        const keys = Object.values(STORAGE_KEYS);
        expect(keys.length).toBeGreaterThan(0);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys.every(key => key.startsWith(`${PRODUCT_STORAGE_PREFIX}-`))).toBe(true);
        expect(keys.some(key => key.startsWith(`${UPSTREAM_PLUGIN_ID}-`))).toBe(false);
    });

    it('uses separate cache, icon, and browser event namespaces', () => {
        expect(createProductDatabaseName('cache', 'vault-a')).toBe('picturefish-obsidian-navigator/cache/vault-a');
        expect(createProductDatabaseName('icons', 'vault-a')).toBe('picturefish-obsidian-navigator/icons/vault-a');
        expect(PRODUCT_VISIBLE_EVENT).toBe('picturefish-obsidian-navigator-visible');
    });

    it('detects simultaneous activation without mutating either plugin', () => {
        expect(isUpstreamPluginEnabled(new Set([UPSTREAM_PLUGIN_ID]))).toBe(true);
        expect(isUpstreamPluginEnabled(new Set([PRODUCT_ID]))).toBe(false);
        expect(isUpstreamPluginEnabled(undefined)).toBe(false);
    });
});
