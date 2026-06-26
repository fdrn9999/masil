/**
 * playback.js — pure playback controller (no DOM).
 * Manages skip/auto mode, dialogue history, and rollback snapshots.
 */

const VALID_MODES = new Set(['normal', 'skip', 'auto']);

export function makePlayback(opts = {}) {
  const HISTORY_LIMIT = opts.historyLimit ?? 200;
  const SNAPSHOT_LIMIT = opts.snapshotLimit ?? 60;

  let _mode = 'normal';
  const _history = [];
  const _snapshots = [];
  const _modeListeners = new Set();
  const _notifyMode = () => { for (const fn of _modeListeners) { try { fn(_mode); } catch (_e) {} } };

  return {
    // --- mode ---
    get mode() { return _mode; },

    setMode(m) {
      if (!VALID_MODES.has(m)) throw new Error(`Invalid mode: ${m}`);
      _mode = m;
      _notifyMode();
    },

    isSkip() { return _mode === 'skip'; },
    isAuto() { return _mode === 'auto'; },

    toggleSkip() {
      _mode = _mode === 'skip' ? 'normal' : 'skip';
      _notifyMode();
    },

    toggleAuto() {
      _mode = _mode === 'auto' ? 'normal' : 'auto';
      _notifyMode();
    },

    // Subscribe to mode changes (e.g. sysmenu bar re-sync). Returns unsubscribe.
    onModeChange(fn) { _modeListeners.add(fn); return () => _modeListeners.delete(fn); },

    // --- auto delay ---
    autoDelay(text) {
      return Math.min(6000, 700 + (text?.length || 0) * 45);
    },

    // --- history ---
    pushHistory({ who, name, text }) {
      _history.push({ who, name, text });
      if (_history.length > HISTORY_LIMIT) _history.shift();
    },

    history() { return [..._history]; },

    clearHistory() { _history.length = 0; },

    // --- rollback snapshots ---
    pushSnapshot(snap) {
      // Deep-clone vars AND pos so later mutation of the originals (e.g. a live
      // engine position whose callStack array changes) can't corrupt the snapshot.
      const stored = {
        vars: JSON.parse(JSON.stringify(snap.vars)),
        pos: JSON.parse(JSON.stringify(snap.pos)),
      };
      _snapshots.push(stored);
      if (_snapshots.length > SNAPSHOT_LIMIT) _snapshots.shift();
    },

    popSnapshot() {
      return _snapshots.length > 0 ? _snapshots.pop() : null;
    },

    canRollback() { return _snapshots.length > 0; },

    snapshotCount() { return _snapshots.length; },
  };
}
