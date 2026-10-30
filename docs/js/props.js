// Small handmade prop builders that share the pack's palette and flat-shaded
// matte material language. Everything is built from code; no extra assets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = Object.freeze({
  ink: '#243746', cream: '#F6EEDC', clay: '#D97B60', amber: '#E6B85C',
  moss: '#7C986A', teal: '#5AA9A0', aqua: '#AED8CF', twilight: '#77708F',
});

const matCache = new Map();
/** Shared matte material (do not mutate; use mat(..., {unique:true}) for fades). */
export function mat(color, { glow = 0, unique = false, vertexColors = false, side } = {}) {
  const hex = PAL[color] || color;
  const key = `${hex}|${glow}|${vertexColors}|${side || 0}`;
  if (!unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: vertexColors ? '#ffffff' : hex, roughness: 0.92, metalness: 0, flatShading: true,
    emissive: glow ? hex : '#000000', emissiveIntensity: glow, vertexColors,
  });
  if (side !== undefined) m.side = side;
  if (!unique) matCache.set(key, m);
  return m;
}

export function mesh(geo, color, opts = {}) {
  const m = new THREE.Mesh(geo, opts.material || mat(color, opts));
  if (opts.name) m.name = opts.name;
  if (opts.pos) m.position.fromArray(opts.pos);
  if (opts.rot) m.rotation.fromArray(opts.rot);
  if (opts.scale) Array.isArray(opts.scale) ? m.scale.fromArray(opts.scale) : m.scale.setScalar(opts.scale);
  return m;
}

/** Folded-leaf surface (same 5-vertex construction as the world kit). */
export function leafGeometry(fold = 0.16) {
  const v = [[0, 0, 0], [-0.5, 0.45, 0], [0, 1, 0], [0.5, 0.45, 0], [0, 0.45, fold]];
  const f = [[0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0], [0, 2, 3], [0, 1, 2]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(f.flatMap(t => t.flatMap(i => v[i])), 3));
  g.computeVertexNormals(); return g;
}

/** Bake a solid colour into a (non-indexed) geometry so pieces can be merged. */
export function tint(geo, color, { pos, rot, scale } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...(pos || [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))),
    new THREE.Vector3(...(Array.isArray(scale) ? scale : [scale ?? 1, scale ?? 1, scale ?? 1])));
  g.applyMatrix4(m);
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(PAL[color] || color); // Color.set converts sRGB hex to linear already
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}
export function merge(parts) { const g = mergeGeometries(parts, false); g.computeBoundingSphere(); return g; }

const ico0 = new THREE.IcosahedronGeometry(1, 0);
const ico1 = new THREE.IcosahedronGeometry(1, 1);
const oct = new THREE.OctahedronGeometry(1, 0);
const leafG = leafGeometry();

