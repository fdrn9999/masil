# =============================================================
#  screens_meta.rpy  —  매력/메타 UI
# =============================================================
#  ② 마실 친구목록(비수치 대시보드)  ③ 엔딩 진단카드 + 추억함
#  + 갤러리(엔딩 수집) + 폰 메뉴(인게임 접근) + 도윤 푸시 토스트(보너스)
#  데이터는 systems_extra.rpy / systems_affection / systems_items 에서.
# =============================================================

# ---------- 공통: 작은 아바타 위젯 ----------
screen _avatar_box(disp, key, sz=54):
    if key and _auto_avatar(disp):
        frame:
            background "#00000000"
            padding (0, 0)
            xysize (sz, sz)
            add _auto_avatar(disp) fit "cover" xysize (sz, sz)
    else:
        frame:
            background (_avatar_color(disp) if disp != "???" else "#9aa0b3")
            padding (0, 0)
            xysize (sz, sz)
            text (disp[0] if disp and disp != "???" else "?"):
                align (0.5, 0.5) color "#ffffff" size int(sz*0.45) bold True


# =============================================================
#  ② 마실 — 친구 목록 (관계의 '결' 대시보드)
# =============================================================
screen _friend_row(disp, key, top=False):
    hbox:
        spacing 14
        use _avatar_box(disp, key)
        vbox:
            yalign 0.5
            spacing 2
            hbox:
                spacing 8
                text disp size 23 bold True color "#2f3447"
                if top:
                    text "고정" size 14 color "#2fb574" yalign 0.5
            if disp == "???":
                text "…누군지 아직 모르는 이름" size 18 color "#8a90a3"
            else:
                text rel_subtitle(key) size 18 color "#8a90a3"

screen masil_friends():
    zorder 80
    modal True
    add "#000000cc"
    frame:
        align (0.5, 0.5)
        background "#fffdf7"
        padding (30, 26)
        xmaximum 720
        vbox:
            spacing 14
            text "마실 — 친구" size 30 bold True color "#2f3447"

            # 도윤 = 상수, 항상 맨 위
            use _friend_row("도윤", "doyun", True)
            add Solid("#e6e3da", xysize=(640, 1))

            # 히로인은 만난 경우에만
            $ _any = False
            for k in ["seoa", "jiu", "mingyeol"]:
                if is_met(k):
                    $ _any = True
                    use _friend_row(hname(k), k)

            # 이스터에그: 도윤 과거를 캐물었지만 정체를 모르는 '그 이름'
            if (not is_met("mingyeol")) and doyun_secret_seen and (not mingyeol_truth_known):
                use _friend_row("???", None)

            if not _any:
                text "아직 도윤 말곤 친구가 없다.{w=0.0}" size 17 color "#9aa0b3"

            textbutton "닫기":
                xalign 1.0
                action Hide("masil_friends")
                text_size 22 text_color "#6c7cf0"


# =============================================================
#  ③ 엔딩 진단카드 + 거울 통계
# =============================================================
screen _stat_row(label, val):
    hbox:
        spacing 12
        text label:
            size 18 color "#8a90a3" xsize 170
        text val:
            size 19 color "#ffffff" xmaximum 540

screen result_card():
    zorder 90
    modal True
    add "#0b0b12f5"
    frame:
        align (0.5, 0.5)
        background "#1b1f2e"
        padding (38, 32)
        xmaximum 840
        vbox:
            spacing 12
            $ lt, desc = love_type()
            text "당신의 연애 유형" size 20 color "#8a90a3" xalign 0.5
            text lt size 52 bold True color "#6c7cf0" xalign 0.5
            text desc:
                size 22 color "#cfd4e6" xalign 0.5 text_align 0.5 xmaximum 760
            null height 8

            frame:
                background "#ffffff12"
                padding (22, 16)
                xfill True
                vbox:
                    spacing 9
                    use _stat_row("곁에 남은 사람", who_remained())
                    use _stat_row("준 마음", heart_vs_like())
                    use _stat_row("도망친 횟수", str(times_ran) + "번")
                    use _stat_row("도윤과의 사이", rel_subtitle("doyun"))
                    use _stat_row("본 엔딩", "%d / %d" % (endings_seen_count(), len(ENDING_LIST)))

            $ _kp = kept_promises()
            if _kp:
                null height 4
                text "지킨 약속" size 18 bold True color "#2fb574"
                for line in _kp:
                    text ("· " + line) size 18 color "#cfd4e6"

            null height 8
            text "(이 화면을 캡처해서 공유해 보세요)" size 15 color "#8a90a3" xalign 0.5
            textbutton "닫기":
                xalign 1.0
                action Return(True)
                text_size 22 text_color "#6c7cf0"


# =============================================================
#  ③ 추억함 (소지품 + 건넨 것 회고)
# =============================================================
screen _mem_row(icon, name, desc, tag):
    hbox:
        spacing 14
        text icon size 32
        vbox:
            spacing 2
            hbox:
                spacing 10
                text name size 21 bold True color "#ffffff"
                text tag size 15 color "#6c7cf0" yalign 0.5
            text desc size 16 color "#9aa0b3" xmaximum 540

