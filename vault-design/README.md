# Gemeinsames Vault-Design

CF-PFNAV-0005. Der am 04.10.2026 freigegebene Entwurf steht im Vault-Projekt
`02 Projekte/picturefish-obsidian-navigator/Notes/2026-10-04 Farbsteuerung im produktiven Vault.md`.

`node scripts/build-vault-design.mjs` erzeugt `vault-design/dist/venezia.css` mit
vier eingebetteten normalen Picturefish-Sans-Schnitten. Das erzeugte Snippet
wird als `.obsidian/snippets/venezia.css` ausgeliefert. Der Plugin-Build bleibt
0.3.0; diese Auslieferung aktualisiert das separate Vault-Design.

Style Settings zeigt unter der vorhandenen ID `venezia` den Bereich
**Vault-Design**. Die gespeicherten Werte für Lesebreite, Schriftgröße und
Typografie behalten ihre Kennungen. Grundfläche, Darstellung und Zellabstand
kommen hinzu. Farben für hell/dunkel sind getrennt konfigurierbar. System folgt
der Betriebssystem-Darstellung; ein explizites Plugin-Theme bleibt gesondert.

Die gemeinsamen CSS-Regeln richten Navigator, Notizen und beide Tabellenarten
an derselben Palette aus. Der bisherige Farbmix bleibt als Vergleichsoption
verfügbar. Normale Schriftbreite gilt auch unter 840 px. Starre Mindest- und
Spaltenbreiten werden in den gemeinsamen Tabellenregeln aufgehoben.

Die Schriftdateien stammen aus dem bestehenden Projekt `venezia-sans/web/`.
Lizenz: SIL OFL 1.1, siehe `fonts/OFL.txt`. Die frühere Venezia-CSS ist die
Kompatibilitätsbasis für bestehende Layout- und Spezialansichtsregeln.

Vor Installation Snippet, appearance.json und Style-Settings-Daten sichern.
Nur das aktivierte Snippet ersetzen und Style Settings neu einlesen. Keine
Einstellungen anderer Plugins oder die aktive Obsidian-Theme-Auswahl ersetzen.
