# Phoenix Context Blueprint

Status: LOCKED

## Ziel

Phoenix benötigt eine zentrale Kontext-Datei, damit ein neuer Chat den kompletten Projektstand sofort verstehen kann.

Diese Datei soll später automatisch aktualisiert werden.

Geplante Kontext-Datei:

.phoenix/PHOENIX_CONTEXT.md

## Inhalt von PHOENIX_CONTEXT.md

Die Datei muss enthalten:

- Projektname
- aktuelle Version
- aktuelle Stage
- aktueller Meilenstein
- letzter abgeschlossener Schritt
- nächster geplanter Schritt
- Architekturstatus
- PDS-Regeln
- Ordnerstruktur
- Core-Struktur
- Roadmap-Zusammenfassung
- wichtige Projektentscheidungen
- offene Aufgaben
- Git-Status
- letzter Commit
- Hinweise für neuen Chat

## Automatische Aktualisierung

Die Datei soll später durch ein Tool aktualisiert werden:

tools/phoenix_finish.py

Dieses Tool soll später:

- CHANGELOG.md aktualisieren
- PROJECT_STATE.md aktualisieren
- .phoenix/state.json aktualisieren
- manifest/version.json prüfen oder erhöhen
- .phoenix/PHOENIX_CONTEXT.md neu erzeugen
- Phoenix Resume Report erzeugen
- Git-Status prüfen
- Git-Commit erstellen
- optional Git-Tag erstellen

## Neuer-Chat-Regel

Wenn ein neuer Chat gestartet wird, reicht später dieser Hinweis:

PHOENIX RESUME starten.
Lies .phoenix/PHOENIX_CONTEXT.md und arbeite strikt nach PDS weiter.

## Regeln

- PHOENIX_CONTEXT.md ist die zentrale Übergabe-Datei.
- Sie wird nicht manuell gepflegt, sobald phoenix_finish.py existiert.
- Sie darf keine Architektur ändern.
- Sie fasst nur den aktuellen Projektstand zusammen.
- Sie muss immer verständlich für einen neuen Chat sein.

## Zusätzliche Maschinen-Datei

Neben der Markdown-Datei soll später zusätzlich eine JSON-Datei erzeugt werden:

.phoenix/PHOENIX_CONTEXT.json

Zweck:

- PHOENIX_CONTEXT.md ist für Menschen und neue Chats.
- PHOENIX_CONTEXT.json ist für Tools, Dashboard, Automatisierung und Tests.

Beide Dateien müssen später aus derselben Datenbasis erzeugt werden.

## Zusätzliche Maschinen-Datei

Neben der Markdown-Datei soll später zusätzlich eine JSON-Datei erzeugt werden:

.phoenix/PHOENIX_CONTEXT.json

Zweck:

- PHOENIX_CONTEXT.md ist für Menschen und neue Chats.
- PHOENIX_CONTEXT.json ist für Tools, Dashboard, Automatisierung und Tests.

Beide Dateien müssen später aus derselben Datenbasis erzeugt werden.
