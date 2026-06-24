# =============================================================
#  script_ep3.rpy  —  Ep.3 (지우 · 성수 · 슬로우번)  [장편 확장본]
# =============================================================
#  필요: effects / screens_chat / screens_map / systems_affection / systems_items / ep1~2
#  연결: ep2_wrap → episode3_full,  ep3_wrap → episode4_full
#  게임성: 게임친구 텍스팅 · 장소분기(성수/서울숲/한강) · 아이템(캔커피, 폴라로이드)
# =============================================================

# ---------- 임시 배경 ----------
image bg boardcafe = Solid("#2e3340")   # 보드게임/PC 느낌
image bg seongsu   = Solid("#43484f")   # 성수 카페거리 (낮/노을)
image bg seoulsup  = Solid("#34402f")   # 서울숲
image bg han_river = Solid("#1e2a38")   # 한강 (노을→밤)
image bg cafe_in   = Solid("#4a3f3a")   # 카페 내부

# ---------- 캐릭터 ----------
define j = Character("지우", color="#5ba3d0")

# ---------- Ep.3 상태 ----------
default date3_loc = ""    # 성수 데이트 장소: cafe / forest / river


label episode3_full:

    $ chapter_start()
    $ show_gauges = False

    scene bg black with fade
    centered "{size=50}Ep.3{/size}\n\n천천히, 진짜가 되는"
    with Pause(1.2)

    # ------------------------------------------------------------
    #  지우 — 게임 친구로 이미 알던 사이 (텍스팅 인터루드)
    # ------------------------------------------------------------
    scene bg boardcafe with dissolve
    $ pmusic("audio/bgm/bgm_daily.ogg")
    n "지우는 좀 달랐다."
    n "보드게임 오픈챗에서 만나, 벌써 몇 주째 거의 매일 같이 게임을 하던 사이.{w=0.3} 썸이라기엔 너무 담백하고, 친구라기엔 자꾸 신경 쓰이는."
    n "퇴근하고 헤드셋을 끼면, 어느새 지우가 방에 들어와 있었다. 그게 하루 중 제일 편한 시간이었다."

    $ chat_reset("지우")
    show screen masil_chat with Dissolve(0.4)
    $ recv("왔네 ㅋㅋ 오늘도 한 판? 어제 그 협동미션 마저 깨야지", name="지우")
    pause
    $ send("콜. 근데 어제 너 힐 안 줘서 내가 죽은 거 기억하지?")
    pause
    $ recv("야 그건 네 무빙이 구렸지!! 나 질 때까지 한다 진짜, 각오해", name="지우")
    pause
    $ send("ㅋㅋㅋ 또 시작이다 또. 평소엔 그렇게 차분하면서")
    pause
    $ recv("게임은 별개야. 지는 거 진짜 못 참아. 한 판만 더, 어? 어? 어?", name="지우")
    pause
    $ recv("…아 미안 나 또 발끈했지 ㅋㅋ 방금 목소리 커졌어 나", name="지우")
    pause
    n "잔잔한 줄만 알았던 지우는, 게임 얘기만 나오면 사람이 바뀌었다.{w=0.3} 그러다 제풀에 머쓱해져 목소리를 줄이는 그 갭이 —{w=0.4} 묘하게, 자꾸 신경 쓰였다."
    $ add_like("jiu", 5)

    n "지우의 톡이 떠 있다. 게임 친구 사이의 답장 텀은, 늘 애매하다."
    call reply_prompt("jiu")

    # 민결 소문 복선 (Ep.4 회수)
    $ recv("아 맞다. 너 혹시 '민결'이라는 사람 알아? 요즘 오픈챗에서 말 좀 많던데", name="지우")
    pause
    $ send("민결? 모르는데. 왜?")
    pause
    $ recv("아니 그냥… 좀 사연 있는 사람이라더라. 됐고, 우린 게임이나 ㅋㅋ", name="지우")
    pause

    # 지우가 늦게까지 일하는 날 — 캔커피 떡밥
    $ recv("아 나 오늘 야근하다 와서 손이 다 얼었어 ㅠㅠ 손 시려", name="지우")
    pause

    menu:
        n "지우가 추운 모양이다."

        "다음에 만나면 따뜻한 거 사주기로 마음먹는다":
            $ send("다음에 보면 내가 따뜻한 거 사줄게. 손 녹이게")
            $ recv("오… 그런 말 하는 거 반칙인데. 메모해둔다?", name="지우")
            pause
            $ add_sincere("jiu", 8)
            $ get_item("warm_can")
            n "(만날 때 따뜻한 캔커피를 챙기기로 했다.)"

        "게임 얘기로 넘긴다":
            $ send("야근 힘들었겠다 ㅋㅋ 자 빨리 한 판 더 ㄱ")
            $ add_like("jiu", 5)

    $ recv("근데 우리, 맨날 온라인만 하니까 좀 그렇다", name="지우")
    pause
    $ recv("우리 한 번 오프라인에서 볼래? 부담 갖진 말고! 그냥 게임 친구로 ㅎㅎ", name="지우")
    pause
    $ send("그래. 게임 친구로 ㅋㅋ")
    pause
    hide screen masil_chat with Dissolve(0.4)
    n "'게임 친구로'라고 답을 보내면서도, 손끝이 괜히 떨렸다."
    n "이 편안한 거리를 한 발만 넘으면, 잘되면 더없이 좋지만 어긋나면 이 방마저 잃는다.{w=0.4} 나는 늘, 그 한 발이 무서워서 도망쳤었다."

    # --- 도윤 상담 ---
    scene bg room
    n "헤드셋을 벗자, 도윤한테 톡이 왔다. 이 녀석은 정말 귀신이다."
    d "(톡) 형, 지우 누나? 걔는 좀… 형이 진짜 잘해야 되는 사람이야."
    if seoa_result == "slow":
        d "서아 누나 때처럼 천천히 가. 형 그거 이제 할 줄 알잖아."
    else:
        d "형, 서아 누나 때 급하게 굴다 데인 거, 이번엔 반복하지 말고."

    menu:
        n "도윤에게 상담받을까?"

        "도윤한테 상담받기":
            call consult_doyun("jiu")
        "혼자 해본다":
            mc "이번엔 내 감대로 해볼게."
            d "(톡) ㅇㅋ. 근데 형, 지우 누나는 진짜 천천히 가야 돼. 알지?"

    # --- 성수로 이동 ---
    n "주말. 2호선 순환선을 타고 성수로 향한다.{w=0.3} 가방엔, 챙겨둔 게 하나 들어 있었다."
    $ unlock_station("seongsu")
    call screen subway_map

    jump ep3_date


