// The island: the pack's world kit plus ground textures, hedges, gates, water
// rules, decor, sky and lighting. Gameplay colliders live in CollisionWorld.
import * as THREE from 'three';
import { buildWorld, setProjectComplete, animateWorld } from './kit/world-kit.js';
import { CollisionWorld, NavGrid } from './nav.js';
import { PAL, mat, mesh, leafGeometry, RECIPES, instanced, rng, halo, iconSprite, radialTexture, tint, merge } from './props.js';

export const LAYOUT = Object.freeze({
  spawn: [-17, 0, 10],
  pond: { cx: 10, cz: -2, rx: 6, rz: 4.6 },
  river: [[10, -5.5], [12, -8], [10, -11], [11, -14], [11.7, -17.8]],
  meadowHedgeN: [[-12.4, 16.9], [-9.6, 13.6], [-7.7, 10.2], [-7.0, 7.6], [-6.9, 6.5]],
  meadowHedgeS: [[-6.9, 3.5], [-7.1, 2.4], [-7.8, 0], [-9.2, -2.5], [-10.6, -4.2]],
  meadowGate: [[-6.9, 6.35], [-6.9, 3.65]],
  duskHedgeW: [[-21.8, -7.4], [-16, -5.6], [-10.6, -4.2], [-6.5, -4.6], [-3.6, -4.95], [-2.65, -4.95]],
  duskGate: [[-2.5, -4.95], [0.25, -4.95]],
  duskHedgeE: [[0.4, -4.95], [1.6, -5.7], [3.6, -7.3], [7.5, -5.95]],
  // Lotus crossing (world): five kit pads + a side pad to the bell islet.
  // Overlapping ellipses: lotus pad 3 → side pad → islet form one continuous walkable route.
  // The islet keeps ~0.8 m of water from every shore, so the side pad is the only way on.
  sidePad: { cx: 12.35, cz: -2.7, rx: 0.95, rz: 1.3 },
  islet: { cx: 12.2, cz: -4.5, rx: 1.1, rz: 1.0 },
});

const ZONE_LABELS = { meadow: 'Tumble Meadow', pond: 'Button Pond', canopy: 'Crown Canopy', dusk: 'Lantern Rise' };

/** Sky/light presets for the island's afternoon-to-night journey. */
const SKY = [
  { sky: '#C9E6DD', fog: '#D5EBE2', hemiSky: '#FFF6DE', hemiGround: '#7C986A', hemi: 2.0, sun: '#FFFFFF', sunI: 2.2 },
  { sky: '#D3E6D2', fog: '#DCEBD9', hemiSky: '#FFF2D6', hemiGround: '#7C986A', hemi: 1.95, sun: '#FFF6E6', sunI: 2.15 },
  { sky: '#F1DDB6', fog: '#F2E2C2', hemiSky: '#FFE9C4', hemiGround: '#7C986A', hemi: 1.85, sun: '#FFE3B5', sunI: 2.05 },
  { sky: '#EDBD9F', fog: '#EEC8AE', hemiSky: '#FFD9B8', hemiGround: '#77708F', hemi: 1.7, sun: '#FFC9A3', sunI: 1.85 },
  { sky: '#A497B6', fog: '#ADA0BD', hemiSky: '#E9D2D8', hemiGround: '#5F5A78', hemi: 1.45, sun: '#FFC2A6', sunI: 1.35 },
  { sky: '#3F4C6E', fog: '#46537A', hemiSky: '#A9B5E8', hemiGround: '#3A3E58', hemi: 1.05, sun: '#C9D3FF', sunI: 0.75 },
];

