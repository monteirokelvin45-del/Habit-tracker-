/**
 * Smoke de render das TELAS (não só dos gráficos), sem emulador e sem browser.
 *
 * Monta cada tela com `renderToStaticMarkup` usando o mesmo truque do smoke dos
 * gráficos (stub de store por cenário) e verifica o que o TypeScript não vê:
 * crash em runtime com dado real, tela vazia, e "Sem dado" espalhado quando
 * existem dados.
 *
 * Cenários: app com histórico rico e app zerado (primeiro uso).
 *
 *   node scripts/render-screens-smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, '.screens-build');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

/* ─────────────────────── stubs de ambiente ─────────────────────── */

const stub = (name, code) => fs.writeFileSync(path.join(outRoot, name), code);

const SVG_NAMES = ['Svg', 'Path', 'Line', 'Circle', 'G', 'Text', 'Rect', 'Defs', 'LinearGradient', 'Stop', 'Polygon', 'Polyline', 'Ellipse'];
stub(
  'stub-rn-svg.mjs',
  `import React from 'react';
const names = ${JSON.stringify(SVG_NAMES)};
const cache = new Map();
export const make = (name) => {
  if (!cache.has(name)) {
    const C = function Stub(props) {
      const { children, ...rest } = props || {};
      const clean = {};
      for (const [k, v] of Object.entries(rest)) {
        if (k === 'children' || v === undefined || v === null || typeof v === 'function') continue;
        clean[k] = typeof v === 'object' ? undefined : String(v);
      }
      return React.createElement(name.toLowerCase(), clean, children);
    };
    C.displayName = name;
    C.default = C; // o código usa require('react-native-svg').default
    cache.set(name, C);
  }
  return cache.get(name);
};
export const Default = make('Svg');
${SVG_NAMES.map((n) => `export const ${n} = make("${n}");`).join('\n')}
export default make('Svg');
`,
);

stub(
  'stub-haptics.mjs',
  `export const haptic = () => {};\nexport const hapticsEnabled = () => true;\n`,
);

stub(
  'stub-router.mjs',
  `export const useRouter = () => ({ push: () => {}, back: () => {}, replace: () => {} });
export const router = { push: () => {}, back: () => {}, replace: () => {} };
export const useLocalSearchParams = () => ({});
export const Link = ({ children }) => children;
export const Stack = ({ children }) => children;
`,
);

stub(
  'stub-safe-area.mjs',
  `import React from 'react';
import { View } from 'react-native';
export const SafeAreaView = ({ children, style }) => React.createElement(View, { style }, children);
export const SafeAreaProvider = ({ children }) => children;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
`,
);

// lottie e widget nativo não existem em Node: stub vazio é o suficiente.
stub('stub-empty.mjs', `export default () => null;\nexport const FlexWidget = () => null;\nexport const TextWidget = () => null;\n`);

// Nomes usados por src/components/Icon.tsx — o ESM exige export nomeado real.
const LUCIDE_NAMES = [
  'Activity', 'ArrowRight', 'BedDouble', 'Bell', 'BookOpen', 'Brain', 'BrainCircuit',
  'CalendarDays', 'ChartColumn', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'CircleCheck', 'Clock',
  'Download', 'Droplet', 'Dumbbell', 'Flag', 'Flame', 'Gauge', 'House', 'Layers', 'Link2',
  'Lock', 'Moon', 'Palette', 'Pause', 'Play', 'Plus', 'RotateCcw', 'Scale', 'Settings',
  'ShieldAlert', 'Sparkles', 'Sun', 'Target', 'Timer', 'TrendingUp', 'TriangleAlert',
  'Trophy', 'Upload', 'User', 'Wallet', 'X', 'Zap', 'Utensils',
];
stub(
  'stub-lucide.mjs',
  `import React from 'react';
import { Text } from 'react-native';
export const make = (name) => {
  const C = (props) => React.createElement(Text, { ...props, accessibilityLabel: String(name) }, '·');
  C.displayName = name;
  return C;
};
${LUCIDE_NAMES.map((n) => `export const ${n} = make('${n}');`).join('\n')}
export default make('Icon');
`,
);

stub(
  'stub-gesture.mjs',
  `import React from 'react';
import { View } from 'react-native';
const chain = () => {
  const api = {
    activeOffsetY: () => api,
    onBegin: () => api,
    onUpdate: () => api,
    onEnd: () => api,
    onFinalize: () => api,
    enabled: () => api,
  };
  return api;
};
export const Gesture = { Pan: chain, Tap: chain, LongPress: chain, Simultaneous: () => chain() };
export const GestureDetector = ({ children }) => children;
export const GestureHandlerRootView = (props) => React.createElement(View, props);
export const Swipeable = (props) => React.createElement(View, props);
`,
);

stub(
  'stub-native.mjs',
  `export async function syncDayToCalendar() { return { ok: true, message: 'ok' }; }
export async function createNativeAlarm() { return { ok: true, message: 'ok' }; }
export async function restTimerAlarm() { return { ok: true, message: 'ok' }; }
export async function openAppLimits() { return { ok: true, message: 'ok' }; }
export function watchEscapes() { return () => []; }
export function formatAway() { return '0s'; }
`,
);

/* ─────────────────────── compilação ─────────────────────── */

const entries = [];
const walk = (dir) => {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
      walk(full);
    } else if (/\.tsx?$/.test(item.name)) {
      entries.push(full);
    }
  }
};
walk(path.join(root, 'src'));
walk(path.join(root, 'app'));

const importMap = [
  ["from 'react-native-svg'", "from '@rb/stub-rn-svg.mjs'"],
  ["from 'expo-haptics'", "from '@rb/stub-haptics.mjs'"],
  ["from 'expo-router'", "from '@rb/stub-router.mjs'"],
  ["from 'react-native-safe-area-context'", "from '@rb/stub-safe-area.mjs'"],
  ["from 'lottie-react-native'", "from '@rb/stub-empty.mjs'"],
  ["from 'react-native-android-widget'", "from '@rb/stub-empty.mjs'"],
  ["from '../../src/lib/native'", "from '@rb/stub-native.mjs'"],
  ["from '../lib/native'", "from '@rb/stub-native.mjs'"],
];

