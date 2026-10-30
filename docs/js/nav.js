// Collision world + navigation grid. Pure logic, no Three.js.
// Shapes live on the X/Z ground plane. Solid shapes push actors out; water
// regions are terrain that blocks walking unless an active pad covers it.

export class CollisionWorld {
  constructor({ boundary = { cx: 0, cz: 0, rx: 23, rz: 19 } } = {}) {
    this.boundary = boundary;
    this.solids = [];   // {id, tag, kind:'circle'|'capsule'|'aabb', ..., active}
    this.waters = [];   // {id, kind:'ellipse'|'capsule', ..., active}
    this.pads = [];     // {id, cx, cz, rx, rz, active} walkable islands inside water
    this.version = 0;
  }
  _add(list, shape) { shape.active = shape.active !== false; list.push(shape); this.version++; return shape; }
  circle(id, x, z, r, tag = '') { return this._add(this.solids, { id, tag, kind: 'circle', x, z, r }); }
  capsule(id, ax, az, bx, bz, r, tag = '') { return this._add(this.solids, { id, tag, kind: 'capsule', ax, az, bx, bz, r }); }
  aabb(id, minX, minZ, maxX, maxZ, tag = '') { return this._add(this.solids, { id, tag, kind: 'aabb', minX, minZ, maxX, maxZ }); }
  waterEllipse(id, cx, cz, rx, rz, tag = '') { return this._add(this.waters, { id, tag, kind: 'ellipse', cx, cz, rx, rz }); }
  waterCapsule(id, ax, az, bx, bz, r, tag = '') { return this._add(this.waters, { id, tag, kind: 'capsule', ax, az, bx, bz, r }); }
  pad(id, cx, cz, rx, rz, tag = '', active = true) { return this._add(this.pads, { id, tag, cx, cz, rx, rz, active }); }

  setActive(tag, active) {
    let changed = false;
    for (const list of [this.solids, this.waters, this.pads]) for (const s of list) {
      if ((s.tag === tag || s.id === tag) && s.active !== active) { s.active = active; changed = true; }
    }
    if (changed) this.version++;
  }

  onPad(x, z, shrink = -0.12) { // negative shrink: footing extends a little past the painted rim
    for (const p of this.pads) {
      if (!p.active) continue;
      const dx = (x - p.cx) / Math.max(0.05, p.rx - shrink), dz = (z - p.cz) / Math.max(0.05, p.rz - shrink);
      if (dx * dx + dz * dz <= 1) return p;
    }
    return null;
  }

  inWater(x, z, margin = 0.15) {
    for (const w of this.waters) {
      if (!w.active) continue;
      if (w.kind === 'ellipse') {
        const dx = (x - w.cx) / (w.rx - margin), dz = (z - w.cz) / (w.rz - margin);
        if (dx * dx + dz * dz < 1) return !this.onPad(x, z);
      } else if (segDist(x, z, w.ax, w.az, w.bx, w.bz) < w.r - margin) return !this.onPad(x, z);
    }
    return false;
  }

  outsideBoundary(x, z, radius) {
    const b = this.boundary;
    const dx = (x - b.cx) / (b.rx - radius), dz = (z - b.cz) / (b.rz - radius);
    return dx * dx + dz * dz > 1;
  }

  /** True when a disc of `radius` at (x,z) overlaps any solid or leaves the island. */
  blocked(x, z, radius, { water = true } = {}) {
    if (this.outsideBoundary(x, z, radius)) return true;
    if (water && this.inWater(x, z)) return true;
    for (const s of this.solids) {
      if (!s.active) continue;
      if (s.kind === 'circle') { const dx = x - s.x, dz = z - s.z, rr = s.r + radius; if (dx * dx + dz * dz < rr * rr) return true; }
      else if (s.kind === 'capsule') { if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.r + radius) return true; }
      else if (x > s.minX - radius && x < s.maxX + radius && z > s.minZ - radius && z < s.maxZ + radius) return true;
    }
    return false;
  }

  /** Push a disc out of solids and back inside the boundary (in place). */
  pushOut(p, radius) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const s of this.solids) {
        if (!s.active) continue;
        if (s.kind === 'circle') moved = pushCircle(p, s.x, s.z, s.r + radius) || moved;
        else if (s.kind === 'capsule') {
          const c = closestOnSeg(p.x, p.z, s.ax, s.az, s.bx, s.bz);
          moved = pushCircle(p, c.x, c.z, s.r + radius) || moved;
        } else {
          const minX = s.minX - radius, maxX = s.maxX + radius, minZ = s.minZ - radius, maxZ = s.maxZ + radius;
          if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) {
            const pen = [p.x - minX, maxX - p.x, p.z - minZ, maxZ - p.z];
            const i = pen.indexOf(Math.min(...pen));
            if (i === 0) p.x = minX; else if (i === 1) p.x = maxX; else if (i === 2) p.z = minZ; else p.z = maxZ;
            moved = true;
          }
        }
      }
      const b = this.boundary, rx = b.rx - radius, rz = b.rz - radius;
      const dx = (p.x - b.cx) / rx, dz = (p.z - b.cz) / rz, d = Math.hypot(dx, dz);
      if (d > 1) { p.x = b.cx + (dx / d) * rx * 0.999; p.z = b.cz + (dz / d) * rz * 0.999; moved = true; }
      if (!moved) break;
    }
    return p;
  }

  /**
   * Move a disc from `p` by (dx,dz), sliding along solids and refusing water.
   * Returns the resolved position object (mutates p).
   */
  move(p, dx, dz, radius, { water = true } = {}) {
    const nx = p.x + dx, nz = p.z + dz;
    const trial = { x: nx, z: nz };
    this.pushOut(trial, radius);
    if (!water || !this.inWater(trial.x, trial.z)) { p.x = trial.x; p.z = trial.z; return p; }
    // Water: slide along whichever axis stays dry.
    const tx = { x: p.x + dx, z: p.z }; this.pushOut(tx, radius);
    if (!this.inWater(tx.x, tx.z)) { p.x = tx.x; p.z = tx.z; return p; }
    const tz = { x: p.x, z: p.z + dz }; this.pushOut(tz, radius);
    if (!this.inWater(tz.x, tz.z)) { p.x = tz.x; p.z = tz.z; }
    return p;
  }
}

