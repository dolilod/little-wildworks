/**
 * THE LITTLE WILDWORKS — reusable scenery and authored project toys.
 * No imports, textures, network, physics, navigation solver or progression rules.
 * Inject THREE. Units: metres; +Y up; world ground Y=0.
 */
export const WORLD_PALETTE = Object.freeze({
  ink: '#243746', cream: '#F6EEDC', clay: '#D97B60', amber: '#E6B85C',
  moss: '#7C986A', teal: '#5AA9A0', aqua: '#AED8CF', twilight: '#77708F',
});
export const PROJECT_IDS = Object.freeze(['leaf_slide', 'lotus_steps', 'pinwheel_canopy', 'lantern_picnic']);
export const PROJECT_PLACEMENTS = Object.freeze({
  leaf_slide: Object.freeze([-12, 0, 5]), lotus_steps: Object.freeze([10, 0, -2]),
  pinwheel_canopy: Object.freeze([0, 0, 1]), lantern_picnic: Object.freeze([-2, 0, -10]),
});

function kit(THREE) {
  if (!THREE?.Group || !THREE?.BufferGeometry) throw new TypeError('Pass the THREE namespace.');
  const materials = new Map();
  function mat(color, glow = false) {
    const key = color + ':' + glow;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
      name: color + (glow ? '_warm' : '_matte'), color: WORLD_PALETTE[color] || color,
      flatShading: true, roughness: 0.94, metalness: 0,
      emissive: glow ? WORLD_PALETTE[color] || color : '#000000', emissiveIntensity: glow ? 0.35 : 0,
    }));
    return materials.get(key);
  }
  function part(parent, name, geometry, color, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], glow = false) {
    const mesh = new THREE.Mesh(geometry, mat(color, glow));
    mesh.name = name; mesh.position.fromArray(position); mesh.scale.fromArray(scale); mesh.rotation.fromArray(rotation);
    mesh.castShadow = false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const group = (parent, name, p = [0, 0, 0]) => { const g = new THREE.Group(); g.name = name; g.position.fromArray(p); parent?.add(g); return g; };
  const box = (p, n, c, xyz, size, rot = [0, 0, 0]) => part(p, n, new THREE.BoxGeometry(...size), c, xyz, [1, 1, 1], rot);
  const ball = (p, n, c, xyz, size) => part(p, n, new THREE.IcosahedronGeometry(1, 0), c, xyz, size);
  const disk = (p, n, c, xyz, rx, rz, height = 0.08, sides = 12) => part(p, n, new THREE.CylinderGeometry(1, 1, height, sides, 1), c, xyz, [rx, 1, rz]);
  function beam(p, n, c, a, b, radius = 0.08, sides = 6) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const dir = end.clone().sub(start), length = dir.length();
    const m = part(p, n, new THREE.CylinderGeometry(radius, radius, length, sides), c, start.add(end).multiplyScalar(0.5).toArray());
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); return m;
  }
  function surface(p, n, c, vertices, faces) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(faces.flatMap(f => f.flatMap(i => vertices[i])), 3));
    g.computeVertexNormals(); return part(p, n, g, c);
  }
  function leaf(p, n, c, xyz, size, rot = [0, 0, 0]) {
    const m = surface(p, n, c, [[0, 0, 0], [-0.5, 0.45, 0], [0, 1, 0], [0.5, 0.45, 0], [0, 0.45, 0.16]],
      [[0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0], [0, 2, 3], [0, 1, 2]]);
    m.position.fromArray(xyz); m.scale.fromArray(size); m.rotation.fromArray(rot); return m;
  }
  return { group, part, box, ball, disk, beam, surface, leaf };
}

