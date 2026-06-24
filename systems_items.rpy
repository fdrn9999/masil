# =============================================================
#  systems_items.rpy  —  아이템 / 인벤토리 시스템
# =============================================================
#  특정 상황에서 아이템을 얻고, 주거나(선물) 쓰면(사용) 분기·게이지가 달라진다.
#  설치: game/ 폴더에 넣으세요.
# =============================================================

# ---------- 아이템 정의 ----------
define ITEMS = {
    "hangover":   {"name": "숙취해소제",   "icon": "🧴", "desc": "그날 밤 편의점에서 산 숙취해소제. 누군가에게 필요할지도."},
    "sakura_card":{"name": "벚꽃 엽서",     "icon": "🌸", "desc": "석촌호수 벚꽃 사진으로 만든 엽서. 내 프사를 알아본 그 사람에게 어울릴까."},
    "movie_tkt":  {"name": "영화 예매권",   "icon": "🎬", "desc": "2인 영화 예매권. 다음 약속에 쓸 수 있다."},
    "warm_can":   {"name": "따뜻한 캔커피", "icon": "☕", "desc": "자판기에서 뽑은 따뜻한 캔커피 두 개. 추운 밤에."},
    "doyun_keyring":{"name": "도윤의 키링", "icon": "🔑", "desc": "도윤이 우정의 증표라며 쥐여준 낡은 키링. 버릴 수 없는 무게가 있다."},
    "polaroid":   {"name": "폴라로이드", "icon": "📷", "desc": "지우와 성수 카페에서 찍은 폴라로이드 한 장. 둘 다 어색하게 웃고 있다."},
}

# ---------- 상태 변수 ----------
default inventory = {}      # item_id -> 개수
default item_flags = {}     # 사용/선물 기록 (예: "sakura_card_given": "seoa")

# ---------- 헬퍼 ----------
init python:

    def get_item(iid, n=1, notify=True):
        inventory[iid] = inventory.get(iid, 0) + n
        if notify and iid in ITEMS:
            renpy.notify("아이템 획득: " + ITEMS[iid]["name"])

    def has_item(iid):
        return inventory.get(iid, 0) > 0

    def item_count(iid):
        return inventory.get(iid, 0)

    def use_item(iid, n=1):
        """소모. 성공하면 True."""
        if inventory.get(iid, 0) >= n:
            inventory[iid] -= n
            if inventory[iid] <= 0:
                inventory.pop(iid, None)
            return True
        return False

    def give_item(iid, who=None):
        """선물(소모 + 기록). 성공하면 True."""
        if use_item(iid):
            item_flags[iid + "_given"] = who if who else True
            return True
        return False

    def was_given(iid):
        return item_flags.get(iid + "_given", None)


# ---------- 인벤토리 화면 ----------
#  열기:  call screen inventory_screen   (또는 show)
screen inventory_screen():
    zorder 80
    modal True
    add "#000000bb"
    frame:
        align (0.5, 0.5)
        background "#1f2333"
        padding (28, 24)
        xmaximum 720
        vbox:
            spacing 14
            text "소지품" size 30 bold True color "#ffffff"

            if len(inventory) == 0:
                text "아직 가진 아이템이 없다." size 22 color "#9aa0b3"
            else:
                for iid, cnt in inventory.items():
                    $ it = ITEMS.get(iid, {"name": iid, "icon": "❔", "desc": ""})
                    hbox:
                        spacing 14
                        text it["icon"] size 34
                        vbox:
                            spacing 2
                            text ("[" + it["name"] + "] x" + str(cnt)) size 22 bold True color "#ffffff"
                            text it["desc"] size 18 color "#9aa0b3" xmaximum 560

            textbutton "닫기":
                xalign 1.0
                action Return(True)
                text_size 22 text_color "#6c7cf0"


# ---------- (선택) 어디서나 소지품 보기 단축 버튼 ----------
#  메인 흐름에서 한 번  show screen inv_button  하면 우상단에 작은 버튼.
screen inv_button():
    zorder 20
    textbutton "소지품":
        align (0.98, 0.02)
        background "#1f2333cc"
        padding (14, 8)
        text_size 18 text_color "#cfd4e6"
        action Show("inventory_screen")
