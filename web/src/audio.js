// audio.js — audio + haptics manager (settings-aware, always safe)
// Usage: const audio = makeAudio(settings);
// All methods are safe: missing assets/APIs never throw.

export function makeAudio(settings) {
  let _musicEl = null;  // single shared looping music element
  let _ambEl   = null;  // separate shared looping ambience element

  // ── Internal helpers ────────────────────────────────────────────────────────

  function _newAudio(src) {
    try {
      const a = new Audio(src);
      return a;
    } catch (_e) {
      return null;
    }
  }

  function _tryPlay(el) {
    if (!el) return;
    try { el.play().catch(() => {}); } catch (_e) {}
  }

  function _stopEl(el) {
    if (!el) return;
    try { el.pause(); el.currentTime = 0; } catch (_e) {}
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    /**
     * playSfx(name) — fire-and-forget SE by name (without extension).
     * e.g. playSfx('se_msg_recv') → plays audio/se/se_msg_recv.wav
     */
    playSfx(name) {
      try {
        const a = _newAudio('audio/se/' + name + '.wav');
        if (!a) return;
        a.volume = Math.max(0, Math.min(1, settings.effective('sfx')));
        _tryPlay(a);
      } catch (_e) {}
    },

    /**
     * playSfxFile(path) — fire-and-forget SE by full path.
     * e.g. playSfxFile('audio/se/se_phone.wav')
     */
    playSfxFile(path) {
      try {
        const a = _newAudio(path);
        if (!a) return;
        a.volume = Math.max(0, Math.min(1, settings.effective('sfx')));
        _tryPlay(a);
      } catch (_e) {}
    },

    /**
     * playMusic(file) — start looping BGM (stops any previous).
     */
    playMusic(file) {
      try {
        _stopEl(_musicEl);
        _musicEl = null;
        if (!file) return;
        const a = _newAudio(file);
        if (!a) return;
        a.loop   = true;
        a.volume = Math.max(0, Math.min(1, settings.effective('music')));
        _musicEl = a;
        _tryPlay(a);
      } catch (_e) {}
    },

    /**
     * stopMusic() — stop and clear the looping BGM.
     */
    stopMusic() {
      try { _stopEl(_musicEl); } catch (_e) {}
      _musicEl = null;
    },

    /**
     * playAmb(file) — start looping ambience at sfx*0.6 volume.
     */
    playAmb(file) {
      try {
        _stopEl(_ambEl);
        _ambEl = null;
        if (!file) return;
        const a = _newAudio(file);
        if (!a) return;
        a.loop   = true;
        a.volume = Math.max(0, Math.min(1, settings.effective('sfx') * 0.6));
        _ambEl = a;
        _tryPlay(a);
      } catch (_e) {}
    },

    /**
     * stopAmb() — stop and clear the looping ambience.
     */
    stopAmb() {
      try { _stopEl(_ambEl); } catch (_e) {}
      _ambEl = null;
    },

    /**
     * refreshVolumes() — update live music/amb volumes from current settings.
     * Call after settings.set('music'/'sfx') changes.
     */
    refreshVolumes() {
      try {
        if (_musicEl) {
          _musicEl.volume = Math.max(0, Math.min(1, settings.effective('music')));
        }
        if (_ambEl) {
          _ambEl.volume = Math.max(0, Math.min(1, settings.effective('sfx') * 0.6));
        }
      } catch (_e) {}
    },

    /**
     * vibrate(pattern) — vibrate if setting is on and API available.
     * pattern: number (ms) or array (on/off ms pairs). No-op on desktop.
     */
    vibrate(pattern) {
      if (!settings.get('vibration')) return;
      if (typeof navigator === 'undefined' || !navigator.vibrate) return;
      try { navigator.vibrate(pattern); } catch (_e) {}
    },
  };
}
