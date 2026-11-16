// Emberline Crossing — the map. One layout, three skins: the same lanes, cover
// and sightlines read through whatever theme palette.js picks. Cover is
// data-driven (COVER), so the map is easy to reason about and the bots' routes
// are the same data the player reads.
import * as THREE from 'three';
import { THEME } from './palette.js';
import { createBuildings } from './buildings.js';
import {
  groundTexture, concreteTexture, metalTexture, woodTexture, crateTexture,
  doorTexture, roadTexture, graffitiTexture, hazardTexture, posterTexture,
} from './textures.js';

export const MAP = { halfX: 24, halfZ: 20, wallH: 4.5 };

// Cover boxes: [x, z, width, depth, height, material, rotationY?]
// Lanes run south (attacker spawn) to north (defenders + sites): left via A,
// middle through the yard, right via B.
const COVER = [
  // Central hall block — the map's anchor, splits mid into two corridors.
  [-2,-2,10,6,3.4,"concrete",0],
  [6,-2,3,6,2.6,"metal",0],
  // Left lane cover (toward site A).
  [-13,6,4,1.6,1.2,"crate",0],
  [-17,0,1.6,4,1.2,"crate",0],
  [-11,-6,3.4,1.4,1.1,"wood",0.35],
  [-16,-8,2,2,2.4,"metal",0],
  // Right lane cover (toward site B).
  [13,6,4,1.6,1.2,"crate",0],
  [17,0,1.6,4,1.2,"crate",0],
  [11,-6,3.4,1.4,1.1,"wood",-0.3],
  [16,-8,2,2,2.4,"metal",0],
  // Mid clutter — low cover you can vault sightlines over, never full walls.
  [-6,10,3,1.4,1.0,"crate",0.2],
  [6,10,3,1.4,1.0,"crate",-0.2],
  [0,4,2.4,1.2,1.1,"wood",0],
  // Site A furniture (depot): stacked crates + a container.
  [-18,-13,4.4,2.2,2.6,"metal",0],
  [-11,-15,2,2,1.2,"crate",0],
  [-13,-16.5,1.6,1.6,1.1,"crate",0.5],
  // Site B furniture (overpass): container + barriers.
  [18,-13,4.4,2.2,2.6,"metal",0],
  [11,-15,2,2,1.2,"crate",0],
  [13,-16.5,1.6,1.6,1.1,"crate",-0.4],
  // Spawn cover.
  [-8,15,3,1.4,1.1,"crate",0],
  [8,15,3,1.4,1.1,"crate",0],
  [-4,-16,3,1.4,1.1,"crate",0],
  [4,-16,3,1.4,1.1,"crate",0],
];

export const SITES = [
  { name: "A", label: "Depot", center: new THREE.Vector3(-15,0,-13), radius: 4.6 },
  { name: "B", label: "Overpass", center: new THREE.Vector3(15,0,-13), radius: 4.6 },
];

export const ATTACKER_SPAWNS = [
  new THREE.Vector3(-6,0,16), new THREE.Vector3(-2,0,17.5),
  new THREE.Vector3(2,0,17.5), new THREE.Vector3(6,0,16),
  new THREE.Vector3(0,0,14),
];
export const DEFENDER_SPAWNS = [
  new THREE.Vector3(-6,0,-17), new THREE.Vector3(-2,0,-18),
  new THREE.Vector3(2,0,-18), new THREE.Vector3(6,0,-17),
  new THREE.Vector3(0,0,-15),
];