export function buildIsland({ textures, completed = [] }) {
  const root = new THREE.Group(); root.name = 'island_root';
  const kit = buildWorld(THREE, { completed: [] });
  root.add(kit);
  const projects = {};
  for (const id of ['leaf_slide', 'lotus_steps', 'pinwheel_canopy', 'lantern_picnic']) projects[id] = kit.getObjectByName(id);
  kit.updateMatrixWorld(true);

  const col = new CollisionWorld({ boundary: { cx: 0, cz: 0, rx: 22.6, rz: 18.6 } });
  const occluders = [];
  const island = { root, kit, projects, collision: col, occluders, props: {}, zoneLabels: ZONE_LABELS };

  // --- Ground: textured, world-planar UVs so the tiles keep a steady scale.
  const tex = (t, rep) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.colorSpace = THREE.SRGBColorSpace; c.anisotropy = 4; c.needsUpdate = true; c.userData.rep = rep; return c; };
  const groundMat = (t, color = '#ffffff') => new THREE.MeshStandardMaterial({ map: t, color, roughness: 1, metalness: 0 });
  const ground = kit.getObjectByName('island_ground');
  ground.material = groundMat(tex(textures.meadow), '#f4f7ee'); planarUV(ground, 4.2);
  const meadowPatch = kit.getObjectByName('meadow_ground_patch');
  meadowPatch.material = groundMat(tex(textures.meadow), '#fff6dc'); planarUV(meadowPatch, 4.2);
  const duskPatch = kit.getObjectByName('dusk_ground_patch');
  duskPatch.material = groundMat(tex(textures.dusk), '#ffffff'); planarUV(duskPatch, 4.2);
  const bank = mesh(new THREE.CylinderGeometry(1, 1, 0.03, 28), 'aqua', { material: groundMat(tex(textures.pond), '#ffffff'), pos: [10, 0.012, -2], scale: [7.4, 1, 6.0], name: 'pond_bank' });
  kit.getObjectByName('zone_pond').add(bank); planarUV(bank, 3.2);
  const water = kit.getObjectByName('pond_water');
  water.material = new THREE.MeshStandardMaterial({ color: '#8FCFC4', roughness: 0.55, metalness: 0, flatShading: true });
  kit.getObjectByName('painted_river').material = water.material;

  // Sea around the island, with a soft foam ring at the cliff.
  const sea = mesh(new THREE.CircleGeometry(90, 48).rotateX(-Math.PI / 2), '#8CC9C0', { pos: [0, -0.95, 0], name: 'sea' });
  sea.material = new THREE.MeshStandardMaterial({ color: '#86C4BD', roughness: 0.7, metalness: 0 });
  root.add(sea);
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.07, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#F6EEDC', transparent: true, opacity: 0.55, depthWrite: false }));
  foam.scale.set(24, 1, 20); foam.position.y = -0.93; foam.name = 'foam'; root.add(foam);
  island.foam = foam;

  // River extension to the island edge (kit river stops at z=-14).
  const riverTail = riverSurface([[11, -14], [11.7, -17.8], [11.9, -19.6]], 0.9, 0.055);
  riverTail.material = water.material; kit.getObjectByName('zone_pond').add(riverTail);
  // Move the stepping stone that sat inside the pond onto the dry bank.
  const tile9 = kit.getObjectByName('path_tile_9'); if (tile9) tile9.position.set(2.7, 0.075, -3.4);

  // --- Water rules.
  const P = LAYOUT.pond;
  col.waterEllipse('pond', P.cx, P.cz, P.rx, P.rz, 'pond');
  for (let i = 0; i < LAYOUT.river.length - 1; i++) {
    const [a, b] = [LAYOUT.river[i], LAYOUT.river[i + 1]];
    col.waterCapsule('river_' + i, a[0], a[1], b[0], b[1], 1.0, 'river');
  }
  const lotus = projects.lotus_steps;
  const padCenters = [[-4.6, -2.4], [-2.3, -1.2], [0, 0], [2.3, 1.2], [4.6, 2.4]].map(([x, z]) => [x + 10, z - 2]);
  island.padCenters = padCenters;
  padCenters.forEach(([x, z], i) => col.pad('lotus_pad_' + i, x, z, 1.65, 1.2, 'lotus', false));
  // Invisible connectors between neighbouring pads: the painted pads overlap only a little,
  // and a child steering with a thumb should never get caught on a narrow neck of water.
  for (let i = 0; i < padCenters.length - 1; i++) {
    const [a, b] = [padCenters[i], padCenters[i + 1]];
    col.pad('lotus_link_' + i, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1.0, 0.95, 'lotus', false);
  }
  col.pad('side_pad', LAYOUT.sidePad.cx, LAYOUT.sidePad.cz, LAYOUT.sidePad.rx, LAYOUT.sidePad.rz, 'lotus', false);
  col.pad('islet', LAYOUT.islet.cx, LAYOUT.islet.cz, LAYOUT.islet.rx, LAYOUT.islet.rz, 'islet', true);
  // Side pad + islet visuals (the side pad rises with the lotus project).
  const sidePad = new THREE.Group(); sidePad.name = 'side_pad'; sidePad.position.set(LAYOUT.sidePad.cx, 0.2, LAYOUT.sidePad.cz);
  sidePad.add(mesh(new THREE.CylinderGeometry(1, 1, 0.12, 8), 'moss', { scale: [LAYOUT.sidePad.rx, 1, LAYOUT.sidePad.rz] }));
  sidePad.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), 'cream', { pos: [0, 0.07, 0], rot: [Math.PI / 2, 0, 0.9] }));
  sidePad.visible = false; kit.getObjectByName('zone_pond').add(sidePad);
  const islet = new THREE.Group(); islet.name = 'bell_islet'; islet.position.set(LAYOUT.islet.cx, 0, LAYOUT.islet.cz);
  islet.add(mesh(new THREE.CylinderGeometry(1, 1.12, 0.2, 10), '#C9B48F', { pos: [0, 0.06, 0], scale: [LAYOUT.islet.rx, 1, LAYOUT.islet.rz] }));
  islet.add(mesh(new THREE.CylinderGeometry(1, 1, 0.04, 10), 'moss', { pos: [0, 0.17, 0], scale: [LAYOUT.islet.rx * 0.82, 1, LAYOUT.islet.rz * 0.8] }));
  kit.getObjectByName('zone_pond').add(islet);
  island.props.sidePad = sidePad;
  island.lotusPads = padCenters.map((_, i) => lotus.getObjectByName('floating_pad_' + i));
  island.lotusPads.forEach(p => { p.userData.motion = null; p.userData.dip = 0; p.userData.dipV = 0; });

  // --- Solid colliders from the kit hints.
  // The kit tree at (-14,12) hid Tumbletuft's practice leaf from the fixed camera; nudge it back.
  const t2 = kit.getObjectByName('tree_2'); if (t2) t2.position.set(-12.7, 0, 14.3);
  const c2 = kit.userData.colliders.find(c => c.id === 'tree_2'); if (c2) c2.center = [-12.7, 14.3];
  for (const c of kit.userData.colliders) col.circle(c.id, c.center[0], c.center[1], c.radius + 0.15, 'scenery');
  const slide = projects.leaf_slide;
  col.capsule('slide_buds', -13.7, 5, -10.3, 5, 0.42, 'slide_unfinished');
  col.capsule('slide_body', -14.4, 5, -9.7, 5, 0.86, 'slide_finished'); col.setActive('slide_finished', false);
  [[-2.7, -2], [2.7, -2], [-2.7, 2], [2.7, 2]].forEach(([x, z], i) => col.circle('canopy_post_' + i, x, z + 1, 0.22, 'scenery'));
  col.aabb('bench_0', -4.45, -10.95, -3.75, -9.05, 'scenery');
  col.aabb('bench_1', -0.25, -10.95, 0.45, -9.05, 'scenery');
  [[-2.6, -1.8], [2.6, -1.8], [-2.6, 1.8], [2.6, 1.8]].forEach(([x, z], i) => col.circle('lantern_post_' + i, x - 2, z - 10, 0.14, 'scenery'));

  // --- Hedges (instanced) with capsule colliders, plus the two gates.
  const bushItems = [], duskBushItems = [];
  const R = rng(7);
  const hedge = (pts, items, tag) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      col.capsule(`${tag}_${i}`, a[0], a[1], b[0], b[1], 0.5, tag);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 0.8));
      for (let k = 0; k < n; k++) {
        const u = (k + R() * 0.3) / n;
        items.push({ x: a[0] + (b[0] - a[0]) * u + (R() - 0.5) * 0.22, z: a[1] + (b[1] - a[1]) * u + (R() - 0.5) * 0.22,
          ry: R() * 6.28, s: 0.92 + R() * 0.32, sy: 0.85 + R() * 0.35, tint: R() < 0.2 ? '#e8f0d8' : '#ffffff' });
      }
    }
  };
  hedge(LAYOUT.meadowHedgeN, bushItems, 'hedge'); hedge(LAYOUT.meadowHedgeS, bushItems, 'hedge');
  hedge(LAYOUT.duskHedgeW, duskBushItems, 'hedge'); hedge(LAYOUT.duskHedgeE, duskBushItems, 'hedge');
  root.add(instanced(RECIPES.bush(), bushItems, { name: 'hedge_meadow' }));
  root.add(instanced(RECIPES.duskBush(), duskBushItems, { name: 'hedge_dusk' }));

  island.gates = {
    meadow: buildMeadowGate(root, col),
    dusk: buildDuskGate(root, col),
  };

  // --- Decor: flowers, tufts, reeds, mushrooms and pebbles (deterministic).
  scatterDecor(root, col);

  // --- Occluders that fade when they hide the Keeper (tall roofs, posts, lamps, crowns).
  // Each gets its own material copy so fading never touches other meshes sharing a colour.
  const occluderSet = new Set();
  island.addOccluder = obj => obj.traverse(n => {
    if (!n.isMesh || occluderSet.has(n)) return;
    occluderSet.add(n); n.material = n.material.clone(); n.material.userData.baseOpacity = 1; occluders.push(n);
  });
  kit.traverse(n => {
    if (!n.isMesh) return;
    if (/^(folded_crown|trunk|folded_canopy_panel_|canopy_post_|pinwheel_axle|blade_|hub|leaf_slide_surface|leaf_rail_|grown_stem|welcome_leaf|lantern_post_|unlit_seed_|lit_seed_)/.test(n.name)) {
      island.addOccluder(n);
      if (n.name === 'leaf_slide_surface') n.material.color.set('#A9C77E'); // same light leaf as the practice ramp
    }
  });
  island.addOccluder(island.gates.dusk.group);

  // --- Lights + sky.
  const hemi = new THREE.HemisphereLight('#FFF6DE', '#7C986A', 2.0);
  const sun = new THREE.DirectionalLight('#FFFFFF', 2.2); sun.position.set(-12, 26, 16);
  root.add(hemi, sun);
  island.lights = { hemi, sun };
  island.sky = { stage: 0, cur: { ...lerpSky(SKY[0], SKY[0], 0) }, from: SKY[0], to: SKY[0], u: 1, duskBlend: 0 };

  // Stars + moon for the finale night (hidden until the sky is night).
  island.night = buildNight(root);

  // Apply initial completion visuals instantly.
  for (const id of completed) setComplete(island, id, true);

  island.nav = new NavGrid(col);
  island.heightAt = (x, z) => heightAt(island, x, z);
  island.zoneAt = zoneAt;
  island.setComplete = (id, v) => setComplete(island, id, v);
  island.update = (t, dt, focus) => updateIsland(island, t, dt, focus);
  island.setSkyStage = (s, instant) => setSkyStage(island, s, instant);
  island.skyPresets = SKY;
  return island;
}

