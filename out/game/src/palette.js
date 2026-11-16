// Emberline Crossing — visual themes. One engine, three art directions; the URL
// picks one (?theme=dusk|neon|mist, default dusk). A theme is pure data: sky,
// light, fog and every material colour, so the map, bots and weapon read from it
// and stay coherent. Keep every colour in a theme — no hex literals elsewhere.
export const THEME_NAMES = ["dusk", "neon", "mist"];

const search = new URLSearchParams(
  typeof window !== "undefined" ? window.location.search : "",
);
const pick = (search.get("theme") || "dusk").toLowerCase();
export const THEME_ID = THEME_NAMES.includes(pick) ? pick : "dusk";

export const THEMES = {
  // Dusk desert rail yard: low amber sun, indigo sky, long shadows, warm dust.
  dusk: {
    id: "dusk", label: "Emberline Dusk",
    skyTop: "#26264d", skyMid: "#7c4a63", skyHorizon: "#ff9e56",
    sunColor: "#ffd9a0", sunDisc: "#ffe9bd",
    sunPosition: [38, 26, -46], sunIntensity: 2.8, sunShadowSize: 62,
    sunElevation: "low",
    hemiSky: "#8a6fa8", hemiGround: "#4a3428", hemiIntensity: 0.6,
    fogColor: "#5a3d55", fogNear: 30, fogFar: 130,
    ambient: "#6a5568",
    groundBase: "#8a6a4e", groundPatch: "#6f5340", groundLine: "#a8896a",
    groundRoughness: 0.95,
    wallConcrete: "#9a7f66", wallConcreteDark: "#6f5844",
    wallMetal: "#7d4a38", wallMetalDark: "#54301f",
    wood: "#8a6a42", woodDark: "#5f472c",
    crateA: "#a8763e", crateB: "#7a5230",
    accent: "#ffb347", accentEmissive: "#ff8c1a",
    lamp: "#ffc27a", propGlass: "#3a5a6a",
    teamAttack: "#e8843c", teamAttackDark: "#2e2118", // Ember — warm orange
    teamDefend: "#4a6fa5", teamDefendDark: "#1a2432", // Warden — slate blue
    visorAttack: "#ffb347", visorDefend: "#7fd4ff",
  },
  // Night city block in the rain: cyan/magenta neon, wet asphalt, dark blue fog.
  neon: {
    id: "neon", label: "Neon Rain",
    skyTop: "#04050e", skyMid: "#101a33", skyHorizon: "#24365e",
    sunColor: "#bcd2ff", sunDisc: "#dfeaff",
    sunPosition: [-30, 42, -40], sunIntensity: 1.3, sunShadowSize: 58,
    sunElevation: "high",
    hemiSky: "#2a3a5f", hemiGround: "#0c0f16", hemiIntensity: 0.5,
    fogColor: "#0a0f1e", fogNear: 24, fogFar: 110,
    ambient: "#1c2438",
    groundBase: "#22252d", groundPatch: "#181b22", groundLine: "#3a3f4d",
    groundRoughness: 0.38,
    wallConcrete: "#3c414d", wallConcreteDark: "#262a33",
    wallMetal: "#2f3a4a", wallMetalDark: "#1d2431",
    wood: "#4a3d33", woodDark: "#33291f",
    crateA: "#37414f", crateB: "#2a313d",
    accent: "#22d3ee", accentEmissive: "#22d3ee",
    lamp: "#9be8ff", propGlass: "#12303f",
    teamAttack: "#f472b6", teamAttackDark: "#2b1220", // Ember — hot magenta
    teamDefend: "#22d3ee", teamDefendDark: "#0f2530", // Warden — neon cyan
    visorAttack: "#ff9ad5", visorDefend: "#8ff0ff",
    neonA: "#22d3ee", neonB: "#f472b6", neonC: "#a78bfa",
  },
  // Foggy pine forest at dawn: dense mist, moss and pine, pale low sun, fireflies.
  mist: {
    id: "mist", label: "Mistwood Dawn",
    skyTop: "#8ba89a", skyMid: "#c9cfae", skyHorizon: "#efe3c2",
    sunColor: "#ffe8c0", sunDisc: "#fff3d6",
    sunPosition: [34, 30, -44], sunIntensity: 1.9, sunShadowSize: 58,
    sunElevation: "low",
    hemiSky: "#a8bfae", hemiGround: "#5a6a52", hemiIntensity: 0.7,
    fogColor: "#b8c4ae", fogNear: 13, fogFar: 68,
    ambient: "#8a9a86",
    groundBase: "#6a7a52", groundPatch: "#4f5d3c", groundLine: "#7d8c62",
    groundRoughness: 0.95,
    wallConcrete: "#7a7568", wallConcreteDark: "#55524a",
    wallMetal: "#5d6a58", wallMetalDark: "#3f4a3c",
    wood: "#7a5c38", woodDark: "#54401f",
    crateA: "#8a6f45", crateB: "#6a5230",
    accent: "#ffd27a", accentEmissive: "#ffc94d",
    lamp: "#ffe9b0", propGlass: "#4a5a50",
    teamAttack: "#d97b2f", teamAttackDark: "#2a1e14", // Ember — rust orange
    teamDefend: "#4f7a4a", teamDefendDark: "#16241a", // Warden — forest green
    visorAttack: "#ffcf7a", visorDefend: "#a8e6a1",
  },
};

export const THEME = THEMES[THEME_ID];
