/**
 * THE LITTLE WILDWORKS — original procedural toy cast.
 * No imports, textures, network, physics or rigging required.
 * Supply the application's THREE namespace. Validated with three@0.180.0.
 * Coordinate convention: metres, +Y up, +Z face/front; ground at Y=0.
 */
export const PALETTE = Object.freeze({
  ink: '#243746', cream: '#F6EEDC', clay: '#D97B60', amber: '#E6B85C',
  moss: '#7C986A', teal: '#5AA9A0', aqua: '#AED8CF', twilight: '#77708F',
});

export const CREATURE_IDS = Object.freeze([
  'tumbletuft', 'foldfern', 'puddleloop', 'siltbell',
  'whirli', 'kitefin', 'glintot', 'hushbulb',
]);

export const CREATURE_SPECS = Object.freeze({
  tumbletuft: { element: 'sprout', verb: 'grow', primary: 'teal', silhouette: 'low quadruped with three fan leaves' },
  foldfern: { element: 'sprout', verb: 'grow', primary: 'cream', silhouette: 'upright seed with a folded leaf cape' },
  puddleloop: { element: 'splash', verb: 'float', primary: 'aqua', silhouette: 'horizontal ring with four flippers' },
  siltbell: { element: 'splash', verb: 'float', primary: 'clay', silhouette: 'bell with a loop crest and webbed feet' },
  whirli: { element: 'gust', verb: 'blow', primary: 'cream', silhouette: 'pear with two long rotor ribbons' },
  kitefin: { element: 'gust', verb: 'blow', primary: 'amber', silhouette: 'vertical kite with four folded diamond fins' },
  glintot: { element: 'glimmer', verb: 'light', primary: 'amber', silhouette: 'hexagonal lantern beetle with bead ridge' },
  hushbulb: { element: 'glimmer', verb: 'light', primary: 'twilight', silhouette: 'upright four-petal luminous bud' },
});