screen memory_box():
    zorder 80
    modal True
    add "#000000cc"
    frame:
        align (0.5, 0.5)
        background "#1f2333"
        padding (30, 26)
        xmaximum 740
        vbox:
            spacing 14
            text "추억함" size 30 bold True color "#ffffff"

            if (len(inventory) == 0) and (len(item_flags) == 0):
                text "아직 담긴 추억이 없다." size 20 color "#9aa0b3"
            else:
                for iid, cnt in inventory.items():
                    $ it = ITEMS.get(iid, {"name": iid, "icon": "❔", "desc": ""})
                    use _mem_row(it["icon"], it["name"], it["desc"], "간직 중")
                for k in list(item_flags.keys()):
                    if k.endswith("_given"):
                        $ iid = k[:-6]
                        $ it = ITEMS.get(iid, {"name": iid, "icon": "❔", "desc": ""})
                        $ v = item_flags[k]
                        $ towho = (hname(v) if (isinstance(v, str) and v in HEROINES) else ("도윤" if v == "doyun" else ""))
                        use _mem_row(it["icon"], it["name"], it["desc"], (("→ " + towho + " 에게") if towho else "건넴"))

            textbutton "닫기":
                xalign 1.0
                action Hide("memory_box")
                text_size 22 text_color "#6c7cf0"


# =============================================================
#  보너스: 갤러리 — 엔딩 수집
# =============================================================
screen gallery():
    zorder 80
    modal True
    add "#000000dd"
    frame:
        align (0.5, 0.5)
        background "#15151f"
        padding (32, 28)
        xmaximum 820
        vbox:
            spacing 12
            text "갤러리 — 엔딩 수집" size 30 bold True color "#ffffff"
            text ("%d / %d 발견" % (endings_seen_count(), len(ENDING_LIST))) size 18 color "#8a90a3"
            null height 4

            for key, title in ENDING_LIST:
                $ seen = key in (persistent.endings_seen or [])
                hbox:
                    spacing 12
                    text ("●" if seen else "○"):
                        color ("#2fb574" if seen else "#555555") size 20 yalign 0.5
                    text (title if seen else "??? — 아직 보지 못한 결말"):
                        size 20 color ("#ffffff" if seen else "#666666")

            if all_endings_seen():
                null height 6
                text "★ 모든 결말을 본 당신에게" size 20 bold True color "#ffcf5a"
                text "도윤: \"형, 끝까지 다 봐줬네. …고마워. 진짜로.\"" size 18 color "#9fe7c2"
            else:
                null height 6
                text "CG는 아트 추가 후 여기에 채워집니다." size 15 color "#8a90a3"

            textbutton "닫기":
                xalign 1.0
                action Hide("gallery")
                text_size 22 text_color "#6c7cf0"


# =============================================================
#  인게임 폰 버튼 + 메뉴 (친구목록/추억함/갤러리 접근)
# =============================================================
screen phone_button():
    zorder 26
    textbutton "📱":
        align (0.985, 0.04)
        background "#1f2333cc"
        padding (12, 8)
        text_size 26
        action Show("phone_menu")

screen phone_menu():
    zorder 86
    modal True
    add "#00000088"
    frame:
        align (0.5, 0.5)
        background "#fffdf7"
        padding (30, 24)
        vbox:
            spacing 12
            text "마실" size 28 bold True color "#2f3447"
            textbutton "친구 목록":
                action [Hide("phone_menu"), Show("masil_friends")]
                text_size 22 text_color "#2f3447"
            textbutton "추억함":
                action [Hide("phone_menu"), Show("memory_box")]
                text_size 22 text_color "#2f3447"
            textbutton "갤러리":
                action [Hide("phone_menu"), Show("gallery")]
                text_size 22 text_color "#2f3447"
            textbutton "닫기":
                action Hide("phone_menu")
                text_size 20 text_color "#8a90a3"


# =============================================================
#  보너스: 도윤 푸시 토스트 (상수 캐릭터 생동감)
# =============================================================
transform _push_in:
    yoffset -90 alpha 0.0
    easeout 0.32 yoffset 0 alpha 1.0

screen doyun_push(msg="", dur=2.8):
    zorder 95
    frame:
        align (0.5, 0.06)
        background "#2f3447f5"
        padding (18, 14)
        xmaximum 720
        at _push_in
        hbox:
            spacing 12
            frame:
                background "#2fb574"
                padding (0, 0)
                xysize (40, 40)
                text "도":
                    align (0.5, 0.5) color "#ffffff" size 20 bold True
            vbox:
                spacing 2
                text "도윤" size 16 bold True color "#9fe7c2"
                text msg size 19 color "#ffffff" xmaximum 620
    timer dur action Hide("doyun_push")

init python:
    def doyun_ping(msg, dur=2.8):
        if renpy.loadable("audio/se/se_msg_recv.ogg"):
            renpy.sound.play("audio/se/se_msg_recv.ogg")
        renpy.show_screen("doyun_push", msg=msg, dur=dur)


# =============================================================
#  메인 메뉴 등에서 부를 수 있는 '특전' 진입 (선택)
#  사용: 메인 메뉴 버튼에  action ShowMenu... 대신  Start 후 jump extras_menu 등
# =============================================================
label extras_menu:
    scene black
    "마실 특전실. (친구목록/추억함/갤러리)"
    show screen phone_menu
    return
