// Alle Geräusche werden live mit der Web Audio API erzeugt – keine Audiodateien nötig.
// Für einen vollen, nicht blechernen Klang: tiefes ("braunes") Rauschen statt weißem,
// Bass-Kicks mit Tonhöhen-Abfall (auch auf Laptop-Lautsprechern hörbar), weiche
// Wellenformen, ein gezähmter Höhenbereich und etwas Raumhall.

const VOLUME = 0.8;

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
      this.setup(new Ctx());
    }
    if (this.ctx.state === "suspended" && !this.offline) this.ctx.resume();
  }

  setup(ctx) {
    this.ctx = ctx;
    this.offline = typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext;
    // Summe → Bass-Anhebung → Höhen absenken → Kompressor → Lautstärke
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : VOLUME;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;
    const highs = ctx.createBiquadFilter();
    highs.type = "highshelf";
    highs.frequency.value = 4500;
    highs.gain.value = -7;
    const lows = ctx.createBiquadFilter();
    lows.type = "lowshelf";
    lows.frequency.value = 200;
    lows.gain.value = 4;
    this.out = ctx.createGain();
    this.out.connect(lows).connect(highs).connect(comp).connect(this.master).connect(ctx.destination);
    // Hall als Effektweg
    this.send = ctx.createGain();
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(1.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.send.connect(reverb).connect(wet).connect(highs);

    this.white = this.noiseBuffer("white");
    this.pink = this.noiseBuffer("pink");
    this.brown = this.noiseBuffer("brown");
  }

  noiseBuffer(color) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === "white") d[i] = w;
      else if (color === "pink") {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  // Künstlicher Raumhall: abklingendes, leicht gedämpftes Rauschen
  impulse(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let smooth = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        smooth += (Math.random() * 2 - 1 - smooth) * (0.35 - t * 0.25);
        d[i] = smooth * (1 - t) ** 3.2 * 0.6;
      }
    }
    return buf;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("wk.muted", this.muted ? "1" : "0");
    if (this.master) this.master.gain.value = this.muted ? 0 : VOLUME;
    return this.muted;
  }

  get ready() {
    return !!this.ctx && !this.muted && (this.offline || this.ctx.state === "running");
  }

  // ---------- Bausteine ----------

  // Signal in die Summe und anteilig in den Hall schicken
  route(node, wet) {
    node.connect(this.out);
    if (wet > 0) {
      const g = this.ctx.createGain();
      g.gain.value = wet;
      node.connect(g).connect(this.send);
    }
  }

  env(gainNode, t, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  noise({ color = "pink", type = "lowpass", f0 = 1000, f1 = f0, q = 0.7, dur = 0.3, vol = 0.5, attack = 0.005, delay = 0, wet = 0.25 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this[color];
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + dur);
    const gain = ctx.createGain();
    this.env(gain, t, attack, vol, dur);
    src.connect(filter).connect(gain);
    this.route(gain, wet);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + dur + 0.05);
  }

  tone({ type = "sine", f0 = 440, f1 = f0, dur = 0.2, vol = 0.3, attack = 0.005, delay = 0, vibrato = 0, vibratoDepth = 0, lowpass = 0, band = 0, q = 1, detune = 0, wet = 0.25 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune;
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
    let node = osc;
    if (band) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = band;
      f.Q.value = q;
      node = node.connect(f);
    }
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      node = node.connect(f);
    }
    const gain = ctx.createGain();
    this.env(gain, t, attack, vol, dur);
    node.connect(gain);
    this.route(gain, wet);
    osc.start(t);
    osc.stop(t + attack + dur + 0.05);
  }

  // Bass-Schlag wie eine Kick-Drum: Tonhöhe fällt schnell ab, dadurch auch auf kleinen Lautsprechern hörbar
  kick(f0, f1, dur, vol, delay = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + Math.min(0.12, dur * 0.4));
    const gain = ctx.createGain();
    this.env(gain, t, 0.003, vol, dur);
    osc.connect(gain);
    this.route(gain, 0.1);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Weicher Glockenton (Grundton plus leise Oktave)
  bell(freq, delay = 0, vol = 0.15, dur = 0.5) {
    this.tone({ f0: freq, dur, vol, attack: 0.004, delay, wet: 0.45 });
    this.tone({ f0: freq * 2, dur: dur * 0.5, vol: vol * 0.3, attack: 0.004, delay, wet: 0.45 });
  }

  // ---------- Effekte ----------

  explosion(size = 40) {
    if (!this.ready) return;
    const s = Math.max(0.3, Math.min(2.2, size / 50));
    // Knall
    this.noise({ color: "white", type: "bandpass", f0: 2200, f1: 900, q: 0.8, dur: 0.06, vol: 0.18 + s * 0.08, attack: 0.001, wet: 0.2 });
    // Körper
    this.noise({ color: "brown", f0: 700 + 500 * s, f1: 80, dur: 0.45 + 0.4 * s, vol: 0.9, attack: 0.004, wet: 0.35 });
    // Druckwelle
    this.kick(140 + 20 * s, 38, 0.3 + 0.25 * s, Math.min(1, 0.55 + 0.25 * s));
    // Nachgrollen bei großen Explosionen
    if (size >= 45) this.noise({ color: "brown", f0: 280, f1: 55, dur: 1 + 0.6 * s, vol: 0.45 + 0.1 * s, attack: 0.08, delay: 0.03, wet: 0.5 });
    // Herabprasselnde Erdbrocken
    for (let i = 0; i < Math.round(2 + s * 2); i++) {
      this.noise({ color: "pink", type: "bandpass", f0: 900 + Math.random() * 700, q: 1.2, dur: 0.05, vol: 0.06, delay: 0.25 + Math.random() * 0.5 * s, wet: 0.3 });
    }
  }

  play(name) {
    if (!this.ready) return;
    switch (name) {
      case "launch":
        this.kick(120, 55, 0.18, 0.4);
        this.noise({ type: "bandpass", f0: 300, f1: 1400, q: 0.9, dur: 0.5, vol: 0.45, attack: 0.02, wet: 0.3 });
        break;
      case "throw":
        this.noise({ type: "bandpass", f0: 700, f1: 1800, q: 1, dur: 0.16, vol: 0.3, attack: 0.02, wet: 0.15 });
        break;
      case "bounce":
        this.tone({ f0: 240, f1: 110, dur: 0.08, vol: 0.3, wet: 0.1 });
        this.noise({ color: "brown", f0: 700, dur: 0.06, vol: 0.25, attack: 0.002, wet: 0.1 });
        break;
      case "shotgun":
        this.noise({ color: "white", type: "bandpass", f0: 2600, f1: 1500, q: 0.7, dur: 0.04, vol: 0.4, attack: 0.001, wet: 0.4 });
        this.noise({ color: "brown", f0: 1800, f1: 180, dur: 0.35, vol: 0.9, attack: 0.002, wet: 0.5 });
        this.kick(170, 50, 0.22, 0.7);
        // Repetieren
        this.noise({ type: "bandpass", f0: 1400, q: 2, dur: 0.03, vol: 0.2, delay: 0.42, wet: 0.1 });
        this.noise({ type: "bandpass", f0: 1100, q: 2, dur: 0.04, vol: 0.2, delay: 0.52, wet: 0.1 });
        break;
      case "jump":
        this.tone({ f0: 260, f1: 480, dur: 0.11, vol: 0.18, wet: 0.1 });
        this.noise({ type: "bandpass", f0: 600, f1: 1200, dur: 0.1, vol: 0.12, wet: 0.1 });
        break;
      case "splash":
        this.noise({ color: "brown", f0: 600, f1: 150, dur: 0.4, vol: 0.5, attack: 0.005, wet: 0.3 });
        this.noise({ type: "bandpass", f0: 1500, f1: 400, q: 0.8, dur: 0.7, vol: 0.4, wet: 0.35 });
        for (let i = 0; i < 4; i++) this.tone({ f0: 700 + Math.random() * 600, f1: 1100 + Math.random() * 500, dur: 0.05, vol: 0.06, delay: 0.1 + Math.random() * 0.4, wet: 0.4 });
        break;
      case "bat":
        this.noise({ color: "white", type: "bandpass", f0: 1700, q: 1.4, dur: 0.05, vol: 0.4, attack: 0.001, wet: 0.2 });
        this.tone({ type: "triangle", f0: 420, f1: 300, dur: 0.12, vol: 0.25, lowpass: 2000, wet: 0.2 });
        this.kick(130, 70, 0.14, 0.45);
        break;
      case "punch":
        this.kick(160, 55, 0.2, 0.8);
        this.noise({ color: "brown", f0: 1200, f1: 300, dur: 0.15, vol: 0.6, attack: 0.002, wet: 0.2 });
        this.noise({ type: "bandpass", f0: 1200, q: 1, dur: 0.04, vol: 0.25, attack: 0.001, wet: 0.2 });
        break;
      case "holy":
        // Engelschor: je Ton zwei leicht verstimmte Stimmen durch einen Vokal-Filter
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          for (const detune of [-7, 7]) {
            this.tone({ type: "sawtooth", f0: f, dur: 1.5, vol: 0.05, attack: 0.35, detune, vibrato: 5.5, vibratoDepth: 3, band: 750 + i * 120, q: 0.8, lowpass: 1800, delay: i * 0.03, wet: 0.7 });
          }
          this.tone({ f0: f / 2, dur: 1.5, vol: 0.07, attack: 0.4, delay: i * 0.03, wet: 0.6 });
        });
        break;
      case "baa":
        this.tone({ type: "sawtooth", f0: 360, f1: 320, dur: 0.55, vol: 0.22, attack: 0.03, vibrato: 26, vibratoDepth: 28, band: 1100, q: 1.2, lowpass: 2600, wet: 0.3 });
        break;
      case "supersheep":
        this.tone({ type: "triangle", f0: 300, f1: 1200, dur: 0.6, vol: 0.18, lowpass: 2500, wet: 0.4 });
        this.play("baa");
        break;
      case "granny":
        this.tone({ type: "sawtooth", f0: 200, f1: 170, dur: 0.6, vol: 0.18, attack: 0.04, vibrato: 8, vibratoDepth: 22, band: 700, q: 1, lowpass: 1400, wet: 0.25 });
        break;
      case "donkey":
        this.tone({ type: "sawtooth", f0: 600, f1: 520, dur: 0.25, vol: 0.18, attack: 0.03, band: 950, q: 1, lowpass: 2200, wet: 0.3 });
        this.tone({ type: "sawtooth", f0: 260, f1: 210, dur: 0.4, vol: 0.22, attack: 0.03, band: 600, q: 1, lowpass: 1400, delay: 0.27, wet: 0.3 });
        break;
      case "beep":
        this.tone({ f0: 1050, dur: 0.07, vol: 0.16, wet: 0.15 });
        break;
      case "fizzle":
        this.noise({ type: "highpass", f0: 2500, f1: 1200, dur: 0.8, vol: 0.18, attack: 0.02, wet: 0.2 });
        break;
      case "fire":
        this.noise({ color: "brown", f0: 900, f1: 200, dur: 0.9, vol: 0.5, attack: 0.03, wet: 0.3 });
        for (let i = 0; i < 6; i++) this.noise({ color: "white", type: "bandpass", f0: 1800 + Math.random() * 1200, q: 2, dur: 0.02, vol: 0.08, delay: Math.random() * 0.8, wet: 0.1 });
        break;
      case "fuse":
        this.noise({ type: "highpass", f0: 2800, dur: 0.5, vol: 0.1, attack: 0.02, wet: 0.1 });
        break;
      case "tele":
        this.tone({ f0: 220, f1: 1760, dur: 0.45, vol: 0.18, wet: 0.6 });
        this.tone({ type: "triangle", f0: 880, f1: 1760, dur: 0.35, vol: 0.06, delay: 0.1, vibrato: 30, vibratoDepth: 80, wet: 0.6 });
        break;
      case "rope":
        this.noise({ type: "bandpass", f0: 2400, f1: 1200, q: 1, dur: 0.07, vol: 0.25, attack: 0.002, wet: 0.15 });
        this.tone({ f0: 900, f1: 400, dur: 0.05, vol: 0.08, wet: 0.1 });
        break;
      case "jet":
        this.noise({ color: "brown", f0: 900, f1: 500, dur: 0.35, vol: 0.4, attack: 0.03, wet: 0.2 });
        break;
      case "plane":
        this.noise({ color: "brown", f0: 260, f1: 520, dur: 2.2, vol: 0.5, attack: 0.6, wet: 0.3 });
        this.tone({ type: "sawtooth", f0: 70, f1: 85, dur: 2, vol: 0.06, attack: 0.5, lowpass: 240, wet: 0.2 });
        break;
      case "collect":
        [784, 988, 1319].forEach((f, i) => this.bell(f, i * 0.07, 0.12, 0.3));
        break;
      case "crate":
        this.noise({ f0: 600, f1: 250, dur: 0.5, vol: 0.22, attack: 0.1, wet: 0.2 });
        break;
      case "flip":
        this.tone({ f0: 220, f1: 560, dur: 0.16, vol: 0.18, wet: 0.1 });
        this.noise({ type: "bandpass", f0: 500, f1: 1400, q: 0.8, dur: 0.35, vol: 0.18, attack: 0.03, wet: 0.15 });
        break;
      case "land":
        this.kick(95, 50, 0.09, 0.3);
        this.noise({ color: "brown", f0: 450, dur: 0.07, vol: 0.25, attack: 0.002, wet: 0.05 });
        break;
      case "thud":
        this.kick(110, 45, 0.18, 0.6);
        this.noise({ color: "brown", f0: 500, dur: 0.12, vol: 0.4, attack: 0.002, wet: 0.1 });
        break;
      case "turn":
        this.bell(659, 0, 0.13);
        this.bell(880, 0.13, 0.13);
        break;
      case "myturn":
        [523, 659, 784, 1046].forEach((f, i) => this.bell(f, i * 0.09, 0.14, 0.45));
        break;
      case "tick":
        this.tone({ type: "triangle", f0: 900, f1: 700, dur: 0.03, vol: 0.12, lowpass: 2500, wet: 0.05 });
        break;
      case "suddendeath":
        for (let i = 0; i < 3; i++) this.tone({ type: "triangle", f0: 480, f1: 880, dur: 0.35, vol: 0.16, delay: i * 0.4, lowpass: 2000, wet: 0.4 });
        break;
      case "dying":
        this.tone({ type: "triangle", f0: 600, f1: 150, dur: 0.6, vol: 0.16, lowpass: 1500, wet: 0.4 });
        break;
      case "hurt":
        this.tone({ type: "triangle", f0: 520, f1: 300, dur: 0.15, vol: 0.14, vibrato: 20, vibratoDepth: 40, lowpass: 1800, wet: 0.2 });
        break;
      case "victory":
        [523, 659, 784, 659, 784, 1046].forEach((f, i) => {
          const dur = i === 5 ? 0.7 : 0.13;
          this.tone({ type: "sawtooth", f0: f, dur, vol: 0.07, attack: 0.02, delay: i * 0.14, lowpass: 1400, wet: 0.4 });
          this.tone({ type: "triangle", f0: f, dur, vol: 0.1, attack: 0.01, delay: i * 0.14, wet: 0.4 });
        });
        break;
      case "click":
        this.tone({ f0: 900, f1: 600, dur: 0.03, vol: 0.07, wet: 0 });
        break;
      case "small":
        this.noise({ color: "brown", f0: 1200, f1: 300, dur: 0.18, vol: 0.45, attack: 0.002, wet: 0.2 });
        this.kick(120, 60, 0.1, 0.25);
        break;
    }
  }

  // Dauergeräusch (z. B. Jetpack), an/aus pro Frame
  loop(name, on) {
    if (!this.ctx) return;
    const cur = this.loops.get(name);
    if (on && !cur && !this.muted) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.brown;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 800;
      const g = this.ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.5, this.ctx.currentTime + 0.08);
      src.connect(f).connect(g);
      this.route(g, 0.15);
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
