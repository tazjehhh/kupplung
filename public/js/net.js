import { HostRoom } from "./host.js";

// Verbindungen zwischen den Browsern laufen Peer-to-Peer über WebRTC (Bibliothek PeerJS,
// global als `Peer` geladen). Der öffentliche PeerJS-Server vermittelt nur den Verbindungsaufbau.
// Der Gastgeber registriert sich unter der Raum-ID, alle anderen verbinden sich zu ihm.

const PREFIX = "wurmkrieg-";
const CHUNK = 15000; // WebRTC-Nachrichten bis 16 KB funktionieren in allen Browsern
const CHUNK_TAG = "#";
const PING_MS = 4000;
const TIMEOUT_MS = 25000;
const HOST_KEY = "wk.host";
const SIGNAL_ERRORS = new Set(["network", "server-error", "socket-error", "socket-closed"]);

// Für Tests ohne Internet: ?peer=127.0.0.1:9000 nutzt einen lokalen PeerJS-Server
function peerOptions() {
  const custom = new URLSearchParams(location.search).get("peer");
  if (!custom) return { debug: 0 };
  const [host, port] = custom.split(":");
  return { host, port: Number(port) || 9000, path: "/", secure: false, debug: 0, config: { iceServers: [] } };
}

export function hostedRoom() {
  return sessionStorage.getItem(HOST_KEY);
}

function loadHosted(code) {
  if (sessionStorage.getItem(HOST_KEY) !== code) return null;
  try {
    return JSON.parse(sessionStorage.getItem(`${HOST_KEY}.${code}`) ?? "null");
  } catch {
    return null;
  }
}

// Zerlegt große Nachrichten und hält die Verbindung mit Pings am Leben.
class Channel {
  constructor(dc, onText, onClose) {
    this.dc = dc;
    this.onClose = onClose;
    this.parts = new Map();
    this.nextId = 1;
    this.closed = false;
    this.lastSeen = Date.now();
    dc.on("data", (data) => {
      this.lastSeen = Date.now();
      if (typeof data !== "string" || data === "ping") return;
      if (data.startsWith(CHUNK_TAG)) this.chunk(data, onText);
      else onText(data);
    });
    dc.on("close", () => this.shutdown());
    dc.on("error", () => this.close());
    this.timer = setInterval(() => {
      if (Date.now() - this.lastSeen > TIMEOUT_MS) this.close();
      else this.raw("ping");
    }, PING_MS);
  }

  raw(text) {
    if (!this.dc.open) return;
    try {
      this.dc.send(text);
    } catch {}
  }

  send(text) {
    if (text.length <= CHUNK) return this.raw(text);
    const id = this.nextId++;
    const pieces = [];
    for (let i = 0; i < text.length; ) {
      let end = Math.min(text.length, i + CHUNK);
      // Keine Emoji-Hälften (Surrogatpaare) auseinanderreißen
      const code = text.charCodeAt(end - 1);
      if (end < text.length && code >= 0xd800 && code <= 0xdbff) end--;
      pieces.push(text.slice(i, end));
      i = end;
    }
    pieces.forEach((p, i) => this.raw(`${CHUNK_TAG}${id}|${i}|${pieces.length}|${p}`));
  }

  chunk(data, onText) {
    const [id, i, n] = data.slice(1).split("|", 3);
    const head = CHUNK_TAG.length + id.length + i.length + n.length + 3;
    let entry = this.parts.get(id);
    if (!entry) this.parts.set(id, (entry = []));
    entry[Number(i)] = data.slice(head);
    if (entry.filter((x) => x !== undefined).length === Number(n)) {
      this.parts.delete(id);
      onText(entry.join(""));
    }
  }

  close() {
    try {
      this.dc.close();
    } catch {}
    this.shutdown();
  }

  shutdown() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    this.onClose();
  }
}

// Gastgeber: betreibt den Raum (HostRoom) und spricht selbst über eine interne Verbindung mit ihm.
export class HostNet {
  constructor(code, me, makeHello, onMessage) {
    this.code = code;
    this.isHost = true;
    this.onMessage = onMessage;
    this.connected = true;
    this.closed = false;
    this.queue = [];
    this.guests = new Set();
    const saved = loadHosted(code);
    this.room = new HostRoom(me, saved);
    this.room.onSave = (state) => this.persist(state);
    if (saved?.room?.phase === "game") setTimeout(() => !this.closed && this.room.checkAuth(), 8000);
    sessionStorage.setItem(HOST_KEY, code);
    this.local = { pid: null, send: (text) => this.deliver(text), close() {} };
    this.room.attach(this.local);
    this.startPeer(0);
    queueMicrotask(() => {
      onMessage({ t: "_open" });
      this.send(makeHello());
    });
  }

  // Nachrichten an den eigenen Client asynchron und in Reihenfolge zustellen,
  // genau wie bei einer echten Netzwerkverbindung
  deliver(text) {
    this.queue.push(text);
    if (this.queue.length === 1) queueMicrotask(() => this.flush());
  }

