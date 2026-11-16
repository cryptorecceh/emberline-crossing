// Emberline Crossing — the map. One layout, three skins: the same lanes, cover
// and sightlines read through whatever theme palette.js picks. Cover is
// data-driven (LAYOUT), so the map is easy to reason about and the bots' routes
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
const LAYOUT = [
  // Central hall block — the map's anchor, splits mid into two corridors.
  [-2, -2, 10, 6, 3.4, 'concrete', 0],
  [6, -2, 3, 6, 2.6, 'metal', 0],
  // Left lane cover (toward site A).
  [-13, 6, 4, 1.6, 1.2, 'crate', 0],
  [-17, 0, 1.6, 4, 1.2, 'crate', 0],
  [-11, -6, 3.4, 1.4, 1.1, 'wood', 0.35],
  [-16, -8, 2, 2, 2.4, 'metal', 0],
  // Right lane cover (toward site B).
  [13, 6, 4, 1.6, 1.2, 'crate', 0],
  [17, 0, 1.6, 4, 1.2, 'crate', 0],
  [11, -6, 3.4, 1.4, 1.1, 'wood', -0.3],
  [16, -8, 2, 2, 2.4, 'metal', 0],
  // Mid clutter — low cover you can vault sightlines over, never full walls.
  [-6, 10, 3, 1.4, 1.0, 'crate', 0.2],
  [6, 10, 3, 1.4, 1.0, 'crate', -0.2],
  [0, 4, 2.4, 1.2, 1.1, 'wood', 0],
  // Site A furniture (depot): stacked crates + a container.
  [-18, -13, 4.4, 2.2, 2.6, 'metal', 0],
  [-11, -15, 2, 2, 1.2, 'crate', 0],
  [-13, -16.5, 1.6, 1.6, 1.1, 'crate', 0.5],
  // Site B furniture (overpass): container + barriers.
  [18, -13, 4.4, 2.2, 2.6, 'metal', 0],
  [11, -15, 2, 2, 1.2, 'crate', 0],
  [13, -16.5, 1.6, 1.6, 1.1, 'crate', -0.4],
  // Spawn cover.
  [-8, 15, 3, 1.4, 1.1, 'crate', 0],
  [8, 15, 3, 1.4, 1.1, 'crate', 0],
  [-4, -16, 3, 1.4, 1.1, 'crate', 0],
  [4, -16, 3, 1.4, 1.1, 'crate', 0],
];

export const SITES = [
  { name: 'A', label: 'Depot', center: new THREE.Vector3(-15, 0, -13), radius: 4.6 },
  { name: 'B', label: 'Overpass', center: new THREE.Vector3(15, 0, -13), radius: 4.6 },
];

export const ATTACKER_SPAWNS = [
  new THREE.Vector3(-6, 0, 16), new THREE.Vector3(-2, 0, 17.5),
  new THREE.Vector3(2, 0, 17.5), new THREE.Vector3(6, 0, 16),
  new THREE.Vector3(0, 0, 14),
];
export const DEFENDER_SPAWNS = [
  new THREE.Vector3(-6, 0, -17), new THREE.Vector3(-2, 0, -18),
  new THREE.Vector3(2, 0, -18), new THREE.Vector3(6, 0, -17),
  new THREE.Vector3(0, 0, -15),
];

// Bot routes: lanes from spawn to each site, plus hold spots for defenders.
export const ROUTES = {
  attackA: [[-4, 14], [-10, 8], [-14, 2], [-15, -6], [-15, -12]],
  attackB: [[4, 14], [10, 8], [14, 2], [15, -6], [15, -12]],
  attackMid: [[0, 13], [-3, 6], [0, 0], [-2, -6], [-8, -11]],
  defendA: [[-13, -16], [-17, -10], [-11, -8], [-15, -10]],
  defendB: [[13, -16], [17, -10], [11, -8], [15, -10]],
  defendMid: [[0, -15], [-6, -9], [4, -9], [0, -12]],
};

