export class Engine {
  constructor({ script, characters, state, sys, evaluator, view }) {
    this.script = script;
    this.nodes = script.nodes;
    this.labels = script.labels;
    this.characters = characters;
    this.state = state;
    this.sys = sys;
    this.ev = evaluator;
    this.view = view;
    this.callStack = [];
  }

  interp(text) {
    if (text == null) return text;
    const ESC = String.fromCharCode(0);       // NUL sentinel — cannot appear in script text
    return String(text)
      .replaceAll('[[', ESC)
      .replace(/\[([A-Za-z_]\w*)\]/g, (_, name) => {
        const v = this.state.vars[name];
        return v == null ? '' : String(v);
      })
      .replaceAll(ESC, '[');
  }

  position() { return { label: this._label, ip: this.ip, callStack: [...this.callStack] }; }

  async start(label) { this.ip = this.labels[label]; this._label = label; await this._run(); }
  async resume(pos) { this.ip = pos.ip; this._label = pos.label; this.callStack = pos.callStack || []; await this._run(); }

  async _run() {
    while (this.ip < this.nodes.length) {
      const node = this.nodes[this.ip];
      const next = await this._exec(node);
      if (next === 'stop') return;          // return with empty callstack
      if (typeof next === 'number') { this.ip = next; continue; }
      this.ip += 1;
    }
  }

  async _execList(list) {
    // for menu choice bodies / if branches: run a sub-list with same engine semantics
    for (let i = 0; i < list.length; i++) {
      const r = await this._exec(list[i], list);
      if (r === 'stop') return 'stop';
      if (typeof r === 'object' && r.jump != null) return r;   // propagate jump/return-to-label
      if (r === 'return') return 'return';
    }
    return null;
  }

  async _exec(node, list) {
    const v = this.view;
    switch (node.op) {
      case 'label': return undefined;
      case 'scene': await v.scene({ bg: node.bg, with: node.with }); break;
      case 'say': {
        const c = this.characters[node.who] || {};
        await v.say({ who: node.who, name: c.name, color: node.color || c.color, text: this.interp(node.text) });
        break;
      }
      case 'chat_open': await v.chatOpen({ room: this.interp(node.room) }); break;
      case 'chat_close': await v.chatClose(); break;
      case 'recv': await v.recv({ name: this.interp(node.name), text: this.interp(node.text), avatar: node.avatar }); break;
      case 'send': await v.send({ text: this.interp(node.text) }); break;
      case 'pause': await v.pause(); break;
      case 'input': {
        const val = await v.input({ prompt: this.interp(node.prompt), def: node.default, max: node.max });
        this.state.vars[node.var] = (val ?? '').trim() || node.default || '';
        break;
      }
      case 'set': this.ev.run(node.expr); break;
      case 'toast': await v.toast({ kind: node.kind || 'item', text: this.interp(node.text) }); break;
      case 'music': await v.music({ file: node.file, fadein: node.fadein }); break;
      case 'sound': await v.sound({ file: node.file }); break;
      case 'amb': await v.amb({ file: node.file, fadein: node.fadein }); break;
      case 'stop': await v.stop({ channel: node.channel }); break;
      case 'call_screen': await v.callScreen({ name: node.name, title: node.title, type: node.type }); break;
      case 'consult': {
        if (this.state.vars.doyun_used_chapter) {
          await v.say({ who: 'd', name: '도윤', color: '#2fb574',
            text: '형, 아까 이미 한 번 물어봤잖아. 이번 챕터는 알아서 좀 해봐 ㅋㅋ' });
        } else {
          const [line, hint] = this.sys.doyun_line(node.who);
          await v.consult({ who: node.who, line, hint });
          this.state.vars.doyun_used_chapter = true;
        }
        break;
      }
      case 'menu': {
        const choices = (node.choices || []).filter(c => !c.cond || this.ev.test(c.cond));
        const pick = await v.menu({ prompt: this.interp(node.prompt), choices: choices.map(c => this.interp(c.text)) });
        const r = await this._execList(choices[pick].body || []);
        if (r === 'stop') return 'stop';
        if (r === 'return') return this._doReturn();
        if (r && r.jump != null) return list ? { jump: r.jump } : this._gotoLabel(r.jump);
        break;
      }
      case 'if': {
        const branch = this.ev.test(node.cond) ? (node.then || []) : (node.else || []);
        const r = await this._execList(branch);
        if (r === 'stop') return 'stop';
        if (r === 'return') return this._doReturn();
        if (r && r.jump != null) return list ? { jump: r.jump } : this._gotoLabel(r.jump);
        break;
      }
      case 'jump':
        if (list) return { jump: node.label };       // inside sub-list: propagate
        return this._gotoLabel(node.label);
      case 'call':
        if (node.args) node.args.forEach((a, i) => { this.state.vars['__arg' + i] = a; });
        this.callStack.push(this.ip + 1);
        return this._gotoLabel(node.label);
      case 'return':
        if (list) return 'return';
        return this._doReturn();
      default: console.warn('unknown op', node.op);
    }
    return undefined;
  }

  _gotoLabel(label) {
    this._label = label;
    return this.labels[label];
  }
  _doReturn() {
    if (this.callStack.length === 0) return 'stop';
    return this.callStack.pop();
  }
}
