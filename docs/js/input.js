// Keyboard + touch mapped onto shared actions: move (held), action/friend/pause/mute (edges).
// Gameplay never reads raw keys. Any blur, hidden tab or cancelled pointer clears held state.

const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const EDGE_KEYS = { Space: 'action', KeyE: 'action', Enter: 'action', KeyF: 'friend', Tab: 'friend', KeyM: 'mute', Escape: 'pause', KeyP: 'pause' };

export class Input {
  constructor({ joyZone, joyBase, joyKnob, actionBtn, friendBtn }) {
    this.held = new Set();
    this.edges = new Set();
    this.stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
    this.enabled = true;      // false while modals/cutscenes own the screen
    this.modalOpen = () => false;
    this.lastDevice = 'keyboard';
    this.listeners = [];
    this.els = { joyZone, joyBase, joyKnob, actionBtn, friendBtn };
    this.onDevice = null;
    this.bind();
  }

  on(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.listeners.push(() => target.removeEventListener(type, fn, opts)); }

  bind() {
    this.on(window, 'keydown', e => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      // A focused menu/title button activates natively with Space/Enter (keyboard accessibility).
      if (e.target?.tagName === 'BUTTON' && !e.target.closest('#touch') && (e.code === 'Space' || e.code === 'Enter')) return;
      const modal = this.modalOpen();
      if (MOVE_KEYS[e.code] && !modal) { this.held.add(e.code); e.preventDefault(); this.setDevice('keyboard'); return; }
      const edge = EDGE_KEYS[e.code];
      if (!edge) return;
      // While a dialog is open, keys belong to the dialog (Tab/Space/Enter/Esc work natively there).
      if (modal && edge !== 'mute') return;
      if (e.repeat) { e.preventDefault(); return; }
      e.preventDefault(); this.edges.add(edge); this.setDevice('keyboard');
    });
    this.on(window, 'keyup', e => { this.held.delete(e.code); });
    this.on(window, 'blur', () => this.clear());
    this.on(document, 'visibilitychange', () => { if (document.hidden) this.clear(); });
    this.on(window, 'pagehide', () => this.clear());
    this.on(window, 'orientationchange', () => this.clear());

    const { joyZone, joyBase, joyKnob, actionBtn, friendBtn } = this.els;
    const R = 56;
    const setKnob = () => {
      joyKnob.style.transform = `translate(${this.stick.x * R}px, ${-this.stick.y * R}px)`;
    };
    const release = e => {
      if (this.stick.id !== e.pointerId) return;
      this.stick.id = null; this.stick.x = this.stick.y = 0; setKnob();
      joyZone.classList.remove('active');
    };
    this.on(joyZone, 'pointerdown', e => {
      if (this.stick.id !== null || !this.enabled) return;
      e.preventDefault();
      this.setDevice('touch');
      this.stick.id = e.pointerId; joyZone.setPointerCapture?.(e.pointerId);
      const r = joyZone.getBoundingClientRect();
      const ox = Math.min(Math.max(e.clientX, r.left + R + 8), r.right - R - 8);
      const oy = Math.min(Math.max(e.clientY, r.top + R + 8), r.bottom - R - 8);
      this.stick.ox = ox; this.stick.oy = oy;
      joyBase.style.left = (ox - r.left) + 'px'; joyBase.style.top = (oy - r.top) + 'px';
      joyZone.classList.add('active');
      this.updateStick(e.clientX, e.clientY, R); setKnob();
    });
    this.on(joyZone, 'pointermove', e => { if (e.pointerId !== this.stick.id) return; e.preventDefault(); this.updateStick(e.clientX, e.clientY, R); setKnob(); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(joyZone, type, release);

    const press = (btn, edge) => {
      this.on(btn, 'pointerdown', e => {
        e.preventDefault(); if (e.pointerType !== 'mouse') this.setDevice('touch');
        btn.classList.add('pressed'); this.edges.add(edge);
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) this.on(btn, type, () => btn.classList.remove('pressed'));
      // Keyboard activation of the focused on-screen button is handled by the keydown map above.
      this.on(btn, 'click', e => e.preventDefault());
    };
    press(actionBtn, 'action'); press(friendBtn, 'friend');
    // Any touch anywhere marks the device as touch so controls appear on hybrid laptops.
    this.on(window, 'pointerdown', e => { if (e.pointerType === 'touch') this.setDevice('touch'); }, { passive: true });
  }

  updateStick(cx, cy, R) {
    const dx = (cx - this.stick.ox) / R, dy = -(cy - this.stick.oy) / R;
    const m = Math.min(1, Math.hypot(dx, dy)), raw = Math.hypot(dx, dy) || 1;
    const dead = 0.14;
    if (m < dead) { this.stick.x = 0; this.stick.y = 0; return; }
    const k = (m - dead) / (1 - dead); // radial deadzone, rescaled so the edge is full speed
    this.stick.x = (dx / raw) * k; this.stick.y = (dy / raw) * k;
  }

  setDevice(d) { if (this.lastDevice !== d) { this.lastDevice = d; this.onDevice?.(d); } }

  /** Screen-space move intent, magnitude ≤ 1 (x right, y up). */
  move() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = this.stick.x, y = this.stick.y;
    for (const code of this.held) { const v = MOVE_KEYS[code]; if (v) { x += v[0]; y += v[1]; } }
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }
  consume(edge) { const had = this.edges.has(edge); this.edges.delete(edge); return had; }
  peek(edge) { return this.edges.has(edge); }
  clearEdges() { this.edges.clear(); }
  clear() {
    this.held.clear(); this.edges.clear();
    if (this.stick.id !== null) { this.stick.id = null; }
    this.stick.x = this.stick.y = 0;
    this.els.joyKnob.style.transform = 'translate(0px, 0px)';
    this.els.joyZone.classList.remove('active');
    this.els.actionBtn.classList.remove('pressed'); this.els.friendBtn.classList.remove('pressed');
  }
  dispose() { this.listeners.forEach(off => off()); }
}