function makeSky() {
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

function makeLabelTexture(text, color, sub) {
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

export function createWorld(scene) {
  const colliders = [];
  const shootables = [];
  const group = new THREE.Group();
  scene.add(group);

  const groundTex = groundTexture(7);
  const concreteTex = concreteTexture(11);
  const metalTex = metalTexture(13);
  const woodTex = woodTexture(17);
  const crateTex = crateTexture(19);
  const crateTexB = crateTexture(23, THEME.crateB);

  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex.map, bumpMap: groundTex.bump, bumpScale: 0.6,
    roughness: THEME.groundRoughness, metalness: THEME.id === 'neon' ? 0.14 : 0.0,
  });
  const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.92 });
  const metalMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.55, metalness: 0.35 });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 });
  const crateMatA = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 });
  const crateMatB = new THREE.MeshStandardMaterial({ map: crateTexB, roughness: 0.85 });
  const darkMat = new THREE.MeshStandardMaterial({ color: THEME.wallConcreteDark, roughness: 0.95 });
  const mats = { concrete: concreteMat, metal: metalMat, wood: woodMat, crate: crateMatA, crateB: crateMatB };

  // Ground.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP.halfX * 2, MAP.halfZ * 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  shootables.push(ground);

  // Asphalt roads with faded centre dashes along the three lanes.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
  const roadGeo = new THREE.PlaneGeometry(3.4, 36);
  for (const x of [-14, 0, 14]) {
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.015, 0);
    road.receiveShadow = true;
    group.add(road);
  }
  // Sidewalk strips along the perimeter walls (lighter concrete border).
  const walkMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 });
  const walkGeoH = new THREE.PlaneGeometry(MAP.halfX * 2, 2.2);
  const walkGeoV = new THREE.PlaneGeometry(2.2, MAP.halfZ * 2);
  for (const [geo, x, z] of [
    [walkGeoH, 0, -MAP.halfZ + 1.1], [walkGeoH, 0, MAP.halfZ - 1.1],
    [walkGeoV, -MAP.halfX + 1.1, 0], [walkGeoV, MAP.halfX - 1.1, 0],
  ]) {
    const walk = new THREE.Mesh(geo, walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(x, 0.012, z);
    walk.receiveShadow = true;
    group.add(walk);
  }
  // Puddles: dark, shiny, catching the low sun as a glint.
  const puddleMat = new THREE.MeshPhongMaterial({
    color: '#1c2430', shininess: 120, specular: new THREE.Color('#ffd9a0'),
  });
  for (const [x, z, w, d] of [[-6, 6, 2.4, 1.6], [10, -6, 1.8, 1.4], [-12, -4, 2.0, 1.3], [4, 12, 1.6, 1.2]]) {
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(w, d), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.rotation.z = x * 0.3;
    puddle.position.set(x, 0.02, z);
    group.add(puddle);
  }

  // Perimeter walls.
  const wallGeoH = new THREE.BoxGeometry(MAP.halfX * 2 + 1, MAP.wallH, 1);
  const wallGeoV = new THREE.BoxGeometry(1, MAP.wallH, MAP.halfZ * 2 + 1);
  const wallDefs = [
    { mesh: new THREE.Mesh(wallGeoH, concreteMat), x: 0, z: -MAP.halfZ - 0.5 },
    { mesh: new THREE.Mesh(wallGeoH, concreteMat), x: 0, z: MAP.halfZ + 0.5 },
    { mesh: new THREE.Mesh(wallGeoV, concreteMat), x: -MAP.halfX - 0.5, z: 0 },
    { mesh: new THREE.Mesh(wallGeoV, concreteMat), x: MAP.halfX + 0.5, z: 0 },
  ];
  for (const { mesh, x, z } of wallDefs) {
    mesh.position.set(x, MAP.wallH / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    shootables.push(mesh);
  }

  // Cover from LAYOUT.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const [x, z, w, d, h, mat, rot] of LAYOUT) {
    const mesh = new THREE.Mesh(boxGeo, mats[mat] || concreteMat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.rotation.y = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    shootables.push(mesh);
    // Axis-aligned collider (rotation is small; use the unrotated footprint,
    // widened slightly — safe and simple).
    const pad = Math.abs(Math.sin(rot)) * Math.max(w, d) * 0.5 + 0.12;
    colliders.push({
      minX: x - w / 2 - pad, maxX: x + w / 2 + pad,
      minZ: z - d / 2 - pad, maxZ: z + d / 2 + pad, height: h,
    });
  }

  // Site markers: painted ring on the ground + a beacon pole with a glowing tip.
  const siteRingGeo = new THREE.RingGeometry(3.6, 4.6, 40);
  for (const site of SITES) {
    const ring = new THREE.Mesh(
      siteRingGeo,
      new THREE.MeshBasicMaterial({ color: THEME.accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.center.x, 0.03, site.center.z);
    group.add(ring);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: THEME.wallMetalDark, roughness: 0.6, metalness: 0.4 }),
    );
    pole.position.set(site.center.x + 4.2, 1.6, site.center.z + 3.6);
    pole.castShadow = true;
    group.add(pole);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({
        color: THEME.accent, emissive: THEME.accentEmissive, emissiveIntensity: 2.2,
      }),
    );
    tip.position.set(site.center.x + 4.2, 3.4, site.center.z + 3.6);
    group.add(tip);
    const lamp = new THREE.PointLight(THEME.accent, 14, 16, 1.8);
    lamp.position.copy(tip.position);
    group.add(lamp);
  }

  // Site letters floating over the sites (A / B) — big, emissive, readable.
  for (const site of SITES) {
    const tex = makeLabelTexture(`SITE ${site.name}`, THEME.accent, site.label);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, fog: false,
    }));
    sprite.scale.set(7, 1.75, 1);
    sprite.position.set(site.center.x, 5.4, site.center.z);
    group.add(sprite);
  }

  // ---- Site A: the Depot warehouse (real building, not a sign) ----
  // Corrugated shed with a gable roof, roll-up door and dock, standing
  // just behind the plant circle so the site stays playable.
  const warehouse = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 3.4), metalMat);
  warehouse.position.set(-15, 2.1, -18.9);
  warehouse.castShadow = true;
  warehouse.receiveShadow = true;
  group.add(warehouse);
  shootables.push(warehouse);
  const roofMat = new THREE.MeshStandardMaterial({ color: THEME.wallMetalDark, roughness: 0.6, metalness: 0.4 });
  const roofPanelGeo = new THREE.BoxGeometry(9.6, 0.12, 2.2);
  const roofS = new THREE.Mesh(roofPanelGeo, roofMat);
  roofS.position.set(-15, 4.7, -18.05);
  roofS.rotation.x = -0.53;
  roofS.castShadow = true;
  group.add(roofS);
  const roofN = new THREE.Mesh(roofPanelGeo, roofMat);
  roofN.position.set(-15, 4.7, -19.75);
  roofN.rotation.x = 0.53;
  roofN.castShadow = true;
  group.add(roofN);
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.6, metalness: 0.35 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0), doorMat);
  door.position.set(-15, 1.5, -17.19);
  group.add(door);
  const depotSign = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeLabelTexture('DEPOT 7', THEME.accent, 'WAREHOUSE'), transparent: true, depthWrite: false, fog: false,
  }));
  depotSign.scale.set(4.5, 1.1, 1);
  depotSign.position.set(-15, 4.9, -16.9);
  group.add(depotSign);
  // Hazard-striped dock marking on the ground in front of the door.
  const hazardTex = hazardTexture();
  hazardTex.repeat.set(3, 1);
  const dock = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 1.6),
    new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9, transparent: true, opacity: 0.75 }),
  );
  dock.rotation.x = -Math.PI / 2;
  dock.position.set(-15, 0.025, -15.9);
  group.add(dock);
  // Pipes flanking the door, against the warehouse face.
  const pipeGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8);
  const pipeMat = new THREE.MeshStandardMaterial({ color: THEME.wallMetalDark, roughness: 0.55, metalness: 0.5 });
  for (const px of [-17.6, -12.4]) {
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.set(px, 1.8, -17.14);
    pipe.castShadow = true;
    group.add(pipe);
  }
  colliders.push({ minX: -19.5, maxX: -10.5, minZ: -20.6, maxZ: -17.2, height: 4.2 });

  // ---- Site B: the Overpass (concrete bridge deck on two pillars) ----
  // The deck spans the site's north edge; the pillars stand clear of the
  // site's container (which sits at x 15.8-20.2) and of the plant circle.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 3.6), concreteMat);
  deck.position.set(15.5, 3.2, -13);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  shootables.push(deck);
  const deckRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.2), roadMat);
  deckRoad.rotation.x = -Math.PI / 2;
  deckRoad.rotation.z = Math.PI / 2;
  deckRoad.position.set(15.5, 3.46, -13);
  group.add(deckRoad);
  const railGeo = new THREE.BoxGeometry(12, 0.55, 0.08);
  for (const rz of [-14.75, -11.25]) {
    const rail = new THREE.Mesh(railGeo, darkMat);
    rail.position.set(15.5, 3.7, rz);
    rail.castShadow = true;
    group.add(rail);
  }
  const beamGeo = new THREE.BoxGeometry(12, 0.3, 0.3);
  for (const bz of [-14.2, -11.8]) {
    const beam = new THREE.Mesh(beamGeo, darkMat);
    beam.position.set(15.5, 2.85, bz);
    group.add(beam);
  }
  const pillarGeo = new THREE.BoxGeometry(0.9, 3.2, 0.9);
  for (const px of [9.9, 21.1]) {
    const pillar = new THREE.Mesh(pillarGeo, concreteMat);
    pillar.position.set(px, 1.6, -13);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
    shootables.push(pillar);
    colliders.push({ minX: px - 0.45, maxX: px + 0.45, minZ: -13.45, maxZ: -12.55, height: 3.2 });
  }
  // Hazard stripes on the deck's short ends, facing the lanes.
  const endHazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9 });
  for (const [ex, ry] of [[9.45, -Math.PI / 2], [21.55, Math.PI / 2]]) {
    const end = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), endHazardMat);
    end.position.set(ex, 3.2, -13);
    end.rotation.y = ry;
    group.add(end);
  }

  // ---- Props: barrels, dumpster, sandbags, pallets ----
  const barrelMat = new THREE.MeshStandardMaterial({ color: '#6a3a28', roughness: 0.7, metalness: 0.3 });
  const barrelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12);
  const barrelClusters = [[-9.5, 8.5], [12, -1], [-19, -9.5], [19, -9.5]];
  for (const [bx, bz] of barrelClusters) {
    const b1 = new THREE.Mesh(barrelGeo, barrelMat);
    b1.position.set(bx, 0.45, bz);
    b1.castShadow = true;
    group.add(b1);
    const b2 = new THREE.Mesh(barrelGeo, barrelMat);
    b2.position.set(bx + 0.75, 0.45, bz + 0.2);
    b2.castShadow = true;
    group.add(b2);
    colliders.push({ minX: bx - 0.4, maxX: bx + 1.15, minZ: bz - 0.4, maxZ: bz + 0.6, height: 0.9 });
  }
  const dumpsterMat = new THREE.MeshStandardMaterial({ color: '#2a3a2a', roughness: 0.8, metalness: 0.2 });
  const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.1), dumpsterMat);
  dumpster.position.set(7, 0.65, -17.2);
  dumpster.castShadow = true;
  dumpster.receiveShadow = true;
  group.add(dumpster);
  shootables.push(dumpster);
  const dumpLid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.1), darkMat);
  dumpLid.position.set(7, 1.36, -17.2);
  dumpLid.rotation.x = -0.18;
  group.add(dumpLid);
  colliders.push({ minX: 5.9, maxX: 8.1, minZ: -17.75, maxZ: -16.65, height: 1.3 });
  // Sandbag walls (two stacked rows, real low cover) at both site fronts.
  const bagMat = new THREE.MeshStandardMaterial({ color: '#7a6a44', roughness: 1 });
  const bagGeo = new THREE.BoxGeometry(0.6, 0.35, 0.4);
  for (const cx of [-12, 12]) {
    for (let r = 0; r < 2; r += 1) {
      for (let i = 0; i < 6; i += 1) {
        const bag = new THREE.Mesh(bagGeo, bagMat);
        bag.position.set(cx - 1.5 + i * 0.62, 0.18 + r * 0.34, -8.5 + (r % 2) * 0.05);
        bag.rotation.y = (i % 2 ? 0.08 : -0.06);
        bag.castShadow = true;
        group.add(bag);
      }
    }
    colliders.push({ minX: cx - 1.85, maxX: cx + 1.85, minZ: -8.75, maxZ: -8.25, height: 0.7 });
  }
  const palletGeo = new THREE.BoxGeometry(1.2, 0.12, 1.0);
  for (const [px, pz, ry] of [[-13, -15.5, 0.3], [13, -15.5, -0.2]]) {
    const pallet = new THREE.Mesh(palletGeo, woodMat);
    pallet.position.set(px, 0.06, pz);
    pallet.rotation.y = ry;
    pallet.receiveShadow = true;
    group.add(pallet);
  }

  // ---- Wall decals: graffiti + posters ----
  const graffitiMat = new THREE.MeshBasicMaterial({
    map: graffitiTexture(71), transparent: true, depthWrite: false,
  });
  const graffitiMatB = new THREE.MeshBasicMaterial({
    map: graffitiTexture(97, '#7fd4ff'), transparent: true, depthWrite: false,
  });
  const graffGeo = new THREE.PlaneGeometry(2.4, 1.2);
  for (const [gx, gz, ry, mat] of [
    [-6, -19.93, 0, graffitiMat], [10, -19.93, 0, graffitiMatB],
    [4, 19.93, Math.PI, graffitiMat], [-2, 1.02, 0, graffitiMatB],
  ]) {
    const g = new THREE.Mesh(graffGeo, mat);
    g.position.set(gx, 1.4, gz);
    g.rotation.y = ry;
    group.add(g);
  }
  const posterGeo = new THREE.PlaneGeometry(0.9, 1.35);
  const posterA = new THREE.Mesh(posterGeo, new THREE.MeshBasicMaterial({ map: posterTexture(83, 'EMBERLINE') }));
  posterA.position.set(-7.02, 1.5, -2);
  posterA.rotation.y = -Math.PI / 2;
  group.add(posterA);
  const posterB = new THREE.Mesh(posterGeo, new THREE.MeshBasicMaterial({ map: posterTexture(89, 'RAIL YARD', '#4a6fa5') }));
  posterB.position.set(3.02, 1.5, -2);
  posterB.rotation.y = Math.PI / 2;
  group.add(posterB);

  // ---- Cables strung between lamp posts (sagging, 3 segments each) ----
  const cableMat = new THREE.MeshBasicMaterial({ color: '#14100c' });
  const cableUp = new THREE.Vector3(0, 1, 0);
  function runCable(points) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 5), cableMat);
      seg.position.copy(a).addScaledVector(dir, 0.5);
      seg.quaternion.setFromUnitVectors(cableUp, dir.clone().normalize());
      group.add(seg);
    }
  }
  runCable([
    new THREE.Vector3(-8, 4.4, 2), new THREE.Vector3(-2.7, 4.05, 2),
    new THREE.Vector3(2.7, 4.05, 2), new THREE.Vector3(8, 4.4, 2),
  ]);
  runCable([
    new THREE.Vector3(-8, 4.4, -10), new THREE.Vector3(-2.7, 4.05, -10),
    new THREE.Vector3(2.7, 4.05, -10), new THREE.Vector3(8, 4.4, -10),
  ]);

  // ---- Weeds tufting along the wall bases ----
  const weedMat = new THREE.MeshStandardMaterial({ color: '#4a5a2e', roughness: 1 });
  const weedGeo = new THREE.ConeGeometry(0.18, 0.42, 6);
  const weedSpots = [
    [-23, -14], [-23, -4], [-23, 8], [23, -12], [23, 4], [23, 14],
    [-14, -19], [-2, -19], [8, -19], [-18, 19], [2, 19], [16, 19],
    [-21, -17], [21, -18], [-21, 17], [20, 17],
  ];
  for (const [wx, wz] of weedSpots) {
    const weed = new THREE.Mesh(weedGeo, weedMat);
    weed.position.set(wx, 0.21, wz);
    group.add(weed);
  }

  // Lamp posts with warm pools of light.
  const lampSpots = [[-8, 2], [8, 2], [-8, -10], [8, -10]];
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.4, 8);
  const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const headMat = new THREE.MeshStandardMaterial({
    color: THEME.lamp, emissive: THEME.lamp, emissiveIntensity: 3,
  });
  for (const [x, z] of lampSpots) {
    const pole = new THREE.Mesh(poleGeo, darkMat);
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(x, 4.5, z);
    group.add(head);
    const light = new THREE.PointLight(THEME.lamp, 20, 20, 1.8);
    light.position.set(x, 4.3, z);
    group.add(light);
  }

  // Theme props: pines + fireflies (mist), neon signs + rain (neon), skyline (all).
  if (THEME.id === 'mist') {
    const trunkMat = new THREE.MeshStandardMaterial({ color: THEME.woodDark, roughness: 1 });
    const pineMat = new THREE.MeshStandardMaterial({ color: '#2f4a2c', roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 7);
    const coneGeo = new THREE.ConeGeometry(1.9, 4.6, 8);
    const pineSpots = [[-22, -18], [-21, 12], [22, -17], [21, 14], [-22, -2], [22, 2], [-10, -19], [12, -19]];
    for (const [x, z] of pineSpots) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 1.2, z);
      trunk.castShadow = true;
      group.add(trunk);
      const cone = new THREE.Mesh(coneGeo, pineMat);
      cone.position.set(x, 4.4, z);
      cone.castShadow = true;
      group.add(cone);
      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.2, 8), pineMat);
      cone2.position.set(x, 6.6, z);
      group.add(cone2);
      colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, height: 2.4 });
    }
  }
  if (THEME.id === 'neon') {
    const signs = [
      { text: 'EMBERLINE', sub: 'CROSSING', x: 0, z: -19.3, color: THEME.neonB, w: 12 },
      { text: 'SITE A', sub: 'DEPOT', x: -15, z: -18.9, color: THEME.neonA, w: 6 },
      { text: 'SITE B', sub: 'OVERPASS', x: 15, z: -18.9, color: THEME.neonA, w: 6 },
    ];
    for (const s of signs) {
      const tex = makeLabelTexture(s.text, s.color, s.sub);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
      }));
      sprite.scale.set(s.w, s.w / 4, 1);
      sprite.position.set(s.x, 3.6, s.z);
      group.add(sprite);
    }
    // Neon strip lights along the top of the perimeter walls.
    const stripGeo = new THREE.BoxGeometry(10, 0.12, 0.12);
    for (const [x, z, color] of [[-12, -19.9, THEME.neonA], [12, -19.9, THEME.neonB], [0, 19.9, THEME.neonC]]) {
      const strip = new THREE.Mesh(stripGeo, new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 2.5,
      }));
      strip.position.set(x, 4.1, z);
      group.add(strip);
    }
  }

  // Real 3D city ring around the yard (replaces the old flat silhouettes):
  // lit windows, parapets, roof props, ground-floor shops.
  createBuildings(scene);

  // Sky dome + sun disc.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 16), makeSky());
  scene.add(sky);
  const sunDir = new THREE.Vector3(...THEME.sunPosition).normalize();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(7, 32),
    new THREE.MeshBasicMaterial({ color: THEME.sunDisc, fog: false, transparent: true, opacity: 0.95 }),
  );
  sun.position.copy(sunDir).multiplyScalar(130);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  // Sun + hemisphere.
  const sunLight = new THREE.DirectionalLight(THEME.sunColor, THEME.sunIntensity);
  sunLight.position.set(...THEME.sunPosition);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -THEME.sunShadowSize;
  sunLight.shadow.camera.right = THEME.sunShadowSize;
  sunLight.shadow.camera.top = THEME.sunShadowSize;
  sunLight.shadow.camera.bottom = -THEME.sunShadowSize;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(THEME.hemiSky, THEME.hemiGround, THEME.hemiIntensity);
  scene.add(hemi);

  return { group, colliders, shootables, sites: SITES, sunLight, hemi };
}
