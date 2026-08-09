# Upstream relationship

Picturefish Obsidian Navigator is an independent fork of
[johansan/notebook-navigator](https://github.com/johansan/notebook-navigator).

## Initial baseline

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| Upstream repository | `johansan/notebook-navigator`                          |
| Initial fork commit | `747383f6e1bfeaaf4d98d1db6aec00f210b63049`             |
| Git description     | `3.3.2-34-g747383f6`                                   |
| Fork initialized    | 2026-08-09                                             |
| Runtime status      | still identical to upstream; not a Picturefish release |

The preferred runtime-renaming baseline is the next reviewed stable upstream release, at least 3.3.3. If development
starts before that release, this commit remains the documented temporary baseline and the stable tag will be integrated
before the first Picturefish alpha.

## Initial fork changes

The initialization branch changes documentation and repository governance only; runtime identity and behavior remain
unchanged. It also updates the locked development-only transitive dependencies `js-yaml` from 4.3.0 to 4.3.1 and
`nanoid` from 3.3.16 to 3.3.18 to clear the security advisories present at fork time. Production dependencies were not
affected.

## Remotes

Local development checkouts use:

```text
origin    https://github.com/sykfar/picturefish-obsidian-navigator.git
upstream  https://github.com/johansan/notebook-navigator.git
```

The `upstream` remote is read-only by policy. Contributors must never push to it.

## Synchronization policy

1. Fetch upstream tags without rewriting them.
2. Create `integration/upstream-<version>` from the current Picturefish main branch.
3. Merge the selected reviewed upstream release into the integration branch.
4. Resolve conflicts with explicit notes for every Picturefish behavior that is retained.
5. Run upstream and Picturefish tests, security checks, migration tests, and performance benchmarks.
6. Merge through review without rewriting published main history.
7. Update this file with the new baseline and add an upstream-integration learning note.

Upstream does not accept external pull requests. General bugs may be reported through upstream issues, but Picturefish
planning assumes long-term ownership of all fork-specific changes.

## Patch categories

- **A — additive modules:** Picturefish code isolated under a dedicated module tree;
- **B — hook points:** small, intentional changes to upstream files;
- **C — core changes:** indexing, selection, drag-and-drop, or file operations;
- **D — UI forks:** substantial divergence in existing React components.

The initial target is at least 70 percent of Picturefish code in category A and no more than ten documented category-C
or category-D hotspots before the first alpha.

## Attribution and license

Inherited files keep their original copyright headers. Picturefish-specific authorship is visible in Git history and
new-file headers. The complete work remains GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