// Bot routes: lanes from spawn to each site, plus hold spots for defenders.
export const ROUTES = {
  attackA: [[-4,14],[-10,8],[-14,2],[-15,-6],[-15,-12]],
  attackB: [[4,14],[10,8],[14,2],[15,-6],[15,-12]],
  attackMid: [[0,13],[-3,6],[0,0],[-2,-6],[-8,-11]],
  defendA: [[-13,-16],[-17,-10],[-11,-8],[-15,-10]],
  defendB: [[13,-16],[17,-10],[11,-8],[15,-10]],
  defendMid: [[0,-15],[-6,-9],[4,-9],[0,-12]],
};

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(THEME.skyTop) },
      mid: { value: new THREE.Color(THEME.skyMid) },
      horizon: { value: new THREE.Color(THEME.skyHorizon) },
      sunDir: { value: new THREE.Vector3(...THEME.sunPosition).normalize() },
      sunColor: { value: new THREE.Color(THEME.sunColor) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      uniform vec3 sunDir; uniform vec3 sunColor;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.65, h));
        float sun = pow(max(dot(vDir, sunDir), 0.0), 90.0);
        float glow = pow(max(dot(vDir, sunDir), 0.0), 6.0);
        col += sunColor * (sun * 0.9 + glow * 0.35);
        // Thin wispy clouds: two crossing sine bands, only high up and
        // fading toward the horizon so the skyline stays readable.
        float band = sin(vDir.x * 4.0 + vDir.y * 9.0) * sin(vDir.z * 3.0 - vDir.y * 6.0);
        float clouds = smoothstep(0.55, 0.9, band) * smoothstep(0.06, 0.35, vDir.y);
        col = mix(col, vec3(1.0, 0.92, 0.85) * 0.55, clouds * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function labelTexture(text, color, sub) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = color;
  ctx.font = '700 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillText(text, 256, sub ? 48 : 64);
  if (sub) {
    ctx.font = '500 30px system-ui, sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(stage) {
  const solids = [];
  const targets = [];
  const root = new THREE.Group();
  stage.add(root);

  const groundTx = groundTexture(7);
  const concreteTx = concreteTexture(11);
  const metalTx = metalTexture(13);
  const woodTx = woodTexture(17);
  const crateTx = crateTexture(19);
  const crateTxB = crateTexture(23, THEME.crateB);

  const groundM = new THREE.MeshStandardMaterial({
    map: groundTx.map, bumpMap: groundTx.bump, bumpScale: 0.6,
    roughness: THEME.groundRoughness, metalness: THEME.id === 'neon' ? 0.14 : 0.0,
  });
  const concreteM = new THREE.MeshStandardMaterial({ map: concreteTx, roughness: 0.92 });
  const metalM = new THREE.MeshStandardMaterial({ map: metalTx, roughness: 0.55, metalness: 0.35 });
  const woodM = new THREE.MeshStandardMaterial({ map: woodTx, roughness: 0.85 });
  const crateM = new THREE.MeshStandardMaterial({ map: crateTx, roughness: 0.85 });
  const crateMB = new THREE.MeshStandardMaterial({ map: crateTxB, roughness: 0.85 });
  const darkM = new THREE.MeshStandardMaterial({ color: THEME.wallConcreteDark, roughness: 0.95 });
  const byKind = { concrete: concreteM, metal: metalM, wood: woodM, crate: crateM, crateB: crateMB };

  // Ground.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP.halfX * 2, MAP.halfZ * 2), groundM);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  targets.push(ground);

  // Asphalt roads with faded centre dashes along the three lanes.
  const roadTx = roadTexture();
  const roadM = new THREE.MeshStandardMaterial({ map: roadTx, roughness: 0.85 });
  const roadG = new THREE.PlaneGeometry(3.4, 36);
  for (const x of [-14, 0, 14]) {
    const road = new THREE.Mesh(roadG, roadM);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.015, 0);
    road.receiveShadow = true;
    root.add(road);
  }
  // Sidewalk strips along the perimeter walls (lighter concrete border).
  const walkM = new THREE.MeshStandardMaterial({ map: concreteTx, roughness: 0.95 });
  const walkGH = new THREE.PlaneGeometry(MAP.halfX * 2, 2.2);
  const walkGV = new THREE.PlaneGeometry(2.2, MAP.halfZ * 2);
  for (const [geo, x, z] of [
    [walkGH, 0, -MAP.halfZ + 1.1], [walkGH, 0, MAP.halfZ - 1.1],
    [walkGV, -MAP.halfX + 1.1, 0], [walkGV, MAP.halfX - 1.1, 0],
  ]) {
    const walk = new THREE.Mesh(geo, walkM);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(x, 0.012, z);
    walk.receiveShadow = true;
    root.add(walk);
  }
  // Puddles: dark, shiny, catching the low sun as a glint.
  const puddleM = new THREE.MeshPhongMaterial({
    color: '#1c2430', shininess: 120, specular: new THREE.Color('#ffd9a0'),
  });
  for (const [x, z, w, d] of [[-6, 6, 2.4, 1.6], [10, -6, 1.8, 1.4], [-12, -4, 2.0, 1.3], [4, 12, 1.6, 1.2]]) {
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(w, d), puddleM);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = x * 0.3;
    puddle.position.set(x, 0.02, z);
    root.add(puddle);
  }

  // Perimeter walls.
  const wallGH = new THREE.BoxGeometry(MAP.halfX * 2 + 1, MAP.wallH, 1);
  const wallGV = new THREE.BoxGeometry(1, MAP.wallH, MAP.halfZ * 2 + 1);
  const walls = [
    { mesh: new THREE.Mesh(wallGH, concreteM), x: 0, z: -MAP.halfZ - 0.5 },
    { mesh: new THREE.Mesh(wallGH, concreteM), x: 0, z: MAP.halfZ + 0.5 },
    { mesh: new THREE.Mesh(wallGV, concreteM), x: -MAP.halfX - 0.5, z: 0 },
    { mesh: new THREE.Mesh(wallGV, concreteM), x: MAP.halfX + 0.5, z: 0 },
  ];
  for (const { mesh, x, z } of walls) {
    mesh.position.set(x, MAP.wallH / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    targets.push(mesh);
  }

  // Cover from COVER.
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  for (const [x, z, w, d, h, mat, rot] of COVER) {
    const mesh = new THREE.Mesh(unitBox, byKind[mat] || concreteM);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.rotation.y = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    targets.push(mesh);
    // Axis-aligned collider (rotation is small; use the unrotated footprint,
    // widened slightly — safe and simple).
    const pad = Math.abs(Math.sin(rot)) * Math.max(w, d) * 0.5 + 0.12;
    solids.push({
      minX: x - w / 2 - pad, maxX: x + w / 2 + pad,
      minZ: z - d / 2 - pad, maxZ: z + d / 2 + pad, height: h,
    });
  }

  // Site markers: painted ring on the ground + a beacon pole with a glowing tip.
  const ringG = new THREE.RingGeometry(3.6, 4.6, 40);
  for (const site of SITES) {
    const circle = new THREE.Mesh(
      ringG,
      new THREE.MeshBasicMaterial({ color: THEME.accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(site.center.x, 0.03, site.center.z);
    root.add(circle);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: THEME.wallMetalDark, roughness: 0.6, metalness: 0.4 }),
    );
    mast.position.set(site.center.x + 4.2, 1.6, site.center.z + 3.6);
    mast.castShadow = true;
    root.add(mast);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({
        color: THEME.accent, emissive: THEME.accentEmissive, emissiveIntensity: 2.2,
      }),
    );
    beacon.position.set(site.center.x + 4.2, 3.4, site.center.z + 3.6);
    root.add(beacon);
    const glow = new THREE.PointLight(THEME.accent, 14, 16, 1.8);
    glow.position.copy(beacon.position);
    root.add(glow);
  }

  // Site letters floating over the sites (A / B) — big, emissive, readable.
  for (const site of SITES) {
    const tex = labelTexture(`SITE ${site.name}`, THEME.accent, site.label);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false,
    }));
    sprite.scale.set(7, 1.75, 1);
    sprite.position.set(site.center.x, 5.4, site.center.z);
    root.add(sprite);
  }

  // ---- Site A: the Depot warehouse (real building, not a sign) ----
  // Corrugated shed with a gable roof, roll-up door and dock, standing
  // just behind the plant circle so the site stays playable.
  const shed = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 3.4), metalM);
  shed.position.set(-15, 2.1, -18.9);
  shed.castShadow = true;
  shed.receiveShadow = true;
  root.add(shed);
  targets.push(shed);
  const roofM = new THREE.MeshStandardMaterial({ color: THEME.wallMetalDark, roughness: 0.6, metalness: 0.4 });
  const roofG = new THREE.BoxGeometry(9.6, 0.12, 2.2);
  const roofSouth = new THREE.Mesh(roofG, roofM);
  roofSouth.position.set(-15, 4.7, -18.05);
  roofSouth.rotation.x = -0.53;
  roofSouth.castShadow = true;
  root.add(roofSouth);
  const roofNorth = new THREE.Mesh(roofG, roofM);
  roofNorth.position.set(-15, 4.7, -19.75);
  roofNorth.rotation.x = 0.53;
  roofNorth.castShadow = true;
  root.add(roofNorth);
  const doorM = new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.6, metalness: 0.35 });
  const shutter = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0), doorM);
  shutter.position.set(-15, 1.5, -17.19);
  root.add(shutter);
  const depotTag = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture('DEPOT 7', THEME.accent, 'WAREHOUSE'), transparent: true, depthWrite: false, fog: false,
  }));
  depotTag.scale.set(4.5, 1.1, 1);
  depotTag.position.set(-15, 4.9, -16.9);
  root.add(depotTag);
  // Hazard-striped dock marking on the ground in front of the door.
  const hazardTx = hazardTexture();
  hazardTx.repeat.set(3, 1);
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 1.6),
    new THREE.MeshStandardMaterial({ map: hazardTx, roughness: 0.9, transparent: true, opacity: 0.75 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(-15, 0.025, -15.9);
  root.add(pad);
  // Pipes flanking the door, against the warehouse face.
  const pipeG = new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8);
  const pipeM = new THREE.MeshStandardMaterial({ color: THEME.wallMetalDark, roughness: 0.55, metalness: 0.5 });
  for (const px of [-17.6, -12.4]) {
    const tube = new THREE.Mesh(pipeG, pipeM);
    tube.position.set(px, 1.8, -17.14);
    tube.castShadow = true;
    root.add(tube);
  }
  solids.push({ minX: -19.5, maxX: -10.5, minZ: -20.6, maxZ: -17.2, height: 4.2 });

  // ---- Site B: the Overpass (concrete bridge deck on two pillars) ----
  // The deck spans the site's north edge; the pillars stand clear of the
  // site's container (which sits at x 15.8-20.2) and of the plant circle.
  const span = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3.6), concreteM);
  span.position.set(15.5, 3.2, -13);
  span.castShadow = true;
  span.receiveShadow = true;
  root.add(span);
  targets.push(span);
  const deckTop = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.2), roadM);
  deckTop.rotation.x = -Math.PI / 2;
  deckTop.rotation.z = Math.PI / 2;
  deckTop.position.set(15.5, 3.46, -13);
  root.add(deckTop);
  const railG = new THREE.BoxGeometry(12, 0.55, 0.08);
  for (const rz of [-14.75, -11.25]) {
    const guard = new THREE.Mesh(railG, darkM);
    guard.position.set(15.5, 3.7, rz);
    guard.castShadow = true;
    root.add(guard);
  }
  const beamG = new THREE.BoxGeometry(12, 0.3, 0.3);
  for (const bz of [-14.2, -11.8]) {
    const strut = new THREE.Mesh(beamG, darkM);
    strut.position.set(15.5, 2.85, bz);
    root.add(strut);
  }
  const pillarG = new THREE.BoxGeometry(0.9, 3.2, 0.9);
  for (const px of [9.9, 21.1]) {
    const post = new THREE.Mesh(pillarG, concreteM);
    post.position.set(px, 1.6, -13);
    post.castShadow = true;
    post.receiveShadow = true;
    root.add(post);
    targets.push(post);
    solids.push({ minX: px - 0.45, maxX: px + 0.45, minZ: -13.45, maxZ: -12.55, height: 3.2 });
  }
  // Hazard stripes on the deck's short ends, facing the lanes.
  const endHazardM = new THREE.MeshStandardMaterial({ map: hazardTx, roughness: 0.9 });
  for (const [ex, ry] of [[9.45, -Math.PI / 2], [21.55, Math.PI / 2]]) {
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), endHazardM);
    cap.position.set(ex, 3.2, -13);
    cap.rotation.y = ry;
    root.add(cap);
  }

  // ---- Props: barrels, dumpster, sandbags, pallets ----
  const barrelM = new THREE.MeshStandardMaterial({ color: '#6a3a28', roughness: 0.7, metalness: 0.3 });
  const barrelG = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12);
  const barrelSpots = [[-9.5, 8.5], [12, -1], [-19, -9.5], [19, -9.5]];
  for (const [bx, bz] of barrelSpots) {
    const first = new THREE.Mesh(barrelG, barrelM);
    first.position.set(bx, 0.45, bz);
    first.castShadow = true;
    root.add(first);
    const second = new THREE.Mesh(barrelG, barrelM);
    second.position.set(bx + 0.75, 0.45, bz + 0.2);
    second.castShadow = true;
    root.add(second);
    solids.push({ minX: bx - 0.4, maxX: bx + 1.15, minZ: bz - 0.4, maxZ: bz + 0.6, height: 0.9 });
  }
  const dumpM = new THREE.MeshStandardMaterial({ color: '#2a3a2a', roughness: 0.8, metalness: 0.2 });
  const bin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.1), dumpM);
  bin.position.set(7, 0.65, -17.2);
  bin.castShadow = true;
  bin.receiveShadow = true;
  root.add(bin);
  targets.push(bin);
  const binLid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.1), darkM);
  binLid.position.set(7, 1.36, -17.2);
  binLid.rotation.x = -0.18;
  root.add(binLid);
  solids.push({ minX: 5.9, maxX: 8.1, minZ: -17.75, maxZ: -16.65, height: 1.3 });
  // Sandbag walls (two stacked rows, real low cover) at both site fronts.
  const bagM = new THREE.MeshStandardMaterial({ color: '#7a6a44', roughness: 1 });
  const bagG = new THREE.BoxGeometry(0.6, 0.35, 0.4);
  for (const cx of [-12, 12]) {
    for (let r = 0; r < 2; r += 1) {
      for (let i = 0; i < 6; i += 1) {
        const sack = new THREE.Mesh(bagG, bagM);
        sack.position.set(cx - 1.5 + i * 0.62, 0.18 + r * 0.34, -8.5 + (r % 2) * 0.05);
        sack.rotation.y = (i % 2 ? 0.08 : -0.06);
        sack.castShadow = true;
        root.add(sack);
      }
    }
    solids.push({ minX: cx - 1.85, maxX: cx + 1.85, minZ: -8.75, maxZ: -8.25, height: 0.7 });
  }
  const palletG = new THREE.BoxGeometry(1.2, 0.12, 1.0);
  for (const [px, pz, ry] of [[-13, -15.5, 0.3], [13, -15.5, -0.2]]) {
    const slat = new THREE.Mesh(palletG, woodM);
    slat.position.set(px, 0.06, pz);
    slat.rotation.y = ry;
    slat.receiveShadow = true;
    root.add(slat);
  }

  // ---- Wall decals: graffiti + posters ----
  const graffM = new THREE.MeshBasicMaterial({
    map: graffitiTexture(71), transparent: true, depthWrite: false,
  });
  const graffMB = new THREE.MeshBasicMaterial({
    map: graffitiTexture(97, '#7fd4ff'), transparent: true, depthWrite: false,
  });
  const graffG = new THREE.PlaneGeometry(2.4, 1.2);
  for (const [gx, gz, ry, mat] of [
    [-6, -19.93, 0, graffM], [10, -19.93, 0, graffMB],
    [4, 19.93, Math.PI, graffM], [-2, 1.02, 0, graffMB],
  ]) {
    const mark = new THREE.Mesh(graffG, mat);
    mark.position.set(gx, 1.4, gz);
    mark.rotation.y = ry;
    root.add(mark);
  }
  const posterG = new THREE.PlaneGeometry(0.9, 1.35);
  const posterL = new THREE.Mesh(posterG, new THREE.MeshBasicMaterial({ map: posterTexture(83, 'EMBERLINE') }));
  posterL.position.set(-7.02, 1.5, -2);
  posterL.rotation.y = -Math.PI / 2;
  root.add(posterL);
  const posterR = new THREE.Mesh(posterG, new THREE.MeshBasicMaterial({ map: posterTexture(89, 'RAIL YARD', '#4a6fa5') }));
  posterR.position.set(3.02, 1.5, -2);
  posterR.rotation.y = Math.PI / 2;
  root.add(posterR);

  // ---- Cables strung between lamp posts (sagging, 3 segments each) ----
  const cableM = new THREE.MeshBasicMaterial({ color: '#14100c' });
  const up = new THREE.Vector3(0, 1, 0);
  function stringCable(points) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 5), cableM);
      piece.position.copy(a).addScaledVector(dir, 0.5);
      piece.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      root.add(piece);
    }
  }
  stringCable([
    new THREE.Vector3(-8, 4.4, 2), new THREE.Vector3(-2.7, 4.05, 2),
    new THREE.Vector3(2.7, 4.05, 2), new THREE.Vector3(8, 4.4, 2),
  ]);
  stringCable([
    new THREE.Vector3(-8, 4.4, -10), new THREE.Vector3(-2.7, 4.05, -10),
    new THREE.Vector3(2.7, 4.05, -10), new THREE.Vector3(8, 4.4, -10),
  ]);

  // ---- Weeds tufting along the wall bases ----
  const weedM = new THREE.MeshStandardMaterial({ color: '#4a5a2e', roughness: 1 });
  const weedG = new THREE.ConeGeometry(0.18, 0.42, 6);
  const weedPlaces = [
    [-23, -14], [-23, -4], [-23, 8], [23, -12], [23, 4], [23, 14],
    [-14, -19], [-2, -19], [8, -19], [-18, 19], [2, 19], [16, 19],
    [-21, -17], [21, -18], [-21, 17], [20, 17],
  ];
  for (const [wx, wz] of weedPlaces) {
    const tuft = new THREE.Mesh(weedG, weedM);
    tuft.position.set(wx, 0.21, wz);
    root.add(tuft);
  }

  // Lamp posts with warm pools of light.
  const lampPlaces = [[-8, 2], [8, 2], [-8, -10], [8, -10]];
  const lampPoleG = new THREE.CylinderGeometry(0.07, 0.1, 4.4, 8);
  const headG = new THREE.SphereGeometry(0.16, 10, 8);
  const headM = new THREE.MeshStandardMaterial({
    color: THEME.lamp, emissive: THEME.lamp, emissiveIntensity: 3,
  });
  for (const [x, z] of lampPlaces) {
    const pole = new THREE.Mesh(lampPoleG, darkM);
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    root.add(pole);
    const bulb = new THREE.Mesh(headG, headM);
    bulb.position.set(x, 4.5, z);
    root.add(bulb);
    const glow = new THREE.PointLight(THEME.lamp, 20, 20, 1.8);
    glow.position.set(x, 4.3, z);
    root.add(glow);
  }

  // Theme props: pines + fireflies (mist), neon signs + rain (neon), skyline (all).
  if (THEME.id === 'mist') {
    const trunkM = new THREE.MeshStandardMaterial({ color: THEME.woodDark, roughness: 1 });
    const pineM = new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 1 });
    const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 7);
    const coneG = new THREE.ConeGeometry(1.9, 4.6, 8);
    const pinePlaces = [[-22, -18], [-21, 12], [22, -17], [21, 14], [-22, -2], [22, 2], [-10, -19], [12, -19]];
    for (const [x, z] of pinePlaces) {
      const stem = new THREE.Mesh(trunkG, trunkM);
      stem.position.set(x, 1.2, z);
      stem.castShadow = true;
      root.add(stem);
      const top = new THREE.Mesh(coneG, pineM);
      top.position.set(x, 4.4, z);
      top.castShadow = true;
      root.add(top);
      const top2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 8), pineM);
      top2.position.set(x, 6.6, z);
      root.add(top2);
      solids.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, height: 2.4 });
    }
  }
  if (THEME.id === 'neon') {
    const boards = [
      { text: 'EMBERLINE', sub: 'CROSSING', x: 0, z: -19.3, color: THEME.neonB, w: 12 },
      { text: 'SITE A', sub: 'DEPOT', x: -15, z: -18.9, color: THEME.neonA, w: 6 },
      { text: 'SITE B', sub: 'OVERPASS', x: 15, z: -18.9, color: THEME.neonA, w: 6 },
    ];
    for (const board of boards) {
      const tex = labelTexture(board.text, board.color, board.sub);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
      }));
      sprite.scale.set(board.w, board.w / 4, 1);
      sprite.position.set(board.x, 3.6, board.z);
      root.add(sprite);
    }
    // Neon strip lights along the top of the perimeter walls.
    const stripG = new THREE.BoxGeometry(10, 0.12, 0.12);
    for (const [x, z, color] of [[-12, -19.9, THEME.neonA], [12, -19.9, THEME.neonB], [0, 19.9, THEME.neonC]]) {
      const bar = new THREE.Mesh(stripG, new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 2.5,
      }));
      bar.position.set(x, 4.1, z);
      root.add(bar);
    }
  }

  // Real 3D city ring around the yard (replaces the old flat silhouettes):
  // lit windows, parapets, roof props, ground-floor shops.
  createBuildings(stage);

  // Sky dome + sun disc.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 16), skyMaterial());
  stage.add(dome);
  const sunVec = new THREE.Vector3(...THEME.sunPosition).normalize();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(7, 32),
    new THREE.MeshBasicMaterial({ color: THEME.sunDisc, fog: false, transparent: true, opacity: 0.95 }),
  );
  disc.position.copy(sunVec).multiplyScalar(130);
  disc.lookAt(0, 0, 0);
  stage.add(disc);

  // Sun + hemisphere.
  const sun = new THREE.DirectionalLight(THEME.sunColor, THEME.sunIntensity);
  sun.position.set(...THEME.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -THEME.sunShadowSize;
  sun.shadow.camera.right = THEME.sunShadowSize;
  sun.shadow.camera.top = THEME.sunShadowSize;
  sun.shadow.camera.bottom = -THEME.sunShadowSize;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0006;
  stage.add(sun);
  const ambient = new THREE.HemisphereLight(THEME.hemiSky, THEME.hemiGround, THEME.hemiIntensity);
  stage.add(ambient);

  return { group: root, colliders: solids, shootables: targets, sites: SITES, sunLight: sun, hemi: ambient };
}