label ep3_date:
    scene bg seongsu with fade
    $ pmusic("audio/bgm/bgm_warm.ogg", fadein=1.0)
    n "성수동. 낡은 공장을 개조한 카페거리 앞에서, 지우가 먼저 와 손을 호호 불고 있었다."
    j "왔네? ㅋㅋ 화면 밖에서 보니까 좀 어색하다 우리."
    n "온라인에선 그렇게 떠들었는데, 막상 마주 서니 둘 다 말이 없어졌다."

    # --- 아이템: 따뜻한 캔커피 ---
    if has_item("warm_can"):
        $ give_item("warm_can", "jiu")
        $ add_sincere("jiu", 12)
        mc "자. 손 시리다며. 약속한 거."
        n "가방에서 따뜻한 캔커피를 꺼내 건넸다. 지우가 두 손으로 받아 쥐고, 한참 나를 봤다."
        j "…진짜 사 왔어? 야, 너 반칙이야. 이런 거 기억하고 있으면 어떡해."
        n "어색하던 공기가, 캔커피 온기처럼 스르르 풀렸다."

    menu:
        n "이 어색함을 어떻게 풀까?"

        "익숙한 게임 얘기로 분위기 풀기":
            mc "야 어제 그 판 말이야, 네가 힐만 제대로 줬어도…"
            j "또 그 얘기야? ㅋㅋㅋ 아 진짜 너랑 있으면 편해."
            $ add_like("jiu", 12)

        "지금 이 순간을 솔직하게":
            mc "이상하다. 맨날 떠들었는데, 직접 보니까 더 잘 보이고 싶네."
            j "……너 그런 말 어디서 배웠어. 심장에 안 좋게."
            $ add_sincere("jiu", 12)

    n "둘이 나란히 성수 골목을 걸었다. 화면 너머로 몇 주를 떠들었는데, 막상 옆에 두니 발소리까지 의식됐다."
    j "신기하다. 너 키보드 소리는 맨날 들었는데, 발소리는 처음 듣네 ㅋㅋ"
    n "그 말에 둘 다 피식 웃었다.{w=0.3} 온라인에서 오프라인으로 한 칸 넘어온 거리만큼, 우리 사이도 꼭 그만큼 좁혀진 것 같았다."

    # ------------------------------------------------------------
    #  장소 선택 — 성수에서 어디로 (분위기·게이지·아이템이 달라짐)
    # ------------------------------------------------------------
    n "지우가 물었다. 「우리 이제 어디 갈까?」"
    menu:
        n "── 어디로 갈까? ──"

        "성수 감성 카페 — 마주 앉아 도란도란":
            $ date3_loc = "cafe"
            jump ep3_loc_cafe

        "서울숲 — 같이 걷기":
            $ date3_loc = "forest"
            jump ep3_loc_forest

        "한강(합정) — 노을 보러":
            $ date3_loc = "river"
            jump ep3_loc_river


