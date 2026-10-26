# 🪱 Wurmkrieg

Ein Worms-Klon für den Browser: rundenbasiertes Explosions-Chaos für **bis zu 6 Spieler online**, jeder an seinem eigenen PC.
Läuft als reine Webseite auf GitHub Pages, die Spieler verbinden sich direkt miteinander (Peer-to-Peer).
Kein Server, kein Account, keine Kosten.

## Features

- **Online-Multiplayer** über Raum-Code oder Link, Lobby mit Chat, Wiedereinstieg nach Neuladen
- **Zufällige, zerstörbare Karten** (Hügel, Inseln, Höhlen) in 5 Landschaften: Wiese, Wüste, Schnee, Süßkram, Vulkan
- **18 Waffen** in vier Paketen
  - Basis: Bazooka, Granate, Schrotflinte, Baseballschläger, Feuerschlag
  - Klassiker: Clustergranate, Bananenbombe, Heilige Handgranate, Dynamit, Luftschlag
  - Bewegung: Ninja-Seil, Teleport, Jetpack, Bungee
  - Verrücktes: Schaf, Super-Schaf, Alte Frau, Betonesel
- Wind, Fallschaden, Wasser, **Waffen- und Gesundheitskisten**, **Minen & Ölfässer** mit Kettenreaktionen
- **Sudden Death** mit steigendem Wasser
- **Einstellbare Regeln** in der Lobby: Würmer pro Team, Lebenspunkte, Zugzeit, Kartengröße, Munition pro Waffe, …
- Sound wird live im Browser erzeugt (keine Audiodateien)
- Übungsmodus: allein starten und Waffen ausprobieren

## Steuerung

| Taste | Aktion |
| --- | --- |
| `←` `→` | Laufen |
| `↑` `↓` | Zielen |
| `Enter` | Sprung nach vorn |
| `Backspace` | Rückwärtssalto |
| `Leertaste` | Feuern (gedrückt halten = mehr Kraft) |
| `1`–`5` | Zünder für Granaten |
| Rechtsklick / `Q` | Waffenmenü |
| Linksklick | Ziel setzen (Luftschlag, Teleport, Betonesel) |
| Maus ziehen / Mausrad | Kamera verschieben / zoomen |
| `C` | Kamera zurück zum Wurm |
| `T` | Chat |
| `M` / `H` / `Esc` | Ton / Hilfe / Menü |

## Online stellen (GitHub Pages)

1. Im Repo auf GitHub unter **Settings → Pages** bei „Source“ **GitHub Actions** auswählen.
2. Den Code auf den Branch `main` bringen (mergen). Der Workflow `.github/workflows/deploy.yml` testet das Spiel
   und veröffentlicht den Ordner `public/` automatisch, nach jedem weiteren Push auf `main` erneut.
3. Das Spiel liegt dann unter **https://tazjehhh.github.io/kupplung/**. Namen eingeben, **Neuen Raum erstellen**
   und den Link an deine Freunde schicken.

Das Spiel ist eine rein statische Seite. Statt GitHub Pages funktioniert also jeder Webspace, auf den man den Ordner `public/` hochladen kann.

## Lokal entwickeln

```bash
npm run dev     # startet http://localhost:8080
npm test        # Tests von Spielsimulation und Raum-Logik
```

Es werden keine Pakete benötigt, nur Node.js ≥ 20. Zum Testen mit mehreren Spielern einfach mehrere Browser-Tabs öffnen:
Jeder Tab ist ein eigener Spieler. Für den Verbindungsaufbau braucht es Internet (siehe unten).

## Wie es funktioniert

```
public/                 Spiel (reines JavaScript, kein Build-Schritt)
  js/game/              Simulation: Gelände, Physik, Waffen, Zugablauf (läuft auch in Node)
  js/client/            Darstellung, Eingabe, Sound, HUD, Abgleich der Spielstände
  js/host.js            Raum-Logik (Lobby, Zugwechsel, Wiedereinstieg), läuft beim Gastgeber
  js/net.js             Peer-to-Peer-Verbindungen über WebRTC
  js/main.js, lobby.js  Startbildschirm und Lobby
  vendor/peerjs.min.js  PeerJS (MIT-Lizenz)
scripts/serve.js        Mini-Webserver für die lokale Entwicklung
test/                   Tests (node --test)
```

- Wer einen Raum erstellt, ist **Gastgeber**: Der Raum läuft in seinem Browser-Tab, alle anderen verbinden sich per
  WebRTC direkt zu ihm. Der öffentliche [PeerJS](https://peerjs.com)-Server vermittelt nur den Verbindungsaufbau,
  danach laufen die Daten direkt zwischen den Browsern (oder über die Relay-Server von PeerJS, falls ein Netzwerk
  keine direkte Verbindung erlaubt).
- Der Spieler, der gerade **am Zug ist**, berechnet die Physik in seinem Browser und schickt ~30-mal pro Sekunde
  die Änderungen an alle anderen. So hat der aktive Spieler keinerlei Eingabeverzögerung.
- Bei jedem Zugwechsel wird ein kompletter Spielstand (Checkpoint) verschickt, damit alle exakt synchron bleiben.
- Wer die Seite neu lädt, steigt sofort wieder ein, auch der Gastgeber. Verlässt der aktive Spieler das Spiel,
  übernimmt automatisch ein anderer die Simulation.

**Grenzen:** Schließt der Gastgeber seinen Tab endgültig, ist der Raum für alle beendet. In sehr strengen Netzwerken
(manche Firmen- oder Uni-WLANs) kann der Verbindungsaufbau scheitern.