/** Visual + collision completion for one project. Gate opening is animated by the story. */
function setComplete(island, id, value) {
  const p = island.projects[id];
  setProjectComplete(p, value);
  const col = island.collision;
  if (id === 'leaf_slide') { col.setActive('slide_unfinished', !value); col.setActive('slide_finished', value); }
  if (id === 'lotus_steps') { col.setActive('lotus', value); island.props.sidePad.visible = value; }
  if (id === 'pinwheel_canopy') {
    const rotor = p.getObjectByName('spinning_pinwheel'); if (rotor) rotor.userData.motion = null;
  }
}

function planarUV(m, tile) {
  m.geometry = m.geometry.clone();
  m.updateWorldMatrix(true, false);
  const pos = m.geometry.attributes.position, uv = new Float32Array(pos.count * 2), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    uv[i * 2] = v.x / tile; uv[i * 2 + 1] = -v.z / tile;
  }
  m.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function riverSurface(points, half, y) {
  const verts = [], idx = [];
  points.forEach(([x, z], i) => { verts.push(x - half, y, z, x + half, y, z); });
  for (let i = 0; i < points.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g); m.name = 'river_tail'; return m;
}

function buildMeadowGate(root, col) {
  // A big sleepy leaf flopped across the gap. Opening: it yawns up into an arch.
  const [a, b] = LAYOUT.meadowGate;
  const g = new THREE.Group(); g.name = 'meadow_gate'; g.position.set(a[0], 0, (a[1] + b[1]) / 2);
  const hinge = new THREE.Group(); hinge.name = 'gate_leaf_hinge'; hinge.position.set(0, 0.05, 1.45); hinge.rotation.order = 'YXZ'; g.add(hinge);
  const leafMat = mat('moss');
  const leaf = new THREE.Mesh(leafGeometry(0.28), leafMat); leaf.name = 'gate_leaf';
  leaf.scale.set(1.25, 2.9, 1.2); leaf.rotation.set(-(Math.PI / 2 - 0.08), 0, 0); hinge.add(leaf);
  const rib = mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.7, 5), 'teal', { pos: [0, 0.16, -1.35], rot: [-(Math.PI / 2 - 0.08), 0, 0] }); hinge.add(rib);
  const zz = mesh(new THREE.IcosahedronGeometry(0.11, 0), 'cream', { pos: [0.25, 0.75, -0.6] }); zz.name = 'gate_snore'; g.add(zz);
  [[-1.55], [1.55]].forEach(([z], i) => g.add(mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.8, 6), 'teal', { pos: [0, 0.4, z], name: 'gate_stump_' + i })));
  root.add(g);
  col.capsule('gate_meadow', a[0], a[1], b[0], b[1], 0.45, 'gate_meadow');
  return { group: g, hinge, leaf, snore: zz, open: false, u: 0, tag: 'gate_meadow', label: 'meadow' };
}

