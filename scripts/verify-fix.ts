/**
 * Проверка правки «окно в космос»: node scripts/verify-fix.ts [url]
 *  1) геометрия: миниатюры (#b-napier, #b-andromeda) и оси Г–Р не пересекают HUD, кнопки, шкалу,
 *     подпись сцены; миниатюра — в левой половине и внутри текстовой колонки; оси Г–Р не задевают HUD;
 *  2) лайтбокс: клик, Enter, Esc, фон, ×, колесо, первая → / PgDn / Space только закрывают, I открывает/закрывает,
 *     фокус удерживается и возвращается; клавиши по event.code в раскладках HY/RU.
 */
import { chromium, type Page } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5173/';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const issues: string[] = [];
let fails = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fails++; console.log(`✗ ${msg}`); } };
const fly = (p: Page, n: number) => p.evaluate((nn) => (window as any).__lc.fly(nn), n);

type R = { x: number; y: number; w: number; h: number } | null;
const rect = (p: Page, sel: string) => p.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect(); if (!r.width || !r.height) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}, sel) as Promise<R>;
const hit = (a: R, c: R, gap = 0) => !!a && !!c && a.x < c.x + c.w + gap && c.x < a.x + a.w + gap && a.y < c.y + c.h + gap && c.y < a.y + a.h + gap;

for (const [w, h] of [[1366, 768], [1280, 720], [1920, 1080], [390, 844]] as const) {
  for (const lang of ['hy', 'ru', 'en']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((l) => { try { localStorage.setItem('log-cosmos.lang', l); } catch { /* */ } }, lang);
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`${w}x${h} ${lang} ${m.type()}: ${m.text()}`); });
    p.on('pageerror', (e) => issues.push(`${w}x${h} ${lang} pageerror: ${e.message}`));
    await p.goto(`${url}?test`);
    await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 90000 });
    const tag = `${w}×${h} ${lang}`;
    const ui = ['.hud-read', '.top-right', '.brand', '.beat-ind', '.hud-scale'];
    for (const [id, n] of [['napier', 1.6], ['andromeda', 21.95]] as const) {
      await fly(p, n); await p.waitForTimeout(4200);
      const th = await rect(p, `#b-${id} .artifact`);
      const img = await rect(p, `#b-${id} .artifact-mini`);
      const col = await rect(p, `#b-${id} .beat-inner`);
      ok(!!th, `${tag} #b-${id}: миниатюры нет на экране`);
      if (!th) continue;
      ok(!!img && Math.max(img.w, img.h) <= 161 && Math.max(img.w, img.h) >= 110, `${tag} #b-${id}: изображение миниатюры вне 120–160 px (${img?.w.toFixed(0)}×${img?.h.toFixed(0)})`);
      ok(th.y + th.h <= h + 1 && th.y >= 0, `${tag} #b-${id}: миниатюра за краем экрана`);
      if (w > 700) ok(th.x + th.w <= w * 0.5, `${tag} #b-${id}: миниатюра заходит в зону 3D-сцены`);
      ok(!!col && th.x >= col.x - 1 && th.x + th.w <= col.x + col.w + 1, `${tag} #b-${id}: миниатюра вне текстовой колонки`);
      for (const s of ui) ok(!hit(th, await rect(p, s), 4), `${tag} #b-${id}: миниатюра задевает ${s}`);
      // текст колонки не перекрывается миниатюрой (миниатюра — последний элемент колонки)
      const lastP = await p.evaluate((bid) => { const ps = [...document.querySelectorAll(`#b-${bid} .beat-inner > .line, #b-${bid} .beat-inner > .formula`)]; const r = ps.at(-1)?.getBoundingClientRect(); return r ? r.bottom : 0; }, id);
      ok(th.y >= lastP - 1, `${tag} #b-${id}: миниатюра выше последнего абзаца`);
    }
    if (w > 700) {
      await fly(p, 17.8); await p.waitForTimeout(4200);
      const axes = await p.evaluate(() => [...document.querySelectorAll('.beat.is-active .hr-axes, .beat.is-active .hr-axes span')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
      const hud = await rect(p, '.hud-read');
      const col = await rect(p, '#b-hr .beat-inner > .line');
      for (const a of axes) {
        ok(!hit(a, hud, 12), `${tag} #b-hr: ось задевает HUD (зазор < 12 px)`);
        ok(!hit(a, await rect(p, '.top-right'), 8), `${tag} #b-hr: ось задевает кнопки`);
      }
      void col;
    }
    await ctx.close();
  }
}

