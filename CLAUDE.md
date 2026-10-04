# Picturefish Obsidian Navigator

Globale Codex-/Vault-Regeln gelten. Produktwissen, Anforderungen, Entscheidungen und offene Punkte stehen im Vault:

`/Users/alexander/Obsidian/2ndBrain/02 Projekte/picturefish-obsidian-navigator/CLAUDE.md`

Vor Produktentscheidungen diesen Einstieg und die dort verlinkten Festlegungen lesen. GitHub ist die Quelle für Code; der Vault ist die Quelle für Wissen. Keine automatische Installation, kein Merge und kein Release ohne entsprechenden Auftrag.

## Entwicklung

- Node.js 24 LTS verwenden.
- `npm ci`, `npm run format:check`, `./scripts/build.sh` und `npx knip --no-progress` prüfen.
- Laufzeitidentität aus `src/constants/product.ts` erhalten. Eigene Settings, Speicher, Views und Web-Ressourcen bleiben getrennt vom Original.
- Deutsch und Englisch lokal bündeln. Keine automatische Sprachdownload-Pipeline aktivieren.
- Vorlagen bleiben Dateien im Vault. Neue vorlagenbasierte Notizen erst nach lokaler Vorschau und Bestätigung erstellen.
- UI-Änderungen brauchen ein freigegebenes Mockup. Für den aktuellen Übernahmestand ist das Mockup vom 04.10.2026 freigegeben.

Technische Grenzen des aktuellen Ports: [Upstream-Integration 3.4.3](docs/upstream-3.4.3-integration.md).