function toolkit(THREE, id, options = {}) {
  if (!THREE?.Group || !THREE?.BufferGeometry) throw new TypeError('Pass the THREE namespace.');
  const root = new THREE.Group();
  root.name = id;
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  const face = new THREE.Group(); face.name = 'face'; body.add(face);
  const ornament = new THREE.Group(); ornament.name = 'ornament'; body.add(ornament);
  const mats = new Map();
  const palette = { ...PALETTE, ...(options.palette || {}) };
  function material(key, emissive = false) {
    const hex = palette[key] || key;
    const cacheKey = hex + (emissive ? ':glow' : ':matte');
    if (!mats.has(cacheKey)) mats.set(cacheKey, new THREE.MeshStandardMaterial({
      name: key + (emissive ? '_warm' : '_matte'), color: hex,
      roughness: 0.88, metalness: 0, flatShading: true,
      emissive: emissive ? hex : '#000000', emissiveIntensity: emissive ? 0.16 : 0,
    }));
    return mats.get(cacheKey);
  }
  function part(name, geo, color, xyz = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], parent = body, emissive = false) {
    const mesh = new THREE.Mesh(geo, material(color, emissive));
    mesh.name = name; mesh.position.fromArray(xyz); mesh.scale.fromArray(scale); mesh.rotation.fromArray(rotation);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const ball = (name, color, xyz, scale, parent = body, detail = 1, emissive = false) =>
    part(name, new THREE.IcosahedronGeometry(1, detail), color, xyz, scale, [0, 0, 0], parent, emissive);
  const cyl = (name, color, xyz, top, bottom, height, sides = 8, parent = body, rotation = [0, 0, 0]) =>
    part(name, new THREE.CylinderGeometry(top, bottom, height, sides, 1), color, xyz, [1, 1, 1], rotation, parent);
  const torus = (name, color, xyz, radius, tube, rotation = [0, 0, 0], parent = body, segments = 12) =>
    part(name, new THREE.TorusGeometry(radius, tube, 5, segments), color, xyz, [1, 1, 1], rotation, parent);
  function leaf(name, color, xyz, width, height, depth = 0.06, rotation = [0, 0, 0], parent = ornament) {
    const vertices = [
      [0, 0, 0], [-width * 0.5, height * 0.4, 0], [0, height, 0], [width * 0.5, height * 0.4, 0],
      [0, height * 0.42, depth * 0.5], [0, height * 0.42, -depth * 0.5],
    ];
    const faces = [[1,0,4],[2,1,4],[3,2,4],[0,3,4],[0,1,5],[1,2,5],[2,3,5],[3,0,5]];
    const a = new Float32Array(faces.flatMap(f => f.flatMap(i => vertices[i])));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.computeVertexNormals();
    return part(name, g, color, xyz, [1,1,1], rotation, parent);
  }
  function eyes(y, z, distance = 0.12, radius = 0.042, parent = face) {
    ball('eye_left', 'ink', [-distance, y, z], [radius, radius * 1.2, radius * 0.45], parent, 1);
    ball('eye_right', 'ink', [distance, y, z], [radius, radius * 1.2, radius * 0.45], parent, 1);
    const my=y-radius*1.75, mz=z+0.020;
    const curve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-radius*0.68, my+radius*0.15, mz),
      new THREE.Vector3(0, my-radius*0.12, mz+0.001),
      new THREE.Vector3(radius*0.68, my+radius*0.15, mz),
    ]);
    part('mouth',new THREE.TubeGeometry(curve,6,radius*0.13,3,false),'ink',[0,0,0],[1,1,1],[0,0,0],parent);
  }
  function feet(positions, color, shape = [0.11,0.09,0.15]) {
    positions.forEach((p,i) => ball('foot_' + i, color, p, shape, body, 0));
  }
  function finalize() {
    // Put the exact model bounds on the floor; do not assume primitive extrema.
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    body.position.y -= bounds.min.y;
    const size = new THREE.Vector3(); new THREE.Box3().setFromObject(root).getSize(size);
    root.userData = {
      kind: id === 'keeper' ? 'player' : 'creature', creatureId: id,
      element: CREATURE_SPECS[id]?.element || null, verb: CREATURE_SPECS[id]?.verb || null,
      grown: Boolean(options.grown), nominalHeight: size.y, axes: '+Y up, +Z front',
      restY: body.position.y, animationPhase: Number(options.phase || 0),
    };
    if (options.grown && id !== 'keeper') {
      // A shared-history token, not a level/stat upgrade. Same collision footprint.
      ball('friendship_seed', 'amber', [0, size.y * 0.65, 0.38], [0.055,0.055,0.04], ornament, 0, true);
      // Metadata describes the final visible object, including its new token.
      root.updateMatrixWorld(true);
      new THREE.Box3().setFromObject(root).getSize(size);
      root.userData.nominalHeight = size.y;
    }
    root.updateMatrixWorld(true); return root;
  }
  return { root, body, face, ornament, palette, part, ball, cyl, torus, leaf, eyes, feet, finalize };
}

