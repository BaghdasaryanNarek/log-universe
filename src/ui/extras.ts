import { SOURCES } from '../content/sources.ts';
import { QR_SVG, SITE_URL } from 'virtual:qr';
import { HR_BOX } from '../scenes/stars/stars-layer.ts';
import { t, lang } from '../i18n/index.ts';
import { sup } from '../i18n/format.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Страница в духе «Canon» Непера (1614): угол, синус при радиусе 10⁷ и логарифм Непера
 * L = 10⁷·ln(10⁷ / sin). Значения посчитаны, а не скопированы: у Непера в 7-м знаке бывают ошибки.
 */
export function napierPage(): string {
  const rows: string[] = [];
  for (let m = 0; m <= 9; m++) {
    const a = ((30 + m / 60) * Math.PI) / 180;
    const sin = Math.round(1e7 * Math.sin(a));
    const L = Math.round(1e7 * Math.log(1e7 / sin));
    rows.push(`<tr><td>${m}</td><td>${sin}</td><td>${L}</td></tr>`);
  }
  return `<figure class="beat-extra napier" aria-label="${esc(t('napier.tableTitle'))}">
    <div class="napier-page">
      <div class="napier-head">${esc(t('napier.tableTitle'))}</div>
      <table><thead><tr><th>Gr. 30<br><span>min</span></th><th>Sinus</th><th>Logarithmi</th></tr></thead><tbody>${rows.join('')}</tbody></table>
      <div class="napier-rule"></div>
    </div>
    <figcaption>${esc(t('napier.tableNote'))}</figcaption>
  </figure>`;
}

/** Реконструкция пластинки Хаббла (негатив): чёрные звёзды на светлом, обведённая переменная и «VAR!». */
export function varPlate(): string {
  let dots = '';
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 140; i++) {
    const x = r() * 300, y = r() * 220, rr = 0.6 + Math.pow(r(), 6) * 3.4;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}"/>`;
  }
  return `<figure class="beat-extra var-plate" aria-hidden="true">
    <svg viewBox="0 0 300 220"><rect width="300" height="220" class="vp-bg"/><g class="vp-stars">${dots}</g>
      <circle cx="196" cy="92" r="2.4" class="vp-v1"/><circle cx="196" cy="92" r="11" class="vp-ring"/>
      <path d="M 162 70 q 6 -4 22 12" class="vp-ink"/>
      <text x="118" y="64" class="vp-var">VAR!</text></svg>
    <figcaption>M31 · 1923 · ${esc(t('m31.v1'))}</figcaption>
  </figure>`;
}

/** Оси диаграммы Г–Р, совмещённые с рамкой, в которую шейдер перестраивает звёзды. */
export function hrAxes(): string {
  const W = 1000, H = 1000;
  const x = (bv: number) => ((bv + 0.4) / 2.4) * W;
  const y = (M: number) => ((M + 8) / 24) * H;
  let g = `<line x1="0" y1="${H}" x2="${W}" y2="${H}" class="ax"/><line x1="0" y1="0" x2="0" y2="${H}" class="ax"/><line x1="${W}" y1="0" x2="${W}" y2="${H}" class="ax"/>`;
  const labels: string[] = [];
  for (let bv = -0.4; bv <= 2.001; bv += 0.4) {
    g += `<line x1="${x(bv)}" y1="${H}" x2="${x(bv)}" y2="${H + 14}" class="tk"/>`;
    labels.push(`<span class="hr-tx" style="left:${(x(bv) / W) * 100}%">${bv.toFixed(1).replace('-', '−').replace('.', lang() === 'en' ? '.' : ',')}</span>`);
  }
  for (let M = -8; M <= 16; M += 4) {
    g += `<line x1="-14" y1="${y(M)}" x2="0" y2="${y(M)}" class="tk"/>`;
    labels.push(`<span class="hr-ty" style="top:${(y(M) / H) * 100}%">${M > 0 ? '+' : M < 0 ? '−' : ''}${Math.abs(M)}</span>`);
  }
  // правая ось — светимость: M = 4,83 − 2,5·log₁₀ L
  for (let k = -4; k <= 5; k++) {
    const M = 4.83 - 2.5 * k;
    if (M < -8 || M > 16) continue;
    g += `<line x1="${W}" y1="${y(M)}" x2="${W + 14}" y2="${y(M)}" class="tk tk-l"/>`;
    labels.push(`<span class="hr-tl" style="top:${(y(M) / H) * 100}%">10${sup(k)}</span>`);
  }
  // Солнце: B−V = 0,656, M = 4,83
  g += `<circle cx="${x(0.656)}" cy="${y(4.83)}" r="16" class="sun"/>`;
  return `<div class="beat-extra hr-axes" aria-hidden="true" style="left:${50 + HR_BOX.x0 * 100}vw;width:${(HR_BOX.x1 - HR_BOX.x0) * 100}vw;top:${50 - HR_BOX.y * 50}vh;height:${HR_BOX.y * 100}vh">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>
    ${labels.join('')}
    <span class="hr-name hr-x">${esc(t('hr.axisX'))}</span>
    <span class="hr-name hr-m">M</span>
    <span class="hr-name hr-l">${esc(t('hr.axisY'))}</span>
    <span class="hr-reg" style="left:${(x(0.55) / W) * 100}%;top:${(y(7.5) / H) * 100}%">${esc(t('hr.ms'))}</span>
    <span class="hr-reg" style="left:${(x(1.35) / W) * 100}%;top:${(y(-1.2) / H) * 100}%">${esc(t('hr.giants'))}</span>
    <span class="hr-reg" style="left:${(x(0.05) / W) * 100}%;top:${(y(13.2) / H) * 100}%">${esc(t('hr.dwarfs'))}</span>
    <span class="hr-reg hr-sun" style="left:${(x(0.656) / W) * 100}%;top:${(y(4.83) / H) * 100}%">${esc(t('hr.sun'))}</span>
  </div>`;
}

/**
 * QR-код с production-адресом (генерируется при сборке, см. vite.config.ts).
 * Подпись сразу на трёх языках: зал смешанный, язык страницы может быть любым.
 */
export function qrCard(): string {
  const host = SITE_URL.replace(/^https?:\/\//, '');
  return `<figure class="beat-extra qr-card">
    <div class="qr-code" role="img" aria-label="QR: ${esc(SITE_URL)}">${QR_SVG}</div>
    <figcaption>
      <a class="qr-url" href="${esc(SITE_URL)}">${esc(host)}</a>
      <span lang="hy">Բացեք կայքը ձեր հեռախոսում</span>
      <span lang="ru">Откройте сайт на своём телефоне</span>
      <span lang="en">Open the site on your phone</span>
    </figcaption>
  </figure>`;
}

export function sourcesHtml(): string {
  const groups: [string, string][] = [['history', 'src.history'], ['astro', 'src.astro'], ['data', 'src.data'], ['media', 'src.media'], ['code', 'src.code']];
  const parts = groups.map(([g, key]) => {
    const items = SOURCES.filter((s) => s.group === g).map((s) =>
      `<li>${esc(s.title)}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : ''}</li>`).join('');
    return `<section class="src-group"><h3>${esc(t(key))}</h3><ol>${items}</ol></section>`;
  });
  return `<h2 class="src-title">${esc(t('src.title'))}</h2><p class="src-intro">${esc(t('src.note'))}</p><div class="src-list" data-lenis-prevent>${parts.join('')}</div>`;
}
