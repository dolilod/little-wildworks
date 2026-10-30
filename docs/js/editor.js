// "My Friend" editor (P1.2): choose one befriended roster slot, then give that
// body a palette.json colour scheme, a name and one supported quirk. It replaces
// that slot's look (no ninth creature), keeps its element, and survives reload.
import { NAMES, QUIRKS, DEFAULT_QUIRK, ELEMENT_TEXT } from './content.js';
import { sanitizeName } from './save.js';
import { SPECIES } from './actors.js';
import { PAL } from './props.js';

const BODY_COLOURS = ['cream', 'clay', 'amber', 'moss', 'teal', 'aqua', 'twilight'];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export async function openFriendEditor(ui) {
  const g = ui.game, friends = g.friendIds();
  if (!friends.length) { ui.toast('Make a friend first!'); return; }
  const existing = g.progress.customFriends[0];
  // Step 1: which friend becomes "My Friend"?
  const slot = existing?.baseId && g.progress.friends[existing.baseId] ? existing.baseId : await ui.modal((card, close) => {
    ui.head(card, 'My Friend');
    card.append(el('p', '', 'Pick one friend to make your very own: new colours, a new name and a favourite habit.'));
    card.append(ui.rosterCards(id => close(id), { onlyFriends: true }));
  }, { wide: true, pause: true, label: 'My Friend: pick a friend' });
  if (!slot) return;
  return editSlot(ui, slot);
}

function editSlot(ui, id) {
  const g = ui.game, actor = g.actors[id], def = g.creatureDefs[id], spec = SPECIES[id];
  const existing = g.progress.customFriends[0]?.baseId === id ? g.progress.customFriends[0] : null;
  const original = existing ? { ...existing.palette } : { ...(g.progress.friends[id].palette || {}) };
  const state = {
    body: existing?.palette?.[spec.primary] || spec.primary,
    trim: existing?.palette?.[spec.secondary] || spec.secondary,
    name: existing?.nickname || g.progress.friends[id].nickname || '',
    quirk: existing?.quirkId || DEFAULT_QUIRK[id],
  };
  const palette = () => ({ [spec.primary]: state.body, [spec.secondary]: state.trim });
  return ui.modal((card, close) => {
    ui.head(card, `My Friend: ${def.name}`);
    const wrap = el('div', 'editor');
    const left = el('div'); const preview = el('img', 'portrait preview'); preview.alt = 'Preview of your friend';
    left.append(preview);
    left.append(el('p', 'name-hint', `${ELEMENT_TEXT[def.element]} friend · ${def.abilityName}. Its power stays the same.`));
    const right = el('div');
    const refresh = () => { actor.applyPalette(palette()); preview.src = ui.portraits.render(actor); };
    const swatches = (label, key, exclude) => {
      right.append(el('h3', '', label));
      const row = el('div', 'swatches');
      for (const c of BODY_COLOURS) {
        if (c === exclude) continue;
        const b = el('button', 'swatch'); b.type = 'button'; b.style.background = PAL[c]; b.setAttribute('aria-label', `${label}: ${c}`);
        b.setAttribute('aria-pressed', String(state[key] === c));
        b.addEventListener('click', () => { state[key] = c; row.querySelectorAll('.swatch').forEach(x => x.setAttribute('aria-pressed', String(x === b))); g.audio.tick(); refresh(); });
        row.append(b);
      }
      right.append(row);
    };
    swatches('Body colour', 'body'); swatches('Trim colour', 'trim');
    right.append(el('h3', '', 'Name'));
    const input = el('input', 'name-input'); input.maxLength = 16; input.value = state.name; input.placeholder = def.name; input.setAttribute('aria-label', 'Friend name'); input.autocomplete = 'off'; input.spellcheck = false;
    const chips = el('div', 'chips'); chips.style.margin = '6px 0';
    for (const n of NAMES[id]) { const c = el('button', 'chip-btn', n); c.type = 'button'; c.addEventListener('click', () => { input.value = n; g.audio.tick(); }); chips.append(c); }
    const hint = el('p', 'name-hint', 'Up to 16 letters. Kind names only.');
    right.append(input, chips, hint);
    right.append(el('h3', '', 'Favourite habit'));
    const quirks = el('div', 'chips');
    for (const q of QUIRKS) {
      const c = el('button', 'chip-btn', q.label); c.type = 'button'; c.setAttribute('aria-pressed', String(state.quirk === q.id));
      c.addEventListener('click', () => { state.quirk = q.id; quirks.querySelectorAll('.chip-btn').forEach(x => x.setAttribute('aria-pressed', String(x === c))); g.audio.tick(); });
      quirks.append(c);
    }
    right.append(quirks);
    wrap.append(left, right); card.append(wrap);
    const row = el('div', 'row');
    if (existing) row.append(ui.button('Back to normal', { cls: 'teal', onClick: () => {
      g.progress.customFriends = []; actor.applyPalette(g.progress.friends[id].palette || {});
      g.portraitVersion[id] = (g.portraitVersion[id] || 0) + 1; g.save('custom'); g.emit('friends'); close('reset');
    } }));
    row.append(ui.button('Cancel', { onClick: () => { actor.applyPalette(original); close(null); } }));
    row.append(ui.button('Save my friend', { primary: true, onClick: () => {
      const raw = input.value.trim(), name = raw ? sanitizeName(raw) : '';
      if (raw && !name) { hint.textContent = 'Let us pick a different, kind name.'; input.focus(); return; }
      const f = g.progress.friends[id];
      g.progress.customFriends = [{ baseId: id, nickname: name, friendship: f.friendship, events: [...f.events], palette: palette(), quirkId: state.quirk }];
      g.portraitVersion[id] = (g.portraitVersion[id] || 0) + 1;
      g.selectFriend(id);
      g.save('custom'); g.emit('friends');
      close('saved');
    } }));
    card.append(row);
    refresh();
  }, { wide: true, pause: true, dismissible: false, label: 'My Friend editor' }).then(result => {
    if (result === 'saved') {
      ui.toast(`Meet your friend, ${g.displayName(id)}!`, { icon: 'assets/ui/item-seed.svg', dur: 3000 });
      actor.perform('bigHappy'); setTimeout(() => g.quirk(actor), 1200);
      g.fx.sparkle(actor.x, 1, actor.z, { count: 18 });
    }
    return result;
  });
}
