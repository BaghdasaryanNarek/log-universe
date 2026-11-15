import 'katex/dist/katex.min.css';
import 'lenis/dist/lenis.css';
import './styles/main.css';
import { gsap } from 'gsap';
import { applyDocument, lang, LANGS, onLang, setLang, t } from './i18n/index.ts';
import { fmtDate, fmtMag, fmtNum } from './i18n/format.ts';
import { BEATS } from './content/scenes.ts';
import { PC, LY, SUN_ABS_MAG } from './content/facts.ts';
import { add, mul, type V3 } from './core/vec.ts';
import { LogScroll } from './core/scroll.ts';
import { Engine, QualityGovernor } from './gl/engine.ts';
import { createRig } from './gl/rig.ts';
import { EARTH_R, earthHelio, gmst, heroDate, julianDate, observerFrame, toAltAz } from './gl/astro.ts';
import { loadCatalog } from './scenes/stars/catalog.ts';
import { StarsLayer } from './scenes/stars/stars-layer.ts';
import { ConstellationLayer } from './scenes/stars/constellations.ts';
import { MilkyWayLayer } from './scenes/sky/milkyway.ts';
import { EarthPass } from './scenes/earth/earth-pass.ts';
import { HorizonLayer, setTelescopeOffset } from './scenes/horizon/horizon-layer.ts';
import { BeatsController } from './ui/beats.ts';
import { Hud } from './ui/hud.ts';
import { Labels } from './ui/labels.ts';
import { Cursor } from './ui/cursor.ts';
import { installKeys } from './ui/keys.ts';
import { CompareTool } from './tools/compare-brightness/compare.ts';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
if (reduced) root.classList.add('reduced');
const BASE = import.meta.env.BASE_URL;

function hasWebGL2(): boolean {
  if (params.has('nogl')) return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

/* ── прелоадер: реальный прогресс задач с весами ── */
class Preloader {
  private parts = new Map<string, { w: number; p: number }>();
  private shown = 0;
  private el = document.getElementById('preloader')!;
  private exp = document.getElementById('pre-exp')!;
  private pct = document.getElementById('pre-pct')!;
  private fill: SVGLineElement;
  private raf = 0;
  constructor() {
    const svg = document.getElementById('pre-svg')!;
    let html = '<line x1="0" y1="25" x2="270" y2="25"/>';
    for (let k = 0; k <= 27; k++) {
      html += `<line x1="${k * 10}" y1="${k % 3 ? 15 : 6}" x2="${k * 10}" y2="25"/>`;
      if (k < 27) for (let m = 2; m <= 9; m++) { const x = (k + Math.log10(m)) * 10; html += `<line x1="${x}" y1="20" x2="${x}" y2="25"/>`; }
    }
    html += '<line class="pre-fill" x1="0" y1="25" x2="0" y2="25"/>';
    svg.innerHTML = html;
    this.fill = svg.querySelector('.pre-fill')!;
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  task(id: string, w: number) { this.parts.set(id, { w, p: 0 }); return (p: number) => { this.parts.get(id)!.p = Math.min(1, p); }; }
  get progress() { let s = 0, w = 0; this.parts.forEach((v) => { s += v.w * v.p; w += v.w; }); return w ? s / w : 0; }
  private draw() {
    this.shown += (this.progress - this.shown) * 0.12;
    if (this.progress - this.shown < 0.002) this.shown = this.progress;
    const n = Math.floor(this.shown * 27 + 1e-6);
    this.exp.textContent = String(n).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]);
    this.pct.textContent = `${Math.round(this.shown * 100)} %`;
    this.fill.setAttribute('x2', String(this.shown * 270));
  }
  async done() {
    await new Promise<void>((r) => { const w = () => (this.shown >= 0.999 ? r() : requestAnimationFrame(w)); w(); });
    cancelAnimationFrame(this.raf);
    this.pct.textContent = t('pre.ready');
    await gsap.to(this.el, { autoAlpha: 0, duration: reduced ? 0.3 : 0.9, delay: 0.25, ease: 'power2.inOut' });
    this.el.remove();
  }
}