/** Create an individual visual project; socket/collision coordinates are local. */
export function buildProject(THREE, id, { complete = false } = {}) {
  if (!PROJECT_IDS.includes(id)) throw new RangeError('Unknown project id: ' + id);
  const k = kit(THREE), g = k.group(null, id), shared = k.group(g, 'shared');
  const unfinished = k.group(g, 'unfinished'), finished = k.group(g, 'finished');
  const element = { leaf_slide: 'sprout', lotus_steps: 'splash', pinwheel_canopy: 'gust', lantern_picnic: 'glimmer' }[id];
  g.userData = {
    kind: 'project', projectId: id, element, complete: false,
    axes: '+Y up; local sockets and paths must be transformed through this group',
    sockets: [{ id: id + '_help', element, position: [0, 0, 2.8], radius: 1.2 }],
    collision: { kind: 'authored-hints-only', unfinished: [], finished: [] },
  };
  // Descriptive choices only. The host implements the selected animation/sound
  // parameter; this kit does not add another progression or simulation system.
  g.userData.toyChoices = {
    leaf_slide: { id: 'ride_style', options: ['gentle', 'bouncy'], default: 'gentle', hostEffect: 'Choose the guided ride bob amplitude.' },
    lotus_steps: { id: 'pad_song', options: ['low_song', 'high_song'], default: 'low_song', hostEffect: 'Choose the note register of the guided crossing.' },
    pinwheel_canopy: { id: 'spin_direction', options: ['clockwise', 'counterclockwise'], default: 'clockwise', hostEffect: 'Choose the sign of the pinwheel rotation speed.' },
    lantern_picnic: { id: 'light_shape', options: ['moon', 'star'], default: 'moon', hostEffect: 'Choose a simple light motif for the finale.' },
  }[id];
  if (id === 'leaf_slide') {
    k.disk(shared, 'garden_bed', 'cream', [0, 0.03, 0], 3.5, 2.4, 0.06);
    [-1.6, 0, 1.6].forEach((x, i) => k.ball(unfinished, 'sleeping_bud_' + i, 'moss', [x, 0.23, 0], [0.36, 0.3, 0.34]));
    k.beam(finished, 'grown_stem', 'teal', [-2, 0, 0], [-2, 2.2, 0], 0.22);
    const v = [[-2.5, 2.2, -0.8], [-2.5, 2.2, 0.8], [-0.5, 1.75, -0.8], [-0.5, 1.75, 0.8], [2.5, 0.2, -0.9], [2.5, 0.2, 0.9]];
    k.surface(finished, 'leaf_slide_surface', 'moss', v, [[0, 1, 2], [1, 3, 2], [2, 3, 4], [3, 5, 4], [2, 1, 0], [2, 3, 1], [4, 3, 2], [4, 5, 3]]);
    [-0.8, 0.8].forEach((z, i) => {
      k.beam(finished, 'leaf_rail_high_' + i, 'teal', [-2.5, 2.35, z], [-0.5, 1.9, z], 0.055);
      k.beam(finished, 'leaf_rail_low_' + i, 'teal', [-0.5, 1.9, z], [2.5, 0.35, z], 0.055);
    });
    k.leaf(finished, 'welcome_leaf', 'teal', [-2, 0.3, -0.2], [1.6, 1.5, 1], [0.3, 0, -0.9]);
    g.userData.ridePath = [[-2.7, 0, 1.7], [-2.2, 2.35, 0], [-0.5, 1.95, 0], [2.8, 0.25, 0]];
    g.userData.collision.unfinished = [{ shape: 'circle', center: [0, 0], radius: 0.7 }];
    g.userData.collision.finished = [{ shape: 'circle', center: [-2, 0], radius: 0.3 }];
  } else if (id === 'lotus_steps') {
    const points = [[-4.6, -2.4], [-2.3, -1.2], [0, 0], [2.3, 1.2], [4.6, 2.4]];
    points.forEach(([x, z], i) => {
      k.disk(unfinished, 'submerged_marker_' + i, 'teal', [x, 0.09, z], 0.24, 0.24, 0.025, 8);
      const pad = k.group(finished, 'floating_pad_' + i, [x, 0.20, z]);
      k.disk(pad, 'lotus_disk', 'moss', [0, 0, 0], 1.65, 1.2, 0.12, 8);
      k.beam(pad, 'lotus_vein', 'cream', [-0.55, 0.07, -0.32], [0.6, 0.07, 0.36], 0.025, 4);
      pad.userData.motion = { kind: 'bob', baseY: 0.20, amplitude: 0.035, speed: 1.5, phase: i * 0.65 };
    });
    g.userData.sockets[0].position = [-6.5, 0, -3.2];
    g.userData.walkPath = [[-6.5, 0, -3.2], ...points.map(([x, z]) => [x, 0.28, z]), [6.5, 0, 3.2]];
    g.userData.traversal = { mode: 'host-guided', requiresJumpInput: false, suggestedSpeed: 2.2, pathIncludesDryBanks: true, padRadii: [1.65, 1.2] };
    g.userData.collision.waterRegion = { shape: 'ellipse', center: [0, 0], radii: [6, 4.6], interpretation: 'After completion, the host guides the player continuously along walkPath from dry bank to dry bank; no jumping or collision is implemented here.' };
  } else if (id === 'pinwheel_canopy') {
    // The entire crown-shaped landmark exists before its toy is completed.
    const crown = k.group(shared, 'crown_landmark');
    [[-2.7, -2], [2.7, -2], [-2.7, 2], [2.7, 2]].forEach(([x, z], i) => k.beam(crown, 'canopy_post_' + i, 'cream', [x, 0, z], [x, 2.6, z], 0.09));
    const outer = [[-3.2, 2.65, -2.5], [3.2, 2.65, -2.5], [3.2, 2.65, 2.5], [-3.2, 2.65, 2.5]];
    outer.forEach((a, i) => {
      const b = outer[(i + 1) % 4], peak = [(a[0] + b[0]) * 0.33, 3.75, (a[2] + b[2]) * 0.33];
      k.surface(crown, 'folded_canopy_panel_' + i, i % 2 ? 'amber' : 'cream', [a, b, peak, [0, 3.12, 0]], [[0, 1, 2], [0, 2, 3], [2, 1, 3], [2, 1, 0], [3, 2, 0], [3, 1, 2]]);
    });
    k.disk(shared, 'canopy_floor', 'cream', [0, 0.03, 0], 3, 2.3, 0.06, 12);
    k.beam(shared, 'pinwheel_axle', 'clay', [0, 2.6, 2.3], [0, 3.25, 2.3], 0.09);
    function makeRotor(parent, name) {
      const rotor = k.group(parent, name, [0, 3.25, 2.38]);
      for (let i = 0; i < 4; i++) k.leaf(rotor, 'blade_' + i, i % 2 ? 'teal' : 'clay', [0, 0, 0], [0.5, 0.95, 0.7], [0, 0, i * Math.PI / 2]);
      k.ball(rotor, 'hub', 'amber', [0, 0, 0.08], [0.13, 0.13, 0.13]); return rotor;
    }
    makeRotor(unfinished, 'still_pinwheel');
    makeRotor(finished, 'spinning_pinwheel').userData.motion = { kind: 'spin', axis: 'z', speed: -0.9, base: 0 };
    k.disk(unfinished, 'parked_lift', 'teal', [3.7, 0.15, 0], 0.75, 0.75, 0.16, 8);
    const lift = k.group(finished, 'gentle_lift', [3.7, 0.15, 0]);
    k.disk(lift, 'lift_platform', 'teal', [0, 0, 0], 0.75, 0.75, 0.16, 8);
    lift.userData.motion = { kind: 'lift', baseY: 0.15, distance: 0.8, period: 8 };
    g.userData.ridePath = [[3.7, 0.23, 0], [3.7, 1.03, 0]];
    g.userData.collision.unfinished = [[-2.7,-2],[2.7,-2],[-2.7,2],[2.7,2]].map(p => ({ shape: 'circle', center: p, radius: 0.16 }));
    g.userData.collision.finished = g.userData.collision.unfinished.map(c => ({ ...c, center: [...c.center] }));
  } else if (id === 'lantern_picnic') {
    k.disk(shared, 'picnic_hill', 'moss', [0, 0.06, 0], 4.2, 3.2, 0.12, 12);
    k.disk(shared, 'picnic_cloth', 'cream', [0, 0.135, 0], 2.9, 2.2, 0.025, 8);
    k.box(shared, 'cloth_stripe', 'clay', [0, 0.15, 0], [0.34, 0.02, 4.0]);
    [-1, 1].forEach((s, i) => k.box(shared, 'picnic_seat_' + i, 'amber', [s * 2.1, 0.25, 0], [0.65, 0.22, 1.9]));
    [[-2.6,-1.8],[2.6,-1.8],[-2.6,1.8],[2.6,1.8]].forEach(([x,z], i) => {
      k.beam(shared, 'lantern_post_' + i, 'cream', [x,0,z], [x,1.8,z], 0.065);
      k.ball(unfinished, 'unlit_seed_' + i, 'twilight', [x,1.9,z], [0.3,0.42,0.3]);
      const light = k.part(finished, 'lit_seed_' + i, new THREE.IcosahedronGeometry(1,0), 'amber', [x,1.9,z], [0.3,0.42,0.3], [0,0,0], true);
      light.userData.motion = { kind: 'glow', base: 0.35, amplitude: 0.08, speed: 1.1 };
    });
    k.ball(finished, 'shared_seed_cake', 'clay', [0,0.42,0], [0.62,0.24,0.62]);
    k.ball(finished, 'cake_seed', 'amber', [0,0.73,0], [0.15,0.2,0.15]);
    // Nine floor positions: all eight friends plus the Keeper. The outer ring
    // avoids the fixed benches, cake, lantern posts, and other seated models.
    g.userData.seatingSockets = Array.from({ length: 9 }, (_, i) => {
      const a = i * Math.PI * 2 / 9;
      return [Number((Math.cos(a) * 4.3).toFixed(4)), 0.035, Number((Math.sin(a) * 4.3).toFixed(4))];
    });
    g.userData.seatingFootprintRadius = 0.85;
    g.userData.collision.unfinished = [{ shape: 'aabb', min: [-2.45,-0.95], max: [-1.75,0.95] }, { shape: 'aabb', min: [1.75,-0.95], max: [2.45,0.95] }];
    g.userData.collision.finished = g.userData.collision.unfinished.map(c => ({ ...c, min: [...c.min], max: [...c.max] }));
  }
  g.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(g);
  g.userData.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray(), includes: 'both render states; not collision geometry' };
  setProjectComplete(g, complete); return g;
}