function pushCircle(p, cx, cz, r) {
  const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-5) { p.x = cx + r; return true; }
  p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; return true;
}

export function closestOnSeg(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2)) : 0;
  return { x: ax + vx * t, z: az + vz * t, t };
}
export function segDist(x, z, ax, az, bx, bz) {
  const c = closestOnSeg(x, z, ax, az, bx, bz); return Math.hypot(x - c.x, z - c.z);
}

/** Uniform walkability grid used for hint trails and reachability checks. */
export class NavGrid {
  constructor(world, { cell = 0.5, minX = -24, maxX = 24, minZ = -20, maxZ = 20, radius = 0.32 } = {}) {
    Object.assign(this, { world, cell, minX, minZ, radius });
    this.w = Math.ceil((maxX - minX) / cell); this.h = Math.ceil((maxZ - minZ) / cell);
    this.walk = new Uint8Array(this.w * this.h);
    this.builtVersion = -1;
    this.rebuild();
  }
  rebuild() {
    const { w, h, cell, minX, minZ } = this;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = minX + (i + 0.5) * cell, z = minZ + (j + 0.5) * cell;
      this.walk[j * w + i] = this.world.blocked(x, z, this.radius) ? 0 : 1;
    }
    this.builtVersion = this.world.version;
  }
  ensure() { if (this.builtVersion !== this.world.version) this.rebuild(); }
  cellOf(x, z) {
    return [Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell)];
  }
  center(i, j) { return { x: this.minX + (i + 0.5) * this.cell, z: this.minZ + (j + 0.5) * this.cell }; }
  ok(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && this.walk[j * this.w + i] === 1; }

  /** Closest walkable cell to a point within `maxR` metres (spiral search). */
  nearestWalkable(x, z, maxR = 4) {
    const [ci, cj] = this.cellOf(x, z);
    if (this.ok(ci, cj)) return [ci, cj];
    const maxC = Math.ceil(maxR / this.cell);
    let best = null, bestD = Infinity;
    for (let r = 1; r <= maxC; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (!this.ok(ci + di, cj + dj)) continue;
        const d = di * di + dj * dj; if (d < bestD) { bestD = d; best = [ci + di, cj + dj]; }
      }
      if (best) return best;
    }
    return null;
  }

  /** BFS (8-neighbour, no corner cutting). Returns world-space waypoints or null. */
  path(fromX, fromZ, toX, toZ, { maxGoalR = 4 } = {}) {
    this.ensure();
    const s = this.nearestWalkable(fromX, fromZ, 2), g = this.nearestWalkable(toX, toZ, maxGoalR);
    if (!s || !g) return null;
    const { w, h } = this, start = s[1] * w + s[0], goal = g[1] * w + g[0];
    const prev = new Int32Array(w * h).fill(-1); prev[start] = start;
    const queue = new Int32Array(w * h); let qh = 0, qt = 0; queue[qt++] = start;
    while (qh < qt) {
      const cur = queue[qh++]; if (cur === goal) break;
      const ci = cur % w, cj = (cur / w) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj; if (!this.ok(ni, nj)) continue;
        if (di && dj && (!this.ok(ci + di, cj) || !this.ok(ci, cj + dj))) continue;
        const n = nj * w + ni; if (prev[n] !== -1) continue;
        prev[n] = cur; queue[qt++] = n;
      }
    }
    if (prev[goal] === -1) return null;
    const cells = []; for (let c = goal; ; c = prev[c]) { cells.push(c); if (c === start) break; }
    cells.reverse();
    return cells.map(c => this.center(c % w, (c / w) | 0));
  }

  reachable(fromX, fromZ, toX, toZ, maxGoalR = 2) { return this.path(fromX, fromZ, toX, toZ, { maxGoalR }) !== null; }
}
