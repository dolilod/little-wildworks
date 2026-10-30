// Render small portraits of the real 3D models (no concept PNGs in the
// gameplay download). Uses the main renderer + an offscreen render target.
import * as THREE from 'three';

const FRAMING = {
  tumbletuft: { y: 0.55, span: 1.55, yaw: 0.55 }, foldfern: { y: 0.65, span: 1.6, yaw: 0.35 },
  puddleloop: { y: 0.36, span: 1.4, yaw: 0.6 }, siltbell: { y: 0.48, span: 1.25, yaw: 0.45 },
  whirli: { y: 0.62, span: 1.6, yaw: 0.3 }, kitefin: { y: 0.82, span: 1.85, yaw: 0.3 },
  glintot: { y: 0.36, span: 1.12, yaw: 0.55 }, hushbulb: { y: 0.56, span: 1.35, yaw: 0.35 },
  keeper: { y: 0.78, span: 1.75, yaw: 0.35 },
};

export class Portraits {
  constructor(renderer, size = 192) {
    this.renderer = renderer; this.size = size;
    this.rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#FFF6DE', '#9fb08f', 2.3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(2, 4, 5); this.scene.add(sun);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.pixels = new Uint8Array(size * size * 4);
    this.cache = new Map();
    this.silhouette = new THREE.MeshBasicMaterial({ color: '#5d6b78' });
  }

  /** Returns a PNG data URL of `actor`'s current look. */
  render(actor, { silhouette = false, yaw } = {}) {
    const f = FRAMING[actor.id] || FRAMING.keeper;
    const clone = actor.model.clone(true);
    clone.traverse(n => { if (n.isSprite) n.visible = false; const r = n.userData?.rest; if (r && n.name !== 'friendship_seed') { n.position.copy(r.p); n.rotation.copy(r.r); n.scale.copy(r.s); } });
    const body = clone.getObjectByName('body'); if (body) { body.position.set(0, actor.restY, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1); }
    clone.position.set(0, 0, 0); clone.rotation.set(0, yaw ?? f.yaw, 0);
    this.scene.add(clone);
    const h = f.span / 2;
    Object.assign(this.cam, { left: -h, right: h, top: h, bottom: -h }); this.cam.updateProjectionMatrix();
    this.cam.position.set(0, f.y + 0.35, 6); this.cam.lookAt(0, f.y, 0);
    this.scene.overrideMaterial = silhouette ? this.silhouette : null;
    const r = this.renderer, prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.rt); r.setClearColor(0x000000, 0); r.clear();
    r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.pixels);
    r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevAlpha);
    this.scene.remove(clone); this.scene.overrideMaterial = null;
    // Flip rows (GL origin is bottom-left).
    const s = this.size, img = this.ctx.createImageData(s, s), row = s * 4;
    for (let y = 0; y < s; y++) img.data.set(this.pixels.subarray((s - 1 - y) * row, (s - y) * row), y * row);
    this.ctx.clearRect(0, 0, s, s); this.ctx.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }

  get(actor, opts = {}) {
    const key = actor.id + (opts.silhouette ? ':sil' : '') + ':' + (opts.version || 0);
    if (!this.cache.has(key)) this.cache.set(key, this.render(actor, opts));
    return this.cache.get(key);
  }
  invalidate(id) { for (const k of [...this.cache.keys()]) if (k.startsWith(id + ':')) this.cache.delete(k); }
}
