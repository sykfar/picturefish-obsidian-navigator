/* Picturefish Obsidian Navigator, 2026. GPL-3.0-or-later. */

/** A user-supplied title is a basename, never a path. Do not silently rewrite it. */
export function isValidNewNoteTitle(title: string): boolean {
    const value = title.trim();
    return (
        value.length > 0 &&
        value !== '.' &&
        value !== '..' &&
        !/[\\/:*?"<>|]/u.test(value) &&
        Array.from(value).every(character => character.charCodeAt(0) >= 32)
    );
}

export function newNotePath(folder: string, title: string): string {
    const prefix = folder === '/' ? '' : folder.replace(/\/$/u, '');
    return `${prefix ? `${prefix}/` : ''}${title.trim()}.md`;
}
