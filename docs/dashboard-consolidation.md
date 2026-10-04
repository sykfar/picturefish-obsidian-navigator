# Gemeinsamer Dashboard-Einstieg

Bedarf und Freigabe: UC-0135 sowie CF-PFNAV-0009 bis 0011 im Vault-Projekt `02 Projekte/picturefish-obsidian-navigator/`. Produktentscheidung und Bestandsprüfung stehen dort, nicht hier.

`Dashboard/Dashboards.md` ist die führende Konfiguration (`pf_dashboards`). `entries` enthält vorhandene Pfade, Bereiche und Anzeigenamen; `favorites`, `visible` und `sources` steuern Navigation und begrenzte Auswertung. `pf_home` aktiviert und ordnet das neue `dashboards`-Modul. Keine zweite Ansichtsliste in den Plugin-Einstellungen.

Der native Hub führt selbst keine Fachabfragen aus. `DashboardService` prüft einzelne Pfadkomponenten auf reguläre Dateien, begrenzt Traversierung vor Inhalt und verweigert fehlende/unsichere Quellkonfiguration. Physische Prüfung wird mit VaultCare geteilt. Pfadkontrolle gilt auch für Links und Buchcover; Cover liegen ausdrücklich unter `07 Anhänge/Bücher/`.

`plugin.dashboard` stellt die API für erhaltene Dataview-Ansichten bereit: `pages(scope,dv)`, `files(scope)`, `tasks(dv)`, `taskState`, `taskList`, `classifyBook`, `bookRead`, `coverMap`, `renderTasks`. Die gemeinsame Aufgabenidentität ist Dateipfad plus Zeile beziehungsweise `::note`; identische Texte verschiedener Zeilen werden nicht zusammengelegt. YAML und eingezäunte Beispiele sind keine Checkbox-Aufgaben. Tagesvergleiche verwenden den lokalen Kalendertag. Erledigt hat Vorrang vor geparkt.

`pf-perspectives` zeigt gemeinsame Einstiege. Buchdiagramme und Spezialfilter bleiben in ihren bisherigen Dateien. `pf-freshness` nutzt den CareService; zusätzliche Regel-, Entscheidungs-, Fehler- und Nachfolgerlisten bleiben getrennte Fragen.

Das einmalige Staging-Skript `scripts/stage-vault-dashboards.py` transformiert ausschließlich die bekannten Ansichten aus dem freigegebenen Audit-CSV. Ausgabe unter `/private/tmp/pf-dashboard-stage`; es installiert nicht. Vor einer Wiederholung Pfade, Quellen und Versionsannahmen prüfen. Keine globale Vault-Inventur. Installation erst nach Abnahme, mit privater Sicherung und Prüfsummen. Vorhandene Inhalte und Co-Autor-Werte erhalten.

Atlas bleibt ein gekennzeichneter Snapshot. Diese Erweiterung führt keinen Atlas-Build aus. Für den älteren Atlas-Generator bleiben Quellenbegrenzung und führende Code-Ablage vor dem nächsten Build offen.

Prüfungen: `tests/vaultDashboards.test.ts`, `tests/vaultDashboardScope.test.ts`, bisherige Home-/Care-Tests und native isolierte sowie produktive UI-Abnahme. Schmale Desktop-Darstellung ist kein Nachweis für ein echtes iPad.