/** Create one creature. Each instance owns its geometry and materials. */
export function buildCreature(THREE, id, options = {}) {
  if (!CREATURE_IDS.includes(id)) throw new RangeError('Unknown creature id: ' + id);
  const t = toolkit(THREE, id, options);
  const {body,face,ornament,ball,cyl,torus,leaf,eyes,feet,part} = t;
  if (id === 'tumbletuft') {
    ball('torso', 'teal', [0,0.33,0], [0.42,0.30,0.55]);
    feet([[-0.28,0.11,0.32],[0.28,0.11,0.32],[-0.28,0.11,-0.32],[0.28,0.11,-0.32]],'clay',[0.11,0.13,0.15]);
    ball('muzzle','cream',[0,0.39,0.47],[0.25,0.16,0.12],face);
    eyes(0.44,0.575,0.11,0.035);
    leaf('leaf_left','moss',[-0.16,0.53,-0.07],0.35,0.51,0.10,[0,0,0.5]);
    leaf('leaf_middle','moss',[0,0.55,-0.13],0.36,0.68,0.11);
    leaf('leaf_right','moss',[0.16,0.53,-0.07],0.35,0.51,0.10,[0,0,-0.5]);
    ball('tail','teal',[0,0.35,-0.57],[0.09,0.08,0.19],body,0);
    ball('tail_seed','amber',[0,0.39,-0.72],[0.07,0.07,0.07],ornament,0);
  } else if (id === 'foldfern') {
    ball('seed_body','cream',[0,0.56,0],[0.32,0.46,0.27]);
    feet([[-0.15,0.08,0.07],[0.15,0.08,0.07]],'amber');
    leaf('cape_left','moss',[-0.07,0.83,0],0.46,0.66,0.10,[0,0,2.55]);
    leaf('cape_right','moss',[0.07,0.83,0],0.46,0.66,0.10,[0,0,-2.55]);
    leaf('cape_back_left','teal',[-0.09,0.83,-0.12],0.43,0.70,0.12,[0.25,-0.3,2.9]);
    leaf('cape_back_right','teal',[0.09,0.83,-0.12],0.43,0.70,0.12,[0.25,0.3,-2.9]);
    leaf('crown','moss',[0,0.94,-0.02],0.22,0.29,0.07,[0,0,-0.18]);
    eyes(0.69,0.249,0.10,0.036);
    ball('seed_button','amber',[0,0.40,0.267],[0.06,0.05,0.035],ornament,0);
  } else if (id === 'puddleloop') {
    torus('ring_body','aqua',[0,0.28,-0.04],0.34,0.145,[Math.PI/2,0,0],body,14);
    feet([[-0.42,0.10,0.20],[0.42,0.10,0.20],[-0.33,0.10,-0.34],[0.33,0.10,-0.34]],'teal',[0.18,0.07,0.16]);
    ball('head','cream',[0,0.48,0.37],[0.24,0.28,0.22],face);
    ball('chin','amber',[0,0.32,0.54],[0.14,0.09,0.09],face,0);
    eyes(0.52,0.573,0.10,0.034);
    ball('bubble_back','teal',[0,0.43,-0.36],[0.08,0.09,0.08],ornament,0);
  } else if (id === 'siltbell') {
    cyl('bell_body','clay',[0,0.44,0],0.23,0.40,0.58,10);
    cyl('rim','aqua',[0,0.20,0],0.40,0.41,0.12,10);
    feet([[-0.28,0.08,0.21],[0.28,0.08,0.21],[-0.28,0.08,-0.21],[0.28,0.08,-0.21]],'teal',[0.14,0.07,0.18]);
    torus('handle_crest','amber',[0,0.81,0],0.14,0.04,[0,0,0],ornament,10);
    eyes(0.49,0.30,0.11,0.030);
    ball('back_drop','aqua',[0,0.49,-0.31],[0.09,0.13,0.04],ornament,0);
  } else if (id === 'whirli') {
    const pearProfile=[[0,.10],[.25,.14],[.35,.29],[.36,.41],[.30,.58],[.20,.76],[.09,.93],[0,1.0]].map(p=>new THREE.Vector2(...p));
    part('pear_body',new THREE.LatheGeometry(pearProfile,10),'cream',[0,0,0],[1,1,.86]);
    feet([[-0.15,0.07,0.07],[0.15,0.07,0.07]],'amber');
    leaf('ribbon_left','teal',[-0.04,0.94,0],0.35,0.61,0.12,[0,0,1.4]);
    leaf('ribbon_right','teal',[0.04,0.94,0],0.35,0.61,0.12,[0,0,-1.4]);
    ball('ribbon_knot','amber',[0,0.92,0],[0.09,0.07,0.08],ornament,0);
    eyes(0.63,0.235,0.09,0.034);
    face.getObjectByName('mouth').position.z=0.015;
    ball('cheek_left','clay',[-0.18,0.57,0.22],[0.048,0.048,0.025],face,0);
    ball('cheek_right','clay',[0.18,0.57,0.22],[0.048,0.048,0.025],face,0);
  } else if (id === 'kitefin') {
    ball('kite_body','teal',[0,0.69,0],[0.25,0.23,0.19],body,1);
    // Match the selected concept: four upright diamond fins around a teal face.
    for (const [name,angle,width,height] of [['top',0,.50,.68],['left',Math.PI/2,.48,.70],['right',-Math.PI/2,.48,.70],['bottom',Math.PI,.43,.64]]) {
      const x=-Math.sin(angle)*.10,y=.69+Math.cos(angle)*.10;
      leaf('fin_'+name+'_edge','amber',[x,y,-.045],width,height,.10,[0,0,angle]);
      leaf('fin_'+name+'_inset','cream',[x-Math.sin(angle)*.055,y+Math.cos(angle)*.055,-.045],width*.78,height-.11,.13,[0,0,angle]);
    }
    ball('head','teal',[0,0.69,0.12],[0.26,0.23,0.16],face);
    eyes(0.72,0.266,0.105,0.034);
    feet([[-0.12,0.44,0.11],[0.12,0.44,0.11]],'teal',[0.055,0.075,0.07]);
    ball('tail','teal',[0,0.60,-0.27],[0.055,0.04,0.19],body,0);
    ball('tail_seed','amber',[0,0.60,-0.45],[0.06,0.05,0.07],ornament,0);
  } else if (id === 'glintot') {
    cyl('hex_body','amber',[0,0.30,0],0.31,0.38,0.34,6);
    ball('shell','cream',[0,0.47,-0.04],[0.33,0.18,0.34],body,1);
    feet([[-0.29,0.08,0.23],[0.29,0.08,0.23],[-0.34,0.08,-0.03],[0.34,0.08,-0.03],[-0.26,0.08,-0.27],[0.26,0.08,-0.27]],'teal',[0.10,0.07,0.13]);
    ball('face_patch','ink',[0,0.33,0.333],[0.23,0.14,0.06],face);
    ball('eye_left','cream',[-0.085,0.36,0.39],[0.033,0.04,0.016],face,1,true);
    ball('eye_right','cream',[0.085,0.36,0.39],[0.033,0.04,0.016],face,1,true);
    ball('mouth','amber',[0,0.29,0.397],[0.022,0.008,0.01],face,0);
    [-0.19,0,0.19].forEach((z,i)=>ball('ridge_seed_'+i,'amber',[0,0.64,z-0.04],[0.065,0.06,0.065],ornament,0,true));
    [-1,1].forEach(s=>ball('glow_window_'+s,'amber',[s*0.30,0.33,0],[0.04,0.12,0.15],ornament,0,true));
  } else if (id === 'hushbulb') {
    ball('bud_body','twilight',[0,0.51,0],[0.32,0.41,0.28]);
    feet([[-0.15,0.07,0.04],[0.15,0.07,0.04]],'teal');
    ball('inner_light','amber',[0,0.57,0.19],[0.24,0.28,0.16],face,1,true);
    ball('face_patch','cream',[0,0.59,0.316],[0.17,0.17,0.035],face,1);
    eyes(0.63,0.352,0.075,0.030);
    const pl=ball('petal_left','twilight',[-0.23,0.51,0.12],[0.16,0.39,0.14],ornament,1);pl.rotation.z=-0.14;
    const pr=ball('petal_right','twilight',[0.23,0.51,0.12],[0.16,0.39,0.14],ornament,1);pr.rotation.z=0.14;
    ball('petal_back_left','twilight',[-0.085,0.66,-0.12],[0.18,0.43,0.14],ornament,1);
    ball('petal_back_right','twilight',[0.085,0.66,-0.12],[0.18,0.43,0.14],ornament,1);
    ball('back_seed','teal',[0,0.47,-0.27],[0.07,0.09,0.035],ornament,0);
  }
  return t.finalize();
}

