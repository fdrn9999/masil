# =============================================================
#  script_epilogue.rpy  —  에필로그 "시간이, 많이 흘렀다"
# =============================================================
#  결혼식 같은 무대 없이, 잔잔하게 시간이 지난 뒤의 회상.
#  시그니처 연출: '그 시절 오픈챗 로그'를 다시 띄움. 도윤은 여전히 곁에.
#  필요: effects.rpy / screens_chat / systems_affection / ep1~4
#  연결: ep4_wrap 끝에서  jump epilogue_full
# =============================================================

image bg room_later  = Solid("#272a3a")   # 시간이 지난 방 (밤)
image bg window_dusk = Solid("#2a2c3e")   # 창가, 노을

label epilogue_full:
    $ show_gauges = False
    hide screen phone_button

    scene black with slowfade
    $ pmusic("audio/bgm/bgm_warm.ogg", fadein=2.0)
    "{i}…그 시절, 우리는 매일 그 톡방에 있었다.{/i}"
    pause 0.5

    scene bg room_later with longdissolve
    n "시간이,{w=0.4} 많이 흘렀다."
    n "회사를 옮겼고, 동네를 옮겼고,{w=0.3} 오픈챗 알림은 어느새 거의 울리지 않는다."
    n "어느 늦은 밤,{w=0.4} 문득 오랜만에 '마실'을 켰다."
    n "그 시절 북적이던 톡방은,{w=0.4} 이제 대부분 조용하다."

    # 그 시절 로그 회상 (시그니처)
    $ pmusic("audio/bgm/bgm_emotional.ogg", fadein=1.5)
    $ ekind, ewho = final_ending()
    $ record_ending(ekind)        # 엔딩 수집(갤러리)

    if ekind == "reconcile":
        jump epi_reconcile
    elif ekind == "doyun":
        jump epi_doyun
    elif ekind == "fishtank":
        jump epi_fishtank
    elif ekind == "true" and ewho:
        jump epi_true
    elif ekind == "good" and ewho:
        jump epi_good
    else:
        jump epi_bitter


# -------------------------------------------------------------
#  R. 화해 진엔딩 — 도윤도 민결도 잃지 않은 길 (Ep.4 reconcile)
# -------------------------------------------------------------
label epi_reconcile:
    $ chat_reset("그때 그 톡방")
    show screen masil_chat with Dissolve(0.6)
    $ recv("오늘 셋이 보기로 한 거 안 까먹었지?", name="민결")
    pause
    $ send("당연하지. 도윤이가 더 신났더라 ㅋㅋ")
    pause
    hide screen masil_chat with Dissolve(0.5)

    scene bg room_later with Dissolve(1.0)
    n "가장 어려운 길이었다.{w=0.3} 도윤도, 민결도 잃지 않는 길."
    n "오래 묵은 상처가 한 번에 아문 건 아니었지만,{w=0.3} 우리 셋은 여전히, 천천히, 같이 가고 있다."
    n "도망치지 않고 끝까지 마주한 끝에 남은 건 —{w=0.4} 한 사람이 아니라, 두 사람이었다."
    jump epi_close


# -------------------------------------------------------------
#  D. 도윤 우정 엔딩 — 사랑보다 단단한 의리 (Ep.4 friend)
# -------------------------------------------------------------
label epi_doyun:
    scene bg room_later with Dissolve(1.0)
    n "민결을 정리하던 날은 오래 쓰렸다.{w=0.3} 그래도 후회하진 않았다.{w=0.4} 그건 도윤을 지킨 선택이었으니까."
    n "누군가는 의리 따위라고 했을지 몰라도,{w=0.4} 나한텐 그게 가장 진짜였다."
    n "사랑이 어떻게 됐든,{w=0.3} 내 인생에서 가장 단단한 사람은 끝까지 곁에 남았다."
    jump epi_close


# -------------------------------------------------------------
#  F. 어장 엔딩 — 모두에게 잘했지만, 아무도 남지 않은
# -------------------------------------------------------------
label epi_fishtank:
    $ chat_reset("마실")
    show screen masil_chat with Dissolve(0.6)
    $ recv("오빠 요즘 왜 답이 없어요?", name="???")
    pause
    $ recv("우리 그래도… 좋았잖아.", name="???")
    pause
    hide screen masil_chat with flash_white

    scene bg room_later with Dissolve(1.0)
    n "한때 여러 톡방이 동시에 울렸다.{w=0.3} 다들 나한테 잘 대해줬고, 나도 다들에게 잘했다."
    n "그런데 잘 보이기만 했지,{w=0.4} 누구에게도 진짜 나를 주진 않았다."
    n "이름이 많던 그 방들은,{w=0.4} 하나씩 조용해졌다.{p}남은 건, 잘 보이던 내 빈손뿐이었다."
    jump epi_close