function buildDuskGate(root, col) {
  const [a, b] = LAYOUT.duskGate;
  const g = new THREE.Group(); g.name = 'dusk_gate'; g.position.set((a[0] + b[0]) / 2, 0, a[1]);
  const half = (b[0] - a[0]) / 2;
  const lamps = {};
  const doors = [];
  [[-half, 'splash', 'teal'], [half, 'gust', 'aqua']].forEach(([x, el, color], i) => {
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.1, 6), 'cream', { pos: [x, 1.05, 0], name: 'dusk_gate_post_' + i }));
    const lamp = mesh(new THREE.IcosahedronGeometry(1, 0), 'twilight', { pos: [x, 2.3, 0], scale: [0.24, 0.32, 0.24], name: 'gate_lamp_' + el, material: mat('twilight', { unique: true }) });
    g.add(lamp);
    const h = halo(color, 1.6, 0); h.position.set(x, 2.3, 0.05); g.add(h);
    const icon = iconSprite(`assets/ui/element-${el}.svg`, 0.62); icon.position.set(x, 2.95, 0); g.add(icon);
    lamps[el] = { lamp, halo: h, icon, lit: false, color };
    const hinge = new THREE.Group(); hinge.position.set(x + (i ? -0.1 : 0.1), 0, 0); g.add(hinge);
    const door = new THREE.Mesh(leafGeometry(0.2), mat('twilight', { side: THREE.DoubleSide }));
    door.scale.set(1.15, 1.25, 1); door.rotation.set(0, 0, i ? Math.PI / 2 : -Math.PI / 2); door.position.set(0, 0.85, 0);
    hinge.add(door);
    const door2 = new THREE.Mesh(leafGeometry(0.2), mat('#5f5a78', { side: THREE.DoubleSide }));
    door2.scale.set(0.8, 1.0, 1); door2.rotation.set(0, 0, i ? Math.PI / 2 : -Math.PI / 2); door2.position.set(0, 0.35, 0.02);
    hinge.add(door2);
    doors.push({ hinge, dir: i ? 1 : -1 });
  });
  root.add(g);
  col.capsule('gate_dusk', a[0], a[1], b[0], b[1], 0.45, 'gate_dusk');
  return { group: g, lamps, doors, open: false, u: 0, tag: 'gate_dusk', label: 'dusk' };
}

