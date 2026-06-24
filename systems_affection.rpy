# =============================================================
#  systems_affection.rpy  —  호감도 + 진심 게이지 + 도윤 상담
# =============================================================
#  핵심 주제 시스템:
#   - 호감도(like)   : 잘 보이기. 가벼운 멘트·리액션으로 잘 오름.
#   - 진심(sincere)  : 진짜 마음. 약한 모습·진솔함·약속 지키기로만 오름.
#   "잘 보이긴 쉽지만 진심을 주는 건 비용이 든다"를 수치로 표현.
#  설치: 이 파일을 프로젝트의 game/ 폴더에 넣으세요.
# =============================================================

# ---------- 1. 히로인 정의 ----------
define HEROINES = {
    "seoa":     "서아",
    "jiu":      "지우",
    "mingyeol": "민결",
}

# ---------- 2. 상태 변수 ----------
default like    = {"seoa": 0, "jiu": 0, "mingyeol": 0}   # 호감도 0~100
default sincere = {"seoa": 0, "jiu": 0, "mingyeol": 0}   # 진심   0~100

default doyun_used_chapter = False   # 이번 챕터에 도윤 상담을 썼는지
default show_gauges = False           # 게이지 오버레이 표시 여부

# ---------- 3. 헬퍼 함수 ----------
init python:

    def _clamp(v):
        return max(0, min(100, v))

    def add_like(who, n):
        like[who] = _clamp(like[who] + n)
        renpy.restart_interaction()

    def add_sincere(who, n):
        sincere[who] = _clamp(sincere[who] + n)
        renpy.restart_interaction()

    def hname(who):
        return HEROINES.get(who, who)

    # --- 챕터 관리 ---
    def chapter_start():
        """새 챕터 시작 시 호출 — 도윤 상담 1회 충전."""
        store.doyun_used_chapter = False

    # --- 도윤이 콕 집어주는 한 줄 (우정 깊을 때만) ---
    def _doyun_read(who):
        if who == "seoa":     return "서아는 속도보다, 형이 진짜인지를 보고 있어"
        if who == "jiu":      return "지우는 답장 빨리 오는 것보다 형 진심을 더 쳐"
        if who == "mingyeol": return "민결은 들이대면 도망가. 형이 먼저 거리를 줘"
        return "지금은 진심 한 스푼이 호감 열보다 커"

    # --- 도윤 조언 로직 (★우정이 깊을수록 촉이 더 정확해진다) ---
    def doyun_line(who):
        """현재 게이지를 보고 도윤이 할 말 + 힌트를 고른다."""
        l, s = like[who], sincere[who]
        n = hname(who)
        sharp = doyun_bond >= 20    # 우정↑ → 조언이 구체적·정확 (우정 우선을 보상)

        if l >= 60 and s < 30:
            line = ("형… {} 한테 잘 보이기만 하는 거 아니야? "
                    "호감만 높고 진심이 안 보여. 이러다 어장 소리 들어.".format(n))
            hint = "[힌트] 약한 모습을 보이거나 진솔한 속얘기를 꺼내봐. 진심이 올라가."
        elif l < 30 and s < 30:
            line = ("형, 아직 {} 랑 서먹하네. 천천히 가도 돼, 일단 자주 말 걸어봐.".format(n))
            hint = "[힌트] 가벼운 대화로 호감부터 쌓는 단계야."
        elif s >= 50:
            line = ("오 형, {} 한테 진심이 통하고 있어. 형 이대로만 가면 돼.".format(n))
            hint = "[힌트] 결정적인 순간에 솔직하게 마음을 말하면 진엔딩 각이야."
        else:
            line = ("형, {} 랑 나쁘진 않아. 근데 더 깊어지려면 형 진짜 속얘길 해야지.".format(n))
            hint = "[힌트] 호감은 충분, 이제 진심을 채울 차례."

        if sharp:
            hint += "\n   (형이 보기엔 — {})".format(_doyun_read(who))
        return (line, hint)

    # --- 호감/진심 게이지만으로 한 '연애 판정' (어장/진/굿/쓸쓸) ---
    def decide_ending():
        # 어장 엔딩: 호감>=70 이면서 진심<30 인 상대가 2명 이상
        fishtank = sum(1 for k in HEROINES if like[k] >= 70 and sincere[k] < 30)
        if fishtank >= 2:
            return ("fishtank", None)
        # 가장 진심이 높은 상대
        best = max(HEROINES, key=lambda k: sincere[k])
        if sincere[best] >= 70 and like[best] >= 60:
            return ("true", best)      # 진엔딩
        elif sincere[best] >= 50:
            return ("good", best)      # 굿엔딩
        else:
            return ("lonely", None)    # 쓸쓸한 엔딩

    # --- 최종 엔딩 판정 (에필로그용) ---
    #  Ep.4의 '명시적 선택(ep4_choice)'과 우정(doyun_bond)을 우선 반영하고,
    #  선택이 조건 미달이거나 Ep.4를 안 거쳤으면 연애 게이지(decide_ending)로 떨어진다.
    #  반환 kind: reconcile / doyun / true / good / fishtank / lonely / run
    def final_ending():
        c = ep4_choice   # "reconcile" / "love" / "friend" / "run" / ""(미플레이)

        # 1) 도피 — 클라이맥스에서 모두에게서 도망친 명시적 선택
        if c == "run":
            return ("run", None)
        # 2) 화해 진엔딩 — 도윤·민결을 모두 안고 가는 최난도(조건 충족 시)
        if c == "reconcile" and doyun_bond >= 25 and sincere["mingyeol"] >= 35:
            return ("reconcile", "mingyeol")
        # 3) 도윤 우정 엔딩 — 정식 메인 엔딩(우정 충분 or 키링 소지)
        if c == "friend" and (doyun_bond >= 25 or has_item("doyun_keyring")):
            return ("doyun", None)
        # 4) 민결과의 진짜 관계 — 사랑을 택했고 진심이 충분
        if c == "love" and sincere["mingyeol"] >= 40:
            return ("true", "mingyeol")
        # 5) 그 외(서툰 중재/허전한 의리/어중간한 사랑/미플레이) → 연애 게이지 판정
        return decide_ending()


