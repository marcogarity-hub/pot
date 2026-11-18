/**
 * Trip cover generation (reference implementation, no dependencies).
 *
 * Every trip gets a cover made from its destination and dates. The app never
 * mentions this: no toggle, no "generated" label, no theme name in the UI.
 * The cover is simply there when the trip is created.
 *
 *   const theme = pickTheme({ placeType: "lake", month: 12, region: "us-west" });
 *   const svg = coverSvg(theme);          // string, drop into <div dangerouslySetInnerHTML>
 *   const pageTint = THEMES[theme].tint;  // light background tint for the trip page
 *
 * Scenes are crisp vector geometry in an 800x300 box with
 * preserveAspectRatio="xMidYMid slice", so one SVG works as a full-width hero,
 * a card cover, or a 32px thumbnail.
 *
 * Mirrors the mockups in the "Pot app UI mockups" canvas (direction I).
 */

export type SceneKind = "lake" | "snow" | "desert" | "beach" | "city" | "event";

export type PlaceType =
  | "lake" | "mountains" | "ski" | "beach" | "coast" | "desert" | "park"
  | "city" | "venue" | "unknown";

export interface Theme {
  kind: SceneKind;
  /** Internal name, for logs and design review only. Never shown in the app. */
  name: string;
  sky: [string, string];
  sun: string;
  a: string;
  b: string;
  fore?: string;
  water?: [string, string];
  sand?: string;
  shade?: string;
  win?: string;
  /** Very light page background tint for the trip page (content layer only). */
  tint: string;
}

export const THEMES = {
  alpineDusk:   { kind: "lake",   name: "Alpine dusk",    sky: ["#F29A79", "#F9D7B8"], sun: "#FCE9C4", a: "#9C86AE", b: "#6F5E8E", water: ["#7F8FB8", "#4C5884"], fore: "#23283F", tint: "#F5F1F3" },
  lakeMorning:  { kind: "lake",   name: "Lake morning",   sky: ["#A9D3EE", "#F3EEDF"], sun: "#FFF8E1", a: "#9DB5C9", b: "#6E8BA6", water: ["#5D9CC0", "#2F6488"], fore: "#23394A", tint: "#F0F4F7" },
  lakeNight:    { kind: "lake",   name: "Lake night",     sky: ["#1D2340", "#3E3A6B"], sun: "#EDE3C0", a: "#3A3F6E", b: "#2A2E52", water: ["#2E3768", "#171C3A"], fore: "#0E1124", tint: "#F0F0F5" },
  rivieraSummer:{ kind: "lake",   name: "Riviera summer", sky: ["#8FD3E8", "#FDF1D6"], sun: "#FFF4C2", a: "#86B89E", b: "#4E8A6E", water: ["#3FA7B5", "#1F6F86"], fore: "#2F4A3A", tint: "#EFF6F2" },
  highDesert:   { kind: "desert", name: "High desert",    sky: ["#F3B98E", "#FBE6CF"], sun: "#FFF3DE", a: "#E1A06E", b: "#C67A4B", fore: "#5B3A2A", tint: "#F8F0E7" },
  caribbeanNoon:{ kind: "beach",  name: "Caribbean noon", sky: ["#9EE0F0", "#FFF1DA"], sun: "#FFE7A3", a: "#2EC4C4", b: "#138A9E", sand: "#F2DDB6", fore: "#2D5B3F", tint: "#EEF7F5" },
  cityLights:   { kind: "city",   name: "City lights",    sky: ["#1B1F3B", "#4B3C7A"], sun: "#F6E7B8", a: "#2A2F55", b: "#363C6E", win: "#FFD27A", tint: "#F0EFF6" },
  freshPowder:  { kind: "snow",   name: "Fresh powder",   sky: ["#BFD9F2", "#EEF5FB"], sun: "#FFFFFF", a: "#FFFFFF", b: "#C9D6E8", shade: "#A9BCD6", fore: "#2E5D4B", tint: "#F0F4F9" },
  stageNight:   { kind: "event",  name: "Stage night",    sky: ["#2B1E3D", "#140E20"], sun: "#F2B544", a: "#6F3F6E", b: "#F6C9B8", tint: "#F2EFF4" },
} satisfies Record<string, Theme>;

