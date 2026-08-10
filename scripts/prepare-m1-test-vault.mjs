#!/usr/bin/env node

/*
 * Picturefish Obsidian Navigator - deterministic, secret-free M1 reference vault generator.
 */

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCT_ID = 'picturefish-obsidian-navigator';
const ASSET_NAMES = ['main.js', 'manifest.json', 'styles.css'];
const DEFAULT_NOTE_COUNT = 1600;
const ATTACHMENT_COUNT = 24;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

function parseArguments(argv) {
    const options = {};

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument.startsWith('--')) {
            throw new Error(`Unexpected argument: ${argument}`);
        }

        const key = argument.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) {
            throw new Error(`Missing value for --${key}`);
        }

        options[key] = value;
        index += 1;
    }

    return options;
}

function isSameOrParent(candidate, child) {
    const relative = path.relative(candidate, child);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertSafeTarget(targetDirectory) {
    const root = path.parse(targetDirectory).root;
    const homeDirectory = path.resolve(os.homedir());

    if (targetDirectory === root || targetDirectory === homeDirectory) {
        throw new Error(`Refusing unsafe target directory: ${targetDirectory}`);
    }
    if (isSameOrParent(targetDirectory, projectRoot) || isSameOrParent(projectRoot, targetDirectory)) {
        throw new Error('Reference vault must be outside the source repository.');
    }
}

async function assertEmptyOrMissing(directory) {
    try {
        const entries = await readdir(directory);
        if (entries.length > 0) {
            throw new Error(`Target directory must be empty: ${directory}`);
        }
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
}

function pad(value, width) {
    return String(value).padStart(width, '0');
}

function getFolder(index) {
    const sequence = Math.floor(index / 8) + 1;
    const variants = [
        '00 Inbox',
        `01 Projects/Project ${pad((sequence % 24) + 1, 2)}`,
        `02 Areas/${['Health', 'Finance', 'Learning', 'Operations'][sequence % 4]}`,
        `03 Resources/Topic ${pad((sequence % 16) + 1, 2)}`,
        `04 Daily/2026/${pad((sequence % 12) + 1, 2)}`,
        `05 Attachments Index/${pad((sequence % 6) + 1, 2)}`,
        `99 Archive/${2023 + (sequence % 3)}`,
        sequence % 2 === 0 ? 'Unicode/Grüße und Café/東京' : 'Long Paths/Research Programme/Deeply Nested Material/Reference Collection'
    ];

    return variants[index % variants.length];
}

function notePathFor(index) {
    const sequence = Math.floor(index / 8) + 1;
    return path.join(getFolder(index), `Reference ${pad(sequence, 4)}.md`);
}

function toVaultPath(filePath) {
    return filePath.split(path.sep).join('/');
}

function withoutMarkdownExtension(filePath) {
    return toVaultPath(filePath).replace(/\.md$/, '');
}

function createNote(index, notePaths) {
    const noteNumber = index + 1;
    const createdDay = (index % 28) + 1;
    const status = ['inbox', 'active', 'waiting', 'done'][index % 4];
    const previous = notePaths[(index - 1 + notePaths.length) % notePaths.length];
    const next = notePaths[(index + 1) % notePaths.length];
    const attachment = `07 Attachments/Synthetic Image ${pad((index % ATTACHMENT_COUNT) + 1, 2)}.svg`;

    return `---
type: synthetic-reference
status: ${status}
created: 2026-${pad((index % 12) + 1, 2)}-${pad(createdDay, 2)}
priority: ${(index % 3) + 1}
tags:
  - picturefish-test
  - ${status}
aliases:
  - Synthetic note ${noteNumber}
---

# Synthetic reference ${noteNumber}

This note contains generated, non-confidential content for Picturefish Obsidian Navigator M1 validation.

- Previous: [[${withoutMarkdownExtension(previous)}|Previous reference]]
- Next: [[${withoutMarkdownExtension(next)}|Next reference]]
- Attachment: ![[${attachment}]]

Search tokens: alpha bravo café Grüße 東京 project-${pad((index % 24) + 1, 2)}.
`;
}

function createSvg(index) {
    const hue = (index * 47) % 360;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="hsl(${hue} 55% 30%)" />
  <text x="320" y="190" text-anchor="middle" font-family="sans-serif" font-size="36" fill="white">Picturefish M1 ${pad(index, 2)}</text>
</svg>
`;
}

async function writeJson(filePath, value) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    if (!options.target) {
        throw new Error(
            'Usage: node scripts/prepare-m1-test-vault.mjs --target <empty-directory> [--assets <artifact-directory>] [--notes 1600]'
        );
    }

    const targetDirectory = path.resolve(options.target);
    const assetDirectory = path.resolve(options.assets ?? projectRoot);
    const noteCount = Number(options.notes ?? DEFAULT_NOTE_COUNT);

    if (!Number.isInteger(noteCount) || noteCount < 32 || noteCount > 5000) {
        throw new Error('--notes must be an integer between 32 and 5000.');
    }

    assertSafeTarget(targetDirectory);
    await assertEmptyOrMissing(targetDirectory);

    const manifest = JSON.parse(await readFile(path.join(assetDirectory, 'manifest.json'), 'utf8'));
    if (manifest.id !== PRODUCT_ID) {
        throw new Error(`Refusing assets for unexpected plugin id: ${String(manifest.id)}`);
    }
    for (const assetName of ASSET_NAMES) {
        await readFile(path.join(assetDirectory, assetName));
    }

    await mkdir(targetDirectory, { recursive: true });
    const notePaths = Array.from({ length: noteCount }, (_, index) => notePathFor(index));

    for (let index = 0; index < notePaths.length; index += 1) {
        const destination = path.join(targetDirectory, notePaths[index]);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, createNote(index, notePaths), 'utf8');
    }

    for (let index = 1; index <= ATTACHMENT_COUNT; index += 1) {
        const destination = path.join(targetDirectory, '07 Attachments', `Synthetic Image ${pad(index, 2)}.svg`);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, createSvg(index), 'utf8');
    }

    const pluginDirectory = path.join(targetDirectory, '.obsidian', 'plugins', PRODUCT_ID);
    await mkdir(pluginDirectory, { recursive: true });
    for (const assetName of ASSET_NAMES) {
        await copyFile(path.join(assetDirectory, assetName), path.join(pluginDirectory, assetName));
    }

    await writeJson(path.join(targetDirectory, '.obsidian', 'app.json'), {
        alwaysUpdateLinks: true,
        attachmentFolderPath: '07 Attachments',
        newFileFolderPath: '00 Inbox',
        newFileLocation: 'folder'
    });
    await writeJson(path.join(targetDirectory, '.obsidian', 'appearance.json'), {
        baseFontSize: 16,
        theme: 'obsidian'
    });
    await writeJson(path.join(targetDirectory, '.obsidian', 'community-plugins.json'), [PRODUCT_ID]);
    await writeJson(path.join(targetDirectory, '.picturefish-reference-vault.json'), {
        schemaVersion: 1,
        generatedBy: 'scripts/prepare-m1-test-vault.mjs',
        pluginId: PRODUCT_ID,
        pluginVersion: manifest.version,
        noteCount,
        attachmentCount: ATTACHMENT_COUNT,
        containsRealVaultData: false
    });

    process.stdout.write(
        `${JSON.stringify(
            {
                targetDirectory,
                pluginId: PRODUCT_ID,
                pluginVersion: manifest.version,
                noteCount,
                attachmentCount: ATTACHMENT_COUNT
            },
            null,
            2
        )}\n`
    );
}

main().catch(error => {
    process.stderr.write(`M1 reference vault generation failed: ${error.message}\n`);
    process.exitCode = 1;
});
