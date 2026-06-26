// sprites.js — 화자 캐릭터의 스탠딩 스프라이트를 화면에 띄우는 얇은 레이어 (safe-play).
//
// say(who=s/j/m/d) 가 들어오면 그 캐릭터를 보여주고, 장면 전환(scene)·채팅 열림에 숨긴다.
// mc(나)·n(나레이션)은 스프라이트가 없으므로 현재 표시를 그대로 둔다(그 자리에 계속 서 있는 느낌).
// 감정은 story 노드의 face(예: face:'smile')로 지정 — 없으면 캐릭터별 기본(def).
// webp 에셋이 없으면 조용히 무표시(onerror) — 본편 흐름엔 영향 없음.
//
// 배경 이미지 방식(div background-image)이라 stage 배경과 동일하게 안전. 경로는 레지스트리
// 값만 쓰므로(사용자 입력 없음) escape 불필요.

export function makeSprites(root, { SPRITES, base = 'images/sprites/' }) {
  let layer = root.querySelector('#sprite-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'sprite-layer';
    root.appendChild(layer);
  }
  let curKey = null;   // 현재 표시 중인 'char_emotion'
  let reqId = 0;       // 늦게 로드된 이전 요청이 최신 표시를 덮지 않게

  function show(who, face) {
    const reg = SPRITES[who];
    if (!reg) return;  // mc/n 등 스프라이트 없는 화자 → 현재 표시 유지
    const emo = (face && reg.emotions.includes(face)) ? face : reg.def;
    const key = reg.char + '_' + emo;
    if (key === curKey && layer.classList.contains('shown')) return;   // 동일 → no-op
    const path = base + key + '.webp';
    const my = ++reqId;
    const img = new Image();
    img.onload = () => {
      if (my !== reqId) return;                       // 더 최신 요청이 왔으면 버림
      layer.style.backgroundImage = `url("${path}")`;
      layer.classList.add('shown');
      curKey = key;
    };
    img.onerror = () => {};                           // safe-play: 에셋 없으면 무표시 유지
    img.src = path;
  }

  function hide() {
    reqId++;                       // 진행 중 로드 무효화
    layer.classList.remove('shown');
    curKey = null;
  }

  return { show, hide };
}
