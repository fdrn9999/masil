import { HEROINES, ITEMS } from './theme.js';

const clamp = v => Math.max(0, Math.min(100, v));

export function makeSystems(state, { onNotify = () => {} } = {}) {
  const v = state.vars;
  const sys = {
    add_like(who, n) { v.like[who] = clamp(v.like[who] + n); },
    add_sincere(who, n) { v.sincere[who] = clamp(v.sincere[who] + n); },
    add_bond(n) { v.doyun_bond += n; },
    hname(who) { return HEROINES[who] || who; },
    chapter_start() { v.doyun_used_chapter = false; },

    get_item(iid, n = 1, notify = true) {
      v.inventory[iid] = (v.inventory[iid] || 0) + n;
      if (notify && ITEMS[iid]) onNotify({ kind: 'item', text: '아이템 획득: ' + ITEMS[iid].name });
    },
    has_item(iid) { return (v.inventory[iid] || 0) > 0; },
    item_count(iid) { return v.inventory[iid] || 0; },
    use_item(iid, n = 1) {
      if ((v.inventory[iid] || 0) >= n) {
        v.inventory[iid] -= n;
        if (v.inventory[iid] <= 0) delete v.inventory[iid];
        return true;
      }
      return false;
    },
    give_item(iid, who = null) {
      if (sys.use_item(iid)) { v.item_flags[iid + '_given'] = who ? who : true; return true; }
      return false;
    },
    was_given(iid) { return v.item_flags[iid + '_given'] ?? null; },

    unlock_station(id) {
      v.__stations = v.__stations || [];
      if (!v.__stations.includes(id)) v.__stations.push(id);
    },
    doyun_ping(text) { onNotify({ kind: 'doyun', text }); },

    _doyun_read(who) {
      if (who === 'seoa') return '서아는 속도보다, 형이 진짜인지를 보고 있어';
      if (who === 'jiu') return '지우는 답장 빨리 오는 것보다 형 진심을 더 쳐';
      if (who === 'mingyeol') return '민결은 들이대면 도망가. 형이 먼저 거리를 줘';
      return '지금은 진심 한 스푼이 호감 열보다 커';
    },
    doyun_line(who) {
      const l = v.like[who], s = v.sincere[who], n = sys.hname(who);
      const sharp = v.doyun_bond >= 20;
      let line, hint;
      if (l >= 60 && s < 30) {
        line = `형… ${n} 한테 잘 보이기만 하는 거 아니야? 호감만 높고 진심이 안 보여. 이러다 어장 소리 들어.`;
        hint = '[힌트] 약한 모습을 보이거나 진솔한 속얘기를 꺼내봐. 진심이 올라가.';
      } else if (l < 30 && s < 30) {
        line = `형, 아직 ${n} 랑 서먹하네. 천천히 가도 돼, 일단 자주 말 걸어봐.`;
        hint = '[힌트] 가벼운 대화로 호감부터 쌓는 단계야.';
      } else if (s >= 50) {
        line = `오 형, ${n} 한테 진심이 통하고 있어. 형 이대로만 가면 돼.`;
        hint = '[힌트] 결정적인 순간에 솔직하게 마음을 말하면 진엔딩 각이야.';
      } else {
        line = `형, ${n} 랑 나쁘진 않아. 근데 더 깊어지려면 형 진짜 속얘길 해야지.`;
        hint = '[힌트] 호감은 충분, 이제 진심을 채울 차례.';
      }
      if (sharp) hint += `\n   (형이 보기엔 — ${sys._doyun_read(who)})`;
      return [line, hint];
    },

    decide_ending() {
      const fishtank = Object.keys(HEROINES).filter(k => v.like[k] >= 70 && v.sincere[k] < 30).length;
      if (fishtank >= 2) return ['fishtank', null];
      const best = Object.keys(HEROINES).reduce((a, b) => (v.sincere[b] > v.sincere[a] ? b : a));
      if (v.sincere[best] >= 70 && v.like[best] >= 60) return ['true', best];
      if (v.sincere[best] >= 50) return ['good', best];
      return ['lonely', null];
    },
    final_ending() {
      const c = v.ep4_choice;
      if (c === 'run') return ['run', null];
      if (c === 'reconcile' && v.doyun_bond >= 25 && v.sincere.mingyeol >= 35) return ['reconcile', 'mingyeol'];
      if (c === 'friend' && (v.doyun_bond >= 25 || sys.has_item('doyun_keyring'))) return ['doyun', null];
      if (c === 'love' && v.sincere.mingyeol >= 40) return ['true', 'mingyeol'];
      return sys.decide_ending();
    },

    apply_timing(who, mode) {
      const tables = {
        seoa: { now: [['like', 10], '오 답장 빠르네 ㅋㅋ 그런 거 맘에 들어, 라며 서아가 좋아했다.'],
                wait: [['like', 3], "조금 뜸을 들였다. '뭐야 왜 이제 답해~' 하면서도 싫진 않은 눈치."],
                ignore: [['like', -5], '한참 못 본 척했더니, 다음 답장에서 서아의 텐션이 살짝 식어 있었다.'] },
        jiu: { now: [['like', 5], "바로 답하자 지우가 '오 빠르다 ㅋㅋ' 하고 웃었다."],
               wait: [['sincere', 8], '한 번 더 생각하고 답을 골랐다. 지우는 그런 신중함을 좋아하는 사람이었다.'],
               ignore: [['like', 2], "게임하다 늦게 봤다. 지우는 '바빴구나 ㅋㅋ 괜찮아' 했다."] },
        mingyeol: { now: [['like', 3], "바로 답하자 민결이 '뭐야 대기 타고 있었어요? ㅋㅋ' 하며 한 발 물러섰다."],
                    wait: [['like', 8], '적당히 뜸을 들였다. 민결은 그 거리감을 오히려 편해했다.'],
                    ignore: [['sincere', 4], "며칠 두자, 민결이 먼저 '바쁜가 보네요' 하고 툭. 의외로 신경 쓰는 눈치였다."] },
      };
      const d = tables[who] || { now: [['bond', 5], 'ㅋㅋ 형 답장 빠르네, 심심했지? 하고 도윤이 놀렸다.'],
        wait: [['bond', 2], '도윤은 답이 늦어도 개의치 않았다.'], ignore: [['bond', 0], "도윤은 '바쁜갑네 ㅋㅋ' 하고 말았다."] };
      const [[gauge, amt], line] = d[mode];
      if (gauge === 'like') sys.add_like(who, amt);
      else if (gauge === 'sincere') sys.add_sincere(who, amt);
      else if (gauge === 'bond') sys.add_bond(amt);
      return line;
    },
  };
  return sys;
}
