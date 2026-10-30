// DOM interface: HUD, speech bubbles, floaters, toasts and modal dialogs.
// Text is always set with textContent (names are user-entered).
import * as THREE from 'three';
import { NAMES, UI, ELEMENT_TEXT, HINTS, LINES } from './content.js';
import { sanitizeName, CREATURE_IDS } from './save.js';
import { openFriendEditor } from './editor.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const FOCUSABLE = 'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

export class UIManager {
  constructor() {
    this.hud = $('#hud'); this.touch = $('#touch');
    this.goalEl = $('#goal'); this.goalText = $('.goal-text'); this.goalIcon = $('.goal-icon');
    this.promptEl = $('#prompt'); this.promptText = $('.prompt-text'); this.promptIcon = $('.prompt-icon');
    this.actionBtn = $('#btn-action'); this.actionLabel = $('.action-label'); this.actionIcon = $('.action-icon');
    this.friendBtn = $('#btn-friend'); this.friendFace = $('.friend-face');
    this.bubbleLayer = $('#bubbles'); this.floaters = $('#floaters');
    this.modalLayer = $('#modal'); this.toasts = $('#toasts');
    this.edgeArrow = $('#edge-arrow'); this.zoneEl = $('#zone-banner');
    this.saveChip = $('#save-chip');
    this.bubbles = new Map();
    this.current = null; this.modalStack = [];
    this.v = new THREE.Vector3();
  }

  attach(game, portraits) {
    this.game = game; this.portraits = portraits;
    $('#btn-roster').addEventListener('click', () => { game.audio.ui(); this.openRoster(); });
    $('#btn-book').addEventListener('click', () => { game.audio.ui(); this.openBook(); });
    $('#btn-mute').addEventListener('click', () => game.setMuted(!game.progress.settings.muted));
    // HUD buttons give focus back to the game so Space keeps meaning "Action".
    for (const b of document.querySelectorAll('.hud-btn, .touch-btn')) b.addEventListener('pointerup', () => setTimeout(() => b.blur(), 0));
    $('#btn-pause').addEventListener('click', () => { game.audio.ui(); this.openPause(); });
    game.on('target', t => this.setTarget(t));
    game.on('busy', () => this.setTarget(game.selectedTarget));
    game.on('friends', () => this.refreshFriends());
    game.on('settings', () => this.refreshSettings());
    game.on('saveMode', () => this.refreshSave());
    game.on('saved', e => { if (e.ok && ['befriend', 'project', 'event', 'finale', 'custom'].includes(e.reason)) this.toast(UI.saved, { icon: 'assets/ui/item-seed.svg', quiet: true }); });
    game.on('moved', () => { if (!this.keysFaded) { this.keysFaded = true; setTimeout(() => $('#keys-help').classList.add('faded'), 6000); } });
    game.input.modalOpen = () => !!this.current;
    this.refreshSettings(); this.refreshFriends(); this.refreshSave();
  }

  showHud(on) { this.hud.hidden = !on; this.touch.hidden = !on; }
  setTouchMode(on) { document.body.classList.toggle('touch', on); }