// Chaves do JSX runtime: sem isso o transpile usa `React.createElement` em alguns
// arquivos e `_jsx` em outros, e o Node trata cada forma de forma diferente.
const JSX_OPTIONS = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2020,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
};

for (const file of entries) {
  const source = fs.readFileSync(file, 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: JSX_OPTIONS, fileName: file }).outputText;

  // `require('react-native-svg')` dentro de função não existe em ESM: vira o stub
  // (mesma estratégia do smoke dos gráficos).
  const usesSvg = js.includes("require('react-native-svg')");
  if (usesSvg) js = js.split("require('react-native-svg')").join('__rnSvgNS');
  const header = usesSvg ? `import * as __rnSvgNS from '@rb/stub-rn-svg.mjs';\n` : '';
  js = header + js;

  for (const [from, to] of importMap) js = js.split(from).join(to);

  // extensão .js nos imports relativos (ESM do Node exige) — antes de reescrever os stubs
  js = js.replace(/from '(\.[^']+)'/g, (m, p) => (p.endsWith('.js') || p.endsWith('.mjs') ? m : `from '${p}.js'`));

  // Resolve `@rb/x.mjs` para o caminho relativo real do stub: reescrita de texto é
  // mais confiável que interceptar resolução de pacote no loader do Node.
  const dest0 = path.join(outRoot, path.relative(root, file).replace(/\.tsx?$/, '.js'));
  js = js.replace(/'@rb\/([^']+)'/g, (m, name) => {
    const target = path.join(outRoot, name);
    const rel = path.relative(path.dirname(dest0), target).split(path.sep).join('/');
    return `'${rel.startsWith('.') ? rel : `./${rel}`}'`;
  });
  const dest = path.join(outRoot, path.relative(root, file).replace(/\.tsx?$/, '.js'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, js);
}

// Módulos de UI nativa não têm equivalente em Node (CJS + TS). São stubs vazios:
// o smoke quer provar que a tela monta, não o comportamento do calendário/agenda.
const stubModule = (name, exports) => {
  const file = path.join(outRoot, `nm-${name.replace(/[^a-z0-9]/gi, '_')}.mjs`);
  fs.writeFileSync(file, exports);
  return { name, file };
};
const nativeStubs = [
  stubModule('expo-calendar', "export const requestCalendarPermissionsAsync = async () => ({ status: 'granted' });\nexport const getCalendarsAsync = async () => [];\nexport const createCalendarAsync = async () => 'id';\nexport const createEventAsync = async () => 'id';\nexport const EntityTypes = { EVENT: 'event' };\nexport const CalendarAccessLevel = { OWNER: 'owner' };\nexport default {};\n"),
  stubModule('expo-intent-launcher', "export const startActivityAsync = async () => ({});\nexport default {};\n"),
  stubModule('expo-file-system', "export class File { constructor() {} create() {} write() {} get uri() { return ''; } }\nexport const Paths = { cache: '' };\nexport default {};\n"),
  // `expo-constants` toca vários símbolos do core; o smoke só precisa que montem.
  stubModule(
    'expo-modules-core',
    "export const requireNativeModule = () => ({});\nexport const requireOptionalNativeModule = () => ({});\nexport const NativeModulesProxy = {};\nexport const EventEmitter = class {};\nexport class CodedError extends Error {};\nexport class UnavailabilityError extends Error {};\nexport const Platform = { OS: 'android', select: (o) => o.android ?? o.default };\nexport const uuid = { v4: () => '00000000-0000-4000-8000-000000000000' };\nexport default {};\n",
  ),
  stubModule('expo-image-picker', "export const launchImageLibraryAsync = async () => ({ canceled: true });\nexport const launchCameraAsync = async () => ({ canceled: true });\nexport const requestMediaLibraryPermissionsAsync = async () => ({ status: 'granted' });\nexport const MediaTypeOptions = { Images: 'Images' };\nexport default {};\n"),
  stubModule('expo-document-picker', "export const getDocumentAsync = async () => ({ canceled: true });\nexport default {};\n"),
  stubModule('expo-notifications', "export const scheduleNotificationAsync = async () => 'id';\nexport const cancelAllScheduledNotificationsAsync = async () => {};\nexport const getPermissionsAsync = async () => ({ status: 'granted' });\nexport const requestPermissionsAsync = async () => ({ status: 'granted' });\nexport const setNotificationHandler = () => {};\nexport const AndroidNotificationPriority = { MAX: 'max' };\nexport const SchedulableTriggerInputTypes = { DAILY: 'daily' };\nexport default {};\n"),
  stubModule('expo-print', "export const printToFileAsync = async () => ({ uri: '' });\nexport default {};\n"),
  stubModule('expo-sharing', "export const isAvailableAsync = async () => false;\nexport const shareAsync = async () => {};\nexport default {};\n"),
  stubModule(
    'react-native-reanimated',
    [
      "import React from 'react';",
      "import { ScrollView, Text, View } from 'react-native';",
      'const chain = () => {',
      '  const api = {',
      '    duration: () => api, delay: () => api, springify: () => api, damping: () => api,',
      '    withInitialValues: () => api, build: () => ({}),',
      '  };',
      '  return api;',
      '};',
      'const Animated = { View, Text, ScrollView, Image: View, createAnimatedComponent: (C) => C };',
      'export default Animated;',
      'export const useSharedValue = (v) => ({ value: v });',
      'export const useAnimatedStyle = () => ({});',
      'export const useDerivedValue = (fn) => ({ value: fn() });',
      'export const withTiming = (v) => v;',
      'export const withSpring = (v) => v;',
      'export const withDelay = (_, v) => v;',
      'export const withRepeat = (v) => v;',
      'export const withSequence = (...v) => v[0];',
      'export const cancelAnimation = () => {};',
      'export const runOnJS = (fn) => fn;',
      'export const runOnUI = (fn) => fn;',
      'export const Easing = { out: chain(), inOut: chain(), ease: chain(), linear: chain(), bezier: () => chain() };',
      'export const FadeIn = chain();',
      'export const FadeInDown = chain();',
      'export const FadeInUp = chain();',
      'export const FadeOut = chain();',
      'export const SlideInRight = chain();',
      'export const SlideInLeft = chain();',
      'export const SlideOutRight = chain();',
      'export const Layout = chain();',
      'export const LinearTransition = chain();',
      'export const ZoomIn = chain();',
    ].join('\n'),
  ),
];

