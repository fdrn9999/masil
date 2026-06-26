// sprites.js — 화자 캐릭터의 스탠딩 스프라이트를 화면에 띄우는 얇은 레이어 (safe-play).
//
// 감정 변형이 '감정별 전신 통짜 이미지'라, 표정 변경 = 이미지 통째 교체(image-unit).
//
// 교체 경로 2가지:
//  1) 자동(화자): say(who=s/j/m/d) 시 그 캐릭터를 띄움. 단 '감정 sticky' — 이미 같은
//     캐릭터가 떠 있고 face 미지정이면 현재 표정을 유지(다음 대사가 기본으로 되돌리지 않음).
//     새 인물로 바뀔 때만 기본 표정(def). mc/n 등은 현재 표시 유지.
//  2) 명시적(story): {op:'sprite', img:'doyun_cry'} 로 정확한 이미지를 직접 교체,
//     {op:'sprite', who, face} 또는 {op:'sprite', hide:true}.
//
// 배경 이미지 div 방식 + onerror 무표시 = safe-play(에셋 없어도 본편 흐름 영향 0).
// 경로는 레지스트리/노드 값만 쓰므로(자유 입력 아님) escape 불필요.

export function makeSprites(root, { SPRITES, base = 'images/sprites/' }) {
  let layer = root.querySelector('#sprite-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'sprite-layer';
    root.appendChild(layer);
  }
  let curKey = null;    // 현재 표시 중인 'char_emotion'
  let curChar = null;   // 현재 표시 중인 캐릭터(예: 'seoa')
  let reqId = 0;        // 늦게 로드된 이전 요청이 최신 표시를 덮지 않게

  // 'char_emotion' 키를 실제로 화면에 띄움
  function apply(key) {
    if (key === curKey && layer.classList.contains('shown')) return;
    const path = base + key + '.webp';
    const my = ++reqId;
    const wasShown = layer.classList.contains('shown');
    const img = new Image();
    img.onload = () => {
      if (my !== reqId) return;                       // 더 최신 요청이 왔으면 버림
      if (wasShown) {
        // 이미 떠 있으면 미세 디졸브로 교체(표정/인물 변경 하드컷 방지)
        layer.classList.add('swap');
        requestAnimationFrame(() => {
          layer.style.backgroundImage = `url("${path}")`;
          requestAnimationFrame(() => layer.classList.remove('swap'));
        });
      } else {
        layer.style.backgroundImage = `url("${path}")`;
        layer.classList.add('shown');                 // 첫 등장은 .shown 페이드인
      }
      curKey = key;
      curChar = key.split('_')[0];
    };
    img.onerror = () => {};                           // safe-play: 에셋 없으면 무표시 유지
    img.src = path;
  }

  // 자동(화자) — 감정 sticky
  function show(who, face) {
    const reg = SPRITES[who];
    if (!reg) return;                                 // mc/n 등 → 현재 표시 유지
    let emo;
    if (face && reg.emotions.includes(face)) emo = face;      // 감정 명시 → 그걸로
    else if (curChar === reg.char) return;                    // 같은 인물 + 미지정 → 현재 표정 유지
    else emo = reg.def;                                       // 새 인물 등장 → 기본 표정
    apply(reg.char + '_' + emo);
  }

  // 명시적 이미지 교체 (image-unit). name 예: 'doyun_cry', 'seoa_teasing'
  function showImage(name) {
    if (!name) return;
    apply(String(name));
  }

  function hide() {
    reqId++;                       // 진행 중 로드 무효화
    layer.classList.remove('shown');
    layer.classList.remove('swap');   // 디졸브 상태 누수 방지
    curKey = null;
    curChar = null;
  }

  return { show, showImage, hide };
}
