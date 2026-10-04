# Selektive Integration von Notebook Navigator 3.4.3

Der Port übernimmt die stabilen Quellcodekorrekturen, Ordnervorlagen, Vorlagenbefehle und kontextbezogenen Listenoptionen bis Notebook Navigator 3.4.3. Der Picturefish-Fork bleibt ein eigenständiges Plugin. Anforderungen und Freigabe stehen im Vault-Projekteinstieg; hier stehen die technischen Grenzen.

## Herkunft

- Picturefish-Ausgangspunkt: `0f75f8cbf87eec691cb9b784c66d6b167b9b8a6f`, Version 0.2.3.
- Ursprüngliche funktionale Basis: Picturefish-Commit `747383f6e1bfeaaf4d98d1db6aec00f210b63049`, entsprechend Upstream 3.3.3.
- Übernahmeziel: [Notebook Navigator 3.4.3](https://github.com/johansan/notebook-navigator/releases/tag/3.4.3), Commit `202330738cf7afeedbf3990f623b44eea992233b`.
- Integration über einen Drei-Wege-Dateivergleich der funktionalen Basis, des aktuellen Forks und des stabilen Upstream-Stands. Die Git-Historien sind auseinander gelaufen; deshalb kein blindes Merge und keine Übernahme der Upstream-Workflows.
- Upstream-Lizenz und Copyright-Hinweise bleiben erhalten. Picturefish verwendet weiterhin GPL-3.0-or-later.

## Picturefish-Anpassungen

| Bereich | Umsetzung |
|---|---|
| Identität und Migration | Eigene Plugin-ID, Commands, Speicher, Views, API und einseitiger Settings-Import bleiben erhalten. |
| Web-Ressourcen | Vorhandene Erkennung, URL-Allowlist und explizite bestätigte Aktionen bleiben erhalten. |
| Venezia | Die in der installierten CSS bestätigte Klasse `nn-venezia-integration` und die Sand-Hintergründe sind im Source konsolidiert. |
| Sprachen | Deutsch und Englisch werden lokal mitgeliefert. Weitere Locale-Quellen bleiben für spätere Abgleiche im Repo, werden nicht gebündelt. Unbekannte Sprachen verwenden Englisch. Keine LanguageService-/LanguageCache-Pipeline. |
| Titel | Farbige Listentitel bleiben intern standardmäßig aus; dafür wird kein neuer Einstellungsregler angeboten. |
| Neue Notiz | Ordneraktion öffnet einen nativen lokalen Dialog für Titel und Vorlage. Pfad und Vorlage sind sichtbar. Abbruch schreibt nichts und liest noch keine Vorlage. |
| Vorlagenbefehle | Vorhandene Vault-Vorlagen, feste und nummerierte Namen. Vor dem Schreiben erscheint der Zielpfad. Feste Kollisionen werden abgewiesen. Nummerierte Namen bleiben gegen parallele Befehle reserviert. |
| Templater | Automatikmodus bricht bei Templater-Syntax und fehlendem Plugin ab. Der lokale Picker verwendet auch im Templater-Modus die konfigurierte Vorlagenablage, damit die Vorschau vor der Erstellung liegt. Ohne konfigurierte Vorlagenablage wird keine Templater-Erstellung delegiert. |
| Wiederholtes Öffnen | Namen und Cursor werden nach dem Öffnen konsistent behandelt. Kalender- und Ordnernotizen behalten ihren bestehenden Erstellungsablauf; unlesbare Templates führen nicht zu leeren Ersatznotizen. Die Vorschau gilt für normale neue Notizen, den Vorlagenpicker und Vorlagenbefehle. |

Die Preview wertet keinen Templater-Code aus. Eingebaute Eingabevariablen können vor der endgültigen Befehlsvorschau abgefragt werden; Rendering und Dateierstellung folgen erst nach Bestätigung. Bei Fehlern während einer bereits gestarteten Templater-Ausführung kann dessen eigenes Verhalten zusätzliche Änderungen verursachen. Dafür ist keine generelle Transaktion vorgesehen.

## Anforderungen und Prüfung

| Nachweis | Schwerpunkt |
|---|---|
| UC-0126, CF-PFNAV-0001 | Ordnerzuordnung und Vererbung: `tests/utils/folderTemplates.test.ts`, Einstellungs- und Transferprüfungen. |
| UC-0126, CF-PFNAV-0002 | Registrierung, Zielordner, Platzhalter, Cursor, nummerierte Namen: `tests/services/templateCommands.test.ts`. |
| UC-0126, CF-PFNAV-0003 | Abbruch vor Template-Lesen, fehlende/unlesbare Vorlage, reservierte Namen, Groß-/Kleinschreibung und Konflikte während Bestätigung: Erstellungs-, Befehls- und Modaltests. |
| UC-0127, CF-PFNAV-0004 | Datums-, Elternordner- und Tag-Anzeige je Kontext: `tests/hooks/useListPaneAppearance.test.ts` und Transferprüfungen. |

`tests/modals/noteCreationModal.test.ts` prüft die tatsächliche Dialoglogik mit Ereignis-Stubs. Das ersetzt keine Sichtprüfung in Obsidian oder auf dem iPad. Produktive Vault-Dateien und die installierten Plugin-Artefakte werden vom Entwicklungsbuild nicht verändert.

## Abhängigkeiten

Kompatible Audit-Korrekturen wurden in der Sperrdatei aktualisiert. Vitest und Coverage laufen zusammen mit Version 5; Moment wird auf die gepatchte 2.31-Reihe überschrieben. Der Test-Config verwendet `.mts`, passend zu ESM.

Der abschließende npm-Audit vom 04.10.2026 meldet sechs hohe Entwicklungsabhängigkeitsbefunde derselben `braces`-Kette (`braces → micromatch → fast-glob → globby → stylelint`, einschließlich des Stylelint-Plugins). [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) betrifft erschöpfbare Stacks bei tief verschachtelten Mustern. Für die aktuelle `braces`-Reihe ist laut Audit kein Patch verfügbar. Der vorgeschlagene Stylelint-Downgrade auf 7.7.0 wird nicht übernommen. Diese Entwicklungswerkzeuge werden nicht in `main.js` gebündelt. Der Entwicklungs-Audit ist deshalb ausdrücklich nicht grün.

## Auslieferungsgrenze

Version 0.3.0 und die passenden Release Notes sind für die nächste Auslieferung vorbereitet. Das ist kein veröffentlichter Release. Vor einer Auslieferung sind die native Prüfung auf Desktop/iPad und der Auftrag zum Merge und Release nötig. Der automatische Upstream-Merge-Workflow wird in diesem Port nicht geändert.