/** A neutral small explorer. Palette overrides permit your son's color choices. */
export function buildPlayer(THREE, options = {}) {
  const t=toolkit(THREE,'keeper',options);
  const {body,face,ornament,ball,cyl,leaf,eyes,part}=t;
  const skin='#A56F4F';
  // Simple separate limb groups remain addressable for a later walking animation.
  cyl('leg_left','ink',[-0.12,0.27,0],0.07,0.065,0.28,6);
  cyl('leg_right','ink',[0.12,0.27,0],0.07,0.065,0.28,6);
  ball('boot_left','cream',[-0.12,0.09,0.05],[0.10,0.10,0.16],body,1);
  ball('boot_right','cream',[0.12,0.09,0.05],[0.10,0.10,0.16],body,1);
  cyl('shorts','ink',[0,0.43,0],0.21,0.21,0.19,8);
  cyl('rain_cape','amber',[0,0.68,0],0.16,0.32,0.48,8);
  ball('collar','cream',[0,0.89,0.12],[0.15,0.05,0.07],ornament,0);
  ball('head',skin,[0,1.10,0],[0.25,0.28,0.23],face,1);
  ball('hair','ink',[0,1.24,-0.025],[0.25,0.18,0.23],ornament,1);
  ball('ear_left',skin,[-0.24,1.10,0],[0.045,0.07,0.05],face,0);
  ball('ear_right',skin,[0.24,1.10,0],[0.045,0.07,0.05],face,0);
  eyes(1.12,0.218,0.085,0.026);
  face.getObjectByName('mouth').position.set(0,-0.062,0.007);
  ball('nose',skin,[0,1.06,0.237],[0.035,0.035,0.035],face,0);
  ball('hand_left',skin,[-0.29,0.52,0.05],[0.06,0.075,0.06],body,0);
  ball('hand_right',skin,[0.29,0.52,0.05],[0.06,0.075,0.06],body,0);
  ball('satchel','teal',[0.27,0.55,-0.035],[0.13,0.16,0.075],ornament,1);
  part('strap',new THREE.BoxGeometry(0.045,0.48,0.035),'teal',[0.08,0.70,0.22],[1,1,1],[0,0,-0.35],ornament);
  ball('satchel_clasp','cream',[0.27,0.56,0.045],[0.035,0.035,0.025],ornament,0);
  return t.finalize();
}

