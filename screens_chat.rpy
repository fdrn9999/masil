# =============================================================
#  screens_chat.rpy  —  가상 메신저 "마실(Masil)" 채팅 UI  [모바일/PC 웹 대응판]
# =============================================================
#  [상표 침해 예방 메모]
#  - 실제 메신저(카카오톡 등)의 이름/로고/캐릭터/시그니처 색을 쓰지 않음.
#  - 앱 이름 "마실"은 가상. 색상은 인디고 계열로 독자 디자인.
#  - 카카오의 노란색(#FEE500), 블루그레이 배경(#B2C7D9), 말풍선 로고,
#    라이언/어피치 등 캐릭터는 절대 사용 금지.
#  - 폰트는 라이선스 free 폰트만 사용할 것(아래 gui.font 참고).
#  설치: 이 파일을 프로젝트의 game/ 폴더에 넣으세요.
# =============================================================
#  [v2 개선점 — 웹(GitHub→Vercel) / 모바일·PC]
#   - 말풍선 폭이 화면 비율 기준(반응형) → 폰/태블릿/PC 어디서도 안 깨짐.
#   - 말풍선 타임스탬프 + '읽음' 표시 + 프사 자동 이니셜(이미지 없어도 OK).
#   - '입력 중…' 점 애니메이션, 수신/전송 효과음 훅(에셋 없으면 자동 무음).
#   - 터치 드래그 스크롤 + 마우스휠 + 방향키 모두 지원.
# =============================================================

# ---------- 1. 테마 색상 (여기만 바꾸면 전체 톤 변경) ----------
define MASIL = {
    "bg":          "#e8ebf2",   # 채팅 배경 (회청색)
    "topbar":      "#2f3447",   # 상단바
    "topbar_txt":  "#ffffff",
    "topbar_sub":  "#b8c0d0",   # 상단바 보조(온라인 등)
    "online":      "#46d18a",   # 온라인 점
    "recv_bubble": "#ffffff",   # 받은 말풍선
    "recv_txt":    "#1c1f2a",
    "send_bubble": "#6c7cf0",   # 보낸 말풍선 (인디고, 카카오 노랑 아님)
    "send_txt":    "#ffffff",
    "name_txt":    "#3b4257",
    "time_txt":    "#8a90a3",
    "read_txt":    "#6c7cf0",
    "avatar_bg":   "#c3c9d9",   # 프사 자리 placeholder
    "typing":      "#9aa0b3",
}

# ---------- 1-1. 프사 이니셜 색(이미지 없을 때 자동 사용) ----------
define CHAT_AVATARS = {
    "도윤": "#2fb574",
    "서아": "#e8553d",
    "지우": "#5ba3d0",
    "민결": "#b06cc0",
}

# ---------- 1-2. 프사 이미지 자동 연결 ----------
#  images/avatar/ 에 아래 파일을 넣어두면 스크립트 수정 없이 프사가 뜬다.
#  파일이 없으면 자동으로 '이니셜 동그라미'로 대체(에러 없음).
define AVATAR_FILES = {
    "도윤": "images/avatar/avatar_doyun.png",
    "서아": "images/avatar/avatar_seoa.png",
    "지우": "images/avatar/avatar_jiu.png",
    "민결": "images/avatar/avatar_mingyeol.png",
}