export type ThemeKey = keyof typeof THEMES;

/** Default when nothing matches: the dusk look the brand is built around. */
export const DEFAULT_THEME: ThemeKey = "alpineDusk";

/**
 * Destination + dates -> theme. Deterministic and cheap; no image generation.
 * placeType comes from your geocoder's place category (map it to PlaceType once).
 * month is 1-12 from the trip's start date.
 */
export function pickTheme(input: { placeType: PlaceType; month?: number; hemisphere?: "north" | "south" }): ThemeKey {
  const { placeType } = input;
  const m = input.month ?? 0;
  // Flip seasons for the southern hemisphere.
  const month = input.hemisphere === "south" && m ? ((m + 5) % 12) + 1 : m;
  const winter = month === 12 || month === 1 || month === 2;
  const summer = month >= 6 && month <= 8;

  switch (placeType) {
    case "ski":
      return "freshPowder";
    case "mountains":
      return winter ? "freshPowder" : "alpineDusk";
    case "lake":
      if (summer) return "rivieraSummer";
      return winter ? "alpineDusk" : "lakeMorning";
    case "beach":
    case "coast":
      return "caribbeanNoon";
    case "desert":
    case "park":
      return "highDesert";
    case "city":
      return "cityLights";
    case "venue":
      return "stageNight";
    default:
      // Unknown place: use the default look. Guessing from the season alone
      // goes wrong too often (snow for Miami in January).
      return DEFAULT_THEME;
  }
}

// ---------------------------------------------------------------------------
// SVG

function defs(id: string, t: Theme): string {
  let d = `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.sky[0]}"/><stop offset=".85" stop-color="${t.sky[1]}"/></linearGradient>`;
  if (t.water) d += `<linearGradient id="${id}-wa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.water[0]}"/><stop offset="1" stop-color="${t.water[1]}"/></linearGradient>`;
  if (t.kind === "beach") d += `<linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient>`;
  return `<defs>${d}</defs><rect width="800" height="300" fill="url(#${id}-sky)"/>`;
}

const lake = (id: string, t: Theme) =>
  `<circle cx="560" cy="118" r="44" fill="${t.sun}"/>` +
  `<path d="M0 170 L90 110 L160 150 L250 80 L330 140 L410 100 L500 150 L570 108 L650 150 L720 96 L800 140 V230 H0Z" fill="${t.a}"/>` +
  `<path d="M0 196 L80 160 L150 186 L240 140 L320 190 L400 162 L480 196 L560 166 L640 194 L720 168 L800 190 V230 H0Z" fill="${t.b}"/>` +
  `<rect y="214" width="800" height="86" fill="url(#${id}-wa)"/>` +
  `<rect x="518" y="226" width="90" height="3" rx="1.5" fill="${t.sun}" opacity=".7"/><rect x="540" y="238" width="48" height="2" rx="1" fill="${t.sun}" opacity=".5"/>` +
  `<path d="M14 300 L40 226 L66 300Z M54 300 L86 196 L118 300Z M104 300 L124 246 L144 300Z M680 300 L708 210 L736 300Z M724 300 L748 238 L772 300Z" fill="${t.fore}"/>`;

const snow = (_id: string, t: Theme) =>
  `<circle cx="600" cy="80" r="30" fill="${t.sun}" opacity=".9"/>` +
  `<path d="M0 210 L120 96 L200 160 L300 58 L400 168 L500 102 L600 178 L700 84 L800 186 V300 H0Z" fill="${t.a}"/>` +
  `<path d="M120 96 L200 160 L150 160Z M300 58 L400 168 L320 168Z M500 102 L600 178 L530 178Z M700 84 L800 186 L730 186Z" fill="${t.shade}"/>` +
  `<path d="M0 214 L90 176 L180 210 L270 170 L380 218 L470 186 L560 222 L660 190 L800 226 V300 H0Z" fill="${t.b}"/>` +
  `<path d="M0 248 Q200 230 400 246 T800 240 V300 H0Z" fill="#FFFFFF"/>` +
  `<path d="M40 280 L60 220 L80 280Z M70 284 L94 206 L118 284Z M640 282 L662 226 L684 282Z M676 286 L700 214 L724 286Z" fill="${t.fore}"/>`;