/** Instanced decor recipes; each returns a merged vertex-coloured geometry. */
export const RECIPES = {
  bush: () => merge([
    tint(ico0, 'moss', { pos: [0, 0.42, 0], scale: [0.62, 0.5, 0.55] }),
    tint(ico0, 'moss', { pos: [0.36, 0.32, 0.12], scale: [0.42, 0.36, 0.4], rot: [0.3, 0.5, 0] }),
    tint(ico0, 'teal', { pos: [-0.34, 0.3, -0.08], scale: [0.44, 0.38, 0.42], rot: [0.1, 1.1, 0.2] }),
    tint(leafG, 'moss', { pos: [0.05, 0.7, 0.05], scale: [0.35, 0.42, 0.35], rot: [-0.2, 0.4, 0.1] }),
  ]),
  duskBush: () => merge([
    tint(ico0, 'twilight', { pos: [0, 0.44, 0], scale: [0.6, 0.52, 0.55] }),
    tint(ico0, '#5f5a78', { pos: [0.36, 0.32, 0.1], scale: [0.42, 0.36, 0.4], rot: [0.3, 0.5, 0] }),
    tint(ico0, 'teal', { pos: [-0.34, 0.3, -0.08], scale: [0.4, 0.34, 0.4], rot: [0.1, 1.1, 0.2] }),
  ]),
  flower: (petal = 'cream') => merge([
    tint(new THREE.CylinderGeometry(0.018, 0.022, 0.32, 4), 'moss', { pos: [0, 0.16, 0] }),
    tint(leafG, 'moss', { pos: [0, 0.02, 0], scale: [0.12, 0.16, 0.12], rot: [0, 0, 0.7] }),
    ...[0, 1, 2, 3, 4].map(i => tint(oct, petal, {
      pos: [Math.cos(i * 1.2566) * 0.07, 0.33, Math.sin(i * 1.2566) * 0.07], scale: [0.06, 0.025, 0.06] })),
    tint(ico0, 'amber', { pos: [0, 0.345, 0], scale: 0.035 }),
  ]),
  tuft: () => merge([0, 1, 2, 3].map(i => tint(leafG, i % 2 ? 'moss' : '#8fae78', {
    pos: [Math.cos(i * 1.7) * 0.06, 0, Math.sin(i * 1.7) * 0.06], scale: [0.1, 0.3 + (i % 3) * 0.06, 0.1],
    rot: [Math.sin(i) * 0.4, i * 1.6, Math.cos(i) * 0.35] }))),
  reed: () => merge([
    tint(new THREE.CylinderGeometry(0.02, 0.025, 0.9, 4), 'moss', { pos: [0, 0.45, 0] }),
    tint(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6), 'clay', { pos: [0, 0.86, 0] }),
    tint(new THREE.CylinderGeometry(0.018, 0.02, 0.7, 4), '#8fae78', { pos: [0.08, 0.35, 0.03], rot: [0, 0, -0.18] }),
    tint(leafG, 'moss', { pos: [-0.04, 0, 0], scale: [0.08, 0.5, 0.08], rot: [0, 0.5, 0.25] }),
  ]),
  mushroom: (cap = 'clay') => merge([
    tint(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), 'cream', { pos: [0, 0.11, 0] }),
    tint(ico0, cap, { pos: [0, 0.24, 0], scale: [0.16, 0.09, 0.16] }),
    tint(ico0, 'cream', { pos: [0.07, 0.29, 0.05], scale: 0.025 }),
    tint(ico0, 'cream', { pos: [-0.06, 0.28, -0.04], scale: 0.02 }),
  ]),
  pebble: () => merge([tint(ico0, 'cream', { pos: [0, 0.06, 0], scale: [0.14, 0.08, 0.11] })]),
  stone: () => merge([tint(new THREE.CylinderGeometry(1, 1, 0.05, 7), 'cream', { pos: [0, 0.03, 0], scale: [0.5, 1, 0.4] })]),
};

/** Place many copies of a recipe with per-instance transforms (and optional tint). */
export function instanced(geo, items, { name = 'decor' } = {}) {
  const m = new THREE.InstancedMesh(geo, mat('#ffffff', { vertexColors: true }), items.length);
  m.name = name;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    p.set(it.x, it.y || 0, it.z); e.set(0, it.ry || 0, it.rz || 0); q.setFromEuler(e);
    s.setScalar(it.s || 1); if (it.sy) s.y *= it.sy;
    mtx.compose(p, q, s); m.setMatrixAt(i, mtx);
    col.set(it.tint || '#ffffff'); m.setColorAt(i, col);
  });
  m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  return m;
}

/** Deterministic RNG so decor is identical every load (and in tests). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Soft round texture for blob shadows, halos and sparkles. */
const texCache = new Map();
export function radialTexture(kind = 'soft') {
  if (texCache.has(kind)) return texCache.get(kind);
  const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  if (kind === 'star') {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 12 : 60; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else if (kind === 'ring') {
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
  } else {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    const hard = kind === 'shadow';
    grd.addColorStop(0, hard ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,1)');
    grd.addColorStop(hard ? 0.55 : 0.35, hard ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(kind, t); return t;
}

/** Bloom-free glow: an additive camera-facing sprite. */
export function halo(color = 'amber', size = 1.4, opacity = 0.6) {
  const m = new THREE.SpriteMaterial({ map: radialTexture('soft'), color: PAL[color] || color, transparent: true,
    opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = 5; s.userData.baseOpacity = opacity; return s;
}

/** Flat contact shadow disc placed just above the ground. */
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
let shadowMat = null;
export function blobShadow(size = 1) {
  shadowMat ||= new THREE.MeshBasicMaterial({ map: radialTexture('shadow'), color: '#243746', transparent: true, opacity: 0.32, depthWrite: false });
  const m = new THREE.Mesh(shadowGeo, shadowMat); m.scale.set(size, 1, size * 0.85); m.position.y = 0.03; m.renderOrder = 1;
  m.name = 'blob_shadow'; return m;
}

/** Element/item icon as a floating sprite (loaded SVG image texture). */
const iconTex = new Map();
export function iconSprite(url, size = 0.7) {
  if (!iconTex.has(url)) {
    const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; iconTex.set(url, t);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex.get(url), transparent: true, depthWrite: false, depthTest: false }));
  s.scale.setScalar(size); s.renderOrder = 20; return s;
}
