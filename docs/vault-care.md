# Native Vault-Pflege

CF-PFNAV-0007 und CF-PFNAV-0008 liefern die zwei freigegebenen Ansichten in einer gemeinsamen Markdown-Notiz aus. `Dashboard/Lose Enden.md` enthält `pf_order` und den Codeblock `pf-order`. `04 Ressourcen/Software-Entwicklung/Notiztypen und Prüfprofile.md` enthält den führenden, versionierten Vertrag `pf_types`. Der Navigator erfindet keinen Ersatzvertrag, wenn das Register fehlt oder fehlerhaft ist.

## Ablauf

Die Pflegeübersicht filtert nach Bereich, Familie und Befund. Matrixzellen wählen Bereich und Regel; die paginierte Liste führt in die Notizwerkstatt. Dort sind aktuelle Metadaten, Herkunft, statische Rücklinks, Zitatquellen, erkannte Pandoc-Verwendung und Veröffentlichungsfassung getrennt. Alle Notizen können auch unabhängig von einem Befund gesucht werden.

Ein Typwechsel zeigt zuerst die Differenz. Erst die einzelne Bestätigung ruft `vault.process` auf. Ein Vergleich mit dem gesamten gelesenen Inhalt verhindert, dass eine veraltete Vorschau fremde Änderungen überschreibt. Die YAML-AST-Bereiche ersetzen nur den einfachen Typwert oder ergänzen das fehlende Feld. YAML-Fehler, doppelte Schlüssel, komplexe Typwerte, Tags und Anker verlangen eine manuelle Quelltextkorrektur. Inhaltsreview, Datumswerte, unbekannte Felder und Co-Autor bleiben erhalten.

Ausnahmen enthalten Pfad, Regel, Begründung, Inhaltsfingerabdruck und Registerversion in der Pflegenotiz. Sie gelten nach einer Datei- oder Vertragsänderung nicht weiter. Die Einstellungen ändern nur `pf_order`; fremde Frontmatter bleibt erhalten.

## Prüfumfang

Explizite Quellen, begrenzte Rekursion und höchstens 5.000 Markdown-Dateien / 25.000 Knoten / 2 MB je Datei. Kein `getMarkdownFiles`, kein globaler Linkindex, keine globalen Dataview-Abfragen. Gesperrte und versteckte Pfade werden vor dem Zugriff ausgeschlossen. Auf Desktop prüft `lstat` jedes noch nicht geprüfte Pfadsegment vor Inhalt oder Rekursion. Verknüpfte Verzeichnisse werden ausgelassen; mobile Vault-Adapter bieten keine Desktop-Dateisystem-Verknüpfungen. Fehlende Bereiche, große Dateien und begrenzte Scans werden sichtbar gemeldet.

Statische Links werden nur gegen den eigenen geprüften Notizindex aufgelöst. Mehrdeutige oder nicht aufgelöste Ziele sind Kandidaten, keine bestätigten defekten Links. Dynamische Dashboards, Canvas, Anhänge als Linkziele, externe Manuskripte und ausgeschlossene Bereiche sind ungeprüft. Die Pandoc-Grammatik entspricht Buchstudio; sein unbeschränkter Laufzeitindex wird nicht übernommen. Rücklinks werden nicht als Zitate ausgegeben. Vorlagen und abgelöste Inhalte haben eigene Ausnahmen. Zahlen unterschiedlicher Regeln können sich überschneiden.

Der gemeinsame Dienst teilt parallele Prüfläufe und puffert Dateiinhalte nach mtime/Größe. Die Startseite kann mit dem konfigurierbaren Modul `loose` denselben Live-Stand anzeigen. Tabellen erben Vault-Font und Zellabstand; Kompakt verändert nur den lokalen Zellabstand.

## Prüfung

`tests/vaultCare.test.ts` prüft Profile, YAML, statische Beziehungen, Zitiergrammatik, dateigebundene Ausnahmen, verlustfreie Typänderungen und veraltete Vorschauen. `tests/vaultCareScope.test.ts` prüft, dass ausgeschlossene/verknüpfte Pfade weder betreten noch gelesen werden, die direkte Konfiguration vor Inhalt geprüft wird und der Inhaltscache Änderungen erkennt.

Produkt- und Ordnungsentscheidungen bleiben im Vault unter `02 Projekte/picturefish-obsidian-navigator/`.
