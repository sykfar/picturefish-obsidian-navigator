# Native Abnahme von 0.3.0

Diese Prüfung gilt für UC-0126/0127 und CF-PFNAV-0001 bis 0004. Produktentscheidungen und der Abnahmestand stehen im Vault-Projekteinstieg. Ein schmales Desktop-Fenster ersetzt keinen iPad-Test.

## Testmaterial

- Ein separater Vault mit ausschließlich synthetischen Bestandsnotizen.
- Navigator-Build 0.3.0 aus dem Review-Branch, zugehörige `main.js`, `manifest.json`, `styles.css` und Prüfsummen.
- Installierter Templater in derselben Version wie im produktiven Vault. Eigene Testeinstellungen: `trigger_on_file_creation: false`, keine Startup-Templates, keine Systembefehle.
- Lokale Kopien der vorhandenen Vault-Vorlagen `Use Case (UC).md`, `Custom Function (CF).md` und `Entscheidung (ADR).md`. Diese Kopien gehören nur in den privaten Test-Vault, nicht ins öffentliche Repository.
- Synthetischer Bestand `UC-0042` und `CF-TEST-0007`. Die nächsten Kennungen müssen `UC-0043` und `CF-TEST-0008` ergeben. Die ADR-Vorlage besitzt derzeit bewusst `NNNN` als Platzhalter; der Navigator darf daraus keine eigene Nummernfolge machen.

## Desktop und iPad

| Schritt | Erwartetes Ergebnis |
|---|---|
| Navigator öffnen | Getrennte Picturefish-Ansicht ohne Startfehler. |
| Neue Notiz im Ordner mit geerbter Learning-Vorlage | Titel, Vorlage und Zielpfad sichtbar; passende Vorlage vorbelegt. |
| Dialog abbrechen | Keine neue Datei, keine Änderung am Bestand. |
| Vorhandenen Titel eingeben | Kollisionshinweis; Anlegen deaktiviert. Groß-/Kleinschreibung wird berücksichtigt. |
| Learning anlegen | Vorlage verarbeitet, Notiz geöffnet, Cursor an der vorgesehenen Stelle. |
| Unterordner mit spezifischer Ressource-Vorlage öffnen | Spezifische Vorlage verdrängt die geerbte Learning-Vorlage. |
| Nummerierten Meeting-Befehl zweimal ausführen | `Meeting 01.md` und `Meeting 02.md`, Inhalt und Cursor passend zum Namen. |
| UC-/CF-Befehl mit Originalvorlage ausführen | Templater-Prompts erscheinen nach der Erstellungsbestätigung. Kennung und Zielordner stammen weiterhin aus der Vorlage. |
| ADR-Befehl mit Originalvorlage ausführen | Titelabfrage und Vorlageninhalt erhalten; `NNNN` bleibt der bestehende Platzhalter. |
| Datum/Elternordner im Kontext ausschalten | Nur dieser Kontext ändert sich. Wechsel zu anderem Kontext erhält dessen Vorgaben. |
| Gruppierung „Keine“ wählen | Keine Gruppenüberschriften. |
| Obsidian-Fenster neu laden | Gespeicherte Zuordnungen, Befehle und Ansichtsoptionen bleiben erhalten. |
| Hell/Dunkel und schmale Ansicht prüfen | Dialog, Pfad, Fehlermeldung und Buttons vollständig lesbar; kein abgeschnittener Inhalt. |
| iPad Hoch-/Querformat, Softwaretastatur | Titel bleibt erreichbar; Scrollen und Anlegen/Abbrechen funktionieren mit geöffneter Tastatur. |

## Übergabe an das iPad

Das Plugin-Assetpaket enthält ausschließlich die drei Build-Dateien und Prüfsummen, keine produktiven Notizen oder Plugin-Konfigurationen. In einem separaten iPad-Test-Vault unter `.obsidian/plugins/picturefish-obsidian-navigator/` ablegen. Templater dort über den bestehenden vertrauenswürdigen Installationsweg aktivieren. Vorlagen und synthetischen Bestand lokal in denselben Test-Vault übertragen. Den produktiven Vault erst nach vollständiger Abnahme aktualisieren.

Kein Tag, kein GitHub-Release und keine produktive Installation entstehen aus diesem Dokument. Veröffentlichung und produktive Aktualisierung benötigen den jeweiligen Auftrag.
