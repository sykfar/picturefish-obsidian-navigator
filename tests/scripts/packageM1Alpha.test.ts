import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve('scripts/package-m1-alpha.mjs');
const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(prefix: string): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
}

async function createAssets(pluginId = 'picturefish-obsidian-navigator'): Promise<string> {
    const projectDirectory = await createTemporaryDirectory('picturefish-m1-package-source-');
    await writeFile(
        path.join(projectDirectory, 'manifest.json'),
        `${JSON.stringify({ id: pluginId, name: 'Picturefish Obsidian Navigator', version: '0.1.0' }, null, 2)}\n`,
        'utf8'
    );
    await writeFile(path.join(projectDirectory, 'main.js'), 'module.exports = {};\n', 'utf8');
    await writeFile(path.join(projectDirectory, 'styles.css'), '.picturefish { display: block; }\n', 'utf8');
    return projectDirectory;
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

describe('package-m1-alpha', () => {
    it('copies only the installable assets and records deterministic SHA-256 checksums', async () => {
        const projectDirectory = await createAssets();
        const outputDirectory = path.join(await createTemporaryDirectory('picturefish-m1-package-output-'), 'artifact');

        await execFileAsync(process.execPath, [scriptPath, '--project-root', projectDirectory, '--output', outputDirectory]);

        const checksumLines = (await readFile(path.join(outputDirectory, 'SHA256SUMS'), 'utf8')).trim().split('\n');
        expect(checksumLines).toHaveLength(3);
        for (const assetName of ['main.js', 'manifest.json', 'styles.css']) {
            const content = await readFile(path.join(outputDirectory, assetName));
            const expectedHash = createHash('sha256').update(content).digest('hex');
            expect(checksumLines).toContain(`${expectedHash}  ${assetName}`);
        }
    });

    it('refuses an upstream plugin manifest', async () => {
        const projectDirectory = await createAssets('notebook-navigator');
        const outputDirectory = path.join(await createTemporaryDirectory('picturefish-m1-package-output-'), 'artifact');

        const errorOutput = await runExpectingFailure(['--project-root', projectDirectory, '--output', outputDirectory]);
        expect(errorOutput).toContain('unexpected plugin id');
    });

    it('does not overwrite a non-empty output directory', async () => {
        const projectDirectory = await createAssets();
        const outputDirectory = await createTemporaryDirectory('picturefish-m1-package-output-');
        await mkdir(outputDirectory, { recursive: true });
        await writeFile(path.join(outputDirectory, 'keep.txt'), 'preserve me\n', 'utf8');

        const errorOutput = await runExpectingFailure(['--project-root', projectDirectory, '--output', outputDirectory]);
        expect(errorOutput).toContain('must be empty');
        expect(await readFile(path.join(outputDirectory, 'keep.txt'), 'utf8')).toBe('preserve me\n');
    });
});
