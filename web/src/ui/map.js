// map.js — 2호선 캔디 루프 지하철 맵 (story call_screen subway_map 용 모달)
// Usage: const map = makeMap(root, { sys, state }); await map.show();

import { STATIONS, MAP } from '../theme.js';

// html-escape for dynamic text inserted via innerHTML
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// jamsil + sinchon always open per Ren'Py `default station_unlocked`
const DEFAULT_OPEN = new Set(['jamsil', 'sinchon']);

function isOpen(key, stationsArr) {
  return DEFAULT_OPEN.has(key) || (stationsArr || []).includes(key);
}

function stationName(key) {
  const s = STATIONS.find(st => st.key === key);
  return s ? s.name : key;
}

// Build the SVG ellipse path connecting stations in loop order.
// We use the spec's ellipse (cx=50 cy=46 rx=34 ry=37 in 0-100 space) as the track.
function buildSVG(currentStation, stationsArr, mapW, mapH) {
  // SVG coordinate helpers: station x/y (0..1) → px within mapW × mapH
  const px = x => (x * mapW).toFixed(1);
  const py = y => (y * mapH).toFixed(1);

  // Build station node SVGs
  const nodes = STATIONS.map(st => {
    const here = st.key === currentStation;
    const open = isOpen(st.key, stationsArr);

    const cx = parseFloat(px(st.x));
    const cy = parseFloat(py(st.y));

    let labelColor, isLocked;
    if (here) {
      labelColor = MAP.node_here;   // blush-red
      isLocked = false;
    } else if (open) {
      labelColor = MAP.name_txt;    // mint green node, ink label
      isLocked = false;
    } else {
      labelColor = '#9a9a9a';       // grey
      isLocked = true;
    }

    const dotR = here ? 18 : 12;
    // Current dot uses the glossy radial gradient; others flat.
    const dotFill = here ? 'url(#map-here-grad)' : (open ? MAP.node_open : MAP.node_lock);

    // Label placement: decide above vs below based on y position
    // stations near top (y < 0.5): label above; stations near bottom (y >= 0.5): label below
    // Also push left/right for edge stations
    let labelDx = 0;
    let labelDy = 0;
    let labelAnchor = 'middle';

    if (st.x < 0.25) {
      // left-side stations: label to the left
      labelDx = -(dotR + 28);
      labelAnchor = 'end';
    } else if (st.x > 0.75) {
      // right-side stations: label to the right
      labelDx = dotR + 28;
      labelAnchor = 'start';
    } else if (st.y < 0.4) {
      // top stations: label above
      labelDy = -(dotR + 20);
    } else {
      // bottom stations: label below
      labelDy = dotR + 22;
    }

    // "지금 여기" pin above the current station node
    const pinSvg = here ? `
      <!-- ♥ 지금 여기 pin -->
      <g transform="translate(${cx},${cy - dotR - 44})">
        <path d="M0,28 C-14,8 -14,-8 0,-8 C14,-8 14,8 0,28 Z"
          fill="${MAP.node_here}" filter="url(#map-pin-shadow)" opacity="0.95"/>
        <circle cy="2" r="8" fill="#fff"/>
        <text y="6" font-size="11" text-anchor="middle" fill="${MAP.node_here}" font-family="Jua,sans-serif">♥</text>
      </g>
      <text x="${cx}" y="${cy - dotR - 22}" font-size="13" text-anchor="middle"
        fill="${MAP.node_here}" font-family="Jua,sans-serif" font-weight="bold">지금 여기</text>
    ` : '';

    const lockIcon = isLocked ? `
      <text x="${cx}" y="${cy + 6}" font-size="14" text-anchor="middle" dominant-baseline="middle">🔒</text>
    ` : '';

    const displayName = isLocked ? `🔒 ${st.name}` : st.name;
    const labelFontSize = here ? 18 : (isLocked ? 15 : 16);
    const labelFontWeight = here ? 'bold' : 'normal';

    return `
    ${pinSvg}
    <!-- station: ${st.key} -->
    <circle cx="${cx}" cy="${cy}" r="${dotR}"
      fill="${dotFill}" stroke="#fff" stroke-width="4"
      filter="${here ? 'url(#map-pin-shadow)' : 'url(#map-node-shadow)'}"/>
    ${lockIcon}
    <text x="${cx + labelDx}" y="${cy + labelDy}"
      font-size="${labelFontSize}" font-family="Jua,sans-serif"
      text-anchor="${labelAnchor}" fill="${labelColor}"
      font-weight="${labelFontWeight}">${esc(displayName)}</text>
    `;
  }).join('\n');

  return `<svg width="${mapW}" height="${mapH}" viewBox="0 0 ${mapW} ${mapH}"
    xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <defs>
      <linearGradient id="map-track-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#9be7cd"/>
        <stop offset="1" stop-color="#7fdcc0"/>
      </linearGradient>
      <filter id="map-node-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#6fc9a8" flood-opacity="0.4"/>
      </filter>
      <filter id="map-pin-shadow" x="-80%" y="-80%" width="260%" height="260%">
        <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#ff7d9c" flood-opacity="0.6"/>
      </filter>
      <radialGradient id="map-here-grad" cx="0.35" cy="0.3">
        <stop offset="0" stop-color="#ffc0cf"/>
        <stop offset="1" stop-color="#ff7d9c"/>
      </radialGradient>
    </defs>

    <!-- ── Loop track (rounded rect matching the candy-loop mockup) ── -->
    <!-- Outer track stripe with gradient fill -->
    <rect x="${mapW*0.12}" y="${mapH*0.12}" width="${mapW*0.76}" height="${mapH*0.76}"
      rx="${mapH*0.30}" fill="none"
      stroke="url(#map-track-grad)" stroke-width="22"
      filter="url(#map-node-shadow)"/>
    <!-- White dashed stitching sparkle overlay on the track -->
    <rect x="${mapW*0.12}" y="${mapH*0.12}" width="${mapW*0.76}" height="${mapH*0.76}"
      rx="${mapH*0.30}" fill="none"
      stroke="#ffffff" stroke-width="5"
      stroke-dasharray="3 22" stroke-linecap="round" opacity="0.75"/>

    <!-- Cute floating sparkles -->
    <text x="${mapW*0.5}" y="${mapH*0.5}" font-size="28" text-anchor="middle" fill="#cfeede" font-family="Jua,sans-serif">🚃</text>
    <text x="${mapW*0.38}" y="${mapH*0.38}" font-size="16" opacity="0.6" fill="#b8e8d0">✦</text>
    <text x="${mapW*0.62}" y="${mapH*0.62}" font-size="14" opacity="0.6" fill="#b8e8d0">✦</text>

    <!-- ── Station nodes ── -->
    ${nodes}
  </svg>`;
}

