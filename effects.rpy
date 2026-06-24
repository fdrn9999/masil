# =============================================================
#  effects.rpy  —  연출 도구 (안전한 사운드 재생 + 트랜지션)
# =============================================================
#  - 아직 오디오 에셋이 없어도 게임이 안 깨지게: 파일 있으면 재생, 없으면 무시.
#  - 감정 연출용 트랜지션(플래시/암전)과 흔들림 헬퍼 제공.
#  설치: game/ 폴더에 넣으세요.
# =============================================================

# ---------- 앰비언스 전용 채널 등록 ('amb') ----------
#  Ren'Py 기본 채널은 music/sound/voice 뿐 → 'amb'는 직접 등록해야 한다.
#  (이전 코드는 미등록 'audio' 채널을 써서, 앰비언스 파일을 넣는 순간 크래시할 수 있었음.)
init python:
    try:
        renpy.music.get_channel("amb")
    except Exception:
        renpy.music.register_channel("amb", mixer="music", loop=True)

# ---------- 안전 사운드 헬퍼 (에셋 없으면 조용히 패스) ----------
init python:
    def pmusic(path, fadein=1.0, fadeout=1.0, channel="music"):
        # 파일이 실제로 있을 때만 BGM 재생 (없으면 무시)
        if renpy.loadable(path):
            renpy.music.play(path, channel=channel, fadein=fadein, fadeout=fadeout, loop=True)
    def pstop(channel="music", fadeout=1.5):
        renpy.music.stop(channel=channel, fadeout=fadeout)
    def psound(path):
        if renpy.loadable(path):
            renpy.sound.play(path)
    def pamb(path, fadein=1.0):
        # 앰비언스(루프). 정식 등록한 'amb' 채널 사용.
        if renpy.loadable(path):
            renpy.music.play(path, channel="amb", fadein=fadein, loop=True)
    def pamb_stop(fadeout=1.5):
        renpy.music.stop(channel="amb", fadeout=fadeout)

# ---------- 감정 연출용 트랜지션 ----------
#  Fade(out_time, hold_time, in_time, color)
define flash_white = Fade(0.10, 0.0, 0.45, color="#ffffff")   # 흰 플래시 (충격/회상)
define flash_black = Fade(0.18, 0.0, 0.55, color="#000000")   # 짧은 암전
define slowfade    = Fade(1.2, 0.4, 1.2, color="#000000")     # 무겁고 느린 암전
define longdissolve = Dissolve(1.4)                            # 긴 디졸브(여운)

# vpunch / hpunch 는 Ren'Py 기본 제공 (화면 흔들림) → with vpunch

# ---------- 화면 어둡게(집중) 오버레이 ----------
image dim_overlay = Solid("#00000077")
# 사용:  show dim_overlay with Dissolve(0.4)  /  hide dim_overlay
