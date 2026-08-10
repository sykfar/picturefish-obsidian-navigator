# M1 validation

M1 is accepted only after the fork behaves like the reviewed upstream baseline while keeping all Picturefish runtime
state separate. Never run Notebook Navigator and Picturefish Obsidian Navigator at the same time during this milestone.

## Automated preparation

Use an empty target outside every real vault and outside the source repository:

```bash
npm ci
./scripts/build.sh
npm run package:m1-alpha -- --output /tmp/picturefish-m1-alpha
npm run prepare:m1-vault -- \
  --target /tmp/picturefish-m1-reference-vault \
  --assets /tmp/picturefish-m1-alpha \
  --notes 1600
```

The package step copies only `main.js`, `manifest.json`, and `styles.css`, then writes `SHA256SUMS`. It refuses a
manifest whose ID is not `picturefish-obsidian-navigator` and refuses a non-empty output directory.

The vault generator creates 1,600 deterministic Markdown notes, 24 synthetic SVG attachments, nested folders, repeated
basenames, Unicode paths, long paths, links, tags, and frontmatter. It contains no production-vault content or secrets.
The plugin is installed under its own ID, and `community-plugins.json` contains only Picturefish. The generator refuses
unsafe, repository-contained, and non-empty targets.

## Desktop acceptance matrix

- [ ] Open the generated vault in the current stable Obsidian desktop release.
- [ ] Confirm that only Picturefish Obsidian Navigator is enabled.
- [ ] Confirm that the navigator opens without startup errors or repeated notices.
- [ ] Browse Inbox, Projects, Areas, Resources, Daily Notes, Archive, Unicode, and long nested paths.
- [ ] Search for `café`, `Grüße`, `東京`, a tag, a frontmatter property, and a folder filter.
- [ ] Use keyboard navigation, multi-selection, drag-and-drop, rename, and move on synthetic notes.
- [ ] Restart Obsidian and confirm that selection, view layout, and settings persist.
- [ ] Disable and re-enable Picturefish and confirm the same behavior.
- [ ] Inspect developer-console errors and record any Picturefish stack trace.

## Migration and rollback matrix

- [ ] In a disposable vault, export settings from Notebook Navigator.
- [ ] Disable Notebook Navigator before enabling Picturefish.
- [ ] Import the export through Picturefish and confirm the preview/confirmation flow.
- [ ] Confirm that Picturefish writes only to its plugin folder and namespaced browser storage.
- [ ] Disable Picturefish, re-enable Notebook Navigator, and confirm that its settings are unchanged.
- [ ] Reinstall the same Picturefish artifact and confirm that existing Picturefish settings remain usable.
- [ ] Test an upgrade from an earlier Picturefish artifact when one exists.
- [ ] Test downgrade behavior before any public beta.

## Mobile and sync matrix

- [ ] Sync only the synthetic vault to a second test device.
- [ ] Open Picturefish on iPhone and iPad and verify navigation, search, layout, and touch drag-and-drop.
- [ ] Change one synced setting and confirm propagation.
- [ ] Change one device-local setting and confirm that it does not propagate.
- [ ] Confirm that no plugin database or browser-storage namespace is shared with Notebook Navigator.

## Gate evidence

Record the Obsidian version, operating system, artifact checksum, device, result, and any issue link. A failing mutation,
data overwrite, namespace collision, startup error, or unrecoverable migration blocks the PR. Cosmetic differences must
be documented and explicitly accepted before merge.