# -------------------------------------------------------------
#  A. 진엔딩 — 그 사람과는, 아직 이어져 있다
# -------------------------------------------------------------
label epi_true:
    $ who_n = hname(ewho)
    $ chat_reset("그때 그 톡방")
    show screen masil_chat with Dissolve(0.6)
    $ recv("안녕하세요! 프로필 보고 연락드려요 ㅎㅎ", name="[who_n]")
    pause
    $ send("아 안녕하세요!")
    pause
    hide screen masil_chat with Dissolve(0.5)

    scene bg room_later with Dissolve(1.0)
    n "그 짧은 톡 몇 줄로 시작한 사이가,{w=0.4} 아직도 내 옆에 있다."
    n "가볍게 시작했지만,{w=0.3} 끝까지 가벼웁지 않게 굴었던 게 — 다행이었다."
    jump epi_close


# -------------------------------------------------------------
#  B. 굿엔딩 — 좋은 기억으로 멀어진 사이
# -------------------------------------------------------------
label epi_good:
    $ who_n = hname(ewho)
    n "[who_n] 와는,{w=0.4} 어느 순간 자연스럽게 멀어졌다."
    n "그래도 끝까지 서로에게 솔직했고,{w=0.3} 나쁘지 않게 헤어졌다."
    n "가끔 생각난다.{w=0.4} 그 정도면,{w=0.3} 꽤 괜찮은 인연이었다고."
    jump epi_close


# -------------------------------------------------------------
#  C. 씁쓸 엔딩 — 끝내 진심을 못 준 그 사람 (울컥 포인트)
# -------------------------------------------------------------
label epi_bitter:
    python:
        _cand = max(HEROINES, key=lambda k: like[k] + sincere[k])
        who_n = hname(_cand)

    # 같은 말풍선, 다른 무게
    $ chat_reset("그때 그 톡방")
    show screen masil_chat with Dissolve(0.6)
    $ recv("우리 그냥… 좀 더 솔직해져 볼래요?", name="[who_n]")
    pause
    n "{i}그때 나는, 또 가벼운 척 웃어넘겼다.{/i}"
    $ send("ㅎㅎ 천천히 알아가요 우리")
    pause
    hide screen masil_chat with flash_white

    scene bg room_later with Dissolve(1.0)
    n "그 '천천히'는,{w=0.4} 결국 오지 않았다."
    n "[who_n] 는 잘 지낸다고 들었다.{w=0.4} 좋은 사람을 만났다고도."
    n "잘된 일이다.{w=0.3} 정말로.{p}…그런데 왜 자꾸,{w=0.3} 그때 그 답장을 다시 쓰고 싶어질까."
    jump epi_close


# -------------------------------------------------------------
#  공통 마무리 — 그래도 한 사람은, 여전히 곁에 있다
# -------------------------------------------------------------
label epi_close:
    scene bg window_dusk with longdissolve
    $ pmusic("audio/bgm/bgm_warm.ogg", fadein=2.0)
    n "톡방을 닫으려는데,{w=0.4} 익숙한 알림 하나가 떴다."

    $ chat_reset("도윤")
    show screen masil_chat with Dissolve(0.5)
    $ recv("형 안 자? ㅋㅋ 갑자기 옛날 생각나서", name="도윤")
    pause
    $ recv("그때 형이 날 안 잡아줬으면 지금 나 없었다? 진심", name="도윤")
    pause
    $ send("오글거리니까 그만해 인마")
    pause
    $ recv("ㅋㅋㅋ 알겠어. 나 여기 있으니까, 천천히 와 형.", name="도윤")
    pause
    hide screen masil_chat with Dissolve(0.6)

    scene bg window_dusk
    if promise_spring:
        n "그러고 보니 —{w=0.3} 봄에 석촌호수 가자던 약속, 그 봄이 벌써 몇 번이나 지났다."
        n "어떤 약속은,{w=0.3} 지켜서가 아니라 남겨둔 것만으로도 사람을 살게 한다."
    n "가볍게 시작했던 그 톡방에서,{w=0.4} 나는 한 가지는 분명히 배웠다."
    n "진심을 주는 건 무섭고,{w=0.3} 가끔은 너무 늦는다."
    n "그래도——{w=0.5} 누군가의 손을 끝까지 놓지 않았던 그 밤들은,{w=0.4} 분명히 진짜였다."

    pause 0.6
    scene black with slowfade
    pause 0.4
    centered "{size=42}그 시절,\n우리가 좋아했던 사람들에게{/size}"
    pause 1.2
    $ pstop(fadeout=3.0)

    centered "{size=30}─ 끝 ─{/size}"
    pause

    # ③ 엔딩 진단카드 + 거울 통계 (공유 유도)
    $ renpy.call_screen("result_card")
    return
