// Sound: the pack's seven cues (sound-kit) plus synthesized footsteps,
// creature voices, ambience beds and picnic music. No audio files.
// Nothing makes a sound before a real user gesture unlocks the kit.
import { createSoundKit } from './kit/sound-kit.js';

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

const VOICES = {
  tumbletuft: { base: 520, type: 'triangle', syl: 0.085, glide: 1.25, gain: 0.07 },
  foldfern:   { base: 690, type: 'sine', syl: 0.12, glide: 0.88, vib: 7, gain: 0.07 },
  puddleloop: { base: 380, type: 'sine', syl: 0.12, glide: 0.62, gain: 0.08 },
  siltbell:   { base: 600, type: 'sine', syl: 0.17, bell: true, gain: 0.06 },
  whirli:     { base: 640, type: 'sine', syl: 0.09, glide: 1.1, breath: true, gain: 0.06 },
  kitefin:    { base: 470, type: 'square', syl: 0.1, glide: 1.0, lp: 1300, gain: 0.035 },
  glintot:    { base: 980, type: 'triangle', syl: 0.06, glide: 1.15, gain: 0.05 },
  hushbulb:   { base: 310, type: 'sine', syl: 0.14, glide: 1.05, gain: 0.045 },
  keeper:     { base: 420, type: 'triangle', syl: 0.08, glide: 1.2, gain: 0.04 },
};

export class GameAudio {
  constructor({ muted = false } = {}) {
    this.kit = createSoundKit({ volume: 0.3, muted });
    this.muted = muted; this.g = null; this.buses = null;
    this.amb = null; this.timers = { bird: 2, plip: 3, cricket: 2 };
    this.music = null; this.voiceBusyUntil = 0;
    this.everUnlocked = false;
  }
  get ready() { return !!this.kit.graph(); }

  async unlock(event) {
    const ok = await this.kit.unlock(event);
    if (!ok) return false;
    this.everUnlocked = true;
    const g = this.kit.graph();
    if (g && this.g !== g.context) this.build(g);
    return true;
  }
  async suspend() { await this.kit.suspend(); }
  setMuted(m) { this.muted = m; this.kit.setMuted(m); }

  build({ context, master }) {
    this.ctx = context; this.g = context;
    const bus = gain => { const n = context.createGain(); n.gain.value = gain; n.connect(master); return n; };
    this.buses = { sfx: bus(1.0), voice: bus(0.9), amb: bus(0.55), music: bus(0.5) };
    // Shared white-noise buffer.
    const len = context.sampleRate * 2, buf = context.createBuffer(1, len, context.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // Ambience beds: wind (bandpass) and water (lowpass), gains follow the zone.
    const bed = (type, freq, q) => {
      const src = context.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = context.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g2 = context.createGain(); g2.gain.value = 0;
      src.connect(f); f.connect(g2); g2.connect(this.buses.amb); src.start();
      return { src, f, g: g2 };
    };
    this.amb = { wind: bed('bandpass', 520, 0.7), water: bed('lowpass', 380, 0.5) };
  }

  now() { return this.ctx ? this.ctx.currentTime + 0.01 : 0; }

  tone(t, freq, dur, { type = 'sine', gain = 0.08, end = freq, attack = 0.01, bus = 'sfx', vib = 0, lp = 0 } = {}) {
    const c = this.ctx; if (!c || !this.buses) return;
    const o = c.createOscillator(), e = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (end !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    let head = o;
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = freq * 0.03; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + attack); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(e); } else head.connect(e);
    e.connect(this.buses[bus]); o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { o.disconnect(); e.disconnect(); };
  }
  noiseHit(t, dur, { type = 'lowpass', freq = 800, q = 0.8, gain = 0.05, bus = 'sfx', sweep = 0 } = {}) {
    const c = this.ctx; if (!c || !this.noise) return;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(gain, t + 0.008); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(e); e.connect(this.buses[bus]);
    s.start(t, Math.random() * 1.5, dur + 0.05); s.onended = () => { s.disconnect(); f.disconnect(); e.disconnect(); };
  }

