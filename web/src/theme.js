export const HEROINES = { seoa: '서아', jiu: '지우', mingyeol: '민결' };
export const ITEMS = {
  hangover:    { name: '숙취해소제',   icon: '🧴', desc: '그날 밤 편의점에서 산 숙취해소제. 누군가에게 필요할지도.' },
  sakura_card: { name: '벚꽃 엽서',     icon: '🌸', desc: '석촌호수 벚꽃 사진으로 만든 엽서. 내 프사를 알아본 그 사람에게 어울릴까.' },
  movie_tkt:   { name: '영화 예매권',   icon: '🎬', desc: '2인 영화 예매권. 다음 약속에 쓸 수 있다.' },
  warm_can:    { name: '따뜻한 캔커피', icon: '☕', desc: '자판기에서 뽑은 따뜻한 캔커피 두 개. 추운 밤에.' },
  doyun_keyring:{ name: '도윤의 키링', icon: '🔑', desc: '도윤이 우정의 증표라며 쥐여준 낡은 키링. 버릴 수 없는 무게가 있다.' },
  polaroid:    { name: '폴라로이드', icon: '📷', desc: '지우와 성수 카페에서 찍은 폴라로이드 한 장. 둘 다 어색하게 웃고 있다.' },
};
export const ENDING_LIST = [
  ["reconcile", "용서까지 데려다준 사람"],
  ["doyun",     "그날 그 손을 끝까지"],
  ["true",      "끝내 건넨 진심"],
  ["good",      "서툰 진심"],
  ["fishtank",  "모두의, 아무도 아닌"],
  ["lonely",    "못다 준 사람"],
  ["run",       "다시 혼자"],
];
export const CHAT_AVATARS = { '도윤': '#2fb574', '서아': '#e8553d', '지우': '#5ba3d0', '민결': '#b06cc0' };

// ── d.3 Map + Station constants (verbatim from screens_map.rpy) ──────────────
export const MAP = {
  bg:        '#f3f1ea',  // 맵 배경 (종이 느낌)
  line:      '#2fb574',  // 2호선 라인
  node_open: '#2fb574',  // 갈 수 있는 역
  node_lock: '#c2c2c2',  // 잠긴 역
  node_here: '#e8553d',  // 현재 위치
  name_txt:  '#2b2b2b',
  title_txt: '#2fb574',
};

// x, y are screen-ratio 0.0–1.0; array order matches screens_map.rpy
export const STATIONS = [
  { key: 'hongdae',  name: '홍대입구', x: 0.30, y: 0.16 },
  { key: 'hapjeong', name: '합정',     x: 0.50, y: 0.12 },
  { key: 'seongsu',  name: '성수',     x: 0.70, y: 0.16 },
  { key: 'konkuk',   name: '건대입구', x: 0.84, y: 0.42 },
  { key: 'jamsil',   name: '잠실',     x: 0.78, y: 0.72 },
  { key: 'gangnam',  name: '강남',     x: 0.50, y: 0.86 },
  { key: 'mullae',   name: '문래',     x: 0.22, y: 0.72 },
  { key: 'sinchon',  name: '신촌',     x: 0.16, y: 0.42 },
];

export const MASIL = {
  bg: '#e8ebf2', topbar: '#2f3447', topbar_txt: '#ffffff', topbar_sub: '#b8c0d0', online: '#46d18a',
  recv_bubble: '#ffffff', recv_txt: '#1c1f2a', send_bubble: '#6c7cf0', send_txt: '#ffffff',
  name_txt: '#3b4257', time_txt: '#8a90a3', read_txt: '#6c7cf0', avatar_bg: '#c3c9d9', typing: '#9aa0b3',
};

// 배경 에셋 힌트 — 각 bg 키의 한국어 설명. 예상 이미지 파일 = images/bg/bg_<키>.png
// real:false = 연출용(흑막/플래시) → 에셋 불필요, 힌트 칩 미표시.
export const BG_INFO = {
  room:        { desc: '잠실 자취방 (밤)' },
  room_dawn:   { desc: '자취방 (새벽)' },
  room_later:  { desc: '시간이 지난 방 (밤)' },
  sinchon:     { desc: '신촌 연세로 (낮)' },
  cafe:        { desc: '카페' },
  cafe_in:     { desc: '카페 내부' },
  boardcafe:   { desc: '보드게임/PC 느낌' },
  alley:       { desc: '골목 / 포장마차' },
  mullae_alley:{ desc: '문래 창작촌 골목' },
  pojang:      { desc: '문래 골목 조용한 술집' },
  konkuk:      { desc: '건대 먹자골목 (시끌)' },
  seongsu:     { desc: '성수 카페거리 (낮/노을)' },
  seoulsup:    { desc: '서울숲' },
  han_night:   { desc: '한강 (밤)' },
  han_river:   { desc: '한강 (노을→밤)' },
  street_n:    { desc: '밤거리' },
  street_night:{ desc: '밤거리' },
  gangnam:     { desc: '강남 밤거리 (네온)' },
  rooftop:     { desc: '옥상 바' },
  doyun_room:  { desc: '도윤의 방' },
  window_dusk: { desc: '창가, 노을' },
  mc_profile:  { desc: '내 프사 — 석촌호수 벚꽃 (CG)' },
  black:       { desc: '암전', real: false },
  white:       { desc: '흰 플래시', real: false },
};

// 캐릭터 스탠딩 스프라이트 — 화자 who(s/j/m/d) → 캐릭터/감정. images/sprites/<char>_<emotion>.webp
// def = story 노드에 face 없을 때 기본 감정. mc(나)·n(나레이션)은 스프라이트 없음(현재 화자 유지).
export const SPRITE_BASE = 'images/sprites/';
export const SPRITES = {
  s: { char: 'seoa',     def: 'base',   emotions: ['base', 'sad', 'sincere', 'teasing'] },
  j: { char: 'jiu',      def: 'base',   emotions: ['base', 'lonely', 'playful', 'shy'] },
  m: { char: 'mingyeol', def: 'base',   emotions: ['base', 'sincere', 'wavering'] },
  d: { char: 'doyun',    def: 'normal', emotions: ['cry', 'drunk', 'normal', 'serious', 'smile'] },
};
