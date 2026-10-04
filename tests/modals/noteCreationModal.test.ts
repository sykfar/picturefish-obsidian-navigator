import { App, Modal, TFolder } from 'obsidian';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestNoteCreation } from '../../src/modals/NoteCreationModal';
import { createTestTFile } from '../utils/createTestTFile';

/** Events and text only: this checks modal behavior, not native Obsidian rendering. */
class Element {
    children: Element[] = [];
    events = new Map<string, () => void>();
    text = '';
    value = '';
    disabled = false;
    constructor(public tag = 'div') {}
    createEl(tag: string, options: { text?: string; value?: string } = {}): Element {
        const child = new Element(tag);
        child.text = options.text ?? '';
        child.value = options.value ?? '';
        this.children.push(child);
        return child;
    }
    createDiv(): Element {
        const child = new Element();
        this.children.push(child);
        return child;
    }
    setText(text: string): void {
        this.text = text;
    }
    setAttribute(): void {}
    focus(): void {}
    select(): void {}
    empty(): void {
        this.children = [];
    }
    addEventListener(event: string, callback: () => void): void {
        this.events.set(event, callback);
    }
    fire(event: string): void {
        this.events.get(event)?.();
    }
    find(tag: string): Element[] {
        return [...(this.tag === tag ? [this] : []), ...this.children.flatMap(child => child.find(tag))];
    }
}

function openPreview() {
    const app = new App();
    Reflect.set(app.vault, 'getFiles', () => []);
    const folder = new TFolder('Notes');
    folder.children = [];
    const body = new Element();
    let closeModal = () => {};
    vi.spyOn(Modal.prototype, 'open').mockImplementation(function (this: Modal) {
        closeModal = () => this.close();
        Reflect.set(this, 'contentEl', body);
        Reflect.set(this, 'titleEl', new Element());
        void this.onOpen();
    });
    const result = requestNoteCreation(app, { folder, baseName: 'Neue Notiz', templateFile: null, allowEditing: true });
    return { folder, body, result, close: () => closeModal() };
}

describe('local note creation preview', () => {
    afterEach(() => vi.restoreAllMocks());

    it('settles cancellation when the modal is closed without submission', async () => {
        const preview = openPreview();
        preview.close();
        expect(await preview.result).toBeNull();
    });

    it('blocks a path as title and confirms a corrected Unicode title', async () => {
        const preview = openPreview();
        const input = preview.body.find('input')[0];
        const confirm = preview.body.find('button')[1];
        input.value = '../Andere Notiz';
        input.fire('input');
        expect(confirm.disabled).toBe(true);
        input.value = 'Über Verantwortung';
        input.fire('input');
        expect(confirm.disabled).toBe(false);
        expect(preview.body.find('div').some(element => element.text === 'Notes/Über Verantwortung.md')).toBe(true);
        confirm.fire('click');
        expect(await preview.result).toEqual({ baseName: 'Über Verantwortung', templateFile: null });
    });

    it('rechecks a case-only collision that arrives while the dialog is open', async () => {
        const preview = openPreview();
        const confirm = preview.body.find('button')[1];
        preview.folder.children.push(createTestTFile('Notes/NEUE NOTIZ.md'));
        confirm.fire('click');
        expect(confirm.disabled).toBe(true);
        preview.close();
        expect(await preview.result).toBeNull();
    });
});
