// Genera frontend/src/styles/themes.css y verifica contraste WCAG.
// Uso: npm run themes -w frontend  (o: node scripts/generate-themes.mjs <salida>)
import fs from 'node:fs';

const o = (l, c, h, a) =>
  `oklch(${+l.toFixed(3)} ${+c.toFixed(3)} ${+h.toFixed(1)}${a != null ? ` / ${a}%` : ''})`;

// p = primario; g = grises (tono, croma); brand = degradado (from, via, to, deep, glow1, glow2)
const THEMES = [
  {
    id: 'indigo',
    light: { p: [0.52, 0.22, 278], pfg: 'light' },
    dark: { p: [0.68, 0.17, 280], pfg: 'dark' },
    g: [275, 0.012],
    brand: [
      [0.56, 0.24, 293],
      [0.49, 0.22, 275],
      [0.42, 0.2, 268],
      [0.26, 0.11, 275],
      [0.68, 0.25, 320],
      [0.7, 0.15, 230],
    ],
  },
  {
    id: 'emerald',
    light: { p: [0.5, 0.13, 163], pfg: 'light' },
    dark: { p: [0.74, 0.15, 162], pfg: 'dark' },
    g: [170, 0.01],
    brand: [
      [0.62, 0.15, 165],
      [0.53, 0.12, 178],
      [0.45, 0.09, 190],
      [0.25, 0.05, 185],
      [0.82, 0.16, 140],
      [0.7, 0.12, 210],
    ],
  },
  {
    id: 'ruby',
    light: { p: [0.53, 0.21, 20], pfg: 'light' },
    dark: { p: [0.68, 0.19, 18], pfg: 'dark' },
    g: [20, 0.01],
    brand: [
      [0.58, 0.22, 25],
      [0.48, 0.2, 10],
      [0.4, 0.17, 0],
      [0.22, 0.08, 10],
      [0.7, 0.2, 40],
      [0.62, 0.22, 340],
    ],
  },
  {
    id: 'ocean',
    light: { p: [0.53, 0.17, 250], pfg: 'light' },
    dark: { p: [0.7, 0.14, 240], pfg: 'dark' },
    g: [240, 0.014],
    brand: [
      [0.6, 0.15, 228],
      [0.53, 0.17, 248],
      [0.42, 0.16, 262],
      [0.24, 0.08, 255],
      [0.8, 0.12, 195],
      [0.6, 0.18, 280],
    ],
  },
  {
    id: 'graphite',
    light: { p: [0.29, 0.01, 260], pfg: 'light' },
    dark: { p: [0.9, 0.006, 260], pfg: 'dark' },
    g: [260, 0.006],
    brand: [
      [0.45, 0.012, 260],
      [0.33, 0.01, 260],
      [0.24, 0.008, 260],
      [0.17, 0.006, 260],
      [0.75, 0.02, 250],
      [0.6, 0.03, 220],
    ],
  },
  {
    id: 'amber',
    light: { p: [0.55, 0.16, 50], pfg: 'light' },
    dark: { p: [0.78, 0.15, 70], pfg: 'dark' },
    g: [60, 0.012],
    brand: [
      [0.64, 0.17, 60],
      [0.58, 0.17, 45],
      [0.48, 0.15, 35],
      [0.25, 0.06, 40],
      [0.85, 0.15, 90],
      [0.65, 0.2, 25],
    ],
  },
  {
    id: 'orchid',
    light: { p: [0.54, 0.22, 325], pfg: 'light' },
    dark: { p: [0.72, 0.18, 325], pfg: 'dark' },
    g: [320, 0.012],
    brand: [
      [0.6, 0.24, 335],
      [0.5, 0.23, 315],
      [0.42, 0.2, 300],
      [0.23, 0.1, 305],
      [0.75, 0.18, 0],
      [0.65, 0.2, 280],
    ],
  },
  {
    id: 'midnight',
    light: { p: [0.33, 0.1, 265], pfg: 'light' },
    dark: { p: [0.82, 0.13, 85], pfg: 'dark' },
    g: [265, 0.014],
    brand: [
      [0.36, 0.1, 265],
      [0.27, 0.08, 268],
      [0.2, 0.06, 270],
      [0.14, 0.04, 270],
      [0.82, 0.14, 85],
      [0.5, 0.12, 260],
    ],
  },
];