/** Call per frame; does not move the root or change the navigation collision shape. */
export function animateCreature(root,time,state='idle') {
  if (!Number.isFinite(time)) return;
  const body=root.getObjectByName('body'); if (!body) return;
  const t=time+(root.userData.animationPhase||0);
  body.position.y=(root.userData.restY||0)+Math.sin(t*2.3)*0.012;
  body.rotation.set(0,0,Math.sin(t*1.7)*0.022);
  body.scale.set(1,1,1);
  if(state==='happy') {
    const hop=Math.max(0,Math.sin(t*7)); body.position.y+=hop*0.10;
    body.scale.set(1-hop*0.035,1+hop*0.07,1-hop*0.035);
  } else if(state==='work') {
    body.rotation.x=Math.sin(t*6)*0.10; body.rotation.z=Math.sin(t*3)*0.05;
  } else if(state==='sleep') {
    body.scale.y=0.92+Math.sin(t*1.3)*0.025;
  }
  const face=root.getObjectByName('face');
  if(face) for(const name of ['eye_left','eye_right']) {
    const eye=face.getObjectByName(name); if(!eye) continue;
    if(eye.userData.openEyeScaleY===undefined) eye.userData.openEyeScaleY=eye.scale.y;
    const blink=(t%4.7)>4.56;
    eye.scale.y=eye.userData.openEyeScaleY*(state==='sleep'||blink?0.13:1);
  }
}

/** Dispose an asset instance only after removing it from the scene. */
export function disposeAsset(root) {
  const geometries=new Set(),materials=new Set();
  root.traverse(node=>{
    if(node.geometry) geometries.add(node.geometry);
    if(node.material) (Array.isArray(node.material)?node.material:[node.material]).forEach(m=>materials.add(m));
  });
  geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose());
}