label ep3_loc_cafe:
    scene bg cafe_in with dissolve
    $ pmusic("audio/bgm/bgm_daily.ogg", fadein=0.8)
    n "공장을 개조한 카페 안. 따뜻한 조명 아래 마주 앉아, 우리는 두 시간이 어떻게 갔는지 모르게 떠들었다."
    n "구석에 즉석 사진기가 있었다. 지우가 장난스럽게 끌고 갔다."
    j "야 우리 이거 하나 찍자! 추억으로 ㅋㅋ"
    n "셋, 둘, 하나. 둘 다 어색하게 웃는 사이 셔터가 터졌다.{w=0.3} 인화된 사진 속 우리는, 영락없이 갓 사귀기 직전의 얼굴이었다."
    $ get_item("polaroid")
    $ add_like("jiu", 8)
    $ add_sincere("jiu", 6)
    jump ep3_confess


label ep3_loc_forest:
    scene bg seoulsup with dissolve
    $ pmusic("audio/bgm/bgm_warm.ogg", fadein=1.0)
    n "성수에서 멀지 않은 서울숲. 잎이 다 진 나무들 사이를 우리는 천천히 걸었다."
    n "지우는 걸을 때 보폭을 슬쩍 나한테 맞췄다. 그런 작은 배려가, 게임 속에서도 늘 그랬던 거였구나 싶었다."
    j "나 사실, 누구랑 이렇게 말없이 걷는 거 잘 못해. 근데 너랑은 괜찮네."
    $ add_sincere("jiu", 12)
    jump ep3_confess


label ep3_loc_river:
    $ unlock_station("hapjeong")
    scene bg han_river with longdissolve
    $ pmusic("audio/bgm/bgm_warm.ogg", fadein=1.2)
    n "택시로 합정 한강. 해가 지면서 하늘이 주황에서 보라로 번졌다."
    n "지우는 노을을 한참 보다가, 작게 중얼거렸다. 「예쁘다.」 그 옆얼굴이 더 예뻤다."
    $ add_like("jiu", 7)
    $ add_sincere("jiu", 7)
    jump ep3_confess


label ep3_confess:
    # 장소별 마무리 분위기
    if date3_loc == "cafe":
        scene bg seongsu with dissolve
        n "카페를 나오니 거리에 노을이 깔려 있었다. 지우가 걸음을 멈췄다."
    elif date3_loc == "forest":
        n "공원 벤치에 나란히 앉았다. 지우가 손에 입김을 불며 입을 열었다."
    else:
        n "강바람이 선선했다. 지우가 강에서 눈을 떼지 않은 채 입을 열었다."

    j "있잖아. 난 빨리 불타는 거 잘 못 믿어.{w=0.3} 그런 건 빨리 꺼지더라."
    j "근데 너랑은…{w=0.4} 천천히 데워지는 느낌이라 좋아."
    n "지우가 조심스럽게 물었다."
    j "우리, 게임 친구 말고…{w=0.4} 그 다음으로 가볼래?"

    menu:
        n "── Ep.3의 결말을 가르는 선택 ──"

        "마음을 솔직하게 건넨다 (진심)":
            $ add_sincere("jiu", 15)
            mc "응.{w=0.3} 나도 그 다음이 보고 싶어.{w=0.4} 천천히, 너랑."
            jump ep3_end_true

        "아직 친구가 편하다고 한다 (회피)":
            $ add_like("jiu", 5)
            mc "음…{w=0.4} 지금이 너무 좋아서, 망칠까 봐 무서워."
            jump ep3_end_friend