function scatterDecor(root, col) {
  const R = rng(42);
  const flowers = { cream: [], clay: [], amber: [] }, tufts = [], reeds = [], mush = { clay: [], amber: [] }, pebbles = [];
  const clearOf = (x, z, r, extra = []) => {
    if (col.blocked(x, z, r)) return false;
    if (col.inWater(x, z, -0.6)) return false;
    for (const [ex, ez, er] of extra) if (Math.hypot(x - ex, z - ez) < er) return false;
    return true;
  };
  // Keep play spaces clear: sockets, toys, encounter spots, paths.
  const keepClear = [
    [-12, 5, 4.2], [-12, 7.8, 1.6], [-16, 8, 2.2], [-14.6, 8.2, 1.8], [-5, 4, 1.8], [0, 1, 4.2], [-2, -10, 5.2], [-6, -7, 2.2],
    [3, -13, 2.0], [3.5, -5.2, 1.6], [4, 5, 1.6], [-17, 10, 1.4], [16.5, 1.2, 1.4], [-15.5, 2.6, 1.6], [1.8, -6.6, 1.2],
    [-8, 5, 1.4], [-6, 4, 1.2], [-5, 8, 1.0], [-3, 5, 1.0], [0, -2, 1.0], [-1, -5, 1.4], [-2, -7, 1.0], [4, 1, 1.0],
    [-8.4, 3.9, 1.1], [-8.4, 6.1, 1.1], [2.7, -3.4, 1.0], [-8.4, -7.6, 1.0], [-5.2, -6.2, 1.0],
  ];
  for (let i = 0; i < 2600 && (tufts.length < 260 || flowers.cream.length < 70); i++) {
    const x = (R() - 0.5) * 46, z = (R() - 0.5) * 38;
    if (!clearOf(x, z, 0.3, keepClear)) continue;
    const dusk = z < -5.2 && x < 11;
    if (dusk) {
      if (R() < 0.35 && mush.clay.length + mush.amber.length < 70) (R() < 0.5 ? mush.clay : mush.amber).push({ x, z, ry: R() * 6, s: 0.8 + R() * 0.9 });
      else if (tufts.length < 260) tufts.push({ x, z, ry: R() * 6, s: 0.8 + R() * 0.5, tint: '#c9c2df' });
    } else if (R() < 0.3) {
      const c = ['cream', 'clay', 'amber'][Math.floor(R() * 3)];
      if (flowers[c].length < 40) flowers[c].push({ x, z, ry: R() * 6, s: 0.9 + R() * 0.7 });
    } else if (tufts.length < 260) tufts.push({ x, z, ry: R() * 6, s: 0.8 + R() * 0.7 });
    if (R() < 0.08 && pebbles.length < 60) pebbles.push({ x: x + 0.4, z: z - 0.3, ry: R() * 6, s: 0.6 + R() * 0.9 });
  }
  // Reeds hug the pond and river banks.
  const P = LAYOUT.pond;
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, k = 1.02 + R() * 0.12;
    const x = P.cx + Math.cos(a) * P.rx * k, z = P.cz + Math.sin(a) * P.rz * k;
    if (clearOf(x, z, 0.2, keepClear) && Math.hypot(x - 3.5, z + 5.2) > 2) reeds.push({ x, z, ry: R() * 6, s: 0.7 + R() * 0.6 });
  }
  for (let i = 0; i < LAYOUT.river.length - 1; i++) {
    const [a, b] = [LAYOUT.river[i], LAYOUT.river[i + 1]];
    for (let k = 0; k < 6; k++) {
      const u = R(), side = R() < 0.5 ? -1 : 1, x = a[0] + (b[0] - a[0]) * u + side * (1.15 + R() * 0.3), z = a[1] + (b[1] - a[1]) * u;
      if (!col.outsideBoundary(x, z, 0.3)) reeds.push({ x, z, ry: R() * 6, s: 0.6 + R() * 0.5 });
    }
  }
  const add = (geo, items, name) => { if (items.length) root.add(instanced(geo, items, { name })); };
  add(RECIPES.tuft(), tufts, 'decor_tufts');
  add(RECIPES.flower('cream'), flowers.cream, 'decor_flowers_cream');
  add(RECIPES.flower('clay'), flowers.clay, 'decor_flowers_clay');
  add(RECIPES.flower('amber'), flowers.amber, 'decor_flowers_amber');
  add(RECIPES.reed(), reeds, 'decor_reeds');
  add(RECIPES.mushroom('clay'), mush.clay, 'decor_mushrooms_clay');
  add(RECIPES.mushroom('amber'), mush.amber, 'decor_mushrooms_amber');
  add(RECIPES.pebble(), pebbles, 'decor_pebbles');
  // Little lily pads drifting on the pond, kept off the lotus route, the islet and Puddleloop's corner.
  const lilies = [], avoid = [[5.4, -4.4], [7.7, -3.2], [10, -2], [12.3, -0.8], [14.6, 0.4], [12.35, -2.7], [12.2, -4.5], [5.6, -1.2], [5.75, 0.95]];
  for (let i = 0; i < 200 && lilies.length < 12; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.82, x = P.cx + Math.cos(a) * P.rx * r, z = P.cz + Math.sin(a) * P.rz * r;
    if (avoid.some(([ax, az]) => Math.hypot(x - ax, z - az) < 2.0)) continue;
    lilies.push({ x, y: 0.075, z, ry: R() * 6.28, s: 0.6 + R() * 0.5, tint: R() < 0.3 ? '#cfe3b8' : '#ffffff' });
  }
  // A round pad with a little notch and a tiny cream bud.
  const lily = merge([
    tint(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 9, 1, false, 0.35, Math.PI * 2 - 0.7), 'moss'),
    tint(new THREE.IcosahedronGeometry(0.06, 0), 'cream', { pos: [0.12, 0.05, 0.08] }),
  ]);
  add(lily, lilies, 'decor_lilies');
}

