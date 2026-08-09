# Picturefish Obsidian Navigator

Picturefish Obsidian Navigator is a security-first workspace navigator for Obsidian. It builds on Notebook Navigator's
fast folder, tag, property, preview, keyboard, drag-and-drop, and mobile experience while adding safe workflows and
local structure intelligence.

## Product thesis

Notebook Navigator helps people find notes. Picturefish Obsidian Navigator will additionally help them classify, review,
change, and protect the structure of a vault.

Markdown files, frontmatter, links, and folders remain the source of truth. The plugin must not create a proprietary
second knowledge store.

## Product pillars

### Safe operations

Mutating actions will follow a shared lifecycle:

1. plan the operation without changing files;
2. calculate conflicts and impact;
3. evaluate vault policies;
4. show a concrete preview;
5. execute deterministic steps;
6. verify and journal the result;
7. offer undo where it can be reliable.

The first supported undo operations will be moves, renames, and frontmatter changes. Deletion will continue to rely on
the Obsidian or system trash and will not be advertised as transactionally reversible.

### Workflow navigator

Declarative workflows will support recurring note lifecycles without `eval`, arbitrary JavaScript, or shell commands.
Initial workflows are:

- inbox triage;
- project creation;
- archival review;
- publication readiness.

### Structure intelligence

Local, rule-based diagnostics will identify missing or inconsistent properties, orphaned notes, dead links, stale inbox
items, incomplete projects, tasks in archived contexts, duplicate candidates, and unsafe external resources. A finding
never changes a file by itself.

### Working modes

Vault profiles will evolve into working modes combining visibility, layout, actions, quality rules, protected paths, and
explicit indexing policy. Hiding, excluding from search, and excluding from the local index will be separate choices.

### Integration platform

Optional adapters will integrate Obsidian Bases, Tasks, Dataview, Folder Colors Plus, Templater, Kanban, TaskForge,
ObsidianUI, and other Picturefish plugins. The core must remain functional when an integration is missing or
incompatible.

## Security defaults

- local-first and no telemetry;
- no secret storage;
- no automatic remote AI;
- external images and icon packs disabled by default;
- no external request in the default configuration;
- protected-path policy for every mutation entry point;
- optional `do-not-index` paths for the Picturefish index;
- preview for every batch change;
- local, bounded operation journal;
- reproducible and attested release artifacts.

A protected or non-indexed path is a self-restriction of this plugin, not an operating-system security boundary. Truly
confidential material belongs in a separate vault or stronger isolation boundary.

## Identity

| Field            | Value                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Product name     | Picturefish Obsidian Navigator                                                 |
| Future plugin ID | `picturefish-obsidian-navigator`                                               |
| Repository       | `sykfar/picturefish-obsidian-navigator`                                        |
| License          | GPL-3.0-or-later                                                               |
| Upstream         | `johansan/notebook-navigator`                                                  |
| Versioning       | Picturefish versions start at `0.1.0`; upstream baseline is tracked separately |

The runtime name, plugin ID, view IDs, command IDs, local-storage keys, IndexedDB names, API path, CSS collision points,
and release URLs will be renamed together in one tested milestone. Until that milestone is complete, this repository is
not an installable Picturefish release.

## Delivery sequence

1. establish attribution, governance, test vault, and upstream baseline;
2. atomically namespace the fork while preserving upstream behavior;
3. build the safety kernel;
4. deliver inbox, project, and archive workflows;
5. add structure intelligence;
6. add integrations and a Picturefish public API;
7. complete desktop, mobile, sync, migration, and recovery testing before beta.

The full product and implementation plan is maintained in the associated Obsidian project vault. Repository decisions
will be mirrored here as ADRs as implementation begins.
