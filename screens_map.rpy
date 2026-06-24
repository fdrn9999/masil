# =============================================================
#  screens_map.rpy  —  2호선 순환선 맵 이동 화면  [모바일/PC 웹 대응판]
# =============================================================
#  거점: 잠실. 역을 골라 이동. 진행에 따라 역이 해금됨.
#  이미지 없이 코드만으로 도는 프로토타입.
#  (나중에 game/images/ 에 노선도 이미지를 넣고 add 로 교체 가능)
#
#  [상표/저작권 메모]
#  - 서울교통공사 공식 노선도 디자인을 그대로 베끼지 말 것(도안 저작권 우려).
#  - 여기서는 단순화한 '원형 노선 + 역 점' 형태의 독자 도식만 사용.
#  설치: 이 파일을 프로젝트의 game/ 폴더에 넣으세요.
# =============================================================
#  [v2 개선점]
#   - ★흐름 버그 수정: 역 선택/닫기가 'Return'으로 정상 복귀.
#     (이전: 역을 누르면 데모 스텁으로 renpy.jump → 에피소드가 끊겨 메뉴로 튕김)
#     이제 `call screen subway_map` 다음 줄(에피소드 진행)로 안전하게 이어짐.
#   - 터치 타깃 확대(역 점/이름 주변 여백), 현재 역 강조 링, 범례, 역 선택음 훅.
# =============================================================

# ---------- 1. 테마 색상 ----------
define MAP = {
    "bg":        "#f3f1ea",   # 맵 배경 (종이 느낌)
    "line":      "#2fb574",   # 2호선 라인 (스타일화한 초록)
    "node_open": "#2fb574",   # 갈 수 있는 역
    "node_lock": "#c2c2c2",   # 잠긴 역
    "node_here": "#e8553d",   # 현재 위치
    "name_txt":  "#2b2b2b",
    "title_txt": "#2fb574",
}

# ---------- 2. 역 데이터 ----------
#  x, y 는 화면 비율(0.0~1.0). (target 은 레거시 — 더 이상 사용하지 않음)
define STATIONS = [
    {"key": "hongdae",  "name": "홍대입구",  "x": 0.30, "y": 0.16},
    {"key": "hapjeong", "name": "합정",      "x": 0.50, "y": 0.12},
    {"key": "seongsu",  "name": "성수",      "x": 0.70, "y": 0.16},
    {"key": "konkuk",   "name": "건대입구",  "x": 0.84, "y": 0.42},
    {"key": "jamsil",   "name": "잠실",      "x": 0.78, "y": 0.72},
    {"key": "gangnam",  "name": "강남",      "x": 0.50, "y": 0.86},
    {"key": "mullae",   "name": "문래",      "x": 0.22, "y": 0.72},
    {"key": "sinchon",  "name": "신촌",      "x": 0.16, "y": 0.42},
]

# ---------- 3. 상태 변수 & 헬퍼 ----------
default current_station = "jamsil"      # 현재 위치(거점)
default station_unlocked = {            # 갈 수 있는 역
    "jamsil": True,
    "sinchon": True,
}

init python:

    import math

    # 노선(원) 점선을 그릴 좌표 미리 계산
    def _make_loop(n=64, cx=0.5, cy=0.46, rx=0.34, ry=0.37):
        pts = []
        for i in range(n):
            a = 2 * math.pi * i / n
            pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
        return pts
    MAP_LOOP = _make_loop()

    def unlock_station(key):
        """역 해금. 스토리 진행 중 $ unlock_station('seongsu') 처럼 호출."""
        station_unlocked[key] = True
        renpy.restart_interaction()

    def _go_station(st):
        """열린 역으로 이동(현재 위치 갱신 + 선택음). 화면 종료는 Return 액션이 처리."""
        if renpy.loadable("audio/se/se_station.ogg"):
            renpy.sound.play("audio/se/se_station.ogg")
        store.current_station = st["key"]

    def _station_name(key):
        for s in STATIONS:
            if s["key"] == key:
                return s["name"]
        return key


