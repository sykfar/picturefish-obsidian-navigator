# M1 runtime namespacing

M1 turns the repository into a separately installable development build without adding new navigation features. The
fork keeps inherited TypeScript class names and copyright headers stable so reviewed upstream releases remain
mergeable, while every runtime identifier that owns or addresses data is moved to the Picturefish namespace.

## Namespaced in M1

- plugin manifest ID, package name, product name, icon ID, and version line (`0.1.0`);
- navigator, calendar, and folder-note sidebar view IDs;
- Obsidian command prefixes, which are derived from the new manifest ID;
- all active vault-scoped localStorage keys;
- file-cache and external-icon IndexedDB database names;
- drag-and-drop MIME types, the mobile visibility event, and document-global SVG filter IDs;
- public API lookup path and the Obsidian plugin-settings URL;
- release checks, release media, and bundled icon-pack download URLs;
- Style Settings group ID and a Picturefish root class for future UI scoping.

Regression tests assert that active storage keys, view IDs, databases, and browser events do not reuse the upstream
namespace.

## Settings migration

The existing settings import dialog accepts both Picturefish exports and an explicit Notebook Navigator export. The
migration is one-way: Picturefish writes only its own `data.json` and its own local preferences. The user must select
the JSON file and confirm the import; the existing backup option remains available. Picturefish never silently reads,
moves, or deletes Notebook Navigator settings.

Recommended migration sequence:

1. export settings from Notebook Navigator;
2. disable Notebook Navigator;
3. enable Picturefish Obsidian Navigator;
4. import the exported JSON through Picturefish settings;
5. verify layout, search, navigation, and mobile behavior in a test vault before using a production vault.

## Coexistence boundary

The plugins no longer share settings, localStorage, IndexedDB, views, commands, drag payloads, API registration, or
document-global filter IDs. Picturefish also warns when it detects Notebook Navigator enabled at the same time.

Parallel activation is nevertheless not supported in M1. Much of the inherited UI still uses Notebook Navigator CSS
class names and `nn-*` utility classes. Running both style bundles can therefore produce visual overlap, especially
after either project changes its styles. Workspace layout and duplicated hotkeys can also be confusing. Disable one
plugin before enabling the other.

## Validation

The implementation is gated by the production build, ESLint, Stylelint, the full Vitest suite, and `npm audit`.
`scripts/package-m1-alpha.mjs` creates an installable three-file artifact with SHA-256 checksums, while
`scripts/prepare-m1-test-vault.mjs` creates a deterministic, secret-free reference vault without overwriting an existing
directory. See [M1 validation](m1-validation.md) for the automated commands and manual acceptance matrix.

Manual desktop, mobile, sync, migration, downgrade, and synthetic-vault checks are still required before an alpha
release.
