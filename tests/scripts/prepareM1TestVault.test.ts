import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve('scripts/prepare-m1-test-vault.mjs');
const configDirectory = ['.', 'obsidian'].join('');
const temporaryDirectories: string[] = [];

interface ReferenceVaultMarker {
    pluginId: string;
    noteCount: number;
    containsRealVaultData: boolean;
}

interface PluginManifest {
    id: string;
}

async function createTemporaryDirectory(prefix: string): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
}

async function createAssets(pluginId = 'picturefish-obsidian-navigator'): Promise<string> {
    const assetDirectory = await createTemporaryDirectory('picturefish-m1-assets-');
    await writeFile(
        path.join(assetDirectory, 'manifest.json'),
        `${JSON.stringify({ id: pluginId, name: 'Picturefish Obsidian Navigator', version: '0.1.0' }, null, 2)}\n`,
        'utf8'
    );
    await writeFile(path.join(assetDirectory, 'main.js'), 'module.exports = {};\n', 'utf8');
    await writeFile(path.join(assetDirectory, 'styles.css'), '.picturefish { display: block; }\n', 'utf8');
    return assetDirectory;
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === configDirectory) {
            continue;
        }
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listMarkdownFiles(entryPath)));
        } else if (entry.name.endsWith('.md')) {
            files.push(entryPath);
        }
    }
    return files;
}

function getErrorOutput(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'stderr' in error) {
        const stderr = (error as { stderr?: unknown }).stderr;
        if (typeof stderr === 'string') {
            return stderr;
        }
        if (Buffer.isBuffer(stderr)) {
            return stderr.toString('utf8');
        }
    }
    return error instanceof Error ? error.message : String(error);
}

async function runExpectingFailure(arguments_: string[]): Promise<string> {
    try {
        await execFileAsync(process.execPath, [scriptPath, ...arguments_]);
    } catch (error) {
        return getErrorOutput(error);
    }
    throw new Error('Expected script to fail.');
}

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe('prepare-m1-test-vault', () => {
    it('creates a deterministic secret-free vault with only the Picturefish plugin enabled', async () => {
        const assetDirectory = await createAssets();
        const targetDirectory = path.join(await createTemporaryDirectory('picturefish-m1-parent-'), 'vault');

        await execFileAsync(process.execPath, [scriptPath, '--target', targetDirectory, '--assets', assetDirectory, '--notes', '64']);

        const marker = JSON.parse(
            await readFile(path.join(targetDirectory, '.picturefish-reference-vault.json'), 'utf8')
        ) as ReferenceVaultMarker;
        const enabledPlugins = JSON.parse(
            await readFile(path.join(targetDirectory, configDirectory, 'community-plugins.json'), 'utf8')
        ) as string[];
        const installedManifest = JSON.parse(
            await readFile(
                path.join(targetDirectory, configDirectory, 'plugins', 'picturefish-obsidian-navigator', 'manifest.json'),
                'utf8'
            )
        ) as PluginManifest;

        expect(marker).toMatchObject({
            pluginId: 'picturefish-obsidian-navigator',
            noteCount: 64,
            containsRealVaultData: false
        });
        expect(await listMarkdownFiles(targetDirectory)).toHaveLength(64);
        expect(enabledPlugins).toEqual(['picturefish-obsidian-navigator']);
        expect(installedManifest.id).toBe('picturefish-obsidian-navigator');
        expect(enabledPlugins).not.toContain('notebook-navigator');
    });

    it('refuses an upstream plugin artifact before creating the target', async () => {
        const assetDirectory = await createAssets('notebook-navigator');
        const targetDirectory = path.join(await createTemporaryDirectory('picturefish-m1-parent-'), 'vault');

        const errorOutput = await runExpectingFailure(['--target', targetDirectory, '--assets', assetDirectory, '--notes', '32']);
        expect(errorOutput).toContain('unexpected plugin id');
    });

    it('does not overwrite an existing vault or unrelated directory', async () => {
        const assetDirectory = await createAssets();
        const targetDirectory = await createTemporaryDirectory('picturefish-m1-existing-');
        await writeFile(path.join(targetDirectory, 'keep.md'), 'preserve me\n', 'utf8');

        const errorOutput = await runExpectingFailure(['--target', targetDirectory, '--assets', assetDirectory, '--notes', '32']);
        expect(errorOutput).toContain('must be empty');
        expect(await readFile(path.join(targetDirectory, 'keep.md'), 'utf8')).toBe('preserve me\n');
    });

    it('rejects a target reached through a symlink into the source repository', async () => {
        const assetDirectory = await createAssets();
        const parentDirectory = await createTemporaryDirectory('picturefish-m1-symlink-');
        const targetLink = path.join(parentDirectory, 'vault-link');
        await symlink(path.resolve('.'), targetLink, 'dir');

        const errorOutput = await runExpectingFailure(['--target', targetLink, '--assets', assetDirectory, '--notes', '32']);

        expect(errorOutput).toContain('outside the source repository');
    });
});