function buildNight(root) {
  const g = new THREE.Group(); g.name = 'night_sky'; g.visible = false;
  const R = rng(99), pts = [];
  for (let i = 0; i < 160; i++) pts.push((R() - 0.5) * 120, 14 + R() * 12, (R() - 0.5) * 120 - 20);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#F6EEDC', size: 0.35, map: radialTexture('soft'), transparent: true, depthWrite: false, opacity: 0 }));
  g.add(stars); root.add(g);
  return { group: g, stars };
}

function lerpSky(a, b, u) {
  const c = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), u);
  return {
    sky: c(a.sky, b.sky), fog: c(a.fog, b.fog), hemiSky: c(a.hemiSky, b.hemiSky), hemiGround: c(a.hemiGround, b.hemiGround),
    hemi: a.hemi + (b.hemi - a.hemi) * u, sun: c(a.sun, b.sun), sunI: a.sunI + (b.sunI - a.sunI) * u,
  };
}

function setSkyStage(island, stage, instant = false) {
  const s = island.sky; stage = Math.max(0, Math.min(SKY.length - 1, stage));
  if (stage === s.stage && s.u >= 1) return;
  s.from = s.u >= 1 ? SKY[s.stage] : snapshot(s.cur); s.to = SKY[stage]; s.stage = stage; s.u = instant ? 1 : 0;
  if (instant) s.cur = lerpSky(s.to, s.to, 0);
}
function snapshot(cur) {
  return { sky: '#' + cur.sky.getHexString(), fog: '#' + cur.fog.getHexString(), hemiSky: '#' + cur.hemiSky.getHexString(),
    hemiGround: '#' + cur.hemiGround.getHexString(), hemi: cur.hemi, sun: '#' + cur.sun.getHexString(), sunI: cur.sunI };
}

