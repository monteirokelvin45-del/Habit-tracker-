/**
 * Smoke de render dos gráficos (sem emulador, sem browser).
 *
 * Compila `src/**` (lib + tema + ui + StatsCharts) com o TypeScript, troca
 * `react-native` por `react-native-web`, `react-native-svg` e `expo-haptics` por
 * stubs de SSR e monta cada componente com `renderToStaticMarkup`.
 *
 * Serve para o que o `tsc` NÃO pega: componente que estoura em runtime (divisão
 * por zero, `.map` de undefined, arco de círculo com NaN) e estado vazio.
 *
 *   node scripts/render-charts-smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, '.render-build');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

/* 1. stubs de node_modules (o Node não compila TS que vem de pacote) */
fs.writeFileSync(
  path.join(outRoot, 'stub-rn-svg.mjs'),
  `import React from 'react';
const cache = new Map();
const make = (name) => function Stub(props) {
  const { children, ...rest } = props || {};
  const clean = {};
  for (const [k, v] of Object.entries(rest)) if (k !== 'children' && typeof v !== 'function' && v !== undefined && v !== null) clean[k] = String(v);
  return React.createElement(name.toLowerCase(), clean, children);
};
export default new Proxy({}, { get(t, key) {
  if (key === 'default') return make('svg');
  if (key === '__esModule') return true;
  if (typeof key !== 'string') return undefined;
  if (!cache.has(key)) cache.set(key, make(key));
  return cache.get(key);
} });
`,
);

fs.writeFileSync(
  path.join(outRoot, 'stub-native.mjs'),
  `export async function impactAsync() {}
export async function notificationAsync() {}
export async function selectionAsync() {}
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };
export default { impactAsync, notificationAsync, selectionAsync, ImpactFeedbackStyle, NotificationFeedbackType };
`,
);

fs.writeFileSync(
  path.join(outRoot, 'stub-router.mjs'),
  `export const useRouter = () => ({ push: () => {}, back: () => {}, replace: () => {} });
export const router = { push: () => {}, back: () => {}, replace: () => {} };
export const useLocalSearchParams = () => ({});
export const Link = ({ children }) => children;
export const Stack = ({ children }) => children;
`,
);

fs.writeFileSync(
  path.join(outRoot, 'stub-safe-area.mjs'),
  `import React from 'react';
import { View } from 'react-native';
export const SafeAreaView = ({ children, style, edges }) => React.createElement(View, { style }, children);
export const SafeAreaProvider = ({ children }) => children;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
`,
);