# ---------- 4. 게이지 오버레이 (선택적 표시) ----------
screen affection_gauges():
    zorder 30
    if show_gauges:
        frame:
            xalign 1.0 yalign 0.0
            xoffset -16 yoffset 16
            background "#ffffffd0"
            padding (18, 14)
            vbox:
                spacing 8
                text "관계 현황" size 20 bold True color "#2b2b2b"
                for k in HEROINES:
                    vbox:
                        spacing 2
                        text hname(k) size 18 color "#2b2b2b"
                        hbox:
                            spacing 6
                            text "호감" size 14 color "#8a90a3"
                            bar value like[k] range 100 xsize 140 ysize 12
                        hbox:
                            spacing 6
                            text "진심" size 14 color "#6c7cf0"
                            bar value sincere[k] range 100 xsize 140 ysize 12


# ---------- 5. 도윤 상담 화면 ----------
#  사용:  call consult_doyun("seoa")
#  - 챕터당 1회 제한. 이미 썼으면 막힘.
screen doyun_consult(who):
    zorder 70
    modal True
    add "#000000a0"
    frame:
        align (0.5, 0.5)
        background "#fffdf7"
        padding (32, 28)
        xmaximum 760
        vbox:
            spacing 16
            text "도윤에게 상담하기" size 28 bold True color "#2f3447"

            $ line, hint = doyun_line(who)
            text ("도윤: \"" + line + "\"") size 23 color "#2b2b2b"
            text hint size 21 color "#2fb574" italic True

            textbutton "고마워, 알겠어":
                xalign 1.0
                action Return(True)
                text_size 22 text_color "#6c7cf0"


# ---------- 6. 상담 호출 라벨 (1회 제한 처리) ----------
label consult_doyun(who="seoa"):
    if doyun_used_chapter:
        "도윤: \"형, 아까 이미 한 번 물어봤잖아. 이번 챕터는 알아서 좀 해봐 ㅋㅋ\""
    else:
        $ renpy.call_screen("doyun_consult", who)
        $ doyun_used_chapter = True
    return


# =============================================================
#  7. 사용 예시
# =============================================================
#   챕터 시작:   $ chapter_start()
#   수치 변경:   $ add_like("seoa", 10)   /   $ add_sincere("seoa", 15)
#   상담:        call consult_doyun("seoa")
#   게이지 표시: $ show_gauges = True   (끄려면 False)
#                 + 메인 흐름에서 한 번:  show screen affection_gauges
#   엔딩 판정:   $ kind, who = decide_ending()
# =============================================================

label affection_demo:
    scene black
    $ chapter_start()
    $ show_gauges = True
    show screen affection_gauges

    "[[데모] 호감도/진심 게이지 + 도윤 상담 테스트."

    "서아에게 가벼운 농담으로 잘 보였다. (호감 +20)"
    $ add_like("seoa", 20)

    "또 한 번 띄워줬다. (호감 +20)"
    $ add_like("seoa", 20)

    "호감만 높고 진심은 0인 상태에서 도윤에게 상담해보자."
    call consult_doyun("seoa")

    "이번엔 약한 모습을 솔직히 털어놨다. (진심 +30)"
    $ add_sincere("seoa", 30)

    "같은 챕터에 또 상담을 시도하면?"
    call consult_doyun("seoa")

    "--- 챕터가 바뀌었다 ---"
    $ chapter_start()
    call consult_doyun("seoa")

    $ kind, who = decide_ending()
    "현재 엔딩 판정: [kind] / 대상: [who]"

    $ show_gauges = False
    return