// ── лайтбокс и клавиши ──
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('log-cosmos.lang', 'ru'); } catch { /* */ } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => issues.push(`lightbox pageerror: ${e.message}`));
  await p.goto(`${url}?test`);
  await p.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 90000 });
  const open = () => p.evaluate(() => !(document.getElementById('lightbox') as HTMLElement).hidden && document.documentElement.classList.contains('lb-open'));
  const n = () => p.evaluate(() => (window as any).__lc.n as number);
  const wait = (ms = 450) => p.waitForTimeout(ms);
  await fly(p, 1.6); await p.waitForTimeout(4200);

  await p.click('#b-napier .artifact'); await wait();
  ok(await open(), 'клик по миниатюре не открыл лайтбокс');
  ok(await p.evaluate(() => document.activeElement?.classList.contains('lb-close') ?? false), 'фокус не на кнопке × после открытия');
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  ok(await p.evaluate(() => !!document.activeElement?.closest('#lightbox')), 'Tab выводит фокус из лайтбокса');
  await p.keyboard.press('Escape'); await wait();
  ok(!(await open()), 'Esc не закрыл лайтбокс');
  ok(await p.evaluate(() => document.activeElement?.classList.contains('artifact') ?? false), 'фокус не вернулся на миниатюру');

  await p.keyboard.press('Enter'); await wait();
  ok(await open(), 'Enter на миниатюре не открыл лайтбокс');
  await p.mouse.click(15, 384); await wait();
  ok(!(await open()), 'клик по фону не закрыл лайтбокс');

  await p.focus('#b-napier .artifact'); await p.keyboard.press('Space'); await wait();
  ok(await open(), 'Space на миниатюре не открыл лайтбокс');
  await p.click('.lb-close'); await wait();
  ok(!(await open()), '× не закрыл лайтбокс');

  for (const key of ['ArrowRight', 'PageDown', 'Space']) {
    await p.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await p.keyboard.press('KeyI'); await wait();
    ok(await open(), `I не открыл лайтбокс (перед ${key})`);
    const before = await n();
    await p.keyboard.press(key); await wait(300);
    ok(!(await open()), `первое ${key} не закрыло лайтбокс`);
    ok(Math.abs((await n()) - before) < 0.01, `первое ${key} пролистало сцену`);
  }
  await p.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(3500);
  ok((await n()) > 2, 'второе → не пролистало сцену дальше');
  await fly(p, 1.6); await p.waitForTimeout(4200);

  await p.keyboard.press('KeyI'); await wait();
  await p.mouse.wheel(0, 120); await wait();
  ok(!(await open()), 'колесо не закрыло лайтбокс');

  // раскладки: та же физическая клавиша, другие символы
  const press = (code: string, key: string) => p.evaluate(([c, k]) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: k, bubbles: true })), [code, key]);
  await p.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await press('KeyI', 'ш'); await wait();
  ok(await open(), 'I в русской раскладке (ш) не открыла лайтбокс');
  await press('KeyI', 'ի'); await wait();
  ok(!(await open()), 'I в армянской раскладке (ի) не закрыла лайтбокс');
  await press('KeyH', 'р'); await wait();
  ok(await p.evaluate(() => !(document.getElementById('help') as HTMLElement).hidden), 'H в русской раскладке не открыла шпаргалку');
  ok(await p.evaluate(() => /\bI\b/.test(document.getElementById('help')!.textContent ?? '')), 'в шпаргалке нет клавиши I');
  await press('KeyH', 'р'); await wait();
  const lang0 = await p.evaluate(() => document.documentElement.lang);
  await press('KeyL', 'լ'); await wait(800);
  ok((await p.evaluate(() => document.documentElement.lang)) !== lang0, 'L в армянской раскладке не сменила язык');
  await press('KeyK', 'л'); await wait();
  ok(await p.evaluate(() => document.documentElement.classList.contains('boost')), 'K в русской раскладке не включила режим проектора');
  await press('Digit5', '5'); await p.waitForTimeout(5000);
  ok(Math.abs((await n()) - 16.8) < 0.05, 'цифра 5 не перелетела к сцене 5');
  // «napier» в любой раскладке и без открытия изображения на букве I
  await fly(p, 1.6); await p.waitForTimeout(4200);
  for (const [c, k] of [['KeyN', 'т'], ['KeyA', 'ф'], ['KeyP', 'з'], ['KeyI', 'ш'], ['KeyE', 'у'], ['KeyR', 'к']]) await press(c, k);
  await wait(800);
  ok(!(await open()), '«napier» открыл изображение на букве I');
  ok(await p.evaluate(() => document.documentElement.classList.contains('engraving')), '«napier» в русской раскладке не включил гравюру');
  await ctx.close();
}
await b.close();
console.log(issues.length ? `Console:\n${issues.join('\n')}` : 'Console: clean');
console.log(fails ? `ОШИБОК: ${fails}` : 'Все проверки пройдены');
if (fails) process.exit(1);