function vars(t, mode) {
  const [gh, gc] = t.g;
  const m = t[mode];
  const [pl, pc, ph] = m.p;
  const fgLight = o(0.99, 0, 0);
  const pfg = m.pfg === 'dark' ? o(0.17, gc * 2, gh) : fgLight;
  const v = {};
  if (mode === 'light') {
    Object.assign(v, {
      background: o(0.985, gc * 0.25, gh),
      foreground: o(0.17, gc * 2, gh),
      card: o(1, 0, 0),
      'card-foreground': o(0.17, gc * 2, gh),
      popover: o(1, 0, 0),
      'popover-foreground': o(0.17, gc * 2, gh),
      secondary: o(0.96, gc, gh),
      'secondary-foreground': o(0.25, gc * 2.5, gh),
      muted: o(0.965, gc * 0.6, gh),
      'muted-foreground': o(0.5, gc * 2, gh),
      accent: o(0.955, Math.max(pc * 0.13, 0.004), ph),
      'accent-foreground': o(Math.min(pl, 0.42), pc * 0.8, ph),
      border: o(0.92, gc * 0.8, gh),
      input: o(0.9, gc, gh),
      sidebar: o(0.995, gc * 0.2, gh),
      'sidebar-foreground': o(0.3, gc * 2, gh),
      'sidebar-border': o(0.93, gc * 0.8, gh),
      destructive: o(0.58, 0.22, 25),
      success: o(0.6, 0.15, 160),
      warning: o(0.75, 0.15, 75),
    });
  } else {
    Object.assign(v, {
      background: o(0.15, gc * 1.3, gh),
      foreground: o(0.96, gc * 0.4, gh),
      card: o(0.19, gc * 1.5, gh),
      'card-foreground': o(0.96, gc * 0.4, gh),
      popover: o(0.2, gc * 1.6, gh),
      'popover-foreground': o(0.96, gc * 0.4, gh),
      secondary: o(0.25, gc * 1.6, gh),
      'secondary-foreground': o(0.96, gc * 0.4, gh),
      muted: o(0.24, gc * 1.5, gh),
      'muted-foreground': o(0.71, gc * 1.6, gh),
      accent: o(0.27, Math.max(pc * 0.28, 0.01), ph),
      'accent-foreground': o(0.9, pc * 0.45, ph),
      border: 'oklch(1 0 0 / 9%)',
      input: 'oklch(1 0 0 / 14%)',
      sidebar: o(0.17, gc * 1.4, gh),
      'sidebar-foreground': o(0.86, gc * 0.8, gh),
      'sidebar-border': 'oklch(1 0 0 / 8%)',
      destructive: o(0.68, 0.19, 22),
      success: o(0.72, 0.15, 160),
      warning: o(0.8, 0.14, 80),
    });
  }
  const primary = o(pl, pc, ph);
  Object.assign(v, {
    primary,
    'primary-foreground': pfg,
    ring: o(mode === 'light' ? Math.min(pl + 0.08, 0.7) : pl, pc, ph),
    'sidebar-primary': primary,
    'sidebar-primary-foreground': pfg,
    'sidebar-accent': v.accent,
    'sidebar-accent-foreground': v['accent-foreground'],
    'sidebar-ring': o(pl, pc, ph),
    'chart-1': primary,
    'chart-2': o(0.65, 0.13, 200),
    'chart-3': o(0.7, 0.15, 160),
    'chart-4': o(0.78, 0.15, 75),
    'chart-5': o(0.65, 0.2, 15),
  });
  const [from, via, to, deep, g1, g2] = t.brand;
  Object.assign(v, {
    'brand-from': o(...from),
    'brand-via': o(...via),
    'brand-to': o(...to),
    'brand-deep': o(...deep),
    'brand-glow-1': o(...g1),
    'brand-glow-2': o(...g2),
  });
  return v;
}

// --- Contraste WCAG (oklch → sRGB) ---
function toRgb(str) {
  const [, l, c, h] = str
    .match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/)
    .map(Number);
  const a = c * Math.cos((h * Math.PI) / 180),
    b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((x) => Math.min(1, Math.max(0, x)));
}
const lum = (s) => {
  const [r, g, b] = toRgb(s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const PAIRS = [
  ['foreground', 'background', 7],
  ['muted-foreground', 'background', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['sidebar-foreground', 'sidebar', 4.5],
  ['primary', 'background', 3], // enlaces, íconos y bordes de foco
];

let failures = 0;
const report = [];
for (const t of THEMES) {
  for (const mode of ['light', 'dark']) {
    const v = vars(t, mode);
    for (const [fg, bg, min] of PAIRS) {
      const r = ratio(v[fg], v[bg]);
      if (r < min) {
        failures++;
        report.push(
          `✗ ${t.id}/${mode}: ${fg} sobre ${bg} = ${r.toFixed(2)} (mín ${min})`,
        );
      }
    }
    // Texto blanco sobre el degradado de marca (login, banner, botones).
    for (const k of ['brand-from', 'brand-via', 'brand-to']) {
      const r = ratio('oklch(1 0 0)', v[k]);
      if (r < 3) {
        failures++;
        report.push(
          `✗ ${t.id}/${mode}: blanco sobre ${k} = ${r.toFixed(2)} (mín 3)`,
        );
      }
    }
  }
}

const block = (sel, v) =>
  `${sel} {\n${Object.entries(v)
    .map(([k, x]) => `  --${k}: ${x};`)
    .join('\n')}\n}`;
const css = [
  '/*',
  ' * Temas de color. ARCHIVO GENERADO: los valores salen de unos pocos',
  ' * parámetros por tema (tono, croma, grises y degradado de marca) y se',
  ' * verificó el contraste WCAG de cada combinación en modo claro y oscuro.',
  ' *',
  ' * El tema se elige con data-theme en <html> (o en cualquier contenedor,',
  ' * como las vistas previas del selector) y el modo con la clase .dark.',
  ' */',
  '',
  ...THEMES.flatMap((t) => {
    const def = t.id === 'indigo';
    return [
      block(`${def ? ':root,\n' : ''}[data-theme='${t.id}']`, vars(t, 'light')),
      '',
      block(
        `${def ? '.dark,\n' : ''}.dark[data-theme='${t.id}'],\n.dark [data-theme='${t.id}']`,
        vars(t, 'dark'),
      ),
      '',
    ];
  }),
].join('\n');

console.log(report.join('\n') || 'Contraste OK en todos los temas y modos.');
console.log(
  `Combinaciones revisadas: ${THEMES.length * 2 * (PAIRS.length + 3)}, fallos: ${failures}`,
);
const out = process.argv[2] ?? 'src/styles/themes.css';
if (failures > 0) process.exitCode = 1;
else {
  fs.writeFileSync(out, css);
  console.log('Escrito:', out);
}
