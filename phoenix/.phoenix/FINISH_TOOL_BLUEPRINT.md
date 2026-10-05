# Phoenix Finish Tool Blueprint

Status: LOCKED

## Ziel

Phoenix soll abgeschlossene Entwicklungsschritte automatisch festhalten und sich selbst pflegen.

Geplantes Tool:

tools/phoenix_finish.py

## Grundidee

Ein abgeschlossener Schritt soll später mit einem einzigen Befehl beendet werden:

python3 tools/phoenix_finish.py

## Aufgaben des Tools

Das Tool soll später automatisch:

- aktuellen Projektstand prüfen
- Git-Status prüfen
- CHANGELOG.md ergänzen
- .phoenix/state.json aktualisieren
- manifest/version.json prüfen oder erhöhen
- .phoenix/PHOENIX_CONTEXT.md neu erzeugen
- .phoenix/PHOENIX_CONTEXT.json neu erzeugen
- Phoenix Resume Report erzeugen
- Git-Commit erstellen
- optional Git-Tag erstellen
- nächsten Schritt speichern

## Regeln

- Das Tool darf keine Architektur ändern.
- Das Tool darf nur dokumentieren, prüfen und abschließen.
- Jede Versionserhöhung erfolgt automatisch nach festgelegter Regel.
- Git muss nach Abschluss sauber sein.
- PHOENIX_CONTEXT.md ist Ausgabe, nicht manuelle Quelle.
- PHOENIX_CONTEXT.json ist Ausgabe, nicht manuelle Quelle.

## Zielbild

Ein Entwickler baut und testet eine Änderung.

Danach genügt:

python3 tools/phoenix_finish.py

Phoenix übernimmt die Dokumentation, Kontextpflege und Git-Sicherung.

## Architekturentscheidung: Phoenix CLI

Der automatische Abschlussprozess wird langfristig nicht nur über ein einzelnes Finish-Skript laufen.

Stattdessen erhält Phoenix ein zentrales CLI-Werkzeug:

tools/phoenix.py

Geplante Befehle:

- python3 tools/phoenix.py finish
- python3 tools/phoenix.py resume
- python3 tools/phoenix.py doctor
- python3 tools/phoenix.py context
- python3 tools/phoenix.py version
- python3 tools/phoenix.py status
- python3 tools/phoenix.py roadmap
- python3 tools/phoenix.py backup
- python3 tools/phoenix.py release
- python3 tools/phoenix.py next

Ziel:

Phoenix soll Entwicklungsschritte möglichst automatisch erkennen, dokumentieren, abschließen und den nächsten Schritt vorbereiten.

Das bisher geplante tools/phoenix_finish.py wird damit durch das zentrale CLI tools/phoenix.py ersetzt.