/* 2. compila o que os gráficos usam */
const files = [
  ...fs
    .readdirSync(path.join(root, 'src/lib'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.tsx'))
    .map((f) => path.join(root, 'src/lib', f)),
  path.join(root, 'src/theme.ts'),
  path.join(root, 'src/components/ui.tsx'),
  path.join(root, 'src/components/ModalHeader.tsx'),
  path.join(root, 'src/components/StatsCharts.tsx'),
];

for (const file of files) {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  // `require('react-native-svg')` não existe em ESM: vira import do stub.
  const usesSvg = out.includes("require('react-native-svg')");
  const text = usesSvg ? out.split("require('react-native-svg')").join('__rnSvg') : out;
  const header = usesSvg
    ? `import __rnSvg from ${JSON.stringify(pathToFileURL(path.join(outRoot, 'stub-rn-svg.mjs')).href)};\n`
    : '';
  const dest = path.join(outRoot, path.relative(root, file).replace(/\.tsx?$/, '.js'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, header + text);
}

// a tela central (app/modulo) importa '../../src/...' — o build fica em .render-build/app/modulo
const screenJs = ts.transpileModule(fs.readFileSync(path.join(root, 'app/modulo/graficos.tsx'), 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
  fileName: path.join(root, 'app/modulo/graficos.tsx'),
}).outputText;
fs.mkdirSync(path.join(outRoot, 'app/modulo'), { recursive: true });
fs.writeFileSync(path.join(outRoot, 'app/modulo/graficos.js'), screenJs);

/* 3. loader: react-native -> react-native-web, extensões .js nos imports relativos */
fs.writeFileSync(
  path.join(outRoot, 'hooks.mjs'),
  `import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = ${JSON.stringify(root)};
const outRoot = ${JSON.stringify(outRoot)};
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@rb/')) {
    const p = path.join(outRoot, specifier.slice(4));
    for (const cand of [p, p + '.js', p + '.tsx', p + '/index.js']) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return { url: pathToFileURL(cand).href, format: 'module', shortCircuit: true };
      }
    }
  }
  if (specifier === 'react-native-safe-area-context') {
    return { url: pathToFileURL(path.join(outRoot, 'stub-safe-area.mjs')).href, format: 'module', shortCircuit: true };
  }
  if (specifier === 'expo-router') {
    return { url: pathToFileURL(path.join(outRoot, 'stub-router.mjs')).href, format: 'module', shortCircuit: true };
  }
  if (specifier === 'expo-haptics') {
    return { url: pathToFileURL(path.join(outRoot, 'stub-native.mjs')).href, format: 'module', shortCircuit: true };
  }
  if (specifier === 'react-native') {
    return next('react-native-web', { ...context, parentURL: pathToFileURL(path.join(root, 'index.js')).href });
  }
  if (specifier.startsWith('.') && context.parentURL?.includes('/.render-build/')) {
    const p = new URL(specifier, context.parentURL).pathname;
    for (const cand of [p, p + '.js', p + '/index.js']) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return { url: pathToFileURL(cand).href, format: 'module', shortCircuit: true };
      }
    }
  }
  return next(specifier, context);
}
`,
);

const { register } = await import('node:module');
register(pathToFileURL(path.join(outRoot, 'hooks.mjs')).href, import.meta.url);

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const charts = await import(pathToFileURL(path.join(outRoot, 'src/components/StatsCharts.js')).href);
const stats = await import(pathToFileURL(path.join(outRoot, 'src/lib/stats.js')).href);
const { addDays, todayKey } = await import(pathToFileURL(path.join(outRoot, 'src/lib/date.js')).href);

/* 4. massa de dados: 40 dias, 3 hábitos, falhas com e sem motivo */
const today = todayKey();
const goals = [
  { id: 'g1', name: 'Treino', area: 'Treino', active: true, priority: 'high', type: 'daily' },
  { id: 'g2', name: 'Estudo', area: 'Estudo', active: true, priority: 'medium', type: 'daily' },
  { id: 'g3', name: 'Leitura', area: 'Leitura', active: true, priority: 'low', type: 'daily' },
].map((g) => ({ ...g, createdAt: today }));

const days = Array.from({ length: 40 }, (_, i) => {
  const date = addDays(today, -(39 - i));
  const tasks = goals.map((g, gi) => {
    const ok = (i + gi) % 3 !== 0;
    return {
      goalId: g.id,
      done: ok,
      note: '',
      doneAt: ok ? `0${8 + gi}:20` : undefined,
      failAt: ok ? undefined : '22:10',
      excuse: ok || gi === 2 ? undefined : { type: 'Cansaço', legitimacy: 'legítima' },
    };
  });
  return {
    date,
    mode: 'normal',
    tasks,
    energy: { physical: 3 + (i % 7), mental: 4 + (i % 5), stress: 5 },
    diary: { mood: ['🙂', '😐', '😞', '😄'][i % 4] },
    score: { regularity: 5 + (i % 5), continuity: 6, recovery: 5, honesty: 7, progress: 5, total: 4 + (i % 6) },
    closedAt: i < 39 ? `${date}T23:00:00` : undefined,
  };
});

const app = {
  goals,
  days,
  settings: { targetDailyScore: 7 },
  areas: ['Treino', 'Estudo', 'Leitura'],
  user: { name: 'Teste' },
  rewards: [],
  badges: [],
  rules: [],
  books: [],
  finances: [],
  weights: [],
  sleep: [],
};
const empty = { ...app, goals: [], days: [] };

const cases = {
  CalendarHeatmap: () => ({ weeks: stats.calendarMonth(days, today).weeks, monthLabel: stats.calendarMonth(days, today).monthLabel }),
  StreakCompare: () => ({ info: stats.streakInfo(days, { end: today }) }),
  PeriodBars: () => ({ buckets: stats.weeklyBuckets(days, 8, today), unit: 'score' }),
  ProgressRing: () => ({ ratio: 0.5, done: 3, total: 6, size: 124, label: 'checklist do dia' }),
  WeekdayGrid: () => ({ data: stats.weekdayGrid(days, 56, today) }),
  CompletionLine: () => ({ points: stats.completionWithAverage(days, { n: 30, window: 7, end: today }) }),
  BarsWithTarget: () => ({ data: stats.areaVsTarget(app, 14, today) }),
  TrendChart: () => {
    const t = stats.trendLine(days, { n: 30, end: today });
    return { points: t.points, projection: t.projection };
  },
  CumulativeChart: () => ({ points: stats.cumulativeDone(days, { n: 30, end: today }) }),
  BalanceRadar: () => ({ data: stats.areaBalance(app, 14, today) }),
  HabitRankingBars: () => ({ data: stats.habitRanking(app, 30, today) }),
  HourHeatmap: () => ({ data: stats.hourHeatmap(days) }),
  EnergyScatter: () => {
    const s = stats.scatterEnergy(days, 'energy');
    return { points: s.points, correlation: s.correlation, xLabel: 'energia' };
  },
  StackedBars: () => ({ data: stats.stackedTasks(days, 14, today) }),
  TimelineList: () => ({ items: stats.timeline(days, goals, 10) }),
  BubbleChart: () => ({ points: stats.bubbleHabits(app, 30, today) }),
  WaffleChart: () => {
    const w = stats.waffle(days, 100, today);
    return { cells: w.cells, done: w.done, partial: w.partial };
  },
  Sparkline: () => ({ values: stats.sparkline(app, 'g1', 14, today) }),
  MonthlyGauge: () => ({ info: stats.monthlyGauge(app, today), size: 150 }),
  CategoryDonut: () => ({ data: stats.categoryDistribution(app, 30, today), centerLabel: 'tarefas feitas', unit: ' tarefas' }),
};

/* 5. mesma lista, sem dado nenhum: nenhum gráfico pode estourar */
const emptyCases = {
  CalendarHeatmap: () => ({ weeks: stats.calendarMonth([], today).weeks }),
  StreakCompare: () => ({ info: stats.streakInfo([], { end: today }) }),
  PeriodBars: () => ({ buckets: stats.weeklyBuckets([], 8, today) }),
  ProgressRing: () => ({ ratio: 0, done: 0, total: 0 }),
  WeekdayGrid: () => ({ data: stats.weekdayGrid([], 56, today) }),
  CompletionLine: () => ({ points: stats.completionWithAverage([], { n: 30, window: 7, end: today }) }),
  BarsWithTarget: () => ({ data: stats.areaVsTarget(empty, 14, today) }),
  TrendChart: () => ({ points: [], projection: [] }),
  CumulativeChart: () => ({ points: stats.cumulativeDone([], { n: 30, end: today }) }),
  BalanceRadar: () => ({ data: stats.areaBalance(empty, 14, today) }),
  HabitRankingBars: () => ({ data: [] }),
  HourHeatmap: () => ({ data: stats.hourHeatmap([]) }),
  EnergyScatter: () => ({ points: [], correlation: null }),
  StackedBars: () => ({ data: stats.stackedTasks([], 14, today) }),
  TimelineList: () => ({ items: [] }),
  BubbleChart: () => ({ points: [] }),
  WaffleChart: () => ({ cells: stats.waffle([], 100, today).cells, done: 0, partial: 0 }),
  Sparkline: () => ({ values: stats.sparkline(empty, 'g1', 14, today) }),
  MonthlyGauge: () => ({ info: stats.monthlyGauge(empty, today) }),
  CategoryDonut: () => ({ data: [] }),
};

let fails = 0;
let pass = 0;
const run = (label, map) => {
  for (const [name, make] of Object.entries(map)) {
    const C = charts[name];
    if (!C) {
      console.log(`  ✗ ${label}${name}: não exportado`);
      fails++;
      continue;
    }
    try {
      const html = renderToStaticMarkup(React.createElement(C, make()));
      if (html.length < 40) {
        console.log(`  ✗ ${label}${name}: markup vazio`);
        fails++;
      } else {
        pass++;
      }
    } catch (e) {
      console.log(`  ✗ ${label}${name}: ${e.message}`);
      fails++;
    }
  }
};

console.log('\n── Gráficos: render (com dado e sem dado) ──');
run('', cases);
run('vazio · ', emptyCases);
// 6. a tela inteira (filtros + 21 cards) tem que montar — vazia e com dados reais
{
  // O SSR do zustand lê `getInitialState`, então `setState` nunca chega na tela.
  // Solução: gerar uma cópia da tela compilada que importa um stub de store com
  // o estado do cenário (um stub por cenário — módulo ESM é cacheado por URL).
  const makeStub = (name, fixture) => {
    fs.writeFileSync(
      path.join(outRoot, `app/stub-store-${name}.mjs`),
      `import { useStore as real } from '../src/lib/store.js';
const fixture = ${JSON.stringify(fixture)};
export const useStore = () => ({ ...real.getState(), ...fixture });
useStore.getState = () => ({ ...real.getState(), ...fixture });
useStore.setState = real.setState;
useStore.subscribe = real.subscribe;
`,
    );
    fs.writeFileSync(
      path.join(outRoot, `app/modulo/graficos-${name}.js`),
      screenJs.replace("'../../src/lib/store'", `'../stub-store-${name}.mjs'`),
    );
    return pathToFileURL(path.join(outRoot, `app/modulo/graficos-${name}.js`)).href;
  };

  const renderScreen = async (name, fixture) => {
    try {
      const Screen = (await import(makeStub(name, fixture))).default;
      return { html: renderToStaticMarkup(React.createElement(Screen)) };
    } catch (e) {
      return { error: e.message };
    }
  };

  const vazia = await renderScreen('vazio', {});
  if (vazia.error || vazia.html.length < 200 || !vazia.html.includes('Gráficos')) {
    console.log(`  ✗ Tela de gráficos (sem dado): ${vazia.error ?? `markup suspeito (${vazia.html.length} chars)`}`);
    fails++;
  } else {
    pass++;
  }

  // com dados: a tela tem que desenhar valor, não "Sem dado" em todo card
  const cheia = await renderScreen('dados', { ...app, status: 'ready', booted: true });
  if (cheia.error) {
    console.log(`  ✗ Tela de gráficos (com dados): ${cheia.error}`);
    fails++;
  } else {
    const semDado = (cheia.html.match(/Sem dado/g) ?? []).length;
    if (cheia.html.length < 4000 || semDado > 6) {
      console.log(`  ✗ Tela de gráficos (com dados): ${cheia.html.length} chars, ${semDado}x "Sem dado"`);
      fails++;
    } else {
      console.log(`  ✓ Tela de gráficos (com dados: ${cheia.html.length} chars, ${semDado}x "Sem dado")`);
      pass++;
    }
  }
}

console.log(`\n${fails === 0 ? '✅' : '❌'} ${pass} renders ok, ${fails} falharam\n`);
process.exit(fails === 0 ? 0 : 1);
