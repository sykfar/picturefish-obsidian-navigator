/* Picturefish Obsidian Navigator, 2026. GPL-3.0-or-later. */

import { App, Modal, TFile, type TFolder } from 'obsidian';
import { strings } from '../i18n';
import { isValidNewNoteTitle, newNotePath } from '../utils/noteCreationPolicy';

interface NoteCreationOptions {
    folder: TFolder;
    baseName: string;
    templateFile: TFile | null;
    templateFolder?: string;
    allowEditing?: boolean;
}

export interface NoteCreationChoice {
    baseName: string;
    templateFile: TFile | null;
}

/** Local preview only. Templates are not evaluated and files are not written by this modal. */
export function requestNoteCreation(app: App, options: NoteCreationOptions): Promise<NoteCreationChoice | null> {
    return new Promise(resolve => {
        let settled = false;
        class NoteCreationModal extends Modal {
            onOpen(): void {
                const labels = strings.noteCreation;
                this.contentEl.addClass('nn-note-creation-modal');
                this.titleEl.setText(labels.title);
                let name = options.baseName;
                let template = options.templateFile;
                if (options.allowEditing) {
                    this.contentEl.createEl('label', { text: labels.template });
                    const select = this.contentEl.createEl('select', { cls: 'nn-input' });
                    select.setAttribute('aria-label', labels.template);
                    select.createEl('option', { value: '', text: labels.noTemplate });
                    const prefix =
                        options.templateFolder?.replace(/\/$/u, '') || (app.vault.getAbstractFileByPath('Templates') ? 'Templates' : '');
                    const templates = app.vault
                        .getFiles()
                        .filter(
                            file =>
                                file.extension === 'md' &&
                                ((prefix && (prefix === '/' || file.path.startsWith(`${prefix}/`))) || file.path === template?.path)
                        );
                    templates.forEach(file => select.createEl('option', { value: file.path, text: file.path }));
                    select.value = template?.path ?? '';
                    select.addEventListener('change', () => {
                        const file = app.vault.getAbstractFileByPath(select.value);
                        template = file instanceof TFile ? file : null;
                        update();
                    });
                    this.contentEl.createEl('label', { text: labels.name });
                    const input = this.contentEl.createEl('input', { type: 'text', value: name, cls: 'nn-input' });
                    input.setAttribute('aria-label', labels.name);
                    input.addEventListener('input', () => {
                        name = input.value;
                        update();
                    });
                    input.focus();
                    input.select();
                }
                const summary = this.contentEl.createDiv({ cls: 'nn-note-creation-summary' });
                summary.createEl('strong', { text: labels.target });
                const path = summary.createDiv();
                const source = summary.createDiv();
                this.contentEl.createEl('p', { text: labels.effect, cls: 'nn-input-description' });
                const error = this.contentEl.createDiv({ cls: 'nn-note-creation-error' });
                error.setAttribute('role', 'status');
                const buttons = this.contentEl.createDiv({ cls: 'nn-button-container' });
                buttons.createEl('button', { text: strings.common.cancel }).addEventListener('click', () => this.close());
                const confirm = buttons.createEl('button', { text: labels.create, cls: 'mod-cta' });
                function update(): void {
                    path.setText(newNotePath(options.folder.path, name));
                    source.setText(`${labels.template}: ${template?.path ?? labels.noTemplate}`);
                    const targetPath = newNotePath(options.folder.path, name);
                    const occupied =
                        app.vault.getAbstractFileByPath(targetPath) !== null ||
                        options.folder.children.some(child => child.path.toLowerCase() === targetPath.toLowerCase());
                    const valid = isValidNewNoteTitle(name);
                    error.setText(!valid ? labels.invalidName : occupied ? labels.exists : '');
                    confirm.disabled = !valid || occupied;
                }
                confirm.addEventListener('click', () => {
                    update();
                    if (confirm.disabled || settled) return;
                    settled = true;
                    resolve({ baseName: name.trim(), templateFile: template });
                    this.close();
                });
                update();
            }

            onClose(): void {
                if (!settled) {
                    settled = true;
                    resolve(null);
                }
                this.contentEl.empty();
            }
        }
        new NoteCreationModal(app).open();
    });
}