/* ─────────────────────── loader ─────────────────────── */

fs.writeFileSync(
  path.join(outRoot, 'hooks.mjs'),
  `import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const outRoot = ${JSON.stringify(outRoot)};
const root = ${JSON.stringify(root)};
const NATIVE_STUBS = ${JSON.stringify(Object.fromEntries(nativeStubs.map((s) => [s.name, s.file])))};
export async function resolve(specifier, context, next) {
  if (process.env.DEBUG_RESOLVE) console.error('RESOLVE', specifier, '<-', context.parentURL ?? '-');
  if (specifier.startsWith('@rb/')) {
    const p = path.join(outRoot, path.basename(specifier));
    return { url: pathToFileURL(p).href, format: 'module', shortCircuit: true };
  }
  if (specifier === 'react-native-gesture-handler') {
    return { url: pathToFileURL(path.join(outRoot, 'stub-gesture.mjs')).href, format: 'module', shortCircuit: true };
  }
  if (specifier === 'lucide-react-native') {
    return { url: pathToFileURL(path.join(outRoot, 'stub-lucide.mjs')).href, format: 'module', shortCircuit: true };
  }
  if (NATIVE_STUBS[specifier]) {
    return { url: pathToFileURL(NATIVE_STUBS[specifier]).href, format: 'module', shortCircuit: true };
  }
  if (specifier === 'react-native') {
    // Igual ao smoke dos gráficos: reescreve para react-native-web a partir da raiz.
    return next('react-native-web', { ...context, parentURL: pathToFileURL(path.join(root, 'index.js')).href });
  }
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const base = path.resolve(path.dirname(new URL(context.parentURL).pathname), specifier);
    for (const cand of [base, base + '.js', base + '/index.js']) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return { url: pathToFileURL(cand).href, format: 'module', shortCircuit: true };
      }
    }
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (process.env.DEBUG_SCREENS) console.error('LOAD', url);
  try {
    if (url.endsWith('.js') && url.includes('/.screens-build/')) {
      return { ...(await next(url, { ...context, format: 'module' })), format: 'module' };
    }
    return next(url, context);
  } catch (e) {
    if (process.env.DEBUG_SCREENS) console.error('LOAD FAIL:', url, '=>', e.message.split(String.fromCharCode(10))[0]);
    throw e;
  }
}
`,
);

fs.writeFileSync(
  path.join(outRoot, 'register.mjs'),
  `import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL(${JSON.stringify(path.join(outRoot, 'hooks.mjs'))}).href, import.meta.url);
`,
);

/* ─────────────────────── fixtures ─────────────────────── */

