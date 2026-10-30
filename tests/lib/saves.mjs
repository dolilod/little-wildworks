// Save fixtures (SaveV1 shape) for tests that start mid-story.
export const SAVE_KEY = 'little-wildworks/save/v1';

export function friend(id, extra = {}) {
  return { baseId: id, nickname: '', friendship: 'friend', events: ['help:' + id], palette: {}, quirkId: '', ...extra };
}

export function makeSave({ friends = [], projects = [], selected = null, flags = [], position = [-17, 0, 10], finaleSeen = false, custom = [], variants = {} } = {}) {
  const f = {}; for (const id of friends) f[id] = friend(id);
  return {
    schemaVersion: 1, player: { position, displayName: 'Keeper' },
    friends: f, completedProjects: projects, encounterFlags: [...friends.map(id => 'help:' + id), 'seen:intro', 'rode:leaf_slide', ...flags],
    toyVariants: variants, selectedFriendId: selected ?? friends[0] ?? null, customFriends: custom,
    finale: { seen: finaleSeen, guestOfHonourId: null }, settings: { muted: true, reducedMotion: false, language: 'en' },
  };
}

/** Init script that seeds localStorage once (before the game boots). */
export function seed(save) {
  return { init: `try { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(save))}); sessionStorage.setItem('__seeded', '1'); } } catch (e) {}` };
}