  // ---------- goal + prompt ----------
  setGoal(goal) {
    const text = goal?.text || '';
    if (text === this.lastGoal) return;
    this.lastGoal = text;
    this.goalText.textContent = text; this.goalIcon.src = goal?.icon || 'assets/ui/item-seed.svg';
    this.goalEl.classList.remove('bounce'); void this.goalEl.offsetWidth; this.goalEl.classList.add('bounce');
  }
  setTarget(t) {
    const busy = this.game?.busy;
    if (t && !busy) {
      this.promptText.textContent = t.label; this.promptIcon.src = t.icon || 'assets/ui/control-interact.svg';
      if (this.promptEl.hidden) { this.promptEl.hidden = false; this.promptEl.classList.remove('show'); void this.promptEl.offsetWidth; this.promptEl.classList.add('show'); }
      this.actionLabel.textContent = t.short || t.label; this.actionIcon.src = t.icon || 'assets/ui/control-interact.svg';
      this.actionBtn.classList.add('ready'); this.actionBtn.classList.remove('idle');
      this.actionBtn.setAttribute('aria-label', 'Action: ' + t.label);
    } else {
      this.promptEl.hidden = true;
      this.actionLabel.textContent = busy ? '...' : 'Wave'; this.actionIcon.src = 'assets/ui/control-interact.svg';
      this.actionBtn.classList.remove('ready'); this.actionBtn.classList.add('idle');
      this.actionBtn.setAttribute('aria-label', 'Action');
    }
  }
  refreshFriends() {
    const g = this.game; if (!g) return;
    const id = g.progress.selectedFriendId;
    if (id && this.portraits) { this.friendFace.src = this.portraits.get(g.actors[id], { version: g.portraitVersion?.[id] || 0 }); this.friendBtn.setAttribute('aria-label', 'Switch friend (now: ' + g.displayName(id) + ')'); }
    else { this.friendFace.src = 'assets/ui/control-friend.svg'; this.friendBtn.setAttribute('aria-label', 'Switch friend'); }
    const n = g.friendIds().length, badge = $('.hud-badge');
    badge.hidden = n === 0; badge.textContent = String(n);
  }
  refreshSettings() {
    const g = this.game; if (!g) return;
    const muted = g.progress.settings.muted, b = $('#btn-mute');
    b.setAttribute('aria-pressed', String(muted)); b.setAttribute('aria-label', muted ? UI.unmute : UI.mute);
    document.documentElement.classList.toggle('reduced-motion', !!g.progress.settings.reducedMotion);
  }
  refreshSave() {
    const g = this.game; if (!g) return;
    if (g.saveMode === 'off') {
      this.saveChip.hidden = false; this.saveChip.textContent = '';
      this.saveChip.append(el('span', '', 'Saving is off'));
      const b = el('button', 'btn small', 'Export'); b.type = 'button'; b.addEventListener('click', () => this.openSaveCode()); this.saveChip.append(b);
    } else this.saveChip.hidden = true;
  }