function heightAt(island, x, z) {
  const col = island.collision;
  const pad = col.onPad(x, z, -0.05);
  if (pad) {
    if (pad.id === 'islet') return 0.19;
    if (pad.id === 'side_pad') return 0.27;
    const i = Number(pad.id.slice(-1)); const p = island.lotusPads[i];
    return p ? p.position.y + 0.07 : 0.27;
  }
  // Pinwheel lift (world centre 3.7, 1).
  if (island.projects.pinwheel_canopy.userData.complete && Math.hypot(x - 3.7, z - 1) < 0.72) {
    const lift = island.projects.pinwheel_canopy.getObjectByName('gentle_lift');
    return lift ? lift.position.y + 0.08 : 0;
  }
  return 0;
}

export function zoneAt(x, z) {
  if (z < -5.1 && x < 11.2 && !(x > 4 && z > -7)) return 'dusk';
  const P = LAYOUT.pond;
  if (((x - P.cx) / (P.rx + 3.5)) ** 2 + ((z - P.cz) / (P.rz + 3.5)) ** 2 < 1 || x > 11.2) return 'pond';
  if (x < -6.9 || (x < -4 && z > 6)) return 'meadow';
  if (Math.hypot(x, z - 1) < 6.5) return 'canopy';
  return x < 0 ? 'meadow' : 'canopy';
}

