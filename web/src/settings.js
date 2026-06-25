// settings.js — persistent settings store (music/sfx/brightness/vibration)
// Usage: const settings = makeSettings(); settings.get('music'); settings.set('music', 0.5);
// Persisted to localStorage key masil.settings (merge with defaults on load).

const STORAGE_KEY = 'masil.settings';

const DEFAULTS = {
  music:      0.8,
  sfx:        0.9,
  brightness: 1.0,
  vibration:  true,
};

function applyBrightness(v) {
  const game = document.getElementById('game');
  if (game) {
    game.style.filter = 'brightness(' + Number(v).toFixed(3) + ')';
  }
}

export function makeSettings(storage) {
  const _storage = storage || window.localStorage;

  // Load saved settings, merging with defaults so new keys never break old saves
  let _data = Object.assign({}, DEFAULTS);
  try {
    const raw = _storage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Only copy known keys from saved data
      for (const k of Object.keys(DEFAULTS)) {
        if (k in saved) _data[k] = saved[k];
      }
    }
  } catch (_e) {
    // Corrupted or absent — use defaults
  }

  // Apply brightness on load
  applyBrightness(_data.brightness);

  function save() {
    try { _storage.setItem(STORAGE_KEY, JSON.stringify(_data)); } catch (_e) {}
  }

  return {
    get(key) {
      return key in _data ? _data[key] : DEFAULTS[key];
    },
    set(key, value) {
      _data[key] = value;
      save();
      if (key === 'brightness') applyBrightness(value);
    },
    all() {
      return Object.assign({}, _data);
    },
  };
}
