const KEYMAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  Space: "fire",
};

// Tastatur und Maus. Spiel-Eingaben werden pro Simulations-Tick mit consume() abgeholt.
export class Input {
  constructor(client, canvas) {
    this.client = client;
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = null;
    this.drag = null;
    this.reset();

    this.listeners = [
      [window, "keydown", (e) => this.keyDown(e)],
      [window, "keyup", (e) => this.keys.delete(KEYMAP[e.code])],
      [window, "blur", () => this.keys.clear()],
      [canvas, "mousedown", (e) => this.mouseDown(e)],
      [window, "mousemove", (e) => this.mouseMove(e)],
      [window, "mouseup", (e) => this.mouseUp(e)],
      [canvas, "contextmenu", (e) => {
        e.preventDefault();
        client.toggleWeaponMenu();
      }],
      [canvas, "wheel", (e) => {
        e.preventDefault();
        client.zoom(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY);
      }, { passive: false }],
    ];
    for (const [target, type, fn, opts] of this.listeners) target.addEventListener(type, fn, opts);
  }

  destroy() {
    for (const [target, type, fn, opts] of this.listeners) target.removeEventListener(type, fn, opts);
  }

  reset() {
    this.pressed = { fire: false, jump: false, back: false };
    this.fuse = 0;
    this.select = null;
    this.click = null;
  }

  consume() {
    const k = this.keys;
    const inp = {
      left: k.has("left"), right: k.has("right"), up: k.has("up"), down: k.has("down"), fire: k.has("fire"),
      pressed: this.pressed, fuse: this.fuse, select: this.select, click: this.click,
    };
    this.reset();
    return inp;
  }

  keyDown(e) {
    const c = this.client;
    c.app.sound.unlock();
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.code === "Escape") {
      e.preventDefault();
      c.escape();
      return;
    }
    if (c.panelOpen()) {
      if (e.code === "KeyQ") c.toggleWeaponMenu(false);
      if (e.code === "KeyH") c.toggleHelp(false);
      return;
    }
    const action = KEYMAP[e.code];
    if (action) {
      e.preventDefault();
      if (!e.repeat && action === "fire") this.pressed.fire = true;
      this.keys.add(action);
      return;
    }
    switch (e.code) {
      case "Enter":
      case "NumpadEnter":
        e.preventDefault();
        if (!e.repeat) this.pressed.jump = true;
        break;
      case "Backspace":
        e.preventDefault();
        if (!e.repeat) this.pressed.back = true;
        break;
      case "Digit1": case "Digit2": case "Digit3": case "Digit4": case "Digit5":
        this.fuse = Number(e.code.slice(5));
        c.app.sound.play("click");
        break;
      case "KeyQ":
        c.toggleWeaponMenu();
        break;
      case "KeyH":
        c.toggleHelp();
        break;
      case "KeyM":
        c.toggleMute();
        break;
      case "KeyC":
        c.recenter();
        break;
      case "KeyT":
        e.preventDefault();
        c.openChat();
        break;
      case "Tab":
        e.preventDefault();
        break;
    }
  }

  mouseDown(e) {
    this.client.app.sound.unlock();
    if (e.button !== 0) return;
    this.drag = { sx: e.clientX, sy: e.clientY, cx: this.client.cam.x, cy: this.client.cam.y, moved: false };
  }

  mouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 6) d.moved = true;
    if (d.moved) this.client.pan(d.cx - dx / this.client.cam.zoom, d.cy - dy / this.client.cam.zoom);
  }

  mouseUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved || e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    this.client.clickAt(e.clientX - rect.left, e.clientY - rect.top);
  }
}