function updateIsland(island, t, dt, focus) {
  animateWorld(island.kit, t);
  // Lotus pads: gentle bob plus a springy dip when stepped on.
  island.lotusPads.forEach((p, i) => {
    const u = p.userData; u.dipV += (-u.dip * 90 - u.dipV * 9) * dt; u.dip += u.dipV * dt;
    p.position.y = 0.2 + Math.sin(t * 1.5 + i * 0.65) * 0.03 + u.dip;
  });
  // Sky blend.
  const s = island.sky;
  if (s.u < 1) { s.u = Math.min(1, s.u + dt / 3.5); s.cur = lerpSky(s.from, s.to, smooth(s.u)); }
  const zone = focus ? zoneAt(focus.x, focus.z) : 'meadow';
  const targetDusk = zone === 'dusk' ? 1 : 0;
  s.duskBlend += (targetDusk - s.duskBlend) * (1 - Math.exp(-dt * 1.6));
  const { hemi, sun } = island.lights;
  const duskTint = new THREE.Color('#9A8FB4');
  hemi.color.copy(s.cur.hemiSky); hemi.groundColor.copy(s.cur.hemiGround); hemi.intensity = s.cur.hemi * (1 - 0.12 * s.duskBlend);
  sun.color.copy(s.cur.sun).lerp(new THREE.Color('#FFD1B8'), s.duskBlend * 0.4); sun.intensity = s.cur.sunI * (1 - 0.18 * s.duskBlend);
  island.skyColor = s.cur.sky.clone().lerp(duskTint, s.duskBlend * 0.28);
  island.fogColor = s.cur.fog.clone().lerp(duskTint, s.duskBlend * 0.32);
  const night = island.night, nightU = Math.max(0, (s.stage === 5 ? smooth(s.u) : 0));
  night.group.visible = nightU > 0.01; night.stars.material.opacity = nightU * 0.95;
  // Gates.
  for (const gate of Object.values(island.gates)) {
    const target = gate.open ? 1 : 0;
    if (gate.u !== target) {
      gate.u = target > gate.u ? Math.min(1, gate.u + dt / 1.4) : Math.max(0, gate.u - dt / 1.4);
      poseGate(gate, gate.u);
    }
    if (gate.label === 'meadow' && !gate.open) {
      gate.snore.position.y = 0.75 + (t * 0.35 % 1) * 0.6; gate.snore.scale.setScalar(0.4 + (t * 0.35 % 1) * 0.9);
    }
  }
  const dusk = island.gates.dusk;
  for (const L of Object.values(dusk.lamps)) {
    const want = L.lit ? 1 : 0; L.k = (L.k || 0) + (want - (L.k || 0)) * (1 - Math.exp(-dt * 3));
    L.lamp.material.color.set(PAL.twilight).lerp(new THREE.Color(PAL[L.color]), L.k);
    L.lamp.material.emissive.set(PAL[L.color]); L.lamp.material.emissiveIntensity = L.k * (0.5 + Math.sin(t * 2.4) * 0.08);
    L.halo.material.opacity = L.k * 0.55;
  }
}

export function poseGate(gate, u) {
  const e = easeOutBack(u);
  if (gate.label === 'meadow') {
    // Leaf yawns up and swings into the meadow like a door held open.
    gate.hinge.rotation.x = e * 0.95;
    gate.hinge.rotation.y = e * 1.45;
    gate.snore.visible = u < 0.05;
  } else {
    gate.doors.forEach(d => { d.hinge.rotation.y = d.dir * e * 1.9; });
  }
}

const smooth = u => u * u * (3 - 2 * u);
export function easeOutBack(u) { const c1 = 1.4, c3 = c1 + 1; return u <= 0 ? 0 : u >= 1 ? 1 : 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