# ---------- 4. 노선도 화면 ----------
#  사용:  call screen subway_map   →  선택한 역 key(또는 "__close__") 반환
screen subway_map():
    zorder 40
    add MAP["bg"]

    # 제목
    vbox:
        xpos 0.5 xanchor 0.5 ypos 28
        text "2호선" xalign 0.5 color MAP["title_txt"] size 48 bold True
        text "가고 싶은 역을 선택하세요" xalign 0.5 color "#7a7a7a" size 20

    # 노선(점선 원)
    for (px, py) in MAP_LOOP:
        text "●":
            xpos px ypos py xanchor 0.5 yanchor 0.5
            color MAP["line"] size 10

    # 역 노드 (터치 타깃을 키우기 위해 버튼에 여백)
    for st in STATIONS:
        $ is_here = (st["key"] == current_station)
        $ is_open = station_unlocked.get(st["key"], False)
        $ node_color = MAP["node_here"] if is_here else (MAP["node_open"] if is_open else MAP["node_lock"])

        button:
            xpos st["x"] ypos st["y"]
            xanchor 0.5 yanchor 0.5
            background None
            padding (18, 14)          # 손가락 탭 영역 확대
            # 열린 역: 이동 후 호출부로 key 반환 / 잠긴 역: 알림만(머무름)
            action If(is_open,
                      true=[Function(_go_station, st), Return(st["key"])],
                      false=Function(renpy.notify, "아직 갈 수 없는 곳이에요."))

            vbox:
                spacing 3
                # 역 점 (현재 역은 더 크게 + 외곽 링 느낌)
                text ("◉" if is_here else "●"):
                    xalign 0.5 color node_color
                    size (44 if is_here else 30)
                # 역 이름 (+ 잠금 표시)
                if is_open:
                    text st["name"]:
                        xalign 0.5 color MAP["name_txt"] size 22 bold is_here
                else:
                    text ("🔒 " + st["name"]):
                        xalign 0.5 color "#9a9a9a" size 20

    # 범례
    frame:
        background "#ffffffcc"
        xpos 24 ypos 24
        padding (16, 12)
        vbox:
            spacing 4
            hbox:
                spacing 8
                text "◉" color MAP["node_here"] size 20 yalign 0.5
                text "현재 위치" color "#5a5a5a" size 17 yalign 0.5
            hbox:
                spacing 8
                text "●" color MAP["node_open"] size 18 yalign 0.5
                text "이동 가능" color "#5a5a5a" size 17 yalign 0.5
            hbox:
                spacing 8
                text "🔒" size 16 yalign 0.5
                text "아직 잠김" color "#5a5a5a" size 17 yalign 0.5

    # 현재 위치 안내 / 닫기 (닫기도 Return → 호출부로 안전 복귀)
    frame:
        background "#ffffff"
        yalign 1.0 xfill True
        padding (24, 16)
        hbox:
            yalign 0.5
            text ("현재 위치: " + _station_name(current_station)):
                color "#2b2b2b" size 22 yalign 0.5
            null width 30
            textbutton "닫기":
                yalign 0.5
                padding (22, 12)
                action Return("__close__")
                text_size 22 text_color MAP["line"]


# =============================================================
#  5. 사용 예시
# =============================================================
#  맵 열고 결과 받기:
#     call screen subway_map           # 에피소드: 다음 줄로 그대로 이어짐
#     $ dest = renpy.call_screen("subway_map")   # 선택 역 key 가 필요할 때
#  역 해금:
#     $ unlock_station("seongsu")
# =============================================================

# --- 데모: 맵을 열고 선택 결과 보기 ---
label map_demo:
    scene black
    "[[데모] 2호선 맵을 엽니다. (처음엔 잠실·신촌만 열려 있음)"
    $ dest = renpy.call_screen("subway_map")
    if dest == "__close__":
        "맵을 그냥 닫았습니다."
    else:
        "선택한 역: [dest]"
    return
