/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Central export point for internationalization
 * Dynamically loads the appropriate language based on Obsidian's language setting
 */
import { getLanguage } from 'obsidian';
import type { STRINGS_EN } from './locales/en';

// Type for the translation strings structure
type TranslationStrings = typeof STRINGS_EN;

// Supported Obsidian languages with Notebook Navigator translations.
//
// Obsidian-supported languages:
// ✅ ar     - Arabic
// ❌ am     - Amharic
// ❌ be     - Belarusian
// ❌ da     - Danish
// ✅ de     - German
// ✅ en     - English
// ❌ en-GB  - English (UK)
// ✅ es     - Spanish
// ✅ fa     - Persian (Farsi)
// ✅ fr     - French
// ✅ id     - Indonesian
// ✅ it     - Italian
// ✅ ja     - Japanese
// ✅ ko     - Korean
// ❌ lv     - Latvian
// ❌ ne     - Nepali
// ✅ nl     - Dutch
// ❌ no     - Norwegian
// ✅ pl     - Polish
// ✅ pt     - Portuguese
// ✅ pt-BR  - Portuguese (Brazil)
// ✅ ru     - Russian
// ❌ sq     - Albanian
// ✅ th     - Thai
// ✅ tr     - Turkish
// ✅ uk     - Ukrainian
// ✅ vi     - Vietnamese
// ✅ zh     - Chinese (Simplified)
// ✅ zh-TW  - Chinese (Traditional)
const SUPPORTED_LANGUAGES = new Set(['de', 'en']);

let englishStrings: TranslationStrings | null = null;

/* eslint-disable @typescript-eslint/no-require-imports -- Literal CommonJS requires keep locale modules bundled while deferring locale initialization. */
function getEnglishStrings(): TranslationStrings {
    if (!englishStrings) {
        englishStrings = (require('./locales/en.ts') as typeof import('./locales/en')).STRINGS_EN;
    }
    return englishStrings;
}

function loadLocaleOverrides(locale: string): TranslationStrings | undefined {
    switch (locale) {
        case 'de':
            return (require('./locales/de.ts') as typeof import('./locales/de')).STRINGS_DE;
        case 'en':
            return getEnglishStrings();
        default:
            return undefined;
    }
}
/* eslint-enable @typescript-eslint/no-require-imports -- Locale modules are loaded through literal CommonJS requires above. */

const resolvedLanguageCache = new Map<string, TranslationStrings>();

function getResolvedStrings(locale: string): TranslationStrings {
    if (locale === 'en') {
        return getEnglishStrings();
    }

    const cached = resolvedLanguageCache.get(locale);
    if (cached) {
        return cached;
    }

    const loadedLocale = loadLocaleOverrides(locale);
    if (loadedLocale) {
        resolvedLanguageCache.set(locale, loadedLocale);
        return loadedLocale;
    }

    return getEnglishStrings();
}

/**
 * Gets the current language setting from Obsidian
 */
export function getCurrentLanguage(): string {
    return getLanguage();
}

/**
 * Detects the current Obsidian language setting
 * Falls back to English if the language is not supported
 */
function getObsidianLanguage(): string {
    const locale = getCurrentLanguage();

    if (locale && SUPPORTED_LANGUAGES.has(locale)) {
        return locale;
    }

    return 'en';
}

// Export the appropriate language strings based on Obsidian's setting
export const strings: TranslationStrings = getResolvedStrings(getObsidianLanguage());

/**
 * Get the default date format for the current language
 * Uses Moment format tokens
 */
export function getDefaultDateFormat(): string {
    const localeStrings = getResolvedStrings(getObsidianLanguage());
    return localeStrings.settings.items.dateFormat.placeholder || 'MMM D, YYYY';
}

/**
 * Get the default time format for the current language
 * Uses Moment format tokens
 */
export function getDefaultTimeFormat(): string {
    const localeStrings = getResolvedStrings(getObsidianLanguage());
    return localeStrings.settings.items.timeFormat.placeholder || 'h:mm a';
}

// Retained source labels for deferred features, without bundling language downloads or colored titles.
// unused-strings keep language settings.items.colorListPaneTitle