  // ---- Cues ----
  cue(name) { if (this.muted) return false; try { return this.kit.play(name); } catch { return false; } }
  ui() { if (!this.ready || this.muted) return; this.tone(this.now(), 880, 0.05, { gain: 0.03, type: 'triangle' }); }
  footstep(zone, foot) {
    if (!this.ready || this.muted) return; const t = this.now(), r = 0.9 + Math.random() * 0.2;
    if (zone === 'meadow') this.noiseHit(t, 0.07, { freq: 650 * r, gain: 0.035 });
    else if (zone === 'pond') this.noiseHit(t, 0.06, { type: 'bandpass', freq: 1500 * r, q: 1.2, gain: 0.035 });
    else if (zone === 'dusk') { this.noiseHit(t, 0.08, { freq: 420 * r, gain: 0.03 }); if (foot) this.tone(t, 2400 * r, 0.05, { gain: 0.006 }); }
    else this.tone(t, (foot ? 240 : 205) * r, 0.05, { type: 'triangle', gain: 0.03, end: 150 });
  }
  padNote(i, high = false, bouncy = false) {
    if (!this.ready || this.muted) return; const t = this.now(), f = PENTA[i % 5] * (high ? 2 : 1);
    this.tone(t, f * 1.06, 0.45, { gain: 0.09, end: f });
    this.tone(t, f * 1.5, 0.3, { gain: 0.025 });
    this.noiseHit(t, 0.12, { type: 'bandpass', freq: 900, q: 2, gain: 0.02, sweep: 0.5 });
    if (bouncy) this.tone(t + 0.02, f * 0.5, 0.2, { gain: 0.03, end: f * 0.8, type: 'triangle' });
  }
  voice(id, text) {
    if (!this.ready || this.muted) return; const v = VOICES[id]; if (!v) return;
    const words = String(text).split(/\s+/).filter(Boolean).length;
    const n = Math.max(2, Math.min(7, words)); let t = Math.max(this.now(), this.voiceBusyUntil);
    const loud = /!/.test(text) ? 1.25 : 1, ask = /\?\s*$/.test(text);
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const f = v.base * (0.88 + Math.random() * 0.26) * (last && ask ? 1.3 : 1);
      if (v.bell) { this.tone(t, f, v.syl * 1.6, { gain: v.gain * loud, bus: 'voice' }); this.tone(t, f * 2.76, v.syl, { gain: v.gain * 0.3, bus: 'voice' }); }
      else this.tone(t, f, v.syl, { type: v.type, gain: v.gain * loud, end: f * (v.glide || 1) * (last && ask ? 1.25 : 1), vib: v.vib || 0, lp: v.lp || 0, bus: 'voice' });
      if (v.breath) this.noiseHit(t, v.syl, { type: 'highpass', freq: 3000, gain: 0.012, bus: 'voice' });
      t += v.syl * (0.9 + Math.random() * 0.35) + 0.025;
    }
    this.voiceBusyUntil = t;
  }
  befriend() {
    if (!this.ready || this.muted) return; this.cue('agree'); const t = this.now() + 0.25;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(t + i * 0.09, f, 0.35, { type: 'triangle', gain: 0.06 }));
    for (let i = 0; i < 6; i++) this.tone(t + 0.4 + i * 0.05, 1568 + i * 180, 0.18, { gain: 0.015 });
  }
  fanfare() {
    if (!this.ready || this.muted) return; this.cue('complete'); const t = this.now();
    this.tone(t, 130.81, 0.6, { type: 'triangle', gain: 0.06 }); this.tone(t + 0.39, 196, 0.8, { type: 'triangle', gain: 0.05 });
    [1046.5, 1318.5, 1568].forEach((f, i) => this.tone(t + 0.6 + i * 0.03, f, 0.9, { gain: 0.02 }));
  }
  grow() { if (!this.ready || this.muted) return; const t = this.now(); [659.25, 783.99, 987.77].forEach((f, i) => this.tone(t + i * 0.16, f, 0.5, { gain: 0.05 })); }
  stamp() { if (!this.ready || this.muted) return; const t = this.now(); this.tone(t, 180, 0.12, { type: 'triangle', gain: 0.08, end: 90 }); this.noiseHit(t, 0.05, { freq: 1200, gain: 0.03 }); }
  whoosh() { if (!this.ready || this.muted) return; this.noiseHit(this.now(), 0.45, { type: 'bandpass', freq: 400, q: 0.8, gain: 0.05, sweep: 4 }); }
  boing() { if (!this.ready || this.muted) return; this.tone(this.now(), 220, 0.35, { type: 'triangle', gain: 0.07, end: 520, vib: 14 }); }
  slideWhee(dur = 1.6) { if (!this.ready || this.muted) return; const t = this.now(); this.noiseHit(t, dur, { type: 'bandpass', freq: 500, q: 1.3, gain: 0.04, sweep: 3 }); this.tone(t, 300, dur, { type: 'sine', gain: 0.02, end: 700 }); }
  plunk(muffled = true) { if (!this.ready || this.muted) return; const t = this.now(); if (muffled) this.tone(t, 300, 0.12, { type: 'triangle', gain: 0.07, end: 200, lp: 600 }); else this.bell(); }
  bell(f = 523.25, gain = 0.09) {
    if (!this.ready || this.muted) return; const t = this.now();
    [[1, 1, 2.4], [2.0, 0.35, 1.6], [2.76, 0.25, 1.2], [5.4, 0.1, 0.7]].forEach(([m, g, d]) => this.tone(t, f * m, d, { gain: gain * g }));
  }
  chime(i = 0) { if (!this.ready || this.muted) return; const t = this.now(), f = [880, 1108.73, 1318.51, 1760][i % 4]; this.tone(t, f, 0.6, { gain: 0.05 }); this.tone(t, f * 2, 0.3, { gain: 0.012 }); }
  gustLoop(dur = 1.6) { if (!this.ready || this.muted) return; this.noiseHit(this.now(), dur, { type: 'bandpass', freq: 300, q: 0.9, gain: 0.07, sweep: 3.2 }); }
  tick() { if (!this.ready || this.muted) return; this.tone(this.now(), 1200, 0.03, { gain: 0.02, type: 'square', lp: 2500 }); }

  // ---- Ambience + music, called each frame ----
  update(dt, weights) {
    if (!this.ready || !this.amb) return;
    const c = this.ctx, t = c.currentTime;
    const w = weights || {};
    this.amb.wind.g.gain.setTargetAtTime(0.012 + (w.canopy || 0) * 0.03 + (w.meadow || 0) * 0.01, t, 0.6);
    this.amb.wind.f.frequency.setTargetAtTime(420 + Math.sin(t * 0.3) * 160, t, 0.8);
    this.amb.water.g.gain.setTargetAtTime((w.pond || 0) * 0.06, t, 0.6);
    if (this.muted) return;
    const tm = this.timers;
    tm.bird -= dt; tm.plip -= dt; tm.cricket -= dt;
    if (tm.bird <= 0) { tm.bird = 1.8 + Math.random() * 3.5; if ((w.meadow || 0) + (w.canopy || 0) * 0.6 > 0.3 && !(w.night > 0.5)) this.bird(); }
    if (tm.plip <= 0) { tm.plip = 0.9 + Math.random() * 2.2; if ((w.pond || 0) > 0.3) this.plip(); }
    if (tm.cricket <= 0) { tm.cricket = 0.7 + Math.random() * 1.6; if ((w.dusk || 0) > 0.3 || (w.night || 0) > 0.5) this.cricket(); }
    this.updateMusic();
  }
  bird() { const t = this.now(), f = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) this.tone(t + i * 0.11, f * (1 + i * 0.05), 0.08, { gain: 0.012, end: f * 1.35, bus: 'amb' }); }
  plip() { const t = this.now(), f = 900 + Math.random() * 700; this.tone(t, f, 0.12, { gain: 0.02, end: f * 0.55, bus: 'amb' }); }
  cricket() { const t = this.now(), f = 4300 + Math.random() * 500; for (let i = 0; i < 5; i++) this.tone(t + i * 0.045, f, 0.03, { gain: 0.006, bus: 'amb' }); }

  /** Picnic tune: a small lookahead scheduler on the audio clock. */
  startMusic(kind = 'picnic') {
    if (!this.ready) { this.pendingMusic = kind; return; }
    this.music = { kind, next: this.ctx.currentTime + 0.1, step: 0 };
    if (this.buses) { this.buses.music.gain.cancelScheduledValues(this.ctx.currentTime); this.buses.music.gain.setTargetAtTime(kind === 'picnic' ? 0.55 : 0.32, this.ctx.currentTime, 0.4); }
  }
  stopMusic(fade = 1.2) {
    if (this.buses && this.ctx) this.buses.music.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
    const m = this.music; setTimeout(() => { if (this.music === m) this.music = null; }, fade * 1000);
  }
  updateMusic() {
    const m = this.music; if (!m || this.muted) return;
    const c = this.ctx, spb = 60 / (m.kind === 'picnic' ? 104 : 84) / 2; // eighth notes
    // A cheerful little tune in C major pentatonic (degrees into PENTA; -1 = rest).
    const MEL = [4, 5, 7, 5, 4, 2, 3, -1, 2, 3, 4, 2, 1, 0, 1, -1, 4, 5, 7, 8, 7, 5, 4, -1, 5, 4, 2, 3, 1, 2, 0, -1];
    const BASS = [130.81, 130.81, 174.61, 174.61, 196, 196, 130.81, 196];
    while (m.next < c.currentTime + 0.35) {
      const s = m.step, t = m.next;
      const deg = MEL[s % MEL.length];
      if (deg >= 0) this.tone(t, PENTA[deg], spb * 1.8, { type: 'triangle', gain: m.kind === 'picnic' ? 0.05 : 0.03, bus: 'music' });
      if (s % 4 === 0) this.tone(t, BASS[Math.floor(s / 4) % BASS.length], spb * 3.6, { type: 'sine', gain: 0.06, bus: 'music' });
      if (m.kind === 'picnic' && s % 2 === 1) this.noiseHit(t, 0.04, { type: 'highpass', freq: 6000, gain: 0.012, bus: 'music' });
      if (m.kind === 'picnic' && s % 8 === 4) [329.63, 392, 523.25].forEach(f => this.tone(t, f, spb * 3, { gain: 0.012, bus: 'music' }));
      m.step++; m.next += spb;
    }
  }
}
