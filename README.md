# 🪱 Wurmkrieg

Ein Worms-Klon für den Browser: rundenbasiertes Explosions-Chaos für **bis zu 6 Spieler online**, jeder an seinem eigenen PC.
Läuft komplett auf Cloudflare Workers (kostenloser Plan reicht), kein eigener Server nötig.

## Features

- **Online-Multiplayer** über Raum-Code oder Link, Lobby mit Chat, Reconnect nach Neuladen
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

## Online stellen (Cloudflare)

Du brauchst einen kostenlosen [Cloudflare-Account](https://dash.cloudflare.com/sign-up) und Node.js ≥ 20.

```bash
npm install
npx wrangler login      # öffnet den Browser zum Anmelden
npm run deploy
```

Wrangler gibt danach eine Adresse wie `https://wurmkrieg.<dein-name>.workers.dev` aus.
Diese Adresse öffnen, Namen eingeben, **Neuen Raum erstellen** und den Link an deine Freunde schicken.

Beim ersten Deploy fragt Cloudflare evtl. nach einer `workers.dev`-Subdomain, die kannst du frei wählen.
Der Raum-Server nutzt Durable Objects mit SQLite-Speicher; die sind im kostenlosen Workers-Plan enthalten.

## Lokal entwickeln

```bash
npm install
npm run dev     # startet http://localhost:8787 inkl. Raum-Server
npm test        # Tests der Spielsimulation
```

Zum Testen mit mehreren Spielern einfach mehrere Browser-Tabs öffnen: jeder Tab ist ein eigener Spieler.

## Wie es funktioniert

```
public/                 Spiel (reines JavaScript, kein Build-Schritt)
  js/game/              Simulation: Gelände, Physik, Waffen, Zugablauf (läuft auch in Node)
  js/client/            Darstellung, Eingabe, Sound, HUD, Netzwerk-Abgleich
  js/main.js, lobby.js  Startbildschirm und Lobby
src/worker.js           Cloudflare Worker + Durable Object pro Raum
test/                   Tests der Simulation (node --test)
```

- Der Spieler, der gerade **am Zug ist**, berechnet die Physik in seinem Browser und schickt ~30-mal pro Sekunde
  die Änderungen an alle anderen. So hat der aktive Spieler keinerlei Eingabeverzögerung.
- Bei jedem Zugwechsel wird ein kompletter Spielstand (Checkpoint) verschickt, damit alle exakt synchron bleiben.
- Der Durable Object hält Lobby und letzten Checkpoint vor: Wer die Seite neu lädt, steigt sofort wieder ein.
  Verlässt der aktive Spieler das Spiel, übernimmt automatisch ein anderer die Simulation.