  // ---------- per-frame: bubbles + edge arrow ----------
  frame() {
    const g = this.game; if (!g) return;
    const W = g.viewW, H = g.viewH;
    for (const [id, b] of this.bubbles) {
      if (g.time > b.until && !b.leaving) { this.dropBubble(id); continue; }
      if (!b.w) { b.w = b.el.offsetWidth; b.h = b.el.offsetHeight; }
      const head = b.actor.headWorld(this.v); head.y += 0.25;
      const s = g.camera.toScreen(head, W, H);
      const top = document.body.classList.contains('cinema') ? 10 : this.hudBottom();
      let x = s.x - b.w / 2, y = s.y - b.h - 16;
      const cx = Math.min(Math.max(8, x), W - b.w - 8), cy = Math.min(Math.max(top, y), H - b.h - 8);
      b.cy = cy;
      b.el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      b.el.style.setProperty('--tail', Math.min(b.w - 18, Math.max(18, s.x - cx)).toFixed(0) + 'px');
    }
    // Off-screen goal arrow.
    const goal = g.story?.goalPos;
    if (goal && !document.body.classList.contains('cinema')) {
      const s = g.camera.toScreen(this.v.set(goal.x, (goal.y || 0) + 0.8, goal.z), W, H);
      const m = 26, inside = s.x > 0 && s.x < W && s.y > 70 && s.y < H;
      if (!inside) {
        const cx = W / 2, cy = H / 2, dx = s.x - cx, dy = s.y - cy;
        const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-3), (H / 2 - m - 30) / Math.abs(dy || 1e-3));
        const ax = cx + dx * k, ay = cy + dy * k + 15;
        this.edgeArrow.hidden = false;
        const ang = Math.atan2(dy, dx) + Math.PI;
        this.edgeArrow.style.left = ax + 'px'; this.edgeArrow.style.top = ay + 'px';
        this.edgeArrow.style.transform = `rotate(${ang}rad)`;
      } else this.edgeArrow.hidden = true;
    } else this.edgeArrow.hidden = true;
  }

  bubble(actor, text, { dur, who } = {}) {
    this.dropBubble(actor.id, true);
    const b = el('div', 'bubble'); b.setAttribute('role', 'status');
    if (who) b.append(el('span', 'who', who));
    const inner = el('span', 'in'); inner.textContent = text; b.append(inner);
    this.bubbleLayer.append(b);
    const words = text.split(/\s+/).length;
    this.bubbles.set(actor.id, { el: b, actor, until: this.game.time + (dur ?? Math.max(2.2, 1.3 + words * 0.32)) });
    // Never more than two bubbles: the oldest pops first.
    if (this.bubbles.size > 2) this.dropBubble([...this.bubbles.keys()][0]);
  }
  dropBubble(id, instant = false) {
    const b = this.bubbles.get(id); if (!b) return;
    this.bubbles.delete(id);
    if (instant) { b.el.remove(); return; }
    b.leaving = true; b.el.classList.add('out'); setTimeout(() => b.el.remove(), 260);
  }
  anyBubble() { return this.bubbles.size > 0; }
  clearBubbles() { for (const id of [...this.bubbles.keys()]) this.dropBubble(id, true); }

  /** Lowest edge of the visible top HUD (goal chip, buttons, keyboard help, save chip); re-measured twice a second. */
  hudBottom() {
    const now = performance.now();
    if (this.hudBottomAt && now - this.hudBottomAt < 500) return this.hudBottomCache;
    let bottom = 0;
    if (!this.hud.hidden) for (const sel of ['#goal', '.hud-buttons', '#keys-help', '#save-chip']) {
      const e = document.querySelector(sel);
      if (!e || e.hidden || e.classList.contains('faded') || getComputedStyle(e).display === 'none') continue;
      const r = e.getBoundingClientRect(); if (r.height > 0 && r.top < 260) bottom = Math.max(bottom, r.bottom);
    }
    this.hudBottomAt = now; this.hudBottomCache = Math.max(10, bottom + 10);
    return this.hudBottomCache;
  }

  floater(actor, text, { icon } = {}) {
    const g = this.game, s = g.camera.toScreen(actor.headWorld(this.v).add(new THREE.Vector3(0, 0.6, 0)), g.viewW, g.viewH);
    const f = el('div', 'floater');
    if (icon) { const i = el('img'); i.src = icon; i.alt = ''; f.append(i, ' '); }
    f.append(document.createTextNode(text));
    // Stack above this actor's speech bubble (if any), and never under the HUD strip.
    const b = this.bubbles.get(actor.id);
    let y = b ? Math.min(s.y, b.cy ?? (s.y - b.el.offsetHeight - 16)) - 30 : s.y;
    y = Math.max(y, this.hudBottom() + 22);
    f.style.left = s.x + 'px'; f.style.top = y + 'px';
    this.floaters.append(f); setTimeout(() => f.remove(), 1900);
  }
  /** The amber friendship seed flies from a creature into the memory book. */
  flyToBook(actor, icon = 'assets/ui/item-seed.svg') {
    return new Promise(resolve => {
      const g = this.game, s = g.camera.toScreen(actor.headWorld(this.v), g.viewW, g.viewH);
      const book = $('#btn-book').getBoundingClientRect();
      const f = el('img', 'flyer'); f.src = icon; f.alt = '';
      this.floaters.append(f);
      const tx = book.left + book.width / 2, ty = book.top + book.height / 2;
      const mx = (s.x + tx) / 2, my = Math.min(s.y, ty) - 120;
      const anim = f.animate([
        { transform: `translate(${s.x}px, ${s.y}px) scale(.4)` },
        { transform: `translate(${s.x}px, ${s.y - 40}px) scale(1.4)`, offset: 0.2 },
        { transform: `translate(${mx}px, ${my}px) scale(1.2) rotate(180deg)`, offset: 0.6 },
        { transform: `translate(${tx}px, ${ty}px) scale(.6) rotate(360deg)` },
      ], { duration: this.game.reducedMotion ? 300 : 1300, easing: 'cubic-bezier(.5,0,.4,1)' });
      anim.onfinish = () => {
        f.remove(); const b = $('#btn-book'); b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
        this.game.audio.stamp(); resolve();
      };
    });
  }

  toast(text, { icon, quiet = false, dur = 2400 } = {}) {
    const t = el('div', 'toast'); if (quiet) t.style.fontSize = '14px';
    if (icon) { const i = el('img'); i.src = icon; i.alt = ''; t.append(i); }
    t.append(el('span', '', text)); this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, dur);
  }
  zoneBanner(text) {
    if (!text) return;
    this.zoneEl.textContent = text; this.zoneEl.classList.add('show');
    clearTimeout(this.zoneTimer); this.zoneTimer = setTimeout(() => this.zoneEl.classList.remove('show'), 2300);
  }

  // ---------- modals ----------
  /**
   * Generic dialog. `build(card, close)` fills the card; resolves with close(value).
   * Pauses the simulation when `pause` is set.
   */
  modal(build, { wide = false, pause = false, dismissible = true, soft = false, label = 'Dialog' } = {}) {
    return new Promise(resolve => {
      // A dialog opened from another dialog inherits the paused state from before the first one.
      const inherited = this.current ? this.current.wasPaused : undefined;
      if (this.current) this.current.close(undefined, true);
      const g = this.game, layer = this.modalLayer;
      const prevFocus = document.activeElement;
      layer.hidden = false; layer.textContent = ''; layer.classList.toggle('soft', soft);
      const card = el('div', 'modal' + (wide ? ' wide' : '')); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', label);
      layer.append(card);
      const wasPaused = inherited ?? !!g?.paused;
      if (pause && g) g.paused = true;
      g?.input.clear();
      const onKey = e => {
        // Swallow Escape so it closes only this dialog (and does not also reach the game's pause key).
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (dismissible) close(null); return; }
        if (e.key === 'Tab') {
          const f = [...card.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
          if (!f.length) return;
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      };
      const onBackdrop = e => { if (e.target === layer && dismissible) close(null); };
      let closed = false;
      const close = (value, replaced = false) => {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', onKey, true); layer.removeEventListener('pointerdown', onBackdrop);
        if (!replaced) { layer.hidden = true; layer.textContent = ''; if (g) g.paused = wasPaused; }
        if (this.current?.close === close) this.current = null;
        g?.input.clear();
        if (!replaced && prevFocus && document.contains(prevFocus)) prevFocus.focus?.({ preventScroll: true });
        resolve(value);
      };
      document.addEventListener('keydown', onKey, true); layer.addEventListener('pointerdown', onBackdrop);
      this.current = { close, wasPaused };
      build(card, close);
      if (dismissible) {
        const x = el('button', 'btn small close', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', () => close(null)); card.prepend(x);
      }
      const first = card.querySelector('[data-autofocus]') || card.querySelector('.btn.primary') || card.querySelector(FOCUSABLE);
      setTimeout(() => first?.focus({ preventScroll: true }), 30);
    });
  }
  closeModal() { this.current?.close(null); }
  button(text, { primary = false, cls = '', onClick } = {}) {
    const b = el('button', 'btn ' + (primary ? 'primary ' : '') + cls, text); b.type = 'button';
    if (onClick) b.addEventListener('click', e => { this.game?.audio.ui(); onClick(e); });
    return b;
  }
  head(card, title, actorId) {
    const h = el('div', 'modal-head');
    if (actorId && this.portraits) { const p = el('img', 'portrait'); p.alt = ''; p.src = this.portraits.get(this.game.actors[actorId], { version: this.game.portraitVersion?.[actorId] || 0 }); h.append(p); }
    h.append(el('h2', '', title)); card.append(h); return h;
  }

  confirm(title, text, yes = 'Yes', no = 'No') {
    return this.modal((card, close) => {
      this.head(card, title); card.append(el('p', '', text));
      const row = el('div', 'row');
      row.append(this.button(no, { onClick: () => close(false) }), this.button(yes, { primary: true, onClick: () => close(true) }));
      card.append(row);
    }, { label: title });
  }

  /** Big-card choice. options: [{value, label, sub, img}] */
  choose(title, text, options, { actorId, dismissible = false } = {}) {
    return this.modal((card, close) => {
      this.head(card, title, actorId); if (text) card.append(el('p', '', text));
      const grid = el('div', 'choice-grid');
      for (const o of options) {
        const b = el('button', 'card'); b.type = 'button';
        if (o.img) { const i = el('img', 'portrait'); i.src = o.img; i.alt = ''; b.append(i); }
        b.append(el('div', 'name', o.label)); if (o.sub) b.append(el('div', 'meta', o.sub));
        b.addEventListener('click', () => { this.game.audio.ui(); close(o.value); });
        grid.append(b);
      }
      card.append(grid);
    }, { dismissible, label: title, soft: true });
  }

  /** Optional nickname. Resolves with the chosen (sanitized) name, or '' to keep the original. */
  async nickname(id) {
    const def = this.game.creatureDefs[id];
    return this.modal((card, close) => {
      this.head(card, `New friend: ${def.name}!`, id);
      const memo = el('p', 'name-hint'); const mi = el('img'); mi.src = 'assets/ui/item-memory.svg'; mi.alt = ''; mi.style.cssText = 'width:22px;height:22px;vertical-align:middle;margin-right:6px';
      memo.append(mi, document.createTextNode(`New memory stamp: "${def.memoryLine}"`)); card.append(memo);
      card.append(el('p', '', 'Want to give your friend a nickname? You can skip this.'));
      const chips = el('div', 'chips');
      const input = el('input', 'name-input'); input.type = 'text'; input.maxLength = 16; input.placeholder = 'Type a name'; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Nickname');
      input.setAttribute('autocapitalize', 'words'); input.spellcheck = false;
      for (const n of NAMES[id] || []) {
        const c = el('button', 'chip-btn', n); c.type = 'button';
        c.addEventListener('click', () => { input.value = n; chips.querySelectorAll('.chip-btn').forEach(x => x.setAttribute('aria-pressed', String(x === c))); this.game.audio.tick(); });
        chips.append(c);
      }
      const hint = el('p', 'name-hint', 'Up to 16 letters. Kind names only.');
      const row = el('div', 'row');
      const keep = this.button(`Keep "${def.name}"`, { onClick: () => close('') });
      const use = this.button('Use this name', { primary: true, onClick: () => {
        const clean = sanitizeName(input.value);
        if (!input.value.trim()) { close(''); return; }
        if (!clean) { hint.textContent = 'Let us pick a different, kind name.'; input.focus(); return; }
        close(clean);
      } });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); use.click(); } });
      row.append(keep, use);
      card.append(chips, el('div', '', ''), input, hint, row);
      chips.style.marginBottom = '10px';
    }, { dismissible: false, label: 'Nickname', soft: true });
  }

  rosterCards(onPick, { onlyFriends = false, selected } = {}) {
    const g = this.game, grid = el('div', 'roster-grid');
    for (const id of CREATURE_IDS) {
      const def = g.creatureDefs[id], f = g.progress.friends[id];
      if (onlyFriends && !f) continue;
      const card = el(f ? 'button' : 'div', 'card' + (f ? '' : ' unknown') + (selected === id ? ' selected' : ''));
      if (f) card.type = 'button';
      const img = el('img', 'portrait'); img.alt = f ? g.displayName(id) : 'Not met yet';
      img.src = this.portraits.get(g.actors[id], { silhouette: !f, version: g.portraitVersion?.[id] || 0 });
      card.append(img);
      card.append(el('div', 'name', f ? g.displayName(id) : '???'));
      const meta = el('div', 'meta');
      const icon = el('img'); icon.src = `assets/ui/element-${def.element}.svg`; icon.alt = '';
      meta.append(icon, document.createTextNode(f ? `${ELEMENT_TEXT[def.element]} · ${def.abilityName}` : ELEMENT_TEXT[def.element]));
      card.append(meta);
      if (!f) card.append(el('div', 'meta', HINTS.rumours[id]));
      if (f && f.nickname && f.nickname !== def.name) card.append(el('div', 'meta', def.name));
      if (f?.friendship === 'grown') { const s = el('img', 'seed-badge'); s.src = 'assets/ui/item-seed.svg'; s.alt = 'Grown: has a friendship seed'; card.append(s); }
      if (f && id === g.progress.selectedFriendId) card.append(el('div', 'meta', 'Following you'));
      if (f && g.progress.customFriends[0]?.baseId === id) card.append(el('div', 'meta', 'My Friend (made by you)'));
      if (f && onPick) card.addEventListener('click', () => { g.audio.ui(); onPick(id); });
      grid.append(card);
    }
    return grid;
  }

  openRoster() {
    const g = this.game;
    return this.modal((card, close) => {
      this.head(card, 'Friends');
      const n = g.friendIds().length;
      card.append(el('p', '', n ? `You have ${n} friend${n === 1 ? '' : 's'}. Tap one to bring it along.` : 'No friends yet. Somebody nearby is trying something silly...'));
      card.append(this.rosterCards(id => { g.selectFriend(id); close(id); }, { selected: g.progress.selectedFriendId }));
      const row = el('div', 'row');
      row.append(this.button('Memory book', { onClick: () => this.openBook() }));
      if (n && this.openEditor) row.append(this.button('My Friend', { onClick: () => this.openEditor() }));
      card.append(row);
    }, { wide: true, pause: true, label: 'Friends' });
  }

  openEditor() { return openFriendEditor(this); }

  openBook() {
    const g = this.game;
    return this.modal((card) => {
      this.head(card, 'Memory book');
      card.append(el('p', '', 'Every friend leaves one memory here.'));
      for (const id of CREATURE_IDS) {
        const def = g.creatureDefs[id], f = g.progress.friends[id];
        const page = el('div', 'book-page' + (f ? '' : ' empty'));
        const stamp = el('img', 'stamp portrait'); stamp.alt = '';
        stamp.src = this.portraits.get(g.actors[id], { silhouette: !f, version: g.portraitVersion?.[id] || 0 });
        const right = el('div');
        right.append(el('div', 'who', f ? g.displayName(id) : 'A memory still to make'));
        right.append(el('div', 'line', f ? `"${def.memoryLine}"` : '...'));
        if (f?.friendship === 'grown') right.append(el('div', 'meta', 'Grew a friendship seed'));
        page.append(stamp, right); card.append(page);
      }
    }, { wide: true, pause: true, label: 'Memory book' });
  }

  openPause() {
    const g = this.game; if (!g || this.current) return;
    return this.modal((card, close) => {
      this.head(card, UI.pause);
      const list = el('div', 'settings-list');
      const tog = (label, get, set) => {
        const row = el('div', 'toggle'); row.append(el('span', '', label));
        const b = this.button(get() ? 'On' : 'Off', { cls: 'small', onClick: () => { set(!get()); b.textContent = get() ? 'On' : 'Off'; b.setAttribute('aria-pressed', String(get())); } });
        b.setAttribute('aria-pressed', String(get())); b.setAttribute('aria-label', label); row.append(b); return row;
      };
      list.append(tog('Sound', () => !g.progress.settings.muted, v => g.setMuted(!v)));
      list.append(tog('Calm motion (less camera movement)', () => !!g.progress.settings.reducedMotion, v => g.setReducedMotion(v)));
      card.append(list);
      const row = el('div', 'row');
      row.append(this.button(UI.resume, { primary: true, onClick: () => close(null) }));
      row.append(this.button('Friends', { onClick: () => this.openRoster() }));
      row.append(this.button('Memory book', { onClick: () => this.openBook() }));
      if (this.openEditor && g.friendIds().length) row.append(this.button('My Friend', { onClick: () => this.openEditor() }));
      row.append(this.button('Save code', { onClick: () => this.openSaveCode() }));
      row.append(this.button('Credits', { onClick: () => this.openCredits() }));
      row.append(this.button('New game', { cls: 'teal', onClick: async () => {
        const ok = await this.confirm('Start a new island?', 'This clears your friends and toys on this device. Your island cannot come back unless you saved a code.', 'Yes, start over', 'No, keep playing');
        if (ok) g.newGame();
      } }));
      card.append(row);
      const note = el('p', 'name-hint', g.saveMode === 'local' ? 'Your island saves on this device after each friend and toy.' : UI.saveOff);
      card.append(note);
    }, { pause: true, label: UI.pause });
  }

  openSaveCode() {
    const g = this.game;
    return this.modal((card, close) => {
      this.head(card, 'Save code');
      card.append(el('p', '', g.saveMode === 'local'
        ? 'Your island already saves on this device. You can also copy this code to keep a backup.'
        : 'This browser is not letting us save. Copy this code somewhere safe, then paste it here next time.'));
      const out = el('textarea', 'code'); out.readOnly = true; out.value = g.exportCode(); out.setAttribute('aria-label', 'Your save code');
      const copy = this.button('Copy code', { onClick: async () => {
        out.select();
        try { await navigator.clipboard.writeText(out.value); copy.textContent = 'Copied!'; }
        catch { try { document.execCommand('copy'); copy.textContent = 'Copied!'; } catch { copy.textContent = 'Select and copy'; } }
      } });
      card.append(out, el('div', 'row'));
      card.lastChild.append(copy);
      card.append(el('h2', '', 'Load a code'));
      const inp = el('textarea', 'code'); inp.placeholder = 'Paste a save code here'; inp.setAttribute('aria-label', 'Paste a save code');
      const msg = el('p', 'name-hint', '');
      const load = this.button('Load this island', { primary: true, onClick: async () => {
        const res = g.importCode(inp.value);
        if (!res.ok) { msg.textContent = res.error; return; }
        close(true);
      } });
      card.append(inp, msg, el('div', 'row')); card.lastChild.append(load);
    }, { pause: true, label: 'Save code' });
  }

  openCredits() {
    return this.modal(card => {
      this.head(card, 'Credits');
      const c = el('div', 'credits');
      const sec = (h, ...ps) => { c.append(el('h3', '', h)); ps.forEach(p => c.append(el('p', '', p))); };
      sec('Game design and assets', 'The Little Wildworks asset pack (original, made for this family project): the island, the eight creatures and the Keeper models, the textures, icons, title, sounds and story ideas.');
      sec('Code', 'Game code written by the build agent for this family project, following the asset pack brief.');
      sec('Three.js', 'Three.js r180 (MIT License), Copyright © 2010-2025 three.js authors. The full license text ships with the game in vendor/three/LICENSE.');
      sec('Game-making notes', 'Design guidance came from a game-development skill pack (Apache-2.0), used only as reading material.');
      sec('Title lettering', 'The title letters are outlines made from the DejaVu Sans Bold font (Bitstream Vera license; DejaVu changes are public domain). No font file is shipped.');
      sec('Pictures', 'All names, shapes, art and places were made for this game. No pictures from other games were used.');
      c.append(el('h3', '', 'Concept art from the asset pack'));
      const gal = el('div', 'gallery');
      for (const id of ['keeper', 'tumbletuft', 'foldfern', 'puddleloop', 'siltbell', 'whirli', 'kitefin', 'glintot', 'hushbulb']) {
        const im = el('img'); im.loading = 'lazy'; im.src = `assets/concept/${id}-concept.jpg`;
        im.alt = `${id === 'keeper' ? 'The Keeper' : this.game?.creatureDefs[id]?.name || id}: front, side and back concept sheet`; gal.append(im);
      }
      c.append(gal);
      sec('Thank you', 'Made by a dad, for his son, and for everyone who helps a tiny creature try a big idea.');
      card.append(c);
    }, { wide: true, pause: true, label: 'Credits' });
  }
}

export { el, $ };