const desert = (_id: string, t: Theme) =>
  `<circle cx="230" cy="128" r="40" fill="${t.sun}"/>` +
  `<path d="M0 196 Q200 150 400 184 T800 172 V300 H0Z" fill="${t.a}"/>` +
  `<path d="M0 238 Q240 200 460 230 T800 222 V300 H0Z" fill="${t.b}"/>` +
  `<path d="M604 252 V156 M604 196 L578 172 V146 M604 182 L630 158 V132" stroke="${t.fore}" stroke-width="10" stroke-linecap="round" fill="none"/>` +
  `<ellipse cx="320" cy="262" rx="26" ry="9" fill="${t.fore}" opacity=".35"/><ellipse cx="700" cy="276" rx="18" ry="6" fill="${t.fore}" opacity=".3"/>`;

const beach = (id: string, t: Theme) => {
  const waves = ([[60, 190], [300, 204], [520, 186], [680, 210]] as const)
    .map(([x, y]) => `<path d="M${x} ${y} q20 -6 40 0 t40 0" stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".55"/>`).join("");
  return `<circle cx="620" cy="88" r="34" fill="${t.sun}"/>` +
    `<rect y="166" width="800" height="80" fill="url(#${id}-sea)"/>${waves}` +
    `<path d="M0 238 Q200 222 400 234 T800 228 V300 H0Z" fill="${t.sand}"/>` +
    `<path d="M150 300 Q140 240 172 168" stroke="#8A6A4A" stroke-width="10" stroke-linecap="round" fill="none"/>` +
    `<path d="M172 168 Q130 148 98 172 M172 168 Q150 126 116 118 M172 168 Q200 126 238 124 M172 168 Q216 152 244 178 M172 168 Q176 130 170 108" stroke="${t.fore}" stroke-width="9" stroke-linecap="round" fill="none"/>`;
};

/** Small seeded PRNG so a city skyline is the same every render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const city = (_id: string, t: Theme, seed = 7) => {
  const rnd = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  let out = `<circle cx="640" cy="78" r="24" fill="${t.sun}"/>`;
  for (const [x, y] of [[80, 40], [180, 70], [300, 30], [420, 60], [520, 34], [720, 50], [760, 110]]) out += `<circle cx="${x}" cy="${y}" r="1.4" fill="#FFFFFF" opacity=".7"/>`;
  for (let x = 0; x < 800;) {
    const w = int(46, 92), h = int(90, 210);
    out += `<rect x="${x}" y="${300 - h}" width="${w - 4}" height="${h}" fill="${rnd() < 0.5 ? t.a : t.b}"/>`;
    for (let wy = 300 - h + 14; wy < 292; wy += 16)
      for (let wx = x + 8; wx < x + w - 12; wx += 12)
        if (rnd() < 0.32) out += `<rect x="${wx}" y="${wy}" width="5" height="7" fill="${t.win}" opacity=".9"/>`;
    x += w;
  }
  return out;
};

const event = (_id: string, t: Theme) =>
  `<path d="M120 0 L330 300 H390Z M680 0 L470 300 H410Z M400 0 L370 300 H430Z" fill="${t.sun}" opacity=".35"/>` +
  `<ellipse cx="400" cy="250" rx="220" ry="34" fill="${t.a}" opacity=".8"/><circle cx="400" cy="232" r="12" fill="${t.b}"/>` +
  ([[40, 34], [110, 40], [190, 32], [260, 42], [540, 40], [620, 34], [700, 42], [770, 36]] as const)
    .map(([x, r]) => `<circle cx="${x}" cy="300" r="${r}" fill="#0B0712"/>`).join("");

const SCENES: Record<SceneKind, (id: string, t: Theme) => string> = { lake, snow, desert, beach, city, event };

/**
 * Full SVG markup for a cover. `idSuffix` keeps gradient ids unique when the
 * same theme renders several times on one page (pass the trip id).
 */
export function coverSvg(key: ThemeKey, idSuffix = ""): string {
  const t: Theme = THEMES[key];
  const id = `cov-${key}${idSuffix ? `-${idSuffix}` : ""}`;
  return `<svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${defs(id, t)}${SCENES[t.kind](id, t)}</svg>`;
}
