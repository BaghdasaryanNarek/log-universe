/**
 * Звук — только Web Audio, без файлов. По умолчанию выключен; AudioContext создаётся по жесту.
 *
 * Эмбиент: дрон из обертонов (основной тон, квинта, октава) + «космический ветер» (фильтрованный шум).
 * Высота связана с глубиной зума логарифмически: f₀ = 220 · 2^(−n/13,5) — каждые 13,5 порядка
 * расстояния звук опускается на октаву (220 Гц у человека → 55 Гц у края Вселенной).
 * Частота среза фильтра: 3200 · 2^(−n/7) Гц — пространство «темнеет» по мере отдаления.
 */
export interface Sfx {
  click(): void;
  tick(v: number): void;
}

export class AudioEngine implements Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private amb!: GainNode;
  private oscs: OscillatorNode[] = [];
  private filter!: BiquadFilterNode;
  private noiseF!: BiquadFilterNode;
  private lfo!: OscillatorNode;
  on = false;
  private lastDecade = -1;
  private lastTick = 0;
  private listeners = new Set<(on: boolean) => void>();

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    // эмбиент
    this.amb = ctx.createGain();
    this.amb.gain.value = 0.32;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.7;
    this.filter.connect(this.amb);
    this.amb.connect(this.master);
    const partials: [number, OscillatorType, number, number][] = [[1, 'sine', 0.5, 0], [1.5, 'triangle', 0.16, 3], [2, 'sine', 0.2, -4], [3, 'sine', 0.06, 2]];
    for (const [ratio, type, gain, detune] of partials) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.value = 220 * ratio;
      (o as OscillatorNode & { ratio: number }).ratio = ratio;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(this.filter);
      o.start();
      this.oscs.push(o);
    }
    // медленное «дыхание»
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.08;
    this.lfo.connect(lfoG).connect(this.amb.gain);
    this.lfo.start();
    // шум
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.08;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.noiseF = ctx.createBiquadFilter();
    this.noiseF.type = 'bandpass';
    this.noiseF.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.value = 0.22;
    src.connect(this.noiseF).connect(ng).connect(this.amb);
    src.start();
    return ctx;
  }

  onChange(fn: (on: boolean) => void) { this.listeners.add(fn); }

  async toggle(force?: boolean) {
    const want = force ?? !this.on;
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    this.on = want;
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(want ? 0.55 : 0, t + (want ? 1.6 : 0.8));
    this.listeners.forEach((f) => f(want));
  }

  /** Вызывается каждый кадр. */
  update(n: number) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const f0 = 220 * Math.pow(2, -n / 13.5);
    for (const o of this.oscs) o.frequency.setTargetAtTime(f0 * (o as OscillatorNode & { ratio: number }).ratio, t, 0.25);
    this.filter.frequency.setTargetAtTime(Math.max(180, 3200 * Math.pow(2, -n / 7)), t, 0.3);
    this.noiseF.frequency.setTargetAtTime(Math.max(120, 1600 * Math.pow(2, -n / 9)), t, 0.3);
    // щелчок шкалы на каждом новом порядке
    const dec = Math.floor(n + 1e-6);
    if (dec !== this.lastDecade) {
      if (this.lastDecade >= 0) this.blip(523.25 * Math.pow(2, PENTA[dec % 5] / 12) / (dec >= 15 ? 2 : 1), 0.05, 0.09);
      this.lastDecade = dec;
    }
  }

  private blip(freq: number, gain: number, dur: number, type: OscillatorType = 'sine', force = false) {
    if (!this.ctx || (!this.on && !force)) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(force ? ctx.destination : this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  click() { this.blip(1320, 0.05, 0.05, 'triangle'); }

  /** тихий тик при перетаскивании — высота по логарифму значения */
  tick(v: number) {
    const now = performance.now();
    if (now - this.lastTick < 45) return;
    this.lastTick = now;
    this.blip(440 * Math.pow(2, Math.log10(Math.max(v, 0.01))), 0.035, 0.04, 'triangle');
  }

  /**
   * Демонстрация Вебера — Фехнера: последовательность тонов. Играет даже при выключенном
   * эмбиенте — это прямое действие пользователя.
   */
  async sequence(freqs: number[], onStep?: (i: number) => void) {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    freqs.forEach((f, i) => {
      setTimeout(() => {
        onStep?.(i);
        const t = ctx.currentTime;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.02);
        g.gain.setValueAtTime(0.18, t + 0.38);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.6);
      }, i * 620);
    });
    setTimeout(() => onStep?.(-1), freqs.length * 620);
  }
}

/** пентатоника для щелчков шкалы — порядки звучат как лесенка */
const PENTA = [0, 2, 4, 7, 9];
