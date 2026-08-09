# Contributing to Picturefish Obsidian Navigator

Picturefish Obsidian Navigator is an independent GPL-licensed fork of
[Notebook Navigator](https://github.com/johansan/notebook-navigator). The fork is currently in its initialization phase;
runtime identity and storage have not yet been safely namespaced.

## Before contributing

- Do not publish or install development builds in production vaults.
- Search existing issues before opening a new one.
- For substantial changes, open an issue and agree on scope before writing a pull request.
- Keep changes focused and preserve the documented upstream relationship.
- Never include production vault data, credentials, API keys, or personal information in issues, fixtures, or tests.

## Issues

Issues are welcome for Picturefish-specific bugs, product ideas, architecture questions, and documentation problems.
Include the Picturefish commit or version, upstream baseline, Obsidian version, platform, reproduction steps, and a
minimal synthetic example when applicable.

General bugs that also reproduce in an unmodified Notebook Navigator release should be reported to
[the upstream issue tracker](https://github.com/johansan/notebook-navigator/issues) as well. Upstream does not accept
external pull requests; follow its contribution policy when interacting with that project.

## Pull requests

Pull requests to the Picturefish fork are accepted by prior coordination while the architecture is stabilizing. A pull
request must:

- target one agreed issue or decision;
- keep inherited copyright headers intact;
- place additive Picturefish code in the dedicated Picturefish module tree whenever possible;
- include tests for changed behavior;
- pass build, lint, formatting, test, dependency, and security checks;
- update `UPSTREAM.md` when the upstream baseline or patch classification changes;
- document migrations and recovery behavior for settings, storage, or file operations.

Repository owners may close uncoordinated or unsafe changes, but contributions are not automatically rejected merely
because they come from outside maintainers.

## Security issues

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md) and use private vulnerability reporting.

## Development checks

Run the same core checks used in CI:

```bash
npm ci
npm run format:check
npm run build
npm run lint
npm run lint:styles
npm test
npm audit
```

## License

Contributions are accepted under GPL-3.0-or-later, the same license as the inherited code. By contributing, you confirm
that you have the right to submit the work under that license.