const today = new Date();
const key = (offset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const goal = (id, area, name, priority = 'normal') => ({
  id,
  name,
  area,
  priority,
  min: '10min',
  ideal: '30min',
  excellent: '1h',
  active: true,
  createdAt: '2026-01-01T10:00:00.000Z',
});

const diary = (over = {}) => ({
  promised: '',
  done: '',
  avoided: '',
  blocked: '',
  context: { where: '', when: '', distraction: '', trigger: '' },
  correction: '',
  mood: '',
  sleep: { hours: 0, quality: 0, blockers: [] },
  food: '',
  focus: 0,
  temptation: '',
  relapse: '',
  smallWin: '',
  impulseCost: 0,
  emotions: [],
  // Refeições no formato de `src/lib/diet.ts` (uma por linha) + água.
  food: ['08:10|Café|café e pão|1|', '12:40|Almoço|arroz, feijão e frango|1|', '16:20|Lanche|bolacha|0|Tédio'].join('\n'),
  waterCups: 5,
  // Estudo: blocos do dia + edital (formato de `src/lib/study.ts` e `studies.ts`).
  study: [
    { subject: 'Matemática', plannedMinutes: 90, doneMinutes: 45, material: 'PDF', doubts: ['regra de três composta'] },
    { subject: 'Direito', plannedMinutes: 60, doneMinutes: 0, material: 'Vídeo', doubts: [] },
  ],
  studyPlan: {
    name: 'Concurso',
    examDate: key(30),
    topics: [
      { id: 't1', subject: 'Matemática', topic: 'Porcentagem', weight: 4, status: 'estudado', lastSeen: key(-6) },
      { id: 't2', subject: 'Direito', topic: 'Constitucional', weight: 5, status: 'novo' },
      { id: 't3', subject: 'Português', topic: 'Crase', weight: 2, status: 'revisado', lastSeen: key(-2) },
    ],
  },
  ...over,
});

const days = Array.from({ length: 12 }, (_, i) => {
  const date = key(-(11 - i));
  const total = [7.5, 8.2, 4, 6.1, 9, 5.2, 7.8, 6.5, 8.9, 7.1, 6.8, 0][i] ?? 6;
  return {
    date,
    energy: { physical: 7, mental: 6, stress: 4 },
    mode: 'normal',
    tasks: [
      { goalId: 'g1', done: i % 3 !== 0, note: '' },
      { goalId: 'g2', done: i % 2 === 0, note: '' },
      { goalId: 'g3', done: false, note: '' },
    ],
    diary: diary({
      done: i === 11 ? '' : 'treinei',
      avoided: 'nada',
      blocked: 'cansaço',
      context: { where: 'casa', when: 'manhã', distraction: 'celular', trigger: 'cansaço' },
      sleep: { hours: 7.5, quality: 8, blockers: ['Tela'] },
    }),
    pomodoros: i % 2 === 0 ? [{ goalId: 'g1', minutes: 25, at: '10:00' }] : [],
    score: { regularity: total, continuity: 6, recovery: 6, honesty: 7, progress: total, total },
    closedAt: `${date}T22:00:00`,
  };
});

const cheio = {
  onboarded: true,
  status: 'ready',
  booted: true,
  user: { name: 'Kelvin', identity: 'Operador', noMore: 'desculpa', areas: ['Treino', 'Estudo', 'Leitura'], createdAt: '2026-01-01T10:00:00.000Z' },
  goals: [goal('g1', 'Treino', 'Treino A', 'high'), goal('g2', 'Estudo', 'Estudar 2h'), goal('g3', 'Leitura', 'Ler 20 páginas')],
  days,
  settings: { theme: 'emerald', targetDailyScore: 7, sleepGoalHours: 7.5, focusGoalMinutes: 240, middayCheckin: true, middayTime: '13:00', morningReminder: '07:00', nightReminder: '21:00', streakNotification: true, haptics: true },
  rewards: [],
  badges: [],
  rules: [],
  books: [{ id: 'b1', title: 'Mindset', author: 'Dweck', totalPages: 350, currentPage: 142, dailyGoal: { min: 5, ideal: 20, excellent: 40 }, finished: false }],
  finances: [{ id: 'f1', date: key(0), type: 'expense', amount: 42, category: 'Alimentação', isImpulse: true, note: 'impulso: fome' }],
  weight: [],
  ayanokoji: { startDate: key(-12), scores: days.map((d) => d.score.total), tasksDone: {} },
  weeklyFocus: {},
  routeAdjustments: {},
  // Diário de emoções: 2 registros/dia nos últimos 20 dias, para exercitar o mapa,
  // o ranking e a comparação com o score do dia seguinte (que precisa de ≥ 4 lados).
  emotions: Array.from({ length: 20 }).flatMap((_, i) =>
    (i % 3 === 0 ? ['Ansioso'] : ['Calmo', 'Motivado']).map((emotion, k) => ({
      at: `${key(-i)}T${k === 0 ? '08' : '20'}:00:00.000Z`,
      date: key(-i),
      emotion,
      moment: k === 0 ? 'manhã' : 'noite',
      intensity: 3,
      note: k === 0 ? 'contexto do dia' : undefined,
    })),
  ),
  recovery: null,
  energy: { physical: 7, mental: 6, stress: 4 },
};

/* ───────────── Cenário hostil: o que um backup antigo grava de verdade ─────────────
 * `JSON.stringify(NaN)` grava `null`. Esses registros já existiram em disco, então
 * a tela tem que sobreviver — e o boot (`normalizeData`) tem que limpá-los antes.
 */
const sujo = {
  ...cheio,
  finances: [
    { id: 'f1', date: key(0), type: 'expense', amount: 42, category: 'Alimentação', isImpulse: true, note: 'impulso: fome' },
    { id: 'f2', date: key(-1), type: 'expense', amount: null, category: 'Lazer' },
    { id: 'f3', date: key(-2), type: 'income', amount: '500', category: 'Fixo' },
    { id: 'f4', date: 'data-invalida', type: 'expense', amount: 10, category: 'Outros' },
    { id: 'f5', date: key(-3), type: 'expense', amount: Number.NaN, category: 'Outros' },
  ],
  weight: [
    { id: 'w1', date: key(-1), kg: null },
    { id: 'w2', date: key(-2), kg: 80 },
    { id: 'w3', date: key(-3), kg: '81,5' },
  ],
  books: [{ id: 'b1', title: 'Mindset', totalPages: 350, currentPage: null }],
};

const vazio = {
  ...cheio,
  user: { name: '', identity: '', noMore: '', areas: [], createdAt: '' },
  goals: [],
  days: [],
  books: [],
  finances: [],
  ayanokoji: { startDate: '', scores: [], tasksDone: {} },
  emotions: [],
};

/* ─────────────────────── execução ─────────────────────── */

// Registra o loader DEPOIS de escrever os stubs e ANTES de importar qualquer tela.
const { register } = await import('node:module');
register(pathToFileURL(path.join(outRoot, 'hooks.mjs')).href, import.meta.url);

const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');

const screens = [
  ['Hoje', 'app/(tabs)/index.js'],
  ['Revisões', 'app/(tabs)/revisoes.js'],
  ['Metas', 'app/(tabs)/metas.js'],
  ['Inteligência', 'app/(tabs)/inteligencia.js'],
  ['Perfil', 'app/(tabs)/perfil.js'],
  ['Treino', 'app/modulo/treino.js'],
  ['Estudo', 'app/modulo/estudo.js'],
  ['Leitura', 'app/modulo/leitura.js'],
  ['Projeto', 'app/modulo/projeto.js'],
  ['Sono', 'app/modulo/sono.js'],
  ['Dieta', 'app/modulo/dieta.js'],
  ['Finanças', 'app/modulo/financas.js'],
  ['Peso', 'app/modulo/peso.js'],
  ['Pomodoro', 'app/modulo/pomodoro.js'],
  ['Gráficos', 'app/modulo/graficos.js'],
  ['Constância', 'app/modulo/constancia.js'],
  ['Recompensas', 'app/modulo/recompensas.js'],
  ['Conquistas', 'app/modulo/conquistas.js'],
  ['Widget', 'app/modulo/widget.js'],
  ['Ayanokoji', 'app/modulo/ayanokoji.js'],
  ['Emoções', 'app/modulo/emocoes.js'],
];

// Caminho do store em relação ao arquivo compilado (as telas ficam em
// app/<pasta>/ ou app/(tabs)/, então o relativo muda por arquivo).
const storeRel = (fromFile) =>
  path
    .relative(path.dirname(path.join(outRoot, fromFile)), path.join(outRoot, 'src/lib/store.js'))
    .split(path.sep)
    .join('/');

const withStore = async (file, name, fixture) => {
  const src = fs.readFileSync(path.join(outRoot, file), 'utf8');
  const rel = storeRel(file);
  const specifier = rel.startsWith('.') ? rel : `./${rel}`;

  // stub por cenário: o módulo ESM é cacheado por URL, então cada cenário tem o seu
  const stubPath = path.join(path.dirname(path.join(outRoot, file)), `store-${name}.js`);
  fs.writeFileSync(
    stubPath,
    `export * from '${specifier}';
import { useStore as real } from '${specifier}';
const fixture = ${JSON.stringify(fixture)};
const merge = () => ({ ...real.getState(), ...fixture });
export const useStore = (sel) => (sel ? sel(merge()) : merge());
useStore.getState = merge;
useStore.setState = real.setState;
useStore.subscribe = real.subscribe;
`,
  );

  const stubRel = path.relative(path.dirname(path.join(outRoot, file)), stubPath).split(path.sep).join('/');
  // troca QUALQUER import do store (a extensão .js já foi adicionada na compilação)
  const patched = src.replace(
    new RegExp(`from (['"])[^'"]*src/lib/store(\\.js)?\\1`, 'g'),
    `from './${stubRel}'`,
  );
  if (patched === src) throw new Error(`store não encontrado em ${file}`);
  const copy = path.join(path.dirname(path.join(outRoot, file)), `${path.basename(file, '.js')}-${name}.js`);
  fs.writeFileSync(copy, patched);
  return copy;
};

let pass = 0;
let fails = 0;
const log = (ok, message) => {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
  ok ? pass++ : fails++;
};

// Teto de "Sem dado" por tela: o fixture não preenche todo campo de propósito
// (regras, foco, rota), e essas seções DEVEM dizer "Sem dado".
const SEM_DADO_MAX = { 'Inteligência': 99, Recompensas: 99, Revisões: 20, Perfil: 6 };

console.log('\n── Telas: app com histórico ──');
for (const [label, file] of screens) {
  try {
    const copy = await withStore(file, 'dados', cheio);
    const Screen = (await import(pathToFileURL(copy).href)).default;
    const html = renderToStaticMarkup(React.createElement(Screen));
    const semDado = (html.match(/Sem dado/g) ?? []).length;
    if (html.length < 200) log(false, `${label}: markup vazio (${html.length} chars)`);
    // Revisões cobre semana/mês/período e depende de dados que o fixture não tem
    // (foco da semana, regras SE-ENTÃO, rota) — o teto é maior de propósito.
    else if (SEM_DADO_MAX[label] !== undefined && semDado > SEM_DADO_MAX[label]) log(false, `${label}: ${semDado}x "Sem dado" com dados carregados`);
    else if (SEM_DADO_MAX[label] === undefined && semDado > 12) log(false, `${label}: ${semDado}x "Sem dado" com dados carregados`);
    else log(true, `${label} (${html.length} chars, ${semDado}x "Sem dado")`);
  } catch (e) {
    if (process.env.DEBUG_SCREENS) console.log(e.stack);
    log(false, `${label}: ${e.message}`);
  }
}

console.log('\n── Telas: primeiro uso (app zerado) ──');
for (const [label, file] of screens) {
  try {
    const copy = await withStore(file, 'vazio', vazio);
    const Screen = (await import(pathToFileURL(copy).href)).default;
    const html = renderToStaticMarkup(React.createElement(Screen));
    if (html.length < 200) log(false, `${label}: markup vazio`);
    // `bgElevated`/`undefined->` aparecem em props opcionais legítimas; o alvo é
    // texto visível com NaN/Infinity ou a palavra "undefined" solta no conteúdo.
    else if (/NaN|Infinity/.test(html) || />[^<]*\bundefined\b[^<]*</.test(html)) log(false, `${label}: valor inválido no HTML`);
    else if (label === 'Perfil' && !/MY PRIME v\d+\.\d+\.\d+/.test(html)) log(false, 'Perfil: versão não aparece (usuário não sabe qual build está instalada)');
    else log(true, `${label} (${html.length} chars)`);
  } catch (e) {
    log(false, `${label}: ${e.message}`);
  }
}

/* ───────── Home (Soft Light Glass): nada inventado e contraste do tema claro ───────── */
{
  const renderHome = async (name, fixture, themeId) => {
    const themeMod = await import(pathToFileURL(path.join(outRoot, 'src/theme.js')).href);
    themeMod.applyTheme(themeId);
    const copy = await withStore('app/(tabs)/index.js', name, fixture);
    const Screen = (await import(pathToFileURL(copy).href)).default;
    const html = renderToStaticMarkup(React.createElement(Screen));
    themeMod.applyTheme('emerald');
    return html;
  };
  const homeGoals = [
    { ...goal('h1', 'Treino', 'Treino A', 'high'), ideal: '1h' },
    { ...goal('h2', 'Estudo', 'Estudar 2h', 'high'), ideal: '2h' },
    { ...goal('h3', 'Leitura', 'Ler 20 páginas'), ideal: '20min' },
  ];

  // 1) App zerado: nenhum percentual e nenhum bloco fabricado.
  const zero = await renderHome('home-zero', { ...vazio, goals: [], days: [], settings: { ...vazio.settings } }, 'softGlass');
  log(/Sem dado|Sem registro|Sem meta/.test(zero), 'Home vazia não afirma percentual (Regra 1)');
  log(!/NaN|Infinity/.test(zero), 'Home vazia sem NaN/Infinity');
  log(/Timeline/.test(zero) && /Sem bloco para hoje/.test(zero), 'Home vazia: timeline diz que não há bloco');

  // 2) Tema claro veste a tela; e o texto sobre o botão primário não fica preto.
  log(/rgba\(255, 255, 255/.test(zero) || /rgba\(255,255,255/.test(zero), 'Home no tema claro usa card de vidro');
  log(!/color:rgb\(0, 0, 0\)/.test(zero), 'Home no tema claro não escreve texto preto sobre botão escuro');

  // 3) Com histórico: o dia de hoje tem registro, então conclusão é número real.
  const cheia = await renderHome('home-cheia', { ...cheio, goals: homeGoals, days: [...cheio.days.filter((d) => d.date !== key(0)), { ...cheio.days[11], date: key(0), tasks: homeGoals.map((g) => ({ goalId: g.id, done: g.id !== 'h3', note: '' })) }] }, 'softGlass');
  log(/66%|67%/.test(cheia), 'Home com 2 de 3 feitas mostra a conclusão real', (cheia.match(/\d+%/g) ?? []).slice(0, 4).join(' '));
  log(!/68\.5%/.test(cheia), 'nenhum número da referência (68,5%) aparece');
  log(!/43 tarefas|28 projetos|120%/.test(cheia), 'nenhum contador decorativo da referência aparece');
  log(/Progresso por área/.test(cheia), 'painel escuro de áreas monta');
  log(/Timeline de hoje/.test(cheia), 'timeline monta com dados');
  log(!/NaN|Infinity/.test(cheia), 'Home com dados sem NaN/Infinity');
}

/* ───────── Finanças Bento: Regra 1 (nada inventado) e contraste ───────── */
{
  const render = async (name, fixture) => {
    const copy = await withStore('app/modulo/financas.js', name, fixture);
    const Screen = (await import(pathToFileURL(copy).href)).default;
    return renderToStaticMarkup(React.createElement(Screen));
  };

  // 1) App zerado: nenhum valor monetário pode aparecer.
  const vazioHtml = await render('fin-vazio', { ...vazio, finances: [] });
  const dinheiroNoVazio = vazioHtml.match(/R\$\s?[\d.]/g) ?? [];
  log(dinheiroNoVazio.length === 0, `Finanças vazia não inventa valor monetário${dinheiroNoVazio.length ? ` (achei ${dinheiroNoVazio.join(', ')})` : ''}`);
  log(/Sem dado/.test(vazioHtml), 'Finanças vazia escreve "Sem dado"');
  log(!/NaN|Infinity/.test(vazioHtml), 'Finanças vazia sem NaN/Infinity');

  // 2) Só receita (sem despesa): nada de barras/percentuais fabricados.
  const soReceita = await render('fin-receita', {
    ...vazio,
    finances: [{ id: 'r1', date: key(0), type: 'income', amount: 5000, category: 'Fixo', isImpulse: false, note: '' }],
  });
  log(/R\$\s?5\.000,00/.test(soReceita), 'Finanças formata em Real (R$ 5.000,00)', (soReceita.match(/R\$\s?[\d.,]+/g) ?? []).slice(0, 3).join(' | '));
  log(!/NaN|Infinity/.test(soReceita), 'Finanças com só receita sem NaN');
  log(!/Sem dado[\s\S]{0,40}?R\$\s?0,00/.test(soReceita), 'Sem dado não é R$ 0,00');

  // 3) Mês sem renda (só despesa): alvo dos baldes é "Sem dado", não R$ 0.
  const soDespesa = await render('fin-despesa', {
    ...vazio,
    finances: [{ id: 'd1', date: key(0), type: 'expense', amount: 120.5, category: 'Lazer', isImpulse: true, note: '' }],
  });
  log(/Sem renda registrada/.test(soDespesa), 'sem receita → alvo dos baldes diz "sem renda registrada"');
  log(!/R\$\s?0,00/.test(soDespesa), 'sem receita → nenhum alvo virou R$ 0,00');

  // 4) Valor ilegível não derruba nem vira zero silencioso.
  const quebrado = await render('fin-quebrado', {
    ...vazio,
    finances: [
      { id: 'q1', date: key(0), type: 'expense', amount: null, category: 'Lazer' },
      { id: 'q2', date: key(-1), type: 'expense', amount: 30, category: 'Fixo' },
    ],
  });
  log(/sem valor legível/.test(quebrado), 'valor ilegível é avisado, não somado');
  log(/R\$\s?30,00/.test(quebrado), 'o lançamento bom continua somando (R$ 30,00)');
}

/* ──────── Estudos (Soft UI): Regra 1 e Regra 4 no que a tela afirma ──────── */
{
  const renderEstudo = async (name, fixture) => {
    const copy = await withStore('app/modulo/estudo.js', name, fixture);
    const Screen = (await import(pathToFileURL(copy).href)).default;
    return renderToStaticMarkup(React.createElement(Screen));
  };
  const estudoGoals = [
    { ...goal('g1', 'Estudo', 'Resolver 20 questões', 'high'), ideal: '1h' },
    { ...goal('g2', 'Estudo', 'Ler capítulo 3', 'normal'), ideal: '30min' },
  ];

  // 1) App zerado: nenhum percentual de desempenho inventado.
  const vazioE = await renderEstudo('est-vazio', { ...vazio, goals: [], days: [], settings: { ...vazio.settings } });
  log(!/\d+%\s*(de|da)\s*meta/i.test(vazioE) || /Sem dado/.test(vazioE), 'Estudos vazio não afirma desempenho');
  log(/Sem dado/.test(vazioE), 'Estudos vazio escreve "Sem dado"');
  log(!/NaN|Infinity/.test(vazioE), 'Estudos vazio sem NaN/Infinity');

  // 2) Poucos dias de estudo: desempenho NÃO pode ser afirmado (Regra 4).
  const doisDias = await renderEstudo('est-2dias', {
    ...vazio,
    goals: estudoGoals,
    days: [
      { ...days[0], date: key(0), tasks: estudoGoals.map((g) => ({ goalId: g.id, done: true, note: '' })), diary: { ...days[0].diary, study: [{ subject: 'Matemática', plannedMinutes: 60, doneMinutes: 45, material: 'Livro', doubts: [] }] } },
      { ...days[1], date: key(-1), tasks: [], diary: { ...days[1].diary, study: [{ subject: 'Matemática', plannedMinutes: 60, doneMinutes: 30, material: 'Livro', doubts: [] }] } },
    ],
  });
  log(/Sem dado suficiente/.test(doisDias), 'Estudos com 2 dias NÃO afirma desempenho (Regra 4)', (doisDias.match(/\d+%[^<]{0,20}/) ?? []).slice(0, 3).join(' | '));

  // 3) Amostra suficiente: aí sim o percentual aparece.
  const cincoDias = await renderEstudo('est-5dias', {
    ...vazio,
    goals: estudoGoals,
    days: Array.from({ length: 5 }).map((_, i) => ({
      ...days[0],
      date: key(-i),
      tasks: [],
      diary: { ...days[0].diary, study: [{ subject: 'Matemática', plannedMinutes: 60, doneMinutes: 60, material: 'Livro', doubts: [] }] },
    })),
  });
  log(!/Sem dado suficiente/.test(cincoDias), 'Estudos com 5 dias calcula desempenho');
  log(/100%/.test(cincoDias), 'Estudos com 5 dias: 100% de 60/60 min aparece');

  // 4) Meta do mês sem meta cadastrada não vira 0%.
  log(/Sem meta|Sem dado/.test(vazioE), 'meta mensal sem alvo diz "Sem meta"/"Sem dado", não 0%');
  log(!/>0%</.test(vazioE), 'meta mensal sem alvo não imprime 0%');

  // 5) As metas reais de Estudo aparecem como checklist.
  log(/Resolver 20 questões/.test(doisDias), 'checklist mostra as metas reais da área Estudo');
  log(/Ler capítulo 3/.test(doisDias), 'checklist mostra a segunda meta');
  // Meta de outra área não pode aparecer neste card.
  const comOutraArea = await renderEstudo('est-outra', { ...vazio, goals: [...estudoGoals, goal('g9', 'Treino', 'Treino pesado', 'high')] });
  log(!/Treino pesado/.test(comOutraArea), 'meta de outra área não entra no checklist de Estudos');
}

console.log('\n── Telas: tema Dark Neon Blue Bento aplicado ──');
{
  const themeMod = await import(pathToFileURL(path.join(outRoot, 'src/theme.js')).href);
  themeMod.applyTheme('neonBlue');
  try {
    for (const [label, file] of screens) {
      try {
        const copy = await withStore(file, 'neon', cheio);
        const Screen = (await import(pathToFileURL(copy).href)).default;
        const html = renderToStaticMarkup(React.createElement(Screen));
        // Estudos usa paleta PRÓPRIA (iDraft Soft UI, cinza fumê), de propósito:
        // ele não deve seguir o tema. As outras telas, sim.
        const ownPalette = label === 'Estudo';
        const greens = (html.match(/rgba\(5,31,32/g) ?? []).length;
        const allowed = label === 'Perfil' ? 1 : 0;
        if (html.length < 200) log(false, `${label} (tema neon): markup vazio`);
        else if (greens > allowed) log(false, `${label} (tema neon): ${greens} elemento(s) com a cor do Emerald`);
        else if (ownPalette && !/rgba\(243,244,246/.test(html)) log(false, `${label}: paleta própria (cinza fumê) não apareceu`);
        else if (!ownPalette && !/rgba\(8,9,14/.test(html)) log(false, `${label} (tema neon): fundo #08090E não apareceu`);
        else log(true, `${label} (tema neon, ${html.length} chars)`);
      } catch (e) {
        log(false, `${label} (tema neon): ${e.message}`);
      }
    }
  } finally {
    themeMod.applyTheme('emerald');
  }
}

console.log('\n── Telas: dados corrompidos (null/NaN/texto de backup antigo) ──');
for (const [label, file] of screens) {
  try {
    const copy = await withStore(file, 'sujo', sujo);
    const Screen = (await import(pathToFileURL(copy).href)).default;
    const html = renderToStaticMarkup(React.createElement(Screen));
    if (html.length < 200) log(false, `${label}: markup vazio com dado corrompido`);
    // NaN visível é o sintoma de aritmética não protegida.
    else if (/NaN|Infinity/.test(html)) log(false, `${label}: NaN/Infinity no HTML com dado corrompido`);
    else log(true, `${label} (${html.length} chars)`);
  } catch (e) {
    log(false, `${label}: ${e.message}`);
  }
}

console.log(`\n${fails === 0 ? '✅' : '❌'} ${pass} telas ok, ${fails} falharam\n`);
/* ─────── Preview opcional das Finanças (HTML para conferência visual) ───────
 * `PREVIEW_FINANCES=1 npm run test:screens` grava `docs/design/financas-preview.html`.
 * Não faz parte da verificação: só serve para olhar o desenho sem instalar o APK.
 */
if (process.env.PREVIEW_FINANCES) {
  try {
    // O preview é do tema novo: aplica a paleta antes de renderizar.
    const themeMod = await import(pathToFileURL(path.join(outRoot, 'src/theme.js')).href);
    themeMod.applyTheme('neonBlue');
    const copy = await withStore('app/modulo/financas.js', 'preview', {
      ...cheio,
      finances: [
        { id: 'p1', date: key(0), type: 'income', amount: 6200, category: 'Fixo', isImpulse: false, note: 'salário' },
        { id: 'p2', date: key(0), type: 'expense', amount: 3420, category: 'Fixo', isImpulse: false, note: 'aluguel' },
        { id: 'p3', date: key(-1), type: 'expense', amount: 89.9, category: 'Alimentação', isImpulse: false, note: 'mercado' },
        { id: 'p4', date: key(-2), type: 'expense', amount: 210, category: 'Lazer', isImpulse: true, note: 'impulso: delivery' },
        { id: 'p5', date: key(-3), type: 'income', amount: 450, category: 'Outros', isImpulse: false, note: 'freela' },
        { id: 'p6', date: key(-40), type: 'income', amount: 6100, category: 'Fixo', isImpulse: false, note: '' },
        { id: 'p7', date: key(-40), type: 'expense', amount: 2800, category: 'Fixo', isImpulse: false, note: '' },
        { id: 'p8', date: key(-70), type: 'income', amount: 5400, category: 'Fixo', isImpulse: false, note: '' },
        { id: 'p9', date: key(-70), type: 'expense', amount: 3100, category: 'Lazer', isImpulse: false, note: '' },
      ],
    });
    const Screen = (await import(pathToFileURL(copy).href)).default;
    const body = renderToStaticMarkup(React.createElement(Screen));
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MY PRIME · Finanças (preview)</title>
<style>
  html,body{margin:0;background:#000;}
  body{display:flex;justify-content:center;padding:24px 0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;}
  #app{width:412px;min-height:900px;background:#08090E;border-radius:36px;overflow:hidden;
       border:1px solid #222741;box-shadow:0 0 60px rgba(59,130,246,.25);}
  #app *{box-sizing:border-box;}
</style></head><body><div id="app">${body}</div></body></html>`;
    fs.mkdirSync(path.join(root, 'docs/design'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs/design/financas-preview.html'), html);
    console.log('\npreview: docs/design/financas-preview.html');

  } catch (e) {
    console.error('preview falhou:', e.message);
  }
}

/* ─────── Preview opcional de Estudos (HTML para conferência visual) ───────
 * `PREVIEW_ESTUDO=1 npm run test:screens` grava `docs/design/estudo-preview.html`.
 */
if (process.env.PREVIEW_ESTUDO) {
  try {
    const estudoGoals = [
      { ...goal('g1', 'Estudo', 'Resolver 20 questões', 'high'), ideal: '1h' },
      { ...goal('g2', 'Estudo', 'Ler capítulo 3', 'normal'), ideal: '30min' },
      { ...goal('g3', 'Estudo', 'Revisar anotações', 'normal'), ideal: '20min' },
    ];
    const copy = await withStore('app/modulo/estudo.js', 'preview', {
      ...cheio,
      goals: estudoGoals,
      user: { ...cheio.user, name: 'Kelvin' },
      days: Array.from({ length: 6 }).map((_, i) => ({
        ...days[0],
        date: key(-i),
        tasks: i === 0 ? estudoGoals.map((g) => ({ goalId: g.id, done: g.id !== 'g3', note: '' })) : [],
        diary: {
          ...days[0].diary,
          study: [
            { subject: ['Matemática', 'Direito', 'Português'][i % 3], plannedMinutes: 90, doneMinutes: 45 + i * 8, material: 'Livro', doubts: i === 0 ? ['Como calcular porcentagem composta?'] : [] },
          ],
        },
      })),
    });
    const Screen = (await import(pathToFileURL(copy).href)).default;
    const body = renderToStaticMarkup(React.createElement(Screen));
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MY PRIME · Estudos (preview)</title>
<style>
  html,body{margin:0;background:#DADCE0;}
  body{display:flex;justify-content:center;padding:24px 0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;}
  #app{width:412px;min-height:900px;background:#F3F4F6;border-radius:36px;overflow:hidden;
       border:1px solid #D9DAE0;box-shadow:0 18px 50px rgba(20,20,22,.18);}
  #app *{box-sizing:border-box;}
</style></head><body><div id="app">${body}</div></body></html>`;
    fs.mkdirSync(path.join(root, 'docs/design'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs/design/estudo-preview.html'), html);
    console.log('\npreview: docs/design/estudo-preview.html');
  } catch (e) {
    console.error('preview de estudos falhou:', e.message);
  }
}

/* ─────── Preview opcional da Home (HTML para conferência visual) ───────
 * `PREVIEW_HOME=1 npm run test:screens` grava `docs/design/home-preview.html`.
 * Aplica o tema `softGlass` (o claro translúcido da referência) antes de renderizar.
 */
if (process.env.PREVIEW_HOME) {
  try {
    const themeMod = await import(pathToFileURL(path.join(outRoot, 'src/theme.js')).href);
    themeMod.applyTheme('softGlass');
    const copy = await withStore('app/(tabs)/index.js', 'preview', {
      ...cheio,
      user: { ...cheio.user, name: 'Kelvin', areas: ['Treino', 'Estudo', 'Leitura', 'Finanças'] },
      goals: [
        goal('g1', 'Treino', 'Treino A · peito e tríceps', 'high'),
        goal('g2', 'Estudo', 'Estudar 2h de constitucional', 'high'),
        goal('g3', 'Leitura', 'Ler 20 páginas do Mindset'),
        goal('g4', 'Finanças', 'Registrar gastos do dia'),
      ],
      days: days.map((d, i) => ({
        ...d,
        tasks: [
          { goalId: 'g1', done: i % 3 !== 0, note: '' },
          { goalId: 'g2', done: i % 2 === 0, note: '' },
          { goalId: 'g3', done: i > 8, note: '' },
          { goalId: 'g4', done: i % 4 === 0, note: '' },
        ],
        diary: {
          ...d.diary,
          promised: 'treinar e estudar 2h',
          done: 'treino completo, 1h40 de estudo',
          avoided: 'não abri rede social antes das 18h',
          blocked: 'cansaço depois do almoço',
          correction: 'bloqueei o celular no período da tarde',
          smallWin: 'terminei o capítulo 4',
        },
        closedAt: i === 11 ? undefined : d.closedAt,
      })),
    });
    const Screen = (await import(pathToFileURL(copy).href)).default;
    const body = renderToStaticMarkup(React.createElement(Screen));
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MY PRIME · Home (preview)</title>
<style>
  html,body{margin:0;background:#D6D8DA;}
  body{display:flex;justify-content:center;padding:24px 0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;}
  #app{width:412px;min-height:900px;background:#EBECEC;border-radius:36px;overflow:hidden;
       border:1px solid rgba(28,28,31,.10);box-shadow:0 18px 50px rgba(20,20,22,.18);}
  #app *{box-sizing:border-box;}
</style></head><body><div id="app">${body}</div></body></html>`;
    fs.mkdirSync(path.join(root, 'docs/design'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs/design/home-preview.html'), html);
    console.log('\npreview: docs/design/home-preview.html');
    themeMod.applyTheme('emerald');
  } catch (e) {
    console.error('preview da home falhou:', e.message);
  }
}

process.exit(fails === 0 ? 0 : 1);
