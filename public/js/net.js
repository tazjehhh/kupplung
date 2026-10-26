// WebSocket-Verbindung zum Raum mit automatischem Wiederverbinden.
export class Net {
  constructor(room, makeHello, onMessage) {
    this.room = room;
    this.makeHello = makeHello;
    this.onMessage = onMessage;
    this.ws = null;
    this.closed = false;
    this.retries = 0;
    this.connected = false;
    this.connect();
    this.pingTimer = setInterval(() => this.sendRaw("ping"), 20000);
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/${this.room}`);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retries = 0;
      ws.send(JSON.stringify(this.makeHello()));
      this.onMessage({ t: "_open" });
    };
    ws.onmessage = (e) => {
      if (e.data === "pong") return;
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      this.onMessage(msg, e.data);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.connected = false;
      this.onMessage({ t: "_closed", code: e.code });
      if (this.closed || e.code === 4000 || e.code === 4001) return;
      const delay = Math.min(8000, 500 * 2 ** this.retries++);
      setTimeout(() => !this.closed && this.connect(), delay);
    };
  }

  send(msg) {
    this.sendRaw(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  sendRaw(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(text);
  }

  close() {
    this.closed = true;
    clearInterval(this.pingTimer);
    this.ws?.close(1000, "bye");
  }
}
