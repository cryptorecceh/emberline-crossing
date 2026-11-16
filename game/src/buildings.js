// Emberline Crossing — the city around the yard. One ring of real 3D
// buildings replaces the old flat skyline silhouettes: varied heights,
// window grids with lit/unlit variation (emissive twin texture, so windows
// glow at dusk), parapets, roof props (AC units, water tanks, antennas),
// and ground-floor shops with awnings and fascia signs on the near side.
// They stand outside the perimeter walls, so they never touch gameplay or
// collision — pure depth for the eye.
import * as THREE from 'three';
import { THEME } from './palette.js';
import { mulberry32, buildingFacadeTexture, shopSignTexture } from './textures.js';

const SHOP_NAMES = ['KEDAI KOPI', 'BENGKEL', 'TOKO KELONTONG', 'WARUNG 24'];

export function createBuildings(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const rng = mulberry32(20261115);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const slabGeo = new THREE.BoxGeometry(1, 1, 1);
  const acGeo = new THREE.BoxGeometry(0.9, 0.5, 0.9);
  const tankGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.5, 10);
  const tankBaseGeo = new THREE.BoxGeometry(1.6, 0.25, 1.6);
  const antennaGeo = new THREE.CylinderGeometry(0.04, 0.07, 3.4, 6);
  const crossGeo = new THREE.BoxGeometry(1.1, 0.06, 0.06);
  const darkMat = new THREE.MeshStandardMaterial({ color: THEME.wallConcreteDark, roughness: 0.95 });
  const acMat = new THREE.MeshStandardMaterial({ color: '#8a8a82', roughness: 0.7, metalness: 0.4 });
  const tankMat = new THREE.MeshStandardMaterial({ color: '#5a6a72', roughness: 0.6, metalness: 0.5 });
  const antennaMat = new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.5, metalness: 0.7 });
  const awningMat = new THREE.MeshStandardMaterial({
    color: THEME.accent, roughness: 0.85, side: THREE.DoubleSide,
  });

  const emissiveIntensity = THEME.id === 'dusk' ? 0.55 : THEME.id === 'neon' ? 0.45 : 0.3;
  const litRatio = THEME.id === 'dusk' ? 0.38 : THEME.id === 'neon' ? 0.5 : 0.2;
  const bases = ['#6a5a52', '#5d554e', '#74604e', '#4e5560', '#6b4a3c', '#5a5248'];

  // Four ground-floor shops on the near (south) side, facing the yard.
  let shopsLeft = 4;
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2 + rng() * 0.14;
    const r = 36 + rng() * 24;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const w = 7 + rng() * 6;
    const d = 6 + rng() * 5;
    let h = 8 + rng() * 16;
    if (z < 0) h += 8; // Taller towers behind the defenders (north).
    const floors = Math.max(3, Math.round(h / 3));
    const cols = Math.max(3, Math.round(w / 2.2));
    const isShop = shopsLeft > 0 && z > 28 && Math.abs(x) < 22;
    if (isShop) shopsLeft -= 1;
    const tex = buildingFacadeTexture(100 + i * 17, {
      floors,
      cols,
      litRatio,
      base: bases[i % bases.length],
      dark: THEME.wallConcreteDark,
      shop: isShop,
    });
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map,
      emissiveMap: tex.emissive,
      emissive: '#ffffff',
      emissiveIntensity,
      roughness: 0.9,
    });
    const building = new THREE.Mesh(boxGeo, mat);
    building.scale.set(w, h, d);
    building.position.set(x, h / 2, z);
    building.rotation.y = isShop ? 0 : (rng() - 0.5) * 0.12;
    group.add(building);

    // Parapet slab on the roof edge.
    const slab = new THREE.Mesh(slabGeo, darkMat);
    slab.scale.set(w + 0.3, 0.3, d + 0.3);
    slab.position.set(x, h + 0.15, z);
    slab.rotation.y = building.rotation.y;
    group.add(slab);

    // Roof props: 1-3 of AC unit / water tank / antenna.
    const props = 1 + Math.floor(rng() * 3);
    for (let p = 0; p < props; p += 1) {
      const px = x + (rng() - 0.5) * (w - 2);
      const pz = z + (rng() - 0.5) * (d - 2);
      const kind = rng();
      if (kind < 0.45) {
        const ac = new THREE.Mesh(acGeo, acMat);
        ac.position.set(px, h + 0.55, pz);
        ac.rotation.y = rng() * Math.PI;
        group.add(ac);
      } else if (kind < 0.75) {
        const baseBox = new THREE.Mesh(tankBaseGeo, darkMat);
        baseBox.position.set(px, h + 0.42, pz);
        group.add(baseBox);
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(px, h + 1.3, pz);
        group.add(tank);
      } else {
        const ant = new THREE.Mesh(antennaGeo, antennaMat);
        ant.position.set(px, h + 2, pz);
        group.add(ant);
        const cross = new THREE.Mesh(crossGeo, antennaMat);
        cross.position.set(px, h + 3.2, pz);
        group.add(cross);
      }
    }

    if (isShop) {
      // Awning leaning out over the sidewalk + fascia sign above it.
      const awning = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 1.3), awningMat);
      awning.position.set(x, 3.1, z - d / 2 - 0.7);
      awning.rotation.x = -0.55;
      group.add(awning);
      const signTex = shopSignTexture(SHOP_NAMES[3 - shopsLeft], THEME.accent);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.7, w * 0.7 * 0.25),
        new THREE.MeshBasicMaterial({ map: signTex, transparent: true }),
      );
      sign.position.set(x, 4.1, z - d / 2 - 0.05);
      sign.rotation.y = Math.PI; // Face the yard (the -z side).
      group.add(sign);
    }
  }
  return { group };
}
