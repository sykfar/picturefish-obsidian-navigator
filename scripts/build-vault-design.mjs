import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'vault-design');
let css = await readFile(path.join(source, 'venezia.css'), 'utf8');
for (const weight of ['Light', 'Regular', 'SemiBold', 'Bold']) {
    const font = await readFile(path.join(source, 'fonts', `PicturefishSans-${weight}.woff2`));
    const marker = `__FONT_${weight.toUpperCase()}__`;
    if (!css.includes(marker)) throw new Error(`Missing font marker: ${marker}`);
    css = css.replace(marker, `data:font/woff2;base64,${font.toString('base64')}`);
}
css += `\n${await readFile(path.join(source, 'shared-design.css'), 'utf8')}`;
if (/__FONT_|Sans Compact/.test(css)) throw new Error('Incomplete or compact font in output');
await mkdir(path.join(source, 'dist'), { recursive: true });
await writeFile(path.join(source, 'dist', 'venezia.css'), css);
console.log('Vault-Design: vault-design/dist/venezia.css');