# ---------- 2. 채팅 로그 데이터 ----------
init python:

    chat_log = []          # 화면에 그려지는 메시지 목록
    chat_room = "오픈채팅"  # 상단바에 표시될 방 이름
    _chat_min = 0          # 가짜 시계(메시지마다 1분씩 흐름) — 메신저 느낌용

    def _fmt_time(total):
        # 오후 9:10 부터 시작해 메시지마다 1분씩.
        t = (21 * 60 + 10) + total
        h, m = (t // 60) % 24, t % 60
        ampm = "오전" if h < 12 else "오후"
        h12 = h % 12 or 12
        return "%s %d:%02d" % (ampm, h12, m)

    def _stamp():
        global _chat_min
        s = _fmt_time(_chat_min)
        _chat_min += 1
        return s

    def _safe_se(path):
        # 효과음 파일이 실제로 있을 때만 재생(없으면 조용히 패스).
        if path and renpy.loadable(path):
            renpy.sound.play(path)

    def _avatar_color(name):
        return CHAT_AVATARS.get(name, MASIL["avatar_bg"])

    def _auto_avatar(name):
        # 이름에 맞는 프사 파일이 실제로 있으면 그 경로를, 없으면 None.
        p = AVATAR_FILES.get(name)
        return p if (p and renpy.loadable(p)) else None

    def chat_reset(room="오픈채팅"):
        """새 대화 시작 시 호출 — 로그 비우고 방 이름/시계 초기화."""
        global chat_log, chat_room, _chat_min
        chat_log = []
        chat_room = room
        _chat_min = 0
        renpy.restart_interaction()

    def _refresh():
        renpy.restart_interaction()

    def recv(text, name=None, avatar=None, type_time=0.8):
        """상대가 보낸 메시지. 잠깐 '입력 중…' 표시 후 말풍선 등장 + 수신음."""
        if avatar is None:
            avatar = _auto_avatar(name)
        chat_log.append({"side": "left", "typing": True,
                         "name": name, "avatar": avatar})
        _refresh()
        renpy.pause(type_time, hard=True)
        chat_log.pop()
        chat_log.append({"side": "left", "text": text, "name": name,
                         "avatar": avatar, "time": _stamp()})
        _safe_se("audio/se/se_msg_recv.ogg")
        _refresh()

    def send(text):
        """플레이어(나)가 보낸 메시지 + 전송음."""
        chat_log.append({"side": "right", "text": text,
                         "time": _stamp(), "read": True})
        _safe_se("audio/se/se_msg_send.ogg")
        _refresh()


# ---------- 2-1. '입력 중…' 점 애니메이션 ----------
transform _typing_dot(delay):
    alpha 0.35
    pause delay
    block:
        easein 0.45 alpha 1.0
        easeout 0.45 alpha 0.35
        repeat

screen _typing_dots():
    hbox:
        spacing 7
        text "●":
            size 16
            color MASIL["typing"]
            at _typing_dot(0.0)
        text "●":
            size 16
            color MASIL["typing"]
            at _typing_dot(0.18)
        text "●":
            size 16
            color MASIL["typing"]
            at _typing_dot(0.36)


# ---------- 3. 개별 말풍선 (반응형 폭) ----------
screen masil_bubble(msg):
    # 말풍선 최대 폭 = 화면의 약 58% → 폰/PC 공통으로 자연스럽게.
    $ bw = int(config.screen_width * 0.58)
    $ tw = bw - 40

    if msg["side"] == "left":
        # ---- 받은 메시지 (왼쪽) ----
        hbox:
            spacing 10
            xfill False

            # 프사: 이미지 있으면 이미지, 없으면 이니셜 동그라미
            if msg.get("avatar"):
                frame:
                    background "#00000000"
                    padding (0, 0)
                    xysize (52, 52)
                    add msg["avatar"] fit "cover" xysize (52, 52)
            else:
                $ _ini = (msg.get("name") or "?")[0]
                frame:
                    background _avatar_color(msg.get("name"))
                    padding (0, 0)
                    xysize (52, 52)
                    text _ini:
                        align (0.5, 0.5) color "#ffffff" size 24 bold True

            vbox:
                spacing 4
                if msg.get("name"):
                    text msg["name"]:
                        color MASIL["name_txt"] size 19 bold True

                hbox:
                    spacing 8
                    frame:
                        background MASIL["recv_bubble"]
                        padding (18, 13)
                        xmaximum bw
                        if msg.get("typing"):
                            use _typing_dots
                        else:
                            text msg["text"]:
                                color MASIL["recv_txt"] size 23 xmaximum tw
                    if msg.get("time"):
                        text msg["time"]:
                            color MASIL["time_txt"] size 14 yalign 1.0

    else:
        # ---- 보낸 메시지 (오른쪽) ----
        hbox:
            xfill True
            null width 1
            hbox:
                xalign 1.0
                spacing 8
                # 읽음/시간을 말풍선 왼쪽 아래에
                vbox:
                    yalign 1.0
                    spacing 1
                    if msg.get("read"):
                        text "읽음":
                            color MASIL["read_txt"] size 13 xalign 1.0
                    if msg.get("time"):
                        text msg["time"]:
                            color MASIL["time_txt"] size 14 xalign 1.0
                frame:
                    background MASIL["send_bubble"]
                    padding (18, 13)
                    xmaximum bw
                    text msg["text"]:
                        color MASIL["send_txt"] size 23 xmaximum tw


# ---------- 4. 채팅 메인 화면 ----------
screen masil_chat():
    zorder 50

    # 배경
    add MASIL["bg"]

    # 상단바
    frame:
        background MASIL["topbar"]
        xfill True
        ypos 0
        ysize 84
        padding (24, 0)
        hbox:
            yalign 0.5
            spacing 12
            text "‹":
                color MASIL["topbar_txt"] size 36 yalign 0.5
            vbox:
                yalign 0.5
                spacing 1
                text chat_room:
                    color MASIL["topbar_txt"] size 26 bold True
                hbox:
                    spacing 7
                    frame:
                        background MASIL["online"]
                        xysize (10, 10)
                        yalign 0.5
                        padding (0, 0)
                    text "온라인":
                        color MASIL["topbar_sub"] size 15 yalign 0.5

    # 메시지 영역 (터치 드래그 + 휠 + 방향키)
    viewport id "chatvp":
        mousewheel True
        draggable True
        arrowkeys True
        scrollbars "vertical"
        xfill True
        ypos 84
        ysize (config.screen_height - 84)
        yinitial 1.0           # 항상 최신 메시지가 보이도록 아래로
        left_padding 24
        right_padding 24
        top_padding 18
        bottom_padding 24

        vbox:
            spacing 16
            xfill True
            for msg in chat_log:
                use masil_bubble(msg)


# ---------- 5. 채팅형 선택지 (입력창 느낌 · 터치 친화) ----------
# 사용:  $ result = renpy.call_screen("masil_choices", ["응 좋아", "음… 글쎄"])
screen masil_choices(options):
    zorder 60
    frame:
        background "#fffffff2"
        xfill True
        yalign 1.0
        padding (20, 18)
        vbox:
            spacing 12
            xfill True
            for opt in options:
                textbutton opt:
                    xfill True
                    background "#eef0f8"
                    hover_background "#dfe3f6"
                    padding (22, 18)
                    text_color "#2f3447"
                    text_size 23
                    text_xalign 0.0
                    action Return(opt)


# =============================================================
#  6. 사용 예시 (데모) — 메인 메뉴에서 jump masil_demo 로 테스트
# =============================================================
label masil_demo:
    scene black
    "[[데모] 마실 채팅 UI 테스트를 시작합니다."

    $ chat_reset("서아 (신촌 연합 오픈챗)")
    show screen masil_chat

    $ recv("안녕하세요! 오픈챗 프로필 보고 연락드려요 ㅎㅎ", name="서아")
    pause

    $ recv("혹시 신촌 쪽이세요? 저 이대 다녀요", name="서아")
    pause

    $ send("아 안녕하세요! 저는 잠실인데 신촌 자주 가요")
    pause

    $ recv("오 그럼 우리 언제 한 번 봐요 ㅎㅎ", name="서아")
    pause

    # 채팅형 선택지
    $ pick = renpy.call_screen("masil_choices",
              ["좋아요, 이번 주 어때요?", "음… 좀 더 얘기해보고요"])

    if pick == "좋아요, 이번 주 어때요?":
        $ send("좋아요, 이번 주 어때요?")
        pause
        $ recv("콜! 토요일 신촌에서 봐요 😄", name="서아")
        pause
    else:
        $ send("음… 좀 더 얘기해보고요")
        pause
        $ recv("아 네… 천천히 알아가요 그럼", name="서아")
        pause

    hide screen masil_chat
    scene black
    "데모 끝. (진심 게이지/도윤 상담 시스템은 다음 단계에서 연결)"
    return
