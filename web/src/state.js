const KEY = {
  persistent: 'masil.persistent',
  slot: n => `masil.save.${n}`,
  auto: 'masil.autosave',
  quick: 'masil.save.quick',
};

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

export class GameState {
  constructor(storage) {
    this.storage = storage || memoryStorage();
    this.vars = {};
    this.persistent = {};
  }
  defineDefaults(defaults) {
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in this.vars)) this.vars[k] = (v && typeof v === 'object') ? deepClone(v) : v;
    }
  }
  get(name) { return this.vars[name]; }
  set(name, value) { this.vars[name] = value; }

  snapshot(enginePos, meta) {
    const obj = { vars: deepClone(this.vars), ...enginePos };
    if (meta !== undefined) obj.meta = meta;
    return obj;
  }

  saveSlot(n, enginePos, meta)  { this.storage.setItem(KEY.slot(n), JSON.stringify(this.snapshot(enginePos, meta))); }
  saveAuto(enginePos, meta)     { this.storage.setItem(KEY.auto, JSON.stringify(this.snapshot(enginePos, meta))); }
  saveQuick(enginePos, meta)    { this.storage.setItem(KEY.quick, JSON.stringify(this.snapshot(enginePos, meta))); }
  clearAuto()                   { this.storage.removeItem(KEY.auto); }

  loadSlot(n)  { return this._load(KEY.slot(n)); }
  loadAuto()   { return this._load(KEY.auto); }
  loadQuick()  { return this._load(KEY.quick); }

  _load(key) {
    const raw = this.storage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);       // may throw — vars untouched until parse succeeds
    this.vars = data.vars ?? {};
    const pos = { label: data.label, ip: data.ip, callStack: data.callStack };
    if (data.meta !== undefined) pos.meta = data.meta;
    return pos;
  }

  // Non-destructive peek: parse and return data WITHOUT touching this.vars
  peekSlot(n)  { return this._peek(KEY.slot(n)); }
  peekAuto()   { return this._peek(KEY.auto); }
  peekQuick()  { return this._peek(KEY.quick); }

  _peek(key) {
    const raw = this.storage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const pos = { label: data.label, ip: data.ip, callStack: data.callStack };
    if (data.meta !== undefined) pos.meta = data.meta;
    return pos;
  }

  savePersistent() { this.storage.setItem(KEY.persistent, JSON.stringify(this.persistent)); }
  loadPersistent() {
    const raw = this.storage.getItem(KEY.persistent);
    this.persistent = raw ? JSON.parse(raw) : {};
  }
}

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}