  flush() {
    while (this.queue.length) {
      const text = this.queue[0];
      try {
        if (!this.closed) this.onMessage(JSON.parse(text));
      } catch (err) {
        console.error(err);
      }
      this.queue.shift();
    }
  }

  persist(state) {
    try {
      sessionStorage.setItem(`${HOST_KEY}.${this.code}`, JSON.stringify(state));
    } catch {}
  }

  startPeer(attempt) {
    if (this.closed) return;
    const peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on("open", () => this.onMessage({ t: "_online" }));
    peer.on("connection", (dc) => this.acceptGuest(dc));
    peer.on("disconnected", () => {
      setTimeout(() => !this.closed && !peer.destroyed && peer.disconnected && peer.reconnect(), 1500);
    });
    peer.on("error", (err) => {
      if (this.closed || this.peer !== peer) return;
      if (err.type === "unavailable-id") {
        // Nach einem Reload ist die alte Raum-ID oft noch ein paar Sekunden belegt
        peer.destroy();
        if (attempt < 20) setTimeout(() => this.startPeer(attempt + 1), 1500);
        else this.onMessage({ t: "_error", error: "taken" });
      } else if (SIGNAL_ERRORS.has(err.type)) {
        this.onMessage({ t: "_error", error: "signal" });
        peer.destroy();
        setTimeout(() => this.startPeer(0), 4000);
      }
    });
  }

  acceptGuest(dc) {
    const conn = { pid: null, send: (text) => channel.send(text), close: () => channel.close() };
    const channel = new Channel(dc, (text) => this.room.receive(conn, text), () => {
      this.guests.delete(channel);
      this.room.detach(conn);
    });
    this.guests.add(channel);
    dc.on("open", () => this.room.attach(conn));
  }

  guestCount() {
    return this.room.onlinePids().size - 1;
  }

  send(msg) {
    this.sendRaw(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  sendRaw(text) {
    if (!this.closed) this.room.receive(this.local, text);
  }

  close() {
    if (this.closed) return;
    this.room.conns.delete(this.local);
    this.room.closeAll();
    this.closed = true;
    sessionStorage.removeItem(HOST_KEY);
    sessionStorage.removeItem(`${HOST_KEY}.${this.code}`);
    // Kurz warten, damit "roomclosed" noch rausgeht
    setTimeout(() => this.peer?.destroy(), 300);
  }
}

// Mitspieler: verbindet sich zum Gastgeber und verbindet sich bei Abbrüchen automatisch neu.
export class GuestNet {
  constructor(code, makeHello, onMessage) {
    this.code = code;
    this.isHost = false;
    this.makeHello = makeHello;
    this.onMessage = onMessage;
    this.connected = false;
    this.closed = false;
    this.retries = 0;
    this.channel = null;
    const peer = new Peer(peerOptions());
    this.peer = peer;
    peer.on("open", () => this.connect());
    peer.on("disconnected", () => {
      setTimeout(() => !this.closed && !peer.destroyed && peer.disconnected && peer.reconnect(), 1500);
    });
    peer.on("error", (err) => {
      if (this.closed) return;
      if (err.type === "peer-unavailable") {
        this.dropChannel();
        this.onMessage({ t: "_error", error: "notfound" });
        this.retry();
      } else if (SIGNAL_ERRORS.has(err.type)) {
        this.onMessage({ t: "_error", error: "signal" });
      }
    });
  }

  connect() {
    if (this.closed || this.channel || this.peer.disconnected) return;
    const dc = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: "raw" });
    let opened = false;
    const channel = new Channel(dc, (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      this.onMessage(msg);
    }, () => {
      if (this.channel === channel) this.channel = null;
      this.connected = false;
      if (opened) this.onMessage({ t: "_closed" });
      this.retry();
    });
    this.channel = channel;
    dc.on("open", () => {
      opened = true;
      this.connected = true;
      this.retries = 0;
      channel.send(JSON.stringify(this.makeHello()));
      this.onMessage({ t: "_open" });
    });
    // Hängt der Verbindungsaufbau, nach einer Weile neu versuchen
    setTimeout(() => !opened && channel === this.channel && channel.close(), 15000);
  }

  dropChannel() {
    const ch = this.channel;
    this.channel = null;
    if (ch) {
      ch.onClose = () => {};
      ch.close();
    }
  }

  retry() {
    if (this.closed) return;
    clearTimeout(this.retryTimer);
    const delay = Math.min(5000, 700 * 2 ** this.retries++);
    this.retryTimer = setTimeout(() => {
      if (this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
      else this.connect();
    }, delay);
  }

  send(msg) {
    this.sendRaw(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  sendRaw(text) {
    this.channel?.send(text);
  }

  close() {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.dropChannel();
    this.peer.destroy();
  }
}
