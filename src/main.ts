import 'katex/dist/katex.min.css';
import 'lenis/dist/lenis.css';
import './styles/main.css';
import { gsap } from 'gsap';
import { applyDocument, lang, LANGS, onLang, setLang, t } from './i18n/index.ts';
import { fmtDate, fmtMag, fmtNum } from './i18n/format.ts';
import { BEATS } from './content/scenes.ts';
import { PC, LY, KPC, AU as AU_M, SUN_ABS_MAG } from './content/facts.ts';
import { add, mul, norm, sub, cross, type V3 } from './core/vec.ts';
import * as THREE from 'three';
import { SolarLayer } from './scenes/solar/solar-layer.ts';
import { BeltsLayer } from './scenes/solar/belts.ts';
import { GalaxyLayer } from './scenes/galaxy/galaxy-layer.ts';
import { MILKY_WAY, ANDROMEDA } from './scenes/galaxy/generate.ts';
import { CosmosLayer } from './scenes/cosmos/web-layer.ts';
import { LogMap, type MapPoint, type MapLabel } from './ui/logmap.ts';
import { hrAxes, napierPage, qrCard, sourcesHtml, varPlate } from './ui/extras.ts';
import { AudioEngine } from './audio/engine.ts';
import { KeplerTool } from './tools/kepler-log/kepler.ts';
import { SlideRule } from './tools/slide-rule/rule.ts';
import { OctavesTool } from './tools/octaves/octaves.ts';
import { installEggs } from './ui/eggs.ts';
import { LogScroll } from './core/scroll.ts';
import { Engine, QualityGovernor } from './gl/engine.ts';
import { createRig } from './gl/rig.ts';
import { EARTH_R, EQ_TO_GAL, earthHelio, gmst, heroDate, julianDate, moonGeo, observerFrame, radec, toAltAz } from './gl/astro.ts';
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
/** адрес остановки из ссылки (#b-…) — запоминаем до того, как цикл начнёт обновлять hash */
const START_HASH = location.hash;
/** кадры сцен для версии без WebGL (scripts/fallback.ts) */
const FALLBACK_FRAMES = ['hero', 'napier', 'orbit', 'moon', 'au', 'kepler', 'pogson', 'hr', 'milkyway', 'andromeda', 'universe', 'map'];

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
  const texP = pre.task('tex', 2);
  const genP = pre.task('gen', 3);
  /** отдать кадр прелоадеру между тяжёлыми шагами генерации */
  const breathe = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const extra = (id: 'napier' | 'var' | 'hr' | 'qr') => (id === 'napier' ? napierPage() : id === 'var' ? varPlate() : id === 'qr' ? qrCard() : hrAxes());

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

  const audio = new AudioEngine();
  const soundBtn = document.getElementById('sound')!;
  const syncSound = (on: boolean) => {
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', t(on ? 'sound.on' : 'sound.off'));
    soundBtn.classList.toggle('is-on', on);
  };
  audio.onChange(syncSound);
  onLang(() => syncSound(audio.on));
  soundBtn.addEventListener('click', () => void audio.toggle());

  const tool = new CompareTool();
  const kepler = new KeplerTool(audio);
  const rule = new SlideRule(audio);
  const octaves = new OctavesTool(audio);
  onLang(() => { tool.render(); kepler.render(); rule.render(); octaves.render(); });
  const mountTool = (b: { tool?: string }, slot: HTMLElement) => {
    const el = b.tool === 'compare' ? tool.el : b.tool === 'kepler' ? kepler.el : b.tool === 'rule' ? rule.el : b.tool === 'octaves' ? octaves.el : null;
    if (el) slot.appendChild(el);
  };

  /* ── без WebGL: статичная страница со всем текстом и инструментом ── */
  if (!gl) {
    root.classList.add('no-gl');
    starsP(1); glP(1); texP(1); genP(1);
    await fonts;
    const beats = new BeatsController(document.getElementById('beats')!, {
      mountTool,
      extra: (id) => (id === 'hr' ? '' : extra(id)),
      sources: sourcesHtml,
      figure: (b) => (FALLBACK_FRAMES.includes(b.id) ? `<img class="fallback-img" src="${BASE}fallback/${b.id}.jpg" alt="" loading="lazy" width="960" height="540">` : ''),
    }, true);
    beats.renderStatic();
    onLang(() => { applyDocument(); beats.renderStatic(); });
    await pre.done();
    return;
  }

  const loader = new THREE.TextureLoader();
  let texDone = 0;
  const loadTex = (u: string) => loader.loadAsync(`${BASE}textures/${u}`).then((tx) => {
    tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    texP(++texDone / 2);
    return tx;
  });
  const [cat, earthDay, earthNight] = await Promise.all([loadCatalog(BASE, starsP), loadTex('earth-day.webp'), loadTex('earth-night.webp')]);
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
  const moonAbs = add(earth, moonGeo(date));
  // Галактика: оси — строки матрицы «экватор → галактика» (Hipparcos), центр на 8,2 кпк (GRAVITY 2019)
  const gcDir = EQ_TO_GAL[0], ngp = EQ_TO_GAL[2];
  const gc: V3 = mul(gcDir, 8.2 * KPC);
  const m31Dir = radec(10.68471, 41.26875);
  const m31: V3 = mul(m31Dir, 2.5e6 * LY);
  const rig = createRig({ frame, eye: telescope, mizarDir, alphaCen: cat.posM(alphaI), earth, moon: moonAbs, gc, ngp, m31 });
  // оси диска Млечного Пути: e1 — от центра к Солнцу, e3 — к северному полюсу Галактики
  const mwE1 = norm(mul(gcDir, -1)), mwE3 = ngp, mwE2 = cross(mwE3, mwE1);
  // Андромеда: позиционный угол большой оси 38°, наклон диска 77°
  const north = norm(sub([0, 0, 1], mul(m31Dir, m31Dir[2])));
  const east = norm(cross([0, 0, 1], m31Dir));
  const pa = (38 * Math.PI) / 180, inc = (77 * Math.PI) / 180;
  const major = norm(add(mul(north, Math.cos(pa)), mul(east, Math.sin(pa))));
  const minor = norm(add(mul(north, -Math.sin(pa)), mul(east, Math.cos(pa))));
  const m31E3 = norm(add(mul(m31Dir, Math.cos(inc)), mul(minor, Math.sin(inc))));
  const m31E2 = cross(m31E3, major);

  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const engine = new Engine(canvas);
  engine.reduced = reduced;
  const stars = new StarsLayer(cat);
  engine.add(new MilkyWayLayer());
  engine.add(stars);
  engine.add(new ConstellationLayer(cat));
  engine.add(new EarthPass(earth, gmst(julianDate(date)), { day: earthDay, night: earthNight }));
  { const a = ((mz.az - 9 + 17) * Math.PI) / 180; setTelescopeOffset(Math.sin(a) * 4.6, Math.cos(a) * 4.6); }
  engine.add(new HorizonLayer(obs, frame, mz.az, mz.alt));
  const solar = new SolarLayer(date, earth);
  engine.add(solar);
  engine.add(new BeltsLayer());
  genP(0.1); await breathe();
  const mw = new GalaxyLayer({ ...MILKY_WAY, count: 150000 }, { center: gc, e1: mwE1, e2: mwE2, e3: mwE3, range: [18.7, 28.4], gain: 0.42 });
  genP(0.45); await breathe();
  const andromeda = new GalaxyLayer({ ...ANDROMEDA, count: 90000 }, { center: m31, e1: major, e2: m31E2, e3: m31E3, range: [20.9, 28.4], gain: 0.7 });
  engine.add(mw);
  engine.add(andromeda);
  genP(0.7); await breathe();
  const cosmos = new CosmosLayer();
  genP(1); await breathe();
  engine.add(cosmos);
  engine.onTier = (tier) => { const q = tier === 'high' ? 1 : tier === 'med' ? 0.55 : 0.3; mw.setQuality(q); andromeda.setQuality(q); };
  // ?tier=low|med — принудительно (проверка на слабой графике и для проектора-«калькулятора»)
  const forced = params.get('tier');
  if (forced === 'low' || forced === 'med') engine.setTier(forced);
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
    { key: 'mizar', text: () => t('label.mizar'), sub: () => t('label.mizarNote'), target: mul(mizarDir, 1e22), range: [-1, 1.25], off: [-46, -40] },
    { key: 'sun', text: () => t('label.sun'), sub: live(0), target: [0, 0, 0], range: [13.2, 20.6], off: [54, 44] },
    { key: 'acen', text: () => t('label.alphacen'), sub: live(alphaI), target: cat.posM(alphaI), range: [15.4, 17.6], off: [-56, -48] },
    { key: 'prox', text: () => t('label.proxima'), sub: live(cat.find('Proxima Centauri')), target: cat.posM(cat.find('Proxima Centauri')), range: [15.6, 17.6], off: [-64, 46] },
    { key: 'sirius', text: () => t('label.sirius'), sub: live(cat.find('Sirius')), target: cat.posM(cat.find('Sirius')), range: [15.8, 17.6], off: [50, -40] },
    { key: 'barnard', text: () => t('label.barnard'), sub: live(cat.find("Barnard's Star")), target: cat.posM(cat.find("Barnard's Star")), range: [15.8, 17.6], off: [50, 40] },
    { key: 'moon', text: () => t('obj.moon'), target: moonAbs, range: [8.2, 10.2], off: [46, -38] },
    { key: 'earth', text: () => t('obj.earth'), sub: () => t('map.you'), target: earth, range: [8.2, 13.2], off: [-52, 40] },
    ...(['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const).map((id) => ({
      key: id, text: () => t(`obj.${id}`), target: solar.positions[id],
      range: (['mercury', 'venus', 'mars'].includes(id) ? [11.0, 12.6] : [11.9, 13.8]) as [number, number],
      off: [34, -26] as [number, number],
    })),
    { key: 'kuiper', text: () => t('label.kuiper'), target: mul(norm(sub(solar.positions.neptune, [0, 0, 0])), 45 * AU_M), range: [12.6, 13.9], off: [40, 40] },
    { key: 'oort', text: () => t('label.oort'), sub: () => t('label.oortNote'), target: mul(norm(cat.posM(alphaI)), 2.5e4 * AU_M), range: [14.3, 16.2], off: [-60, 56] },
    { key: 'mwsun', text: () => t('mw.sun'), target: [0, 0, 0], range: [19.8, 21.8], off: [60, 46] },
    { key: 'gc', text: () => t('mw.center'), target: gc, range: [19.8, 22.3], off: [70, -56] },
    { key: 'mw2', text: () => t('m31.mw'), target: gc, range: [22.6, 24.2], off: [-60, 50] },
    { key: 'm31', text: () => t('m31.label'), target: m31, range: [21.6, 24.2], off: [120, -150] },
    { key: 'v1', text: () => t('m31.v1'), sub: () => t('m31.v1note'), target: andromeda.worldOf(-8.5, 4.5), range: [21.65, 22.4], off: [58, 44], pulse: true },
    { key: 'virgo', text: () => t('uni.virgo'), target: cosmos.virgo, range: [23.4, 25.0], off: [56, -44] },
  ]);

  /* ── финальная карта: настоящие направления, радиус ∝ log₁₀ расстояния от Земли ── */
  const mapPts: MapPoint[] = [];
  const lg = (v: V3) => Math.log10(Math.hypot(...v));
  const rel = (q: V3) => sub(q, earth);
  mapPts.push({ log: lg(rel(moonAbs)), dir: norm(rel(moonAbs)), kind: 'moon' });
  mapPts.push({ log: lg(rel([0, 0, 0])), dir: norm(rel([0, 0, 0])), kind: 'sun' });
  for (const id of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) mapPts.push({ log: lg(rel(solar.positions[id])), dir: norm(rel(solar.positions[id])), kind: 'planet' });
  for (let i = 1; i < cat.count; i++) { const q = cat.posM(i); mapPts.push({ log: lg(q), dir: norm(q), kind: 'star' }); }
  for (const g of [mw, andromeda]) for (const q of g.sampleWorld(3000)) mapPts.push({ log: lg(q), dir: norm(q), kind: 'gal' });
  for (const q of cosmos.sampleWorld(5000)) mapPts.push({ log: lg(q), dir: norm(q), kind: 'web' });
  const mapLabels: MapLabel[] = [
    { log: lg(rel(moonAbs)), dir: norm(rel(moonAbs)), key: 'obj.moon' },
    { log: lg(rel([0, 0, 0])), dir: norm(rel([0, 0, 0])), key: 'label.sun' },
    { log: lg(cat.posM(alphaI)), dir: norm(cat.posM(alphaI)), key: 'label.alphacen' },
    { log: lg(gc), dir: norm(gc), key: 'mw.center' },
    { log: lg(m31), dir: norm(m31), key: 'm31.label' },
    { log: lg(cosmos.virgo), dir: norm(cosmos.virgo), key: 'uni.virgo' },
    { log: Math.log10(4.4e26), dir: norm(sub(mul(m31Dir, -1), gcDir)), key: 'uni.cmb' },
  ];
  const logmap = new LogMap(document.getElementById('logmap') as HTMLCanvasElement, mapPts, mapLabels);
  const hint = document.getElementById('hint')!;
  const beatNum = document.getElementById('beat-num')!;
  const beatName = document.getElementById('beat-name')!;

  const beats = new BeatsController(document.getElementById('beats')!, {
    mountTool,
    heroExtra: () => t('hero.sky', { date: fmtDate(date, lang()), count: fmtNum(cat.count, lang(), 0) }),
    extra,
    sources: sourcesHtml,
  }, reduced);

  onLang(() => {
    beats.relocalize(); hud.relocalize(); labels.relocalize(); logmap.invalidate();
  });

  installKeys({
    current: () => scroll.p,
    fly,
    toggleFullscreen,
    cycleLang: () => setLang(LANGS[(LANGS.indexOf(lang()) + 1) % LANGS.length]),
    toggleSound: () => void audio.toggle(),
    toggleBoost: () => { root.classList.toggle('boost'); beats.relocalize(); },
    toggleBlack: () => root.classList.toggle('black'),
    toggleHelp,
    helpOpen: () => !help.hidden,
    toggleDebug: () => root.classList.toggle('debug'),
  });

  /* ── число в тексте → его место на линейке (log₁₀ в HUD) ── */
  const numTip = document.createElement('div');
  numTip.id = 'num-tip';
  numTip.setAttribute('role', 'tooltip');
  document.body.appendChild(numTip);
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as Element).closest?.('.num[data-log]') as HTMLElement | null;
    if (!el) { if (numTip.classList.contains('is-on')) { numTip.classList.remove('is-on'); hud.ghost(null); } return; }
    const lv = Number(el.dataset.log);
    numTip.textContent = t('num.tip', { l: fmtNum(lv, lang(), 2) });
    const r = el.getBoundingClientRect();
    numTip.style.transform = `translate(${Math.min(r.left, innerWidth - 320)}px, ${r.top - 34}px)`;
    numTip.classList.add('is-on');
    hud.ghost(lv);
  });

  // строки SplitText зависят от ширины — после изменения окна пересобираем активный текст
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = window.setTimeout(() => beats.relocalize(), 250); });

  installEggs({ setEngrave: (v) => { engine.engrave = v; }, getEngrave: () => engine.engrave, reduced });

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

  /** hash начинаем обновлять только после перехода по исходной ссылке */
  let started = false;

  /* ── главный цикл: одна функция n → всё ── */
  const t0 = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = now - last; last = now;
    if (document.hidden) return;
    const n = scroll.n, p = scroll.p;
    engine.render(n, rig(n, innerWidth / innerHeight), (now - t0) / 1000, p);
    if (!forced) quality.tick(dt);
    beats.update(p, scroll.flying, scroll.velocity);
    const cur = beats.current;
    hud.update(n, cur?.id ?? null, solar.inflation);
    logmap.draw(engine.frame);
    audio.update(n);
    labels.update(n, engine.frame.pxScale);
    cursor.tick();
    updateTip();
    // адрес страницы помнит остановку: после сбоя можно вернуться по #b-…
    if (cur && !scroll.flying && started && location.hash !== `#b-${cur.id}`) history.replaceState(null, '', `#b-${cur.id}`);
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
      get n() { return scroll.p; },
      get beat() { return beats.current?.id ?? null; },
      fps: () => quality.fps,
      tier: () => engine.tier,
      engine,
    };
  }
  await pre.done();
  // deep link: #b-pogson
  const target = BEATS.find((b) => `#b-${b.id}` === START_HASH);
  if (target) scroll.flyTo(target.p, () => { started = true; });
  else started = true;
}

main().catch((e) => {
  console.error(e);
  document.documentElement.classList.add('no-gl');
});