/** Toggle visual completion only. The host owns progress, save data and validation. */
export function setProjectComplete(group, value) {
  if (group?.userData?.kind !== 'project') throw new TypeError('Expected a project group.');
  const complete = Boolean(value); group.userData.complete = complete;
  group.getObjectByName('unfinished').visible = !complete;
  group.getObjectByName('finished').visible = complete;
  group.userData.activeCollisionState = complete ? 'finished' : 'unfinished';
  return group;
}

/** One contiguous 48 × 40 m island. No external textures are needed. */
export function buildWorld(THREE, { completed = [] } = {}) {
  if (!Array.isArray(completed) || completed.some(id => !PROJECT_IDS.includes(id))) throw new TypeError('completed must contain known project IDs.');
  const k = kit(THREE), root = k.group(null, 'little_wildworks_island');
  root.userData = {
    kind: 'world', units: 'metres', groundY: 0,
    bounds: { min: [-24,-1.6,-20], max: [24,5,20] },
    navigationBoundary: { shape: 'ellipse', center: [0,0], radii: [23,19] },
    spawn: [-17,0,10], cameraLookAt: [0,1,0], projects: [...PROJECT_IDS],
    colliders: [], axes: '+Y up; X/Z ground plane; boundary and colliders are host-consumed hints',
  };
  k.part(root, 'island_clay_edge', new THREE.CylinderGeometry(1,0.92,1.55,32), 'clay', [0,-0.825,0], [24,1,20]);
  k.disk(root, 'island_ground', 'moss', [0,-0.05,0], 24,20,0.1,32);
  const meadow = k.group(root, 'zone_meadow'), pond = k.group(root, 'zone_pond'), dusk = k.group(root, 'zone_dusk');
  meadow.userData = { zoneId: 'meadow', suggestedPalette: ['moss','cream','clay'], center: [-11,0,5] };
  pond.userData = { zoneId: 'pond', suggestedPalette: ['aqua','teal','cream'], center: [10,0,-2] };
  dusk.userData = { zoneId: 'dusk', suggestedPalette: ['twilight','amber','moss'], center: [-2,0,-10] };
  k.disk(meadow, 'meadow_ground_patch', 'moss', [-11,0.015,5], 9,9,0.025,18);
  k.disk(dusk, 'dusk_ground_patch', 'twilight', [-2,0.02,-10], 11.5,7.0,0.025,18);
  k.disk(pond, 'pond_water', 'aqua', [10,0.045,-2], 6,4.6,0.04,20);
  // A shallow painted river ribbon; it is visual water, not a simulated fluid.
  const riverPoints = [[10,0.055,-5.5],[12,0.055,-8.0],[10,0.055,-11.0],[11,0.055,-14.0]];
  const vertices = riverPoints.flatMap(([x,y,z]) => [[x-0.9,y,z],[x+0.9,y,z]]), faces=[];
  for (let i=0;i<riverPoints.length-1;i++) { const a=i*2; faces.push([a,a+1,a+2],[a+1,a+3,a+2]); }
  k.surface(pond, 'painted_river', 'aqua', vertices, faces);
  [[-5,8],[-3,5],[0,2],[0,-2],[-1,-5],[-2,-7],[-6,4],[-8,5],[4,1],[5,-4]].forEach(([x,z],i)=>k.disk(root,'path_tile_'+i,'cream',[x,0.075,z],1.1,0.9,0.04,7));
  const trees = [[-17,-5],[-18,4],[-14,12],[-5,15],[5,14],[19,1],[15,-9],[-10,-13],[3,-15]];
  trees.forEach(([x,z], i) => {
    const tree = k.group(root,'tree_'+i,[x,0,z]);
    k.beam(tree,'trunk','cream',[0,0,0],[0,1.8,0],0.18);
    k.ball(tree,'folded_crown',i%3===0?'teal':'moss',[0,2.2,0],[1.25,1.55,1.05]);
    root.userData.colliders.push({ id:tree.name, shape:'circle', center:[x,z], radius:0.35 });
  });
  [[-19,0],[-16,-9],[-10,14],[9,13],[17,5],[17,-5],[6,-16],[-5,-16]].forEach(([x,z],i)=>{
    k.ball(root,'rock_'+i,i%2?'cream':'twilight',[x,0.32,z],[0.75,0.52,0.62]);
    root.userData.colliders.push({ id:'rock_'+i, shape:'circle', center:[x,z], radius:0.8 });
  });
  PROJECT_IDS.forEach(id=>{
    const p=buildProject(THREE,id,{complete:completed.includes(id)});
    p.position.fromArray(PROJECT_PLACEMENTS[id]);
    (id==='leaf_slide'?meadow:id==='lotus_steps'?pond:id==='lantern_picnic'?dusk:root).add(p);
  });
  root.updateMatrixWorld(true); return root;
}

/** Absolute-time animation: evaluating the same time always gives the same pose. */
export function animateWorld(root, elapsedSeconds) {
  const t=Number(elapsedSeconds); if (!Number.isFinite(t)) throw new TypeError('Time must be finite seconds.');
  root.traverse(node=>{
    const m=node.userData.motion; if (!m) return;
    if (m.kind==='bob') node.position.y=m.baseY+Math.sin(t*m.speed+m.phase)*m.amplitude;
    else if (m.kind==='spin') node.rotation[m.axis]=m.base+t*m.speed;
    else if (m.kind==='lift') node.position.y=m.baseY+(0.5-0.5*Math.cos(t*Math.PI*2/m.period))*m.distance;
    else if (m.kind==='glow' && node.material) node.material.emissiveIntensity=m.base+Math.sin(t*m.speed)*m.amplitude;
  });
  return root;
}

/** Dispose a world/project that owns its resources; do not use on shared clones. */
export function disposeWorld(root) {
  const geometries=new Set(), materials=new Set();
  root.traverse(n=>{ if(n.geometry) geometries.add(n.geometry); if(n.material) (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>materials.add(m)); });
  geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
}
