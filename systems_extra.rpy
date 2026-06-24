# =============================================================
#  systems_extra.rpy  —  매력/메타 시스템 '두뇌'
# =============================================================
#  - ② 관계의 '결'(비수치 라벨)   - ③ 엔딩 진단/거울 통계
#  - 엔딩 수집(persistent)        - 맥거핀(봄·석촌호수) / 통계 카운터
#  설계 원칙: 숫자 노출 X · 정답 하나 X · 진심은 비싸게.
#  설치: game/ 폴더에.
# =============================================================

default times_ran     = 0       # 도망친 횟수 (거울 통계용)
default promise_spring = False   # ★맥거핀: '봄에 석촌호수 가자' 약속을 남겼는가

init python:

    # ---------- 회차 / 엔딩 수집 (persistent) ----------
    if persistent.endings_seen is None:
        persistent.endings_seen = []
    if persistent.play_count is None:
        persistent.play_count = 0

    ENDING_LIST = [
        ("reconcile", "용서까지 데려다준 사람"),
        ("doyun",     "그날 그 손을 끝까지"),
        ("true",      "끝내 건넨 진심"),
        ("good",      "서툰 진심"),
        ("fishtank",  "모두의, 아무도 아닌"),
        ("lonely",    "못다 준 사람"),
        ("run",       "다시 혼자"),
    ]

    def record_ending(kind):
        if persistent.endings_seen is None:
            persistent.endings_seen = []
        if kind and kind not in persistent.endings_seen:
            # 새 리스트로 재할당해야 persistent 가 저장됨
            persistent.endings_seen = persistent.endings_seen + [kind]

    def endings_seen_count():
        return len(persistent.endings_seen or [])

    def all_endings_seen():
        seen = set(persistent.endings_seen or [])
        return all(k in seen for k, _ in ENDING_LIST)

    # ---------- ② 관계의 '결' (비수치 라벨) ----------
    def rel_subtitle(who):
        if who == "doyun":
            b = doyun_bond
            if b >= 25: return "둘도 없는 친구"
            if b >= 12: return "의지가 되는 동생"
            return "오픈챗 게임 친구"
        l, s = like.get(who, 0), sincere.get(who, 0)
        if s >= 60: return "마음이 닿은 사람"
        if s >= 35: return "조금씩 진심이 오가는"
        if l >= 60 and s < 35: return "잘 보이는 중 (겉도는)"
        if l >= 30: return "점점 친해지는"
        if l > 0 or s > 0: return "이제 막 알게 된"
        return "아직 모르는 사이"

    def is_met(who):
        return (like.get(who, 0) > 0 or sincere.get(who, 0) > 0)

    # ---------- ③ 엔딩 진단 (연애 유형) ----------
    def love_type():
        kind, who = final_ending()
        table = {
            "run":       ("도망러",         "끝내 또 도망친. 익숙한 거리에서 가장 외로운 사람."),
            "fishtank":  ("어장러",         "모두에게 잘했지만, 아무에게도 진짜를 주진 못한."),
            "doyun":     ("의리파",         "사랑보다 곁을 택한. 가장 단단한 걸 끝까지 지킨."),
            "reconcile": ("다 끌어안은 사람", "도망치지 않고, 누구도 놓지 않은 최난도 길을 걸은."),
            "good":      ("서툰 진심파",     "완벽하진 않아도, 이번엔 도망치지 않은."),
            "lonely":    ("못다 준 사람",    "진심은 늘 한 발 늦게 도착했다."),
        }
        if kind == "true":
            if who == "jiu":
                return ("슬로우버너", "천천히 데워, 식지 않는 불을 가진 사람.")
            return ("진심파", "비싼 진심을, 끝내 한 사람에게 건넨.")
        return table.get(kind, ("여행자", "이야기는 아직 끝나지 않았다."))

    # ---------- ③ 거울 통계 ----------
    def kept_promises():
        kept = []
        if was_given("sakura_card"): kept.append("서아에게 벚꽃 엽서를 건넸다")
        if was_given("warm_can"):    kept.append("지우에게 따뜻한 캔커피를 챙겼다")
        if was_given("hangover"):    kept.append("도윤에게 숙취해소제를 다시 쥐여줬다")
        if promise_spring:           kept.append("봄에 석촌호수에 가자는 약속을 남겼다")
        return kept

    def heart_vs_like():
        ts, tl = sum(sincere.values()), sum(like.values())
        if ts > tl:        return "진심 > 호감 — 점수보다 마음을 줬다."
        if tl > ts * 2:    return "호감 ≫ 진심 — 잘 보이는 데 능했다."
        return "호감 ≈ 진심 — 그 사이 어딘가."

    def who_remained():
        kind, who = final_ending()
        if kind == "doyun":      return "도윤"
        if kind == "reconcile":  return "민결, 그리고 도윤"
        if kind in ("run", "fishtank", "lonely"): return "— (아무도)"
        if who:                  return hname(who)
        return "—"
