const KEY = { persistent: 'masil.persistent', slot: n => `masil.save.${n}`, auto: 'masil.autosave' };

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

  snapshot(enginePos) { return { vars: deepClone(this.vars), ...enginePos }; }

  saveSlot(n, enginePos) { this.storage.setItem(KEY.slot(n), JSON.stringify(this.snapshot(enginePos))); }
  saveAuto(enginePos)    { this.storage.setItem(KEY.auto, JSON.stringify(this.snapshot(enginePos))); }
  loadSlot(n)            { return this._load(KEY.slot(n)); }
  loadAuto()             { return this._load(KEY.auto); }
  _load(key) {
    const raw = this.storage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);       // may throw — vars untouched until parse succeeds
    this.vars = data.vars ?? {};
    return { label: data.label, ip: data.ip, callStack: data.callStack };
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
