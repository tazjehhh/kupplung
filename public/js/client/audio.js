// Alle Geräusche werden live mit der Web Audio API erzeugt – keine Audiodateien nötig.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem("wk.muted") === "1";
    this.loops = new Map();
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("wk.muted", this.muted ? "1" : "0");
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  get ready() {
    return this.ctx && this.ctx.state === "running" && !this.muted;
  }

  // ---------- Bausteine ----------

  env(gainNode, t, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  noiseBurst({ type = "lowpass", f0 = 1000, f1 = f0, q = 1, dur = 0.3, vol = 0.5, attack = 0.005, delay = 0, pan = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gain = ctx.createGain();
    this.env(gain, t, attack, vol, dur);
    let node = src.connect(filter).connect(gain);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + attack + dur + 0.05);
  }

  tone({ type = "sine", f0 = 440, f1 = f0, dur = 0.2, vol = 0.3, attack = 0.005, delay = 0, vibrato = 0, vibratoDepth = 0, filter = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = vibrato;
      depth.gain.value = vibratoDepth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + attack + dur + 0.05);
    }
    const gain = ctx.createGain();
    this.env(gain, t, attack, vol, dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filter;
      node = node.connect(f);
    }
    node.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + dur + 0.05);
  }

  // ---------- Effekte ----------

  explosion(size = 40) {
    if (!this.ready) return;
    const s = Math.min(1.6, size / 50);
    this.noiseBurst({ f0: 2400 * s + 400, f1: 120, dur: 0.35 + s * 0.5, vol: 0.5 + s * 0.3 });
    this.tone({ f0: 110, f1: 35, dur: 0.3 + s * 0.4, vol: 0.6 * s + 0.2 });
    if (size > 70) this.noiseBurst({ f0: 600, f1: 60, dur: 1.4, vol: 0.4, delay: 0.05 });
  }

  play(name) {
    if (!this.ready) return;
    switch (name) {
      case "launch":
        this.noiseBurst({ type: "bandpass", f0: 400, f1: 2200, q: 2, dur: 0.45, vol: 0.5 });
        this.tone({ type: "sawtooth", f0: 90, f1: 60, dur: 0.25, vol: 0.12, filter: 600 });
        break;
      case "throw":
        this.noiseBurst({ type: "highpass", f0: 1200, f1: 3000, dur: 0.14, vol: 0.25 });
        break;
      case "bounce":
        this.tone({ f0: 320, f1: 140, dur: 0.07, vol: 0.25 });
        break;
      case "shotgun":
        this.noiseBurst({ f0: 5000, f1: 300, dur: 0.3, vol: 0.8, attack: 0.002 });
        this.tone({ type: "square", f0: 160, f1: 50, dur: 0.12, vol: 0.2 });
        this.noiseBurst({ type: "bandpass", f0: 1500, f1: 1200, q: 3, dur: 0.08, vol: 0.25, delay: 0.45 });
        break;
      case "jump":
        this.tone({ f0: 280, f1: 620, dur: 0.12, vol: 0.18 });
        break;
      case "splash":
        this.noiseBurst({ type: "bandpass", f0: 1400, f1: 200, q: 1.5, dur: 0.7, vol: 0.5 });
        this.tone({ f0: 500, f1: 120, dur: 0.25, vol: 0.15 });
        break;
      case "bat":
        this.noiseBurst({ type: "bandpass", f0: 2000, f1: 600, q: 2, dur: 0.12, vol: 0.6, attack: 0.001 });
        this.tone({ type: "triangle", f0: 220, f1: 90, dur: 0.15, vol: 0.4 });
        break;
      case "punch":
        this.tone({ type: "square", f0: 140, f1: 50, dur: 0.18, vol: 0.3, filter: 900 });
        this.noiseBurst({ f0: 1800, f1: 200, dur: 0.15, vol: 0.4 });
        break;
      case "holy": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => {
          this.tone({ type: "sawtooth", f0: f, f1: f * 1.002, dur: 1.4, vol: 0.06, attack: 0.25, vibrato: 5.5, vibratoDepth: 4, filter: 2200 });
          this.tone({ type: "sine", f0: f / 2, f1: f / 2, dur: 1.4, vol: 0.08, attack: 0.3, delay: i * 0.02 });
        });
        break;
      }
      case "baa":
        this.tone({ type: "sawtooth", f0: 380, f1: 330, dur: 0.55, vol: 0.18, vibrato: 28, vibratoDepth: 35, filter: 1600 });
        break;
      case "supersheep":
        this.tone({ type: "triangle", f0: 300, f1: 1400, dur: 0.6, vol: 0.2 });
        this.play("baa");
        break;
      case "granny":
        this.tone({ type: "sawtooth", f0: 210, f1: 170, dur: 0.6, vol: 0.12, vibrato: 9, vibratoDepth: 25, filter: 900 });
        break;
      case "donkey":
        this.tone({ type: "sawtooth", f0: 620, f1: 540, dur: 0.25, vol: 0.14, filter: 2000 });
        this.tone({ type: "sawtooth", f0: 260, f1: 210, dur: 0.4, vol: 0.16, filter: 1200, delay: 0.27 });
        break;
      case "beep":
        this.tone({ type: "square", f0: 1100, f1: 1100, dur: 0.07, vol: 0.12 });
        break;
      case "fizzle":
        this.noiseBurst({ type: "highpass", f0: 3000, f1: 1500, dur: 0.8, vol: 0.25 });
        break;
      case "fire":
        for (let i = 0; i < 6; i++) this.noiseBurst({ f0: 900, f1: 300, dur: 0.15, vol: 0.2, delay: i * 0.12 });
        break;
      case "fuse":
        this.noiseBurst({ type: "highpass", f0: 4000, f1: 6000, dur: 0.5, vol: 0.15 });
        break;
      case "tele":
        this.tone({ type: "sine", f0: 200, f1: 1800, dur: 0.4, vol: 0.2 });
        this.tone({ type: "triangle", f0: 1200, f1: 2400, dur: 0.3, vol: 0.08, delay: 0.1, vibrato: 30, vibratoDepth: 100 });
        break;
      case "rope":
        this.noiseBurst({ type: "highpass", f0: 2500, f1: 5000, dur: 0.09, vol: 0.3 });
        break;
      case "jet":
        this.noiseBurst({ type: "bandpass", f0: 300, f1: 700, q: 1, dur: 0.4, vol: 0.3 });
        break;
      case "plane":
        this.noiseBurst({ type: "lowpass", f0: 300, f1: 800, dur: 2.2, vol: 0.35, attack: 0.6 });
        this.tone({ type: "sawtooth", f0: 70, f1: 90, dur: 2, vol: 0.06, attack: 0.5, filter: 300 });
        break;
      case "collect":
        [660, 880, 1320].forEach((f, i) => this.tone({ type: "square", f0: f, f1: f, dur: 0.07, vol: 0.1, delay: i * 0.07 }));
        break;
      case "crate":
        this.noiseBurst({ type: "lowpass", f0: 500, f1: 200, dur: 0.5, vol: 0.25, attack: 0.1 });
        break;
      case "thud":
        this.tone({ f0: 100, f1: 40, dur: 0.15, vol: 0.4 });
        break;
      case "turn":
        this.tone({ type: "triangle", f0: 660, f1: 660, dur: 0.12, vol: 0.15 });
        this.tone({ type: "triangle", f0: 880, f1: 880, dur: 0.2, vol: 0.15, delay: 0.12 });
        break;
      case "myturn":
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: "triangle", f0: f, f1: f, dur: 0.14, vol: 0.18, delay: i * 0.09 }));
        break;
      case "tick":
        this.tone({ type: "square", f0: 1500, f1: 1500, dur: 0.025, vol: 0.08 });
        break;
      case "suddendeath":
        for (let i = 0; i < 3; i++) this.tone({ type: "sawtooth", f0: 500, f1: 900, dur: 0.35, vol: 0.12, delay: i * 0.4, filter: 2500 });
        break;
      case "dying":
        this.tone({ type: "triangle", f0: 600, f1: 150, dur: 0.6, vol: 0.15 });
        break;
      case "hurt":
        this.tone({ type: "triangle", f0: 520, f1: 300, dur: 0.15, vol: 0.12, vibrato: 20, vibratoDepth: 40 });
        break;
      case "victory":
        [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone({ type: "square", f0: f, f1: f, dur: i === 5 ? 0.6 : 0.13, vol: 0.12, delay: i * 0.14, filter: 3000 }));
        break;
      case "click":
        this.tone({ type: "square", f0: 900, f1: 600, dur: 0.03, vol: 0.08 });
        break;
      case "small":
        this.noiseBurst({ f0: 1500, f1: 300, dur: 0.15, vol: 0.25 });
        break;
    }
  }

  // Dauergeräusch (z. B. Jetpack), an/aus pro Frame
  loop(name, on) {
    if (!this.ctx) return;
    const cur = this.loops.get(name);
    if (on && !cur && !this.muted) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = name === "jet" ? 420 : 900;
      f.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.35, this.ctx.currentTime + 0.08);
      src.connect(f).connect(g).connect(this.master);
      src.start();
      this.loops.set(name, { src, g });
    } else if (!on && cur) {
      cur.g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
      cur.src.stop(this.ctx.currentTime + 0.12);
      this.loops.delete(name);
    }
  }

  stopAll() {
    for (const name of [...this.loops.keys()]) this.loop(name, false);
  }
}
