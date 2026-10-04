# Shared Vault homepage (CF-PFNAV-0006)

The approved homepage uses one Markdown note (`Dashboard/Startseite.md`) containing a `pf-home` fenced block. `pf_home` frontmatter owns configuration; facts remain in existing source notes. Navigator's existing homepage controller opens that same file on startup and command. Core file explorer/bookmarks open it normally while Navigator remains enabled.

Configure from the rendered header or `configure-vault-home`: module visibility/order, 3/5/10 entries, density, explicit per-module folders, startup. Only selected safe folder trees are traversed, never the Vault root. Tasks read at most 100 recent files and 100 KB per file. Traversal caps 500 files/1500 nodes and displays a warning; project/recent modules read entry notes up to two folder levels. No global DataviewJS inventory and no extra dependency.

Task links open source lines; tasks are edited at their original location. Resource read status uses `lesestatus`, falling back to `status`. Old notes with no status are listed. Knowledge upkeep links unreviewed or >90-day-old knowledge/decision/learning notes. Empty/nonexistent scopes and bounded scans have visible messages. Metadata changes refresh the view with a debounce. Unknown note frontmatter remains untouched when configuration is saved.

Homepage content uses Obsidian CSS variables and the existing Vault palette/font. Compact changes spacing only. With `cssclasses: [pf-home-note]`, the properties and inline title are hidden in the display; source mode and the configuration modal remain available.

References to book/article intake call the already installed Picturefish Zitate commands. Full source guide remains in the Vault at `04 Ressourcen/Zeitschriften/README.md`.

Validation: repository quality build, config/path tests and native synthetic Vault interaction (configuration roundtrip, empty source folder, module reorder, source intake and bibliography). Real iPad interaction remains unverified.