export function makeMap(root, { sys, state }) {
  const overlayEl = root.querySelector('#overlay');

  function show() {
    return new Promise(resolve => {
      const vars = (state && state.vars) ? state.vars : {};
      const unlockedStations = vars.__stations || [];

      // currentStation = most recently unlocked, or jamsil as default
      let currentStation = 'jamsil';
      if (unlockedStations.length > 0) {
        currentStation = unlockedStations[unlockedStations.length - 1];
      }

      // Map render area size (SVG will fill this)
      const mapW = 680;
      const mapH = 420;

      const svgMarkup = buildSVG(currentStation, unlockedStations, mapW, mapH);

      // Legend rows
      const legendHtml = `
        <div class="map-legend">
          <span class="map-legend__row">
            <span style="color:${MAP.node_here};font-size:18px;">◉</span>
            <span>현재 위치</span>
          </span>
          <span class="map-legend__row">
            <span style="color:${MAP.node_open};font-size:16px;">●</span>
            <span>이동 가능</span>
          </span>
          <span class="map-legend__row">
            <span>🔒</span>
            <span>아직 잠김</span>
          </span>
        </div>
      `;

      const curName = esc(stationName(currentStation));

      overlayEl.classList.remove('hidden');
      overlayEl.innerHTML = `
        <div class="map-panel">
          <button class="map-panel__x" aria-label="닫기">×</button>
          <div class="map-panel__header">
            <div class="map-panel__title-block">
              <span class="map-panel__badge">2</span>
              <span class="map-panel__title">2호선</span>
            </div>
            <div class="map-panel__subtitle">가고 싶은 역을 선택하세요</div>
          </div>
          ${legendHtml}
          <div class="map-panel__svg-wrap">
            ${svgMarkup}
          </div>
          <div class="map-panel__bottom-bar">
            <span class="map-panel__cur-label">현재 위치:&nbsp;</span>
            <span class="map-panel__cur-name">${curName}</span>
            <button class="map-panel__close">닫기</button>
          </div>
        </div>
      `;

      function onKey(e) {
        if (e.key === 'Escape') dismiss();
      }

      function dismiss() {
        document.removeEventListener('keydown', onKey);
        overlayEl.classList.add('hidden');
        overlayEl.innerHTML = '';
        resolve();
      }

      document.addEventListener('keydown', onKey);
      overlayEl.querySelector('.map-panel__close').onclick = dismiss;
      overlayEl.querySelector('.map-panel__x').onclick = dismiss;
    });
  }

  return { show };
}