label ep3_end_true:
    scene bg black with fade
    $ pmusic("audio/bgm/bgm_emotional.ogg", fadein=1.2)
    if sincere["jiu"] >= 40:
        n "우리는 천천히, 그러나 분명하게 연인이 되었다."
        n "거창한 고백 같은 건 없었다. 그냥 며칠 뒤 게임을 하다, 지우가 「우리 이제 사귀는 거 맞지?」 하고 물었고 —{w=0.3} 나는 「응」 하고 답했다. 그게 다였다."
        n "빠르게 타오르지 않아서, 오래 갈 수 있는 불.{w=0.3} 처음으로, 나는 식는 게 두렵지 않은 관계를 갖게 됐다."
        j "앞으로도 천천히 가자.{w=0.3} 우리 페이스대로. 나 빨리 가는 거 못 믿는 거 알지?"
        mc "알아.{w=0.3} 나도 이제, 천천히가 더 좋아."
        if has_item("polaroid"):
            n "지갑에 넣어둔 폴라로이드를 꺼내 봤다. 어색하게 웃던 그날의 우리가,{w=0.3} 이제는 조금 더 편한 얼굴로 마주 보고 있었다."
            n "그 사진을 찍던 날엔 몰랐다.{w=0.3} '게임 친구' 그 다음으로 넘어가는 데 이렇게 오래 걸리고,{w=0.4} 이렇게 좋을 줄은."
        n "── Ep.3 결말: '천천히 데워지는' (진엔딩 루트 진입)"
        d "(톡) 형… 나 좀 울컥했어. 형 진짜 사람 됐다."
    else:
        n "마음은 건넸지만, 아직 서로를 다 알기엔 일렀다.{w=0.3} 그래도 첫걸음은 뗐다."
        n "── Ep.3 결말: '서툰 시작' (보통 엔딩)"
    jump ep3_wrap


label ep3_end_friend:
    scene bg black with fade
    n "지우는 잠깐 웃었지만, 그 웃음 끝이 조금 쓸쓸했다."
    j "그래.{w=0.3} 친구도… 나쁘지 않지. 응."
    n "우리는 여전히 게임을 같이 했다. 매일 헤드셋을 끼고, 똑같이 떠들고 웃었다."
    n "다만, 헤드셋을 벗고 나면 — 그 이상은 없었다.{w=0.4} 안전한 거리를 지킨 대신, 딱 그만큼의 거리가 늘 사이에 남았다."
    n "── Ep.3 결말: '게임 친구 그대로' (씁쓸한 엔딩)"
    d "(톡) 형. 또 무서워서 도망쳤네.{w=0.3} 언제까지 그럴 거야 진짜."
    jump ep3_wrap


label ep3_wrap:
    scene bg black
    $ pstop(fadeout=2.0)
    $ jiu_like = like["jiu"]
    $ jiu_sinc = sincere["jiu"]

    # 도윤의 간접 피드백
    if sincere["jiu"] >= 40:
        d "(톡) 형, 지우 누나한텐 진짜였네. 나 그거 다 느꼈어."
    else:
        d "(톡) 형, 지우 누나 좋은 사람인데… 진심은 좀 아꼈지?"

    n "(지우 — 호감 [jiu_like] / 진심 [jiu_sinc])"
    n "다음은 Ep.4(민결) — 도윤의 과거가 돌아온다.{w=0.4} …그 '민결'이라는 이름, 어디서 들었더라."

    $ show_gauges = False
    hide screen affection_gauges

    # 이어서 Ep.4 (단독 테스트하려면 아래 줄을 return 으로)
    jump episode4_full
