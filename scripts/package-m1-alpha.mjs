#!/usr/bin/env node

/*
 * Picturefish Obsidian Navigator - deterministic M1 alpha artifact packager.
 */

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCT_ID = 'picturefish-obsidian-navigator';
const ASSET_NAMES = ['main.js', 'manifest.json', 'styles.css'];
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(scriptDirectory, '..');

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

async function assertEmptyOrMissing(directory) {
    try {
        const entries = await readdir(directory);
        if (entries.length > 0) {
            throw new Error(`Output directory must be empty: ${directory}`);
        }
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
}

async function sha256(filePath) {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const projectRoot = path.resolve(options['project-root'] ?? defaultProjectRoot);
    const manifestPath = path.join(projectRoot, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

    if (manifest.id !== PRODUCT_ID) {
        throw new Error(`Refusing to package unexpected plugin id: ${String(manifest.id)}`);
    }
    if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
        throw new Error('Plugin manifest is missing a version.');
    }

    for (const assetName of ASSET_NAMES) {
        await readFile(path.join(projectRoot, assetName));
    }

    const defaultOutput = path.join(projectRoot, 'dist', 'm1-alpha', `${PRODUCT_ID}-${manifest.version}`);
    const outputDirectory = path.resolve(options.output ?? defaultOutput);
    await assertEmptyOrMissing(outputDirectory);
    await mkdir(outputDirectory, { recursive: true });

    const checksums = [];
    for (const assetName of ASSET_NAMES) {
        const destination = path.join(outputDirectory, assetName);
        await copyFile(path.join(projectRoot, assetName), destination);
        checksums.push(`${await sha256(destination)}  ${assetName}`);
    }

    await writeFile(path.join(outputDirectory, 'SHA256SUMS'), `${checksums.join('\n')}\n`, 'utf8');

    process.stdout.write(
        `${JSON.stringify(
            {
                pluginId: PRODUCT_ID,
                version: manifest.version,
                outputDirectory,
                assets: ASSET_NAMES
            },
            null,
            2
        )}\n`
    );
}

main().catch(error => {
    process.stderr.write(`M1 alpha packaging failed: ${error.message}\n`);
    process.exitCode = 1;
});