/* ── логарифмическая спираль в логотипе: r = a·e^(bθ), b = tg 13° ── */
function drawBrandSpiral() {
  const p = document.getElementById('brand-spiral');
  if (!p) return;
  const b = Math.tan((13 * Math.PI) / 180);
  let d = '';
  for (let i = 0; i <= 260; i++) {
    const th = -Math.PI * 5 + (i / 260) * Math.PI * 5.4;
    const r = 10.5 * Math.exp(b * th);
    d += `${i ? 'L' : 'M'}${(r * Math.cos(th)).toFixed(3)} ${(r * Math.sin(th)).toFixed(3)} `;
  }
  p.setAttribute('d', d);
}

function langButtons() {
  const btns = document.querySelectorAll<HTMLButtonElement>('.lang button');
  const sync = () => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang())));
  btns.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as never)));
  onLang(sync);
  sync();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else root.requestFullscreen?.().catch(() => {});
}

async function main() {
  applyDocument();
  drawBrandSpiral();
  langButtons();
  const pre = new Preloader();
  const fontsP = pre.task('fonts', 3);
  const starsP = pre.task('stars', 4);
  const glP = pre.task('gl', 3);

  const fontJobs = ['400 1em "Garamond 1614"', 'italic 400 1em "Garamond 1614"', '400 1em "Plex Mono 1614"', '500 1em "Plex Mono 1614"'];
  let fdone = 0;
  const fonts = Promise.all(fontJobs.map((f) => document.fonts.load(f, 'Aa Яя Աա 10²⁷').then(() => fontsP(++fdone / fontJobs.length))))
    .then(() => document.fonts.load('400 1em "Garamond 1614"', 'Մեր տեղն')).catch(() => fontsP(1));

  const gl = hasWebGL2();
  const cursor = new Cursor();
  const help = document.getElementById('help')!;
  const toggleHelp = (force?: boolean) => {
    const open = force ?? help.hidden;
    help.hidden = !open;
    if (open) help.querySelector<HTMLButtonElement>('.help-close')?.focus();
  };
  help.querySelector('.help-close')!.addEventListener('click', () => toggleHelp(false));
  help.addEventListener('click', (e) => { if (e.target === help) toggleHelp(false); });

  const tool = new CompareTool();
  onLang(() => tool.render());

  /* ── без WebGL: статичная страница со всем текстом и инструментом ── */
  if (!gl) {
    root.classList.add('no-gl');
    starsP(1); glP(1);
    await fonts;
    const beats = new BeatsController(document.getElementById('beats')!, { mountTool: (_b, slot) => slot.appendChild(tool.el) }, true);
    beats.renderStatic();
    onLang(() => { applyDocument(); beats.renderStatic(); });
    await pre.done();
    return;
  }

  const cat = await loadCatalog(BASE, starsP);
  cat.absMag[0] = SUN_ABS_MAG;

  /* ── астрономия кадра: Ереван, сегодня, 22:00 ── */
  const date = heroDate();
  const frame = observerFrame(date);
  const earth = earthHelio(date);
  const obs: V3 = add(earth, mul(frame.zenith, EARTH_R));
  const telescope: V3 = add(obs, mul(frame.zenith, 1.08));
  const mizarI = cat.find('Mizar');
  const dirOf = (i: number): V3 => { const p = cat.posM(i); const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l]; };
  const mizarDir = dirOf(mizarI);
  const mz = toAltAz(frame, mizarDir);
  const alphaI = cat.find('Rigil Kentaurus');
  const rig = createRig({ frame, telescope, mizarDir, alphaCen: cat.posM(alphaI) });

  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const engine = new Engine(canvas);
  engine.reduced = reduced;
  const stars = new StarsLayer(cat);
  engine.add(new MilkyWayLayer());
  engine.add(stars);
  engine.add(new ConstellationLayer(cat));
  engine.add(new EarthPass(earth, gmst(julianDate(date))));
  { const a = ((mz.az - 9 + 17) * Math.PI) / 180; setTelescopeOffset(Math.sin(a) * 4.6, Math.cos(a) * 4.6); }
  engine.add(new HorizonLayer(obs, frame, mz.az, mz.alt));
  glP(0.3);
  engine.render(0, rig(0), 0);
  await engine.warmup();
  glP(1);
  await fonts;

  /* ── DOM-слои ── */
  const scroll = new LogScroll(document.getElementById('scroll-spacer')!, reduced);
  const fade = document.getElementById('fade')!;
  const fly = (n: number) => {
    hint.classList.add('is-gone');
    if (reduced) {
      gsap.to(fade, { opacity: 1, duration: 0.25, onComplete: () => { scroll.flyTo(n, () => gsap.to(fade, { opacity: 0, duration: 0.4 })); } });
    } else scroll.flyTo(n);
  };
  const hud = new Hud(document.querySelector<HTMLElement>('.hud')!, fly);
  const labels = new Labels(document.getElementById('labels')!, engine);
  const camPc = (): [number, number, number] => [engine.frame.cam[0] / PC, engine.frame.cam[1] / PC, engine.frame.cam[2] / PC];
  const live = (i: number) => () => t('label.fromHere', { m: fmtMag(stars.apparentMag(i, camPc()), lang(), 1) });
  labels.set([
    { key: 'you', text: () => t('label.you'), target: add(obs, mul(frame.zenith, 1.6)), range: [0.55, 3.6], off: [-70, -50] },
    { key: 'mizar', text: () => t('label.mizar'), sub: () => t('label.mizarNote'), target: mul(mizarDir, 1e22), range: [-1, 2.6], off: [-46, -40] },
    { key: 'sun', text: () => t('label.sun'), sub: live(0), target: [0, 0, 0], range: [13.2, 27.5], off: [54, 44] },
    { key: 'acen', text: () => t('label.alphacen'), sub: live(alphaI), target: cat.posM(alphaI), range: [15.4, 18.6], off: [-56, -48] },
    { key: 'prox', text: () => t('label.proxima'), sub: live(cat.find('Proxima Centauri')), target: cat.posM(cat.find('Proxima Centauri')), range: [15.6, 18.3], off: [-64, 46] },
    { key: 'sirius', text: () => t('label.sirius'), sub: live(cat.find('Sirius')), target: cat.posM(cat.find('Sirius')), range: [15.8, 18.6], off: [50, -40] },
    { key: 'barnard', text: () => t('label.barnard'), sub: live(cat.find("Barnard's Star")), target: cat.posM(cat.find("Barnard's Star")), range: [15.8, 18.4], off: [50, 40] },
  ]);
  const hint = document.getElementById('hint')!;
  const beatNum = document.getElementById('beat-num')!;
  const beatName = document.getElementById('beat-name')!;

  const beats = new BeatsController(document.getElementById('beats')!, {
    mountTool: (_b, slot) => slot.appendChild(tool.el),
    heroExtra: () => t('hero.sky', { date: fmtDate(date, lang()), count: fmtNum(cat.count, lang(), 0) }),
  }, reduced);

  onLang(() => {
    beats.relocalize(); hud.relocalize(); labels.relocalize();
  });

  installKeys({
    current: () => scroll.n,
    fly,
    toggleFullscreen,
    cycleLang: () => setLang(LANGS[(LANGS.indexOf(lang()) + 1) % LANGS.length]),
    toggleBoost: () => root.classList.toggle('boost'),
    toggleBlack: () => root.classList.toggle('black'),
    toggleHelp,
    helpOpen: () => !help.hidden,
    toggleDebug: () => root.classList.toggle('debug'),
  });

  /* ── подсказка о звезде под курсором ── */
  const tip = document.getElementById('star-tip')!;
  let hoverDirty = false;
  window.addEventListener('pointermove', () => { hoverDirty = true; }, { passive: true });
  const pickStar = () => {
    const { x, y } = cursor.pos;
    const el = document.elementFromPoint(x, y);
    if (el && el.closest('.tool, button, .topbar, .hud-read')) return -1;
    const pc = camPc();
    let best = -1, bestD = 16 * 16;
    const lim = stars.magLimit;
    for (let i = 0; i < cat.count; i++) {
      const m = stars.apparentMag(i, pc);
      if (m > lim - 0.8) continue;
      if (i === 0 && engine.frame.n < 12.5) continue;
      const p = engine.project(cat.posM(i));
      if (!p) continue;
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  };
  const updateTip = () => {
    if (!hoverDirty) return;
    hoverDirty = false;
    const i = scroll.flying ? -1 : pickStar();
    stars.setHover(i);
    if (i < 0) { tip.classList.remove('is-on'); return; }
    const pc = camPc();
    const meta = cat.names.find((n) => n.i === i);
    const key = meta?.name ? `star.${meta.name}` : '';
    const nm = key && t(key) !== key ? t(key) : meta?.name || (meta?.bayer ? `${meta.bayer} ${meta.con}` : `HYG #${i}`);
    const p = cat.pos;
    const dpc = Math.hypot(p[i * 3] - pc[0], p[i * 3 + 1] - pc[1], p[i * 3 + 2] - pc[2]);
    const dly = (dpc * PC) / LY;
    const L = lang();
    tip.innerHTML = `<b>${nm}</b>${t('star.mag')}: ${fmtMag(stars.apparentMag(i, pc), L, 2)}<br>${t('star.dist')}: ${fmtNum(dly, L, dly < 10 ? 2 : 0)} ${t('star.ly')}<br>${t('star.abs')}: ${fmtMag(cat.absMag[i], L, 2)}`;
    const { x, y } = cursor.pos;
    tip.style.transform = `translate(${Math.min(x + 22, innerWidth - tip.offsetWidth - 12)}px, ${Math.max(12, y - tip.offsetHeight - 18)}px)`;
    tip.classList.add('is-on');
  };

  const dbg = document.getElementById('debug')!;
  const quality = new QualityGovernor(engine);
  let last = performance.now();

  /* ── главный цикл: одна функция n → всё ── */
  const t0 = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = now - last; last = now;
    if (document.hidden) return;
    const n = scroll.n;
    engine.render(n, rig(n), (now - t0) / 1000);
    quality.tick(dt);
    beats.update(n, scroll.flying, scroll.velocity);
    const cur = beats.current;
    hud.update(n, cur?.id ?? null);
    labels.update(n, engine.frame.pxScale);
    cursor.tick();
    updateTip();
    const idx = cur ? BEATS.indexOf(cur) : -1;
    beatNum.textContent = idx >= 0 ? String(idx + 1).padStart(2, '0') : '··';
    const nm = cur ? t(`beat.${cur.id}`) : '';
    if (beatName.textContent !== nm) beatName.textContent = nm;
    if (n > 0.3) hint.classList.add('is-gone');
    if (root.classList.contains('debug')) {
      dbg.textContent = `fps ${quality.fps.toFixed(0)}  tier ${engine.tier}\nn ${n.toFixed(3)}  calls ${engine.renderer.info.render.calls}`;
    }
  });

  if (import.meta.env.DEV || params.has('test')) {
    (window as unknown as { __lc: object }).__lc = {
      fly: (n: number) => new Promise<void>((r) => scroll.flyTo(n, r)),
      get n() { return scroll.n; },
      get beat() { return beats.current?.id ?? null; },
      fps: () => quality.fps,
      tier: () => engine.tier,
      engine,
    };
  }
  await pre.done();
  // deep link: #b-pogson
  const target = BEATS.find((b) => `#b-${b.id}` === location.hash);
  if (target) scroll.flyTo(target.n);
}

main().catch((e) => {
  console.error(e);
  document.documentElement.classList.add('no-gl');
});
