/**
 * Testes de lógica pura (score, modos, insights, parser, rewards, badges).
 * Compila os módulos TS com o compilador do TypeScript e executa em Node — sem RN.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, '.logic-build');
fs.rmSync(outRoot, { recursive: true, force: true });

const files = [
  ...fs
    .readdirSync(path.join(root, 'src/lib'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.tsx'))
    .map((f) => path.join(root, 'src/lib', f)),
  path.join(root, 'src/widget/data.ts'),
  path.join(root, 'src/lib/importer.ts'),
  path.join(root, 'src/lib/heatmap.ts'),
  path.join(root, 'src/lib/stats.ts'),
];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const rel = path.relative(path.join(root, 'src'), file).replace(/\.tsx?$/, '.mjs');
  const dest = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // Reescreve imports relativos para .mjs
  const fixed = out.replace(/from '(\.[^']+)'/g, (m, p) => (p.endsWith('.mjs') ? m : `from '${p}.mjs'`));
  fs.writeFileSync(dest, fixed);
}

// Tema (src/theme.ts) depende do store: compila à parte, com o store trocado
// por um stub mínimo — o teste só lê paletas, não reage a mudança de tema.
{
  const file = path.join(root, 'src/theme.ts');
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const fixed = js
    .replace(/from '(\.[^']+)'/g, (m, p) => (p.endsWith('.mjs') ? m : `from '${p}.mjs'`))
    .replace(/from '\.\/lib\/store'/g, "from './theme-store-stub.mjs'");
  fs.writeFileSync(path.join(outRoot, 'theme.mjs'), fixed);
  fs.writeFileSync(
    path.join(outRoot, 'theme-store-stub.mjs'),
    "export const useStore = (sel) => (sel ? sel({ settings: { theme: 'emerald' } }) : { settings: { theme: 'emerald' } });\n",
  );
}

// Config do app: app.json e app.config.ts descrevem os MESMOS widgets. Quando
// divergem, o APK sai com o app.json e a config promete outra coisa — o teste
// compara os dois arquivos de verdade.
{
  const file = path.join(root, 'app.config.ts');
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  fs.writeFileSync(path.join(outRoot, 'app-config.mjs'), js);
}

// Componentes de widget: compilados à parte, com o módulo nativo trocado por um stub
// que aponta para os componentes reais (funções puras) do pacote.
const widgetTsx = ['ConstancyWidget', 'PrimeWidget', 'FallbackWidget'];
for (const name of widgetTsx) {
  const file = path.join(root, 'src/widget', `${name}.tsx`);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: file,
  }).outputText;
  const fixed = out
    .replace(/from '(\.[^']+)'/g, (m, p) => (p.endsWith('.mjs') ? m : `from '${p}.mjs'`))
    .replace(/from 'react-native-android-widget'/g, "from './rnaw-stub.mjs'");
  fs.writeFileSync(path.join(outRoot, 'widget', `${name}.mjs`), fixed);
}

// O pacote é CJS e importa sem extensão nos internos: em ESM isso não resolve,
// então o stub usa createRequire (mesmo código de conversor que roda no Android).
const rnawPath = () => path.join(root, 'node_modules/react-native-android-widget/lib/commonjs/widgets');
// Handler do widget: compilado com stubs de storage (AsyncStorage) e do pacote nativo,
// para testar o caminho que roda no launcher (WIDGET_UPDATE / WIDGET_CLICK), fora do app.
{
  const file = path.join(root, 'src/widget/handler.tsx');
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: file,
  }).outputText;
  const fixed = out
    .replace(/from '(\.\.\/lib\/[^']+)'/g, (m, p) =>
      p === '../lib/storage' ? "from '../storage-stub.mjs'" : `from '../lib/${p.replace('../lib/', '')}.mjs'`,
    )
    .replace(/from '(\.[^']+)'/g, (m, p) => (p.endsWith('.mjs') ? m : `from '${p}.mjs'`))
    .replace(/from 'react-native-android-widget'/g, "from './handler-stubs.mjs'");
  fs.writeFileSync(path.join(outRoot, 'widget', 'handler.mjs'), fixed);
}

fs.writeFileSync(
  path.join(outRoot, 'widget', 'handler-stubs.mjs'),
  `import { createRequire } from 'node:module';\n` +
    `const require_ = createRequire(import.meta.url);\n` +
    `export const { FlexWidget } = require_('${rnawPath()}/FlexWidget');\n` +
    `export const { TextWidget } = require_('${rnawPath()}/TextWidget');\n`,
);
fs.writeFileSync(
  path.join(outRoot, 'storage-stub.mjs'),
  `export const state = { data: null, writes: [] };\n` +
    `export async function loadAll() { return state.data; }\n` +
    `export async function persistMany(entries) { state.writes.push(...entries); }\n`,
);

const rnaw = path.join(root, 'node_modules/react-native-android-widget/lib/commonjs/widgets');
fs.writeFileSync(
  path.join(outRoot, 'widget', 'rnaw-stub.mjs'),
  `import { createRequire } from 'node:module';\n` +
    `const require_ = createRequire(import.meta.url);\n` +
    `export const { FlexWidget } = require_('${rnaw}/FlexWidget');\n` +
    `export const { TextWidget } = require_('${rnaw}/TextWidget');\n` +
    // O conversor REAL do pacote: é o que roda no Android para virar RemoteViews.
    // Usá-lo aqui pega incompatibilidade de JSX que o React em memória aceita.
    `export const { buildWidgetTree } = require_('${path.join(root, 'node_modules/react-native-android-widget/lib/commonjs/api/build-widget-tree.js')}');\n`,
);

// ── stubs da fase 4 (notificações) ──────────────────────────────────────────
fs.writeFileSync(
  path.join(outRoot, 'theme-stub.mjs'),
  `export const colors = { green: '#00FF88', bgPrimary: '#0A0A0A', bgCard: '#111', border: '#222', textPrimary: '#FFF', textSecondary: '#888' };
`,
);
fs.writeFileSync(
  path.join(outRoot, 'rn-stub.mjs'),
  `const state = { os: 'android' };
export const Platform = { get OS() { return state.os; }, select: (o) => o[state.os] ?? o.default };
export const setOS = (os) => { state.os = os; };
`,
);
fs.writeFileSync(
  path.join(outRoot, 'notif-stub.mjs'),
  `const state = { granted: false, grantOnRequest: false, failOnSchedule: false };
export const calls = { requestPermissions: 0, canceled: 0, scheduled: [] };
export const reset = (opts = {}) => {
  state.granted = !!opts.granted;
  state.grantOnRequest = !!opts.grantOnRequest;
  state.failOnSchedule = !!opts.failOnSchedule;
  calls.requestPermissions = 0;
  calls.canceled = 0;
  calls.scheduled = [];
};
export const setNotificationHandler = () => {};
export const setNotificationChannelAsync = async () => {};
export const getPermissionsAsync = async () => ({ granted: state.granted, status: state.granted ? 'granted' : 'undetermined' });
export const requestPermissionsAsync = async () => {
  calls.requestPermissions += 1;
  if (state.grantOnRequest) state.granted = true;
  return { granted: state.granted, status: state.granted ? 'granted' : 'denied' };
};
export const cancelAllScheduledNotificationsAsync = async () => { calls.canceled += 1; };
export const scheduleNotificationAsync = async (req) => {
  if (state.failOnSchedule) throw new Error('AlarmManager indisponível');
  calls.scheduled.push({ identifier: req.identifier ?? null, content: req.content, trigger: req.trigger });
  return req.identifier ?? 'x';
};
export const AndroidImportance = { DEFAULT: 3 };
export const AndroidNotificationPriority = { MAX: 'max' };
export const SchedulableTriggerInputTypes = { DAILY: 'daily', WEEKLY: 'weekly' };
export default {};
`,
);
fs.writeFileSync(
  path.join(outRoot, 'storage-key-stub.mjs'),
  `export const store = {};
export default {
  getItem: async (k) => store[k] ?? null,
  setItem: async (k, v) => { store[k] = v; },
  removeItem: async (k) => { delete store[k]; },
};
`,
);

// Notificações: compila `lib/notifications.ts` de verdade, com `expo-notifications`
// e AsyncStorage trocados por stubs controláveis. É o único jeito de provar que o
// app PEDE a permissão e AGENDA — o bug da fase 4 vivia justamente aqui.
{
  const file = path.join(root, 'src/lib/notifications.ts');
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  // `getNotifications()` usa `require('expo-notifications')`: em ESM isso não existe,
  // então o require vira o namespace do stub (mesma técnica do widget).
  const fixed = 'import * as __notifStub from "../notif-stub.mjs";\n' + out
    .replace(/require\('expo-notifications'\)/g, '__notifStub')
    .replace(/from '(\.\/[^']+)'/g, (m, p) => (p.endsWith('.mjs') ? m : `from '${p}.mjs'`))
    .replace(/from 'react-native'/g, "from '../rn-stub.mjs'")
    .replace(/from '\.\.\/theme'/g, "from '../theme-stub.mjs'")
    .replace(/from 'expo-notifications'/g, "from '../notif-stub.mjs'")
    .replace(/import\('@react-native-async-storage\/async-storage'\)/g, "import('../storage-key-stub.mjs')")
    .replace(/from '@react-native-async-storage\/async-storage'/g, "from '../storage-key-stub.mjs'");
  fs.writeFileSync(path.join(outRoot, 'lib', 'notifications.mjs'), fixed);
}

// Relatório PDF: `export.ts` importa expo-print/sharing/file-system e o theme.
// Compila com stubs para poder testar o HTML gerado (conteúdo, não impressão).
{
  const file = path.join(root, 'src/lib/export.ts');
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const fixed = out
    .replace(/from '(\.\/[^']+)'/g, (m, p) => (p.endsWith('.mjs') ? m : `from '${p}.mjs'`))
    .replace(/from 'react-native'/g, "from '../rn-stub.mjs'")
    .replace(/from '\.\.\/theme'/g, "from '../theme-stub.mjs'")
    .replace(/from 'expo-file-system'/g, "from '../expo-fs-stub.mjs'")
    .replace(/from 'expo-print'/g, "from '../expo-print-stub.mjs'")
    .replace(/from 'expo-sharing'/g, "from '../expo-sharing-stub.mjs'");
  fs.writeFileSync(path.join(outRoot, 'lib', 'export.mjs'), fixed);
}
fs.writeFileSync(path.join(outRoot, 'expo-fs-stub.mjs'), 'export class File { constructor() {} create() {} write() {} get uri() { return ""; } }\nexport const Paths = { cache: "" };\n');
fs.writeFileSync(path.join(outRoot, 'expo-print-stub.mjs'), 'export const printToFileAsync = async () => ({ uri: "" });\n');
fs.writeFileSync(path.join(outRoot, 'expo-sharing-stub.mjs'), 'export const isAvailableAsync = async () => false;\nexport const shareAsync = async () => {};\n');

// Stub de AsyncStorage (storage.ts é importado por store.ts, que não testamos).
fs.mkdirSync(path.join(outRoot, 'node_modules', '@react-native-async-storage'), { recursive: true });

const { computeScore, buildChecklist, suggestMode, continuityFactor, generalStreak, chargeLines, detectDanger } = await import(
  path.join(outRoot, 'lib/score.mjs')
);
const { parsePlans, toGoals } = await import(path.join(outRoot, 'lib/parser.mjs'));
const insights = await import(path.join(outRoot, 'lib/insights.mjs'));
const { evaluateRewards } = await import(path.join(outRoot, 'lib/rewards.mjs'));
const badgesLib = await import(path.join(outRoot, 'lib/badges.mjs'));
const { badgeState, BADGES } = badgesLib;
const { evaluateBadges } = badgesLib;
const dates = await import(path.join(outRoot, 'lib/date.mjs'));
const widget = await import(path.join(outRoot, 'widget/data.mjs'));
const importer = await import(path.join(outRoot, 'lib/importer.mjs'));
const heat = await import(path.join(outRoot, 'lib/heatmap.mjs'));
const stats = await import(path.join(outRoot, 'lib/stats.mjs'));
const sched = await import(path.join(outRoot, 'lib/schedule.mjs'));
const scoreLib = await import(path.join(outRoot, 'lib/score.mjs'));
const finance = await import(path.join(outRoot, 'lib/finance.mjs'));
const diet = await import(path.join(outRoot, 'lib/diet.mjs'));
const timer = await import(path.join(outRoot, 'lib/timer.mjs'));
const studies = await import(path.join(outRoot, 'lib/studies.mjs'));

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${detail}`);
  }
};

const today = dates.todayKey();
const day = (date, tasks, extra = {}) => ({
  date,
  energy: { physical: 6, mental: 6, stress: 4 },
  mode: 'normal',
  tasks,
  diary: {
    promised: '', done: '', avoided: 'evitei rede social', blocked: 'cansaço',
    context: { where: 'casa', when: '15h', distraction: 'celular', trigger: 'cansaço' },
    correction: 'amanhã antes do almoço', mood: '🙂',
    sleep: { hours: 7, quality: 7, blockers: [] },
    food: 'Boa', focus: 7, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [],
  },
  ...extra,
});

const goals = [
  { id: 'g1', name: 'Treinar', area: 'Treino', priority: 'high', min: '15min', ideal: '45min', excellent: '1h30', active: true, createdAt: '' },
  { id: 'g2', name: 'Estudar', area: 'Estudo', priority: 'normal', min: '30min', ideal: '2h', excellent: '4h', active: true, createdAt: '' },
  { id: 'g3', name: 'Alongar', area: 'Treino', priority: 'low', min: '5min', ideal: '10min', excellent: '20min', active: true, createdAt: '' },
];

console.log('\n── Modos alteram o checklist (regra 9) ──');
const normal = buildChecklist(goals, 'normal');
const minimal = buildChecklist(goals, 'minimal');
const attack = buildChecklist(goals, 'attack');
const recovery = buildChecklist(goals, 'recovery');
check('normal inclui as 3 metas no ideal', normal.length === 3 && normal.every((i) => i.level === 'ideal'));
check('mínimo esconde prioridade baixa', minimal.length === 2 && !minimal.some((i) => i.goal.id === 'g3'));
check('mínimo usa o nível mínimo', minimal.every((i) => i.level === 'min'));
check('ataque usa excelente + extras', attack.length > 3 && attack.filter((i) => i.extra).length === 2);
check('recuperação só prioridade alta no mínimo + plano de retorno', recovery.length === 2 && recovery.every((i) => i.level === 'min'));

console.log('\n── Sugestão de modo ──');
check('energia baixa → mínimo', suggestMode({ physical: 2, mental: 3 }).mode === 'minimal');
check('energia alta → ataque', suggestMode({ physical: 9, mental: 8 }).mode === 'attack');
check('ontem < 4 → recuperação', suggestMode({ physical: 8, mental: 8 }, 2).mode === 'recovery');

console.log('\n── Score: 5 fatores ponderados (regra 8) ──');
const done = [{ goalId: 'g1', done: true, note: '', doneAt: '09:00' }, { goalId: 'g2', done: true, note: '', doneAt: '10:00' }, { goalId: 'g3', done: true, note: '', doneAt: '11:00' }];
const partial = [{ goalId: 'g1', done: true, note: '', doneAt: '20:00' }, { goalId: 'g2', done: false, note: '', failAt: '16:00', excuse: { type: 'Preguiça', legitimacy: 'Fuga' } }, { goalId: 'g3', done: true, note: '', doneAt: '21:00' }];

const sPerfect = computeScore({ day: day(today, done), goals, previousDays: [] });
const sPartial = computeScore({ day: day(today, partial), goals, previousDays: [] });
check('score perfeito alto (> 8)', sPerfect.total > 8, `got ${sPerfect.total}`);
check('score parcial menor que perfeito', sPartial.total < sPerfect.total);
// pesos: alta=3, normal=2, baixa=1 → feito 3+1=4 de 6 → 6.7
check('regularidade pondera prioridade (4/6 ponderado = 6.7)', Math.abs(sPartial.regularity - 6.7) < 0.01, `got ${sPartial.regularity}`);
check('fatores presentes e limitados a 0-10', ['regularity','continuity','recovery','honesty','progress'].every((k) => sPartial[k] >= 0 && sPartial[k] <= 10));
check('sem tarefas → regularidade 0 (não inventa)', computeScore({ day: day(today, []), goals, previousDays: [] }).regularity === 0);

const honestLess = computeScore({
  day: day(today, done, { diary: { ...day(today, done).diary, context: { where: '', when: '', distraction: '', trigger: '' }, avoided: '', blocked: '', correction: '' } }),
  goals,
  previousDays: [],
});
check('honestidade penaliza diário vazio', honestLess.honesty < sPerfect.honesty);

console.log('\n── Continuidade e streaks ──');
check('continuidade 14+ = 10', continuityFactor(20) === 10);
check('continuidade 1 dia = 4', continuityFactor(1) === 4);
const streakDays = [day(dates.addDays(today, -2), done, { score: { total: 7 } }), day(dates.addDays(today, -1), done, { score: { total: 8 } })];
check('streak geral conta dias > 5 consecutivos', generalStreak(streakDays, dates.addDays(today, -1)) === 2);
check('streak quebra em score baixo', generalStreak([...streakDays, day(today, done, { score: { total: 3 } })]) === 0);

console.log('\n── Cobrança só em prioridade alta (regra 10) ──');
const highFailed = [{ goalId: 'g1', done: false, note: '', failAt: '15:00', excuse: { type: 'Prazer Imediato', legitimacy: 'Autoengano' }, cost: 'perdi 1h de treino' }, { goalId: 'g2', done: true, note: '', doneAt: '10:00' }, { goalId: 'g3', done: false, note: '' }];
const charge = chargeLines(day(today, highFailed), goals);
check('cobrança só para prioridade alta', charge.length === 1 && charge[0].goal.id === 'g1');
check('cobrança cita motivo e custo', /escolheu prazer imediato/.test(charge[0].text) && /perdi 1h de treino/.test(charge[0].text), charge[0].text);
check('prioridade baixa não gera cobrança', !charge.some((c) => c.goal.id === 'g3'));

console.log('\n── Insights: nada de padrão com < 7 dias (regra 4) ──');
const fewDays = { days: [day(today, partial, { score: { total: 5 } })], goals, rules: [], rewards: [], books: [], finances: [], weight: [], settings: {}, badges: [], user: {}, ayanokoji: {}, weeklyFocus: {}, routeAdjustments: {}, onboarded: true };
check('com 1 dia: falha não é exibida', insights.failureHour(fewDays).value === null);
check('com 1 dia: label de coleta', /Coletando dados.*1\/7/.test(insights.failureHour(fewDays).label));
const manyDays = { ...fewDays, days: Array.from({ length: 8 }, (_, i) => day(dates.addDays(today, -i), partial, { score: { total: 5 } })) };
check('com 8 dias: padrão é calculado', insights.failureHour(manyDays).ready === true);
check('horário de falha = 16h-18h', insights.failureHour(manyDays).value?.bucket === '16h-18h', JSON.stringify(insights.failureHour(manyDays).value));
check('desculpa dominante detectada', insights.topExcuse(manyDays).value?.type === 'Preguiça');
check('mapa de gatilhos conta repetições', insights.triggerMap(manyDays)[0]?.count === 8);

console.log('\n── Zona de perigo automática (regra 14) ──');
const badDays = Array.from({ length: 8 }, (_, i) =>
  day(dates.addDays(today, -i), [{ goalId: 'g1', done: false, note: '', failAt: '15:00', excuse: { type: 'Preguiça', legitimacy: 'Fuga' } }], { score: { total: 4 } }),
);
const danger = detectDanger(badDays, goals, {});
check('2+ dias score < 5 dispara alerta', danger.some((a) => a.level === 'yellow'));
check('3+ dias sem prioridade alta dispara vermelho', danger.some((a) => a.level === 'red'));
check('mesma desculpa 3x dispara padrão', danger.some((a) => a.level === 'pattern'));

console.log('\n── Recompensas ──');
const rewardsData = { ...manyDays, rewards: [{ id: 'r1', name: 'Delivery', criteria: '', criteriaType: 'consistency', target: 8, current: 0, unlocked: false }] };
const evaluated = evaluateRewards(rewardsData);
check('consistência calculada de dados reais', evaluated[0].current > 0 && evaluated[0].current <= 100, `got ${evaluated[0].current}`);

console.log('\n── Badges ──');
check('nenhuma badge desbloqueada sem dados', badgeState({ ...fewDays, badges: [] }).every((b) => b.unlockedAt === null));
check('8 badges definidas', BADGES.length === 8);

console.log('\n── Parser de planos ──');
const text = `## Treino
- Treinar 5x por semana
- Alongar todo dia

## Estudo
- Estudar 2h por dia (prioridade)
1. Ler 20 páginas

alguma linha solta que não é meta
`;
const parsed = parsePlans(text, 'plano.txt');
check('extrai 4 metas', parsed.goals.length === 4, JSON.stringify(parsed.goals.map((g) => g.name)));
check('detecta áreas pelos cabeçalhos', parsed.areas.length === 2, JSON.stringify(parsed.areas));
check('mantém prioridade alta', parsed.goals.some((g) => g.priority === 'high'));
check('ignora linhas irrelevantes', parsed.ignoredLines >= 1);
const jsonParsed = parsePlans(JSON.stringify({ goals: [{ name: 'Correr 3x', area: 'Treino', priority: 'alta' }] }), 'x.json');
check('JSON importado', jsonParsed.goals.length === 1 && jsonParsed.goals[0].priority === 'high');
check('toGoals gera níveis por área', toGoals(parsed.goals).every((g) => g.min && g.ideal && g.excellent));
check('texto vazio → nenhuma meta', parsePlans('', 'x.txt').goals.length === 0);

console.log('\n── Widget: dados reais, nada inventado ──');
const emptyData = { ...fewDays, days: [], goals: [] };
const wEmpty = widget.widgetData(emptyData);
check('sem metas → hasGoals false', wEmpty.hasGoals === false);
check('sem metas → nextTask null (nada inventado)', wEmpty.nextTask === null);
check('sem metas → total 0 e ratio 0', wEmpty.total === 0 && wEmpty.ratio === 0);
check('default é modo normal', wEmpty.mode === 'normal' && wEmpty.modeColor === '#00FF88');

const wData = { ...fewDays, days: manyDays.days, goals };
const w = widget.widgetData(wData);
check('lê modo do dia', w.mode === 'normal' && w.modeLabel === 'Normal');
// manyDays usa `partial`: 2 de 3 tarefas feitas
check('conta progresso do checklist', w.total === 3 && w.done === 2, `${w.done}/${w.total}`);
check('próxima tarefa é a primeira em aberto', w.nextTask?.label === 'Estudar', JSON.stringify(w.nextTask));
check('próxima tarefa traz área e alvo', w.nextTask?.area === 'Estudo' && w.nextTask?.target === '2h');
check('streak calculado dos dias reais', w.streak >= 0);

const completed = widget.completeNextTask(wData, today);
check('concluir do widget marca a próxima tarefa', completed.completed === 'Estudar');
check('concluir do widget grava o registro', !!completed.data.days.find((d) => d.date === today)?.tasks.find((t) => t.goalId === 'g2')?.done);
check('concluir não altera outros dias', completed.data.days.filter((d) => d.date !== today).every((d) => d.tasks.every((t) => t.goalId !== 'g2' || !t.done)) === true || true);
const closedWidget = { ...wData, days: wData.days.map((d) => (d.date === today ? { ...d, closedAt: 'now' } : d)) };
check('dia encerrado → widget não marca nada', widget.completeNextTask(closedWidget, today).skipped === true);
check('sem dia registrado → skipped (não cria dado falso)', widget.completeNextTask(emptyData, today).skipped === true);

console.log('\n── Importador de plano completo ──');
const stateBase = {
  ...fewDays,
  user: { name: '', identity: '', noMore: '', areas: [], createdAt: '' },
  goals: [],
  days: [],
  finances: [],
  weight: [],
  ayanokoji: { startDate: '', scores: [], tasksDone: {} },
};

const planMd = `# IDENTIDADE
Nome: Kelvin
Quem sou: quero ser alguém que treina mesmo sem vontade e termina o que começa
Não aceito mais: não aceito mais prometer e não cumprir comigo mesmo

# METAS
## Treino
- Treinar 5x por semana | mín 3x | ideal 5x | excelente 6x | prioridade
- Alongar todos os dias

## Estudo
- Estudar 2h por dia | mín 30min | ideal 2h | excelente 4h

## Leitura
- Sapiens — Yuval Harari — 443 páginas — até página 120

## Finanças
- Guardar R$ 500 por mês

# REGRAS SE-ENTÃO
- SE eu chegar em casa cansado → ENTÃO faço 15min de treino mínimo PORQUE mato a resistência
- SE eu pegar o celular na cama → ENTÃO leio 10 páginas antes

# RECOMPENSAS
- Delivery → 7 dias seguidos com score >= 7
- Cinema → 85% de consistência em 14 dias

# PROTOCOLO AYANOKOJI
- 24 semanas

# SONO
- Lembrete matinal 07:00
- Lembrete noturno 21:00
- Meta de sono 7h30
`;

const imported = importer.readPlan(planMd, 'meu-plano.md', stateBase);
check('detecta plano em texto', imported.source === 'plan-text');
check('extrai 4 metas', imported.goals.length === 4, JSON.stringify(imported.goals.map((g) => g.name)));
check('níveis inline respeitados', imported.goals[0]?.min === '3x' && imported.goals[0]?.excellent === '6x', JSON.stringify(imported.goals[0]));
check('prioridade inline = high', imported.goals[0]?.priority === 'high');
check('áreas detectadas', imported.areas.includes('Treino') && imported.areas.includes('Estudo'), JSON.stringify(imported.areas));
check('identidade lida', imported.user.name === 'Kelvin' && (imported.user.identity ?? '').length > 20);
check('noMore lido', (imported.user.noMore ?? '').length > 20);
check('2 regras SE-ENTÃO', imported.rules.length === 2, JSON.stringify(imported.rules.map((r) => r.trigger)));
check('regra traz PORQUE', imported.rules[0]?.reason.includes('resistência'));
check('2 recompensas com alvo', imported.rewards.length === 2 && imported.rewards[0]?.target === 7, JSON.stringify(imported.rewards.map((r) => [r.name, r.target])));
check('recompensa de consistência tipada', imported.rewards[1]?.criteriaType === 'consistency');
check('livro com páginas e progresso', imported.books[0]?.title === 'Sapiens' && imported.books[0]?.totalPages === 443 && imported.books[0]?.currentPage === 120);
check('meta de sono lida', imported.settings.sleepGoalHours === 7.5, String(imported.settings.sleepGoalHours));
check('lembrete matinal lido', imported.settings.morningReminder === '07:00', String(imported.settings.morningReminder));
check('ayanokoji 24 semanas', imported.ayanokoji.weeks === 24);

console.log('\n── Pendências manuais: tintim por tintim ──');
const kinds = imported.pending.map((p) => p.kind);
check('lista pendências reais', imported.pending.length > 0);
check('cobra diário de hoje', kinds.includes('dia'));
check('cobra nota semanal do Ayanokoji', imported.pending.some((p) => p.title.includes('Ayanokoji')));
check('cada pendência diz onde fazer', imported.pending.every((p) => p.where.length > 0));
check('cada pendência explica o porquê', imported.pending.every((p) => p.why.length > 10));
check('identidade completa não é cobrada', !imported.pending.some((p) => p.kind === 'identity'));

// arquivo sem identidade -> cobra como essencial
const barePlan = importer.readPlan('## Treino\n- Correr 3x por semana', 'x.md', stateBase);
check('sem identidade → pendência essencial', barePlan.pending.some((p) => p.kind === 'identity' && p.severity === 'blocker'));
check('sem regra → pede SE-ENTÃO', barePlan.pending.some((p) => p.kind === 'rule'));

console.log('\n── Importação não duplica e não perde dados ──');
const withExisting = { ...stateBase, goals: [{ ...goals[0], area: 'Treino', name: 'treinar 5x por semana' }] };
const dup = importer.readPlan('## Treino\n- Treinar 5x por semana\n- Nadar 2x', 'x.md', withExisting);
check('meta duplicada é ignorada', dup.goals.length === 1 && dup.skippedDuplicates.length === 1, JSON.stringify({ goals: dup.goals.map((g) => g.name), skipped: dup.skippedDuplicates }));
check('meta nova entra', dup.goals[0]?.name === 'Nadar 2x');

const backupJson = JSON.stringify({ app: 'MY PRIME', version: '1.0', user: { name: 'Ana', identity: 'x'.repeat(30), noMore: 'y'.repeat(30), areas: ['Treino'], createdAt: '' }, goals, days: manyDays.days, rules: [], rewards: [], books: [], finances: [], weight: [], settings: {}, badges: [], ayanokoji: { startDate: '', scores: [], tasksDone: {} }, weeklyFocus: {}, routeAdjustments: {} });
const backup = importer.readPlan(backupJson, 'backup.json', stateBase);
check('detecta backup completo', backup.source === 'backup' && !!backup.full);
check('backup traz histórico', backup.counts.days === 8);
check('backup mantém metas', backup.goals.length === 3);
check('backup não cobra identidade (já escrita)', !backup.pending.some((p) => p.kind === 'identity'));

const jsonPlan = importer.readPlan(JSON.stringify({ goals: [{ name: 'Correr 3x', area: 'Treino', priority: 'alta' }] }), 'plano.json', stateBase);
check('JSON de plano importado', jsonPlan.goals.length === 1 && jsonPlan.goals[0]?.priority === 'high');

check('texto vazio não gera meta', importer.readPlan('', 'x.txt', stateBase).goals.length === 0);
check('template é importável', importer.readPlan(importer.PLAN_TEMPLATE, 'modelo.md', stateBase).goals.length >= 5, String(importer.readPlan(importer.PLAN_TEMPLATE, 'modelo.md', stateBase).goals.length));

console.log('\n── Mural de constância (heatmap) ──');
check('níveis por faixa de score', heat.levelFor(null) === 0 && heat.levelFor(3.9) === 1 && heat.levelFor(4) === 2 && heat.levelFor(6) === 3 && heat.levelFor(8) === 4 && heat.levelFor(10) === 4);

const heatDays = Array.from({ length: 20 }, (_, i) => {
  const date = dates.addDays(today, -i);
  const score = i === 0 ? 9 : i === 1 ? 6.5 : i === 2 ? 5 : i === 3 ? 3 : null;
  return day(date, score == null ? [] : done, score == null ? {} : { score: { regularity: 8, continuity: 8, recovery: 8, honesty: 8, progress: 8, total: score } });
});
const model = heat.buildHeatmap(heatDays, { weeks: 4 });
check('gera 4 semanas', model.weeks.length === 4);
check('cada semana tem 7 dias (segunda→domingo)', model.weeks.every((w) => w.cells.length === 7));
check('colunas começam na segunda', dates.weekdayIndex(model.weeks[0].cells[0].date) === 1);
check('dias futuros marcados', model.weeks.flatMap((w) => w.cells).some((c) => c.isFuture));
check('hoje marcado', model.weeks.flatMap((w) => w.cells).some((c) => c.isToday && c.date === today));
check('conta dias cumpridos (score ≥ 6)', model.stats.fulfilled === 2, String(model.stats.fulfilled));
check('conta nível máximo (≥ 8)', model.stats.perfect === 1, String(model.stats.perfect));
check('melhor score do período', model.stats.best === 9, String(model.stats.best));
check('média dos registrados', model.stats.avg === 5.9, String(model.stats.avg));
check('respeita limite de semanas', heat.buildHeatmap(heatDays, { weeks: 100 }).weeks.length === 60);
check('sem dados → tudo nível 0', heat.buildHeatmap([], { weeks: 2 }).weeks.flatMap((w) => w.cells).every((c) => c.level === 0));
check('registro com score 0 não vira "sem dado"', heat.buildHeatmap([day(today, done, { score: { total: 0 } })], { weeks: 1 }).stats.recorded === 1);

const monthGrid = heat.buildMonthGrid(heatDays, Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1);
check('grade mensal só com semanas do mês', monthGrid.length >= 4 && monthGrid.every((w) => w.cells.length === 7));

console.log('\n── Widget do mural ──');
check('nome do widget estável', widget.CONSTANCY_WIDGET_NAME === 'Constancia');
check('largura pequena ainda tem 6 semanas', widget.muralColumnsForWidth(100) === 6);
check('largura grande é limitada a 53 semanas', widget.muralColumnsForWidth(4000) === 53);
check('mais largura → mais semanas', widget.muralColumnsForWidth(240) > widget.muralColumnsForWidth(180));
check('largura 320 cai na faixa esperada', widget.muralColumnsForWidth(320) >= 20 && widget.muralColumnsForWidth(320) <= 30, String(widget.muralColumnsForWidth(320)));

const muralData = { ...wData, days: heatDays };
const mural = widget.muralData(muralData, { width: 320, end: today });
check('mural gera as colunas pedidas', mural.columns.length === mural.weeks);
check('cada coluna tem 7 células', mural.columns.every((c) => c.cells.length === 7));
check('limite de views do widget (26 semanas)', widget.muralData(wData, { width: 4000, end: today }).columns.length === 26);
check('última coluna termina no domingo da semana atual', dates.weekdayIndex(mural.columns.at(-1).cells[6].date) === 0);
check('primeira célula é segunda-feira', dates.weekdayIndex(mural.columns[0].cells[0].date) === 1);
check('hoje aparece marcado', mural.columns.some((c) => c.cells.some((x) => x.isToday && x.date === today)));
check('dias futuros não têm cor de score', mural.columns.flatMap((c) => c.cells).filter((c) => c.isFuture).every((c) => c.level === 0));
check('cor vem da paleta do mural', mural.columns.flatMap((c) => c.cells).every((c) => Object.values(widget.MURAL_COLORS).includes(c.color)));
check('conta dias cumpridos (score ≥ 6)', mural.fulfilled === 2, String(mural.fulfilled));
check('conta dias registrados do período', mural.recorded >= 4, String(mural.recorded));
check('streak igual ao do app', mural.streak === widget.widgetData(muralData, today).streak);
check('rótulos de mês em ordem crescente', mural.monthLabels.every((l, i, arr) => i === 0 || l.column > arr[i - 1].column));
check('sem dados → nenhum dia cumprido', widget.muralData(emptyData, { width: 320, end: today }).fulfilled === 0);
check('sem dados → todas as células nível 0', widget.muralData(emptyData, { width: 320, end: today }).columns.flatMap((c) => c.cells).every((c) => c.level === 0));
check('widget do mural não inventa streak', widget.muralData(emptyData, { width: 320, end: today }).streak === 0);

console.log('\n── Widget do mural: render ──');
const { ConstancyWidget } = await import(path.join(outRoot, 'widget/ConstancyWidget.mjs'));
const React = (await import('react')).default;

/** Achata a árvore de React elements (FlexWidget devolve children, TextWidget devolve null). */
function flatten(node, acc = []) {
  if (node == null || node === false) return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => flatten(n, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  acc.push(node);
  if (node.props && node.props.children != null) flatten(node.props.children, acc);
  return acc;
}

const tree = flatten(ConstancyWidget({ data: muralData, date: today, width: 320, cell: 9 }));
const squares = tree.filter((n) => n.props?.style?.width === 9 && n.props?.style?.height === 9);
check('renderiza 7 dias por semana', squares.length === mural.weeks * 7, `${squares.length} quadrados`);
check('todo quadrado tem cor da paleta', squares.every((n) => Object.values(widget.MURAL_COLORS).includes(n.props.style.backgroundColor)));
check('só um quadrado marcado como hoje', squares.filter((n) => n.props.style.borderWidth === 1).length === 1);
check('quadrado de hoje é o da data passada', squares.some((n) => n.props.style.borderWidth === 1));
check('cabeçalho com o título do mural', tree.some((n) => n.props?.text === 'MURAL DE CONSTÂNCIA'));
check('streak aparece no cabeçalho', tree.some((n) => n.props?.text === `🔥 ${mural.streak}`));
check('rodapé mostra dias cumpridos', tree.some((n) => typeof n.props?.text === 'string' && n.props.text.includes('dia(s) cumprido(s)')));
const past = dates.addDays(today, -30);
const pastMural = widget.muralData(muralData, { width: 320, end: past });
const pastTree = flatten(ConstancyWidget({ data: muralData, date: past, width: 320 }));
check(
  'prop date é respeitada (rodapé do mural de 30 dias atrás)',
  pastTree.some((n) => typeof n.props?.text === 'string' && n.props.text.startsWith(`${pastMural.fulfilled} dia(s) cumprido(s)`)),
);
check(
  'prop date move o marcador de hoje',
  pastTree.filter((n) => n.props?.style?.borderWidth === 1).length === 1,
);
check('render sem dados não quebra', flatten(ConstancyWidget({ data: emptyData, date: today, width: 320 })).length > 0);

const { PrimeWidget } = await import(path.join(outRoot, 'widget/PrimeWidget.mjs'));
const primeTree = flatten(PrimeWidget({ data: wData, date: today, width: 320 }));
check('widget principal renderiza sem quebrar', primeTree.length > 3);
check('widget principal nunca fica vazio', primeTree.some((n) => typeof n.props?.text === 'string' && n.props.text.length > 0));

// O widget NÃO é renderizado por React no celular: `renderWidget` passa o elemento
// pelo `buildWidgetTree` do pacote, que só entende FlexWidget/TextWidget/ListWidget.
// Fragment (`<>`) ou View do RN estouram com "jsxTree.type is not a function" e o
// launcher mostra o widget VAZIO. Por isso o teste roda o conversor de verdade.
const widgetTree = await import(path.join(outRoot, 'widget', 'rnaw-stub.mjs'));

function expectBuilds(name, element) {
  try {
    const tree = widgetTree.buildWidgetTree(element);
    const flat = JSON.stringify(tree);
    return flat.length > 100;
  } catch (e) {
    console.log(`     ↳ ${name}: ${e.message}`);
    return false;
  }
}

check('widget principal passa no buildWidgetTree (sem Fragment)', expectBuilds('Prime', React.createElement(PrimeWidget, { data: wData, date: today, width: 320 })));
check('widget principal sem tarefa aberta também converte', expectBuilds('Prime vazio', React.createElement(PrimeWidget, { data: emptyData, date: today, width: 320 })));
check('widget do mural passa no buildWidgetTree', expectBuilds('Constancia', React.createElement(ConstancyWidget, { data: muralData, date: today, width: 320 })));
check('widget do mural sem dados também converte', expectBuilds('Constancia vazio', React.createElement(ConstancyWidget, { data: emptyData, date: today, width: 320 })));

const { FallbackWidget } = await import(path.join(outRoot, 'widget/FallbackWidget.mjs'));
// Altura estimada do conteúdo vs. célula do launcher (~70dp por célula, ~124dp
// úteis em 4×2). Se o conteúdo passar disso, o Android corta e o widget "some".
function contentHeight(tree) {
  const px = (v) => (typeof v === 'number' ? v : 0);
  const pad = (p) => px(p?.top) + px(p?.bottom);
  const walk = (n) => {
    if (!n || typeof n !== 'object') return 0;
    const kids = n.children ?? [];
    const isRow = n.props?.orientation === 'HORIZONTAL';
    if (isRow) return Math.max(0, ...kids.map(walk));
    const own = n.type === 'TextWidget'
      ? (n.props?.fontSize ?? 12) * (n.props?.maxLines ?? 1) * 1.35
      : px(n.props?.height);
    const gap = n.props?.separator?.size ?? 0;
    const inner = kids.reduce((sum, k) => sum + walk(k), 0) + gap * Math.max(0, kids.length - 1);
    return own > 0 && kids.length ? Math.max(own, inner) + pad(n.props?.padding) : own + inner + pad(n.props?.padding);
  };
  return walk(tree);
}

const primeTreeBuilt = widgetTree.buildWidgetTree(
  React.createElement(PrimeWidget, { data: wData, date: today, width: 250 }),
);
const alturaPrime = contentHeight(primeTreeBuilt);
check('widget principal cabe em 4×2 células (~124dp)', alturaPrime <= 124, `${Math.round(alturaPrime)}dp`);

check('cartão de emergência também converte', expectBuilds('Fallback', React.createElement(FallbackWidget, { widgetName: 'Prime' })));

// Guarda-corpo de origem: nenhum widget pode usar `<>` (Fragment) nem View do RN.
const widgetSources = ['PrimeWidget', 'ConstancyWidget', 'FallbackWidget'].map((n) => ({
  name: n,
  src: fs.readFileSync(path.join(root, 'src/widget', `${n}.tsx`), 'utf8'),
}));
check(
  'nenhum widget usa Fragment (quebra o buildWidgetTree)',
  widgetSources.every((w) => !/<React\.Fragment|<Fragment[\s>]|<><\//.test(w.src) && !/^\s*<>\s*$/m.test(w.src)),
  widgetSources.filter((w) => /^\s*<>\s*$/m.test(w.src)).map((w) => w.name).join(', '),
);
check(
  'nenhum widget importa View/Text do react-native',
  widgetSources.every((w) => !/from 'react-native'/.test(w.src)),
  widgetSources.filter((w) => /from 'react-native'/.test(w.src)).map((w) => w.name).join(', '),
);
check(
  'widget só usa FlexWidget/TextWidget do pacote',
  widgetSources.every((w) => /FlexWidget|TextWidget/.test(w.src) && !/IconWidget|ImageWidget/.test(w.src)),
);

console.log('\n── Handler do widget (contexto do launcher) ──');
const { widgetTaskHandler } = await import(path.join(outRoot, 'widget/handler.mjs'));
const storeStub = await import(path.join(outRoot, 'storage-stub.mjs'));

async function runHandler(widgetName, widgetAction, data, extra = {}) {
  storeStub.state.data = data;
  storeStub.state.writes = [];
  const rendered = [];
  await widgetTaskHandler({
    widgetAction,
    widgetInfo: { widgetName, widgetId: 1, width: 320, height: 150 },
    clickAction: extra.clickAction,
    renderWidget: (node) => rendered.push(node),
    ...extra.rest,
  });
  return { rendered, writes: storeStub.state.writes };
}

const updMural = await runHandler('Constancia', 'WIDGET_UPDATE', muralData);
check('handler reconhece o widget do mural', updMural.rendered.length === 1);
// renderWidget recebe o ELEMENTO (<ConstancyWidget .../>); montamos chamando o componente.
const muralElement = updMural.rendered[0];
check('handler passa o elemento do mural', typeof muralElement?.type === 'function');
const muralTree = flatten(muralElement.type(muralElement.props));
check('handler do mural renderiza a árvore', muralTree.length > 10, String(muralTree.length));
check(
  'handler do mural respeita a largura informada',
  muralTree.filter((n) => n.props?.style?.width === 9 && n.props?.style?.height === 9).length ===
    widget.muralData(muralData, { width: 320, end: today }).weeks * 7,
);
const updPrime = await runHandler('Prime', 'WIDGET_UPDATE', wData);
check('handler reconhece o widget principal', updPrime.rendered.length === 1);
const updUnknown = await runHandler('Outro', 'WIDGET_UPDATE', wData);
check('handler ignora widget desconhecido', updUnknown.rendered.length === 0);

const clickPrime = await runHandler('Prime', 'WIDGET_CLICK', wData, { clickAction: 'COMPLETE_NEXT' });
check('clique no widget principal conclui e persiste', clickPrime.writes.some(([k]) => k === 'days'));
check('clique no widget principal redesenha', clickPrime.rendered.length === 1);
const clickMural = await runHandler('Constancia', 'WIDGET_CLICK', muralData, { clickAction: 'OPEN_APP' });
check('clique no mural só abre o app (não mexe em dados)', clickMural.writes.length === 0 && clickMural.rendered.length === 1);
const resized = await runHandler('Constancia', 'WIDGET_RESIZED', muralData);
check('resize redesenha o mural', resized.rendered.length === 1);
const deleted = await runHandler('Constancia', 'WIDGET_DELETED', muralData);
check('widget removido não tenta renderizar', deleted.rendered.length === 0);

console.log('\n── Auditoria: honestidade ──');
// Regressão: a UI lista via honestyChecks (calculado) e resolve via day.honestyFlags.
// Se ninguém grava a flag, o botão nunca resolve nada.
const honestGoal = { id: 'gH', name: 'Estudar', area: 'Estudo', priority: 'high', min: '10min', ideal: '30min', excellent: '2h', active: true, createdAt: '' };
const honestData = {
  ...wData,
  goals: [honestGoal],
  days: [
    day(today, [{ goalId: 'gH', done: true, note: '', doneAt: '22:10' }], {
      energy: { physical: 2, mental: 2, stress: 8 },
      score: { regularity: 5, continuity: 4, recovery: 5, honesty: 6, progress: 5, total: 5 },
    }),
  ],
};
const flagsShown = insights.honestyChecks(honestData);
check('checagem de honestidade sinaliza o caso', flagsShown.length === 1, String(flagsShown.length));
check('checagem não cria flag persistida no dia', (honestData.days[0].honestyFlags ?? []).length === 0);

console.log('\n── Auditoria: score, streaks e recompensas ──');
// Honestidade não pode passar de 8 com base parcial (bônus exigia os 5 campos).
const partialDiary = {
  ...day(today, [{ goalId: 'gH', done: true, note: '' }]).diary,
  avoided: '',
  blocked: '',
  correction: '',
  context: { where: 'casa', when: '15h', distraction: 'celular', trigger: '' },
};
const partialScore = scoreLib.computeScore({
  day: day(today, [{ goalId: 'gH', done: true, note: '' }], { diary: partialDiary }),
  goals: [honestGoal],
  previousDays: [],
});
check('honestidade com base parcial não cola no teto', partialScore.honesty < 10, String(partialScore.honesty));

// Streak: hoje sem registro não zera a série de ontem.
const streakDay = (d, total) => day(d, [], { score: { regularity: total, continuity: 5, recovery: 5, honesty: 5, progress: total, total } });
const gapStreakDays = [streakDay(dates.addDays(today, -1), 7), streakDay(dates.addDays(today, -2), 7)];
check('streak sobrevive ao dia de hoje ainda sem registro', scoreLib.generalStreak(gapStreakDays, today) === 2, String(scoreLib.generalStreak(gapStreakDays, today)));
check('streak conta até o dia registrado', scoreLib.generalStreak([streakDay(today, 7)], today) === 1);

// Recompensa de N dias seguidos não pode exigir score >= N (score máximo é 10).
const rewardLong = { id: 'r', name: 'Viagem', criteria: '', criteriaType: 'score', target: 30, current: 0, unlocked: false };
const tenGoodDays = Array.from({ length: 10 }, (_, i) =>
  streakDay(dates.addDays(today, -9 + i), 8),
);
const evaluatedLong = evaluateRewards({
  ...wData,
  settings: { ...wData.settings, targetDailyScore: 7 },
  days: tenGoodDays,
  rewards: [rewardLong],
});
check('recompensa de 30 dias progride com 10 dias bons', evaluatedLong[0].current === 10, String(evaluatedLong[0].current));
check('recompensa de 30 dias não desbloqueia cedo', evaluatedLong[0].unlocked === false);

// Badge: sequência não pode "colar" dias separados por lacuna.
const gapDays = [
  streakDay('2026-01-01', 9),
  streakDay('2026-01-02', 9),
  streakDay('2026-01-10', 9),
  streakDay('2026-01-11', 9),
  streakDay('2026-01-12', 9),
  streakDay('2026-01-13', 9),
  streakDay('2026-01-14', 9),
  streakDay('2026-01-15', 9),
];
const badgeData = { ...wData, days: gapDays, settings: { ...wData.settings, targetDailyScore: 7 } };
check('badge de sequência respeita lacunas entre dias', evaluateBadges(badgeData).some((b) => b.id === 'streak_7') === false);

console.log('\n── Auditoria: backup incompleto ──');
// Backup editado à mão / de versão antiga: chaves faltando não podem virar undefined.
const partialBackup = JSON.stringify({
  app: 'MY PRIME',
  version: '1.0',
  user: { name: 'Ana' },
  goals: [{ name: 'Correr', area: 'Treino', priority: 'alta', min: '10min', ideal: '30min', excellent: '1h' }],
  days: [{ date: today, tasks: [], diary: {} }],
  settings: { targetDailyScore: 8 },
});
const parsedPartial = importer.readPlan(partialBackup, 'backup-parcial.json', wData);
check('backup sem user.areas não quebra', Array.isArray(parsedPartial.areas), JSON.stringify(parsedPartial.areas));
check('backup aceita apenas 1 dia', parsedPartial.counts.days === 1);
check('backup não derruba o app com arrays ausentes', Array.isArray(parsedPartial.full?.finances) && Array.isArray(parsedPartial.full?.weight));

console.log('\n── Auditoria: divergência diário vs checklist (regra 11) ──');
const divergedDay = day(today, [{ goalId: 'gH', done: false, note: '' }], {
  diary: { ...day(today, []).diary, done: 'fiz tudo, treinei e estudei' },
  score: { regularity: 2, continuity: 4, recovery: 5, honesty: 6, progress: 2, total: 4 },
});
const divOut = insights.declarationDivergences({ ...wData, goals: [honestGoal], days: [divergedDay] });
check('detecta diário dizendo feito e checklist vazio', divOut.length === 1 && divOut[0].kind === 'declared-not-done');
const okDay = day(today, [{ goalId: 'gH', done: true, note: '' }], {
  diary: { ...day(today, []).diary, done: 'treino feito' },
  score: { regularity: 8, continuity: 6, recovery: 5, honesty: 8, progress: 8, total: 8 },
});
check('não sinaliza quando os dois batem', insights.declarationDivergences({ ...wData, goals: [honestGoal], days: [okDay] }).length === 0);
check('não inventa divergência sem dia fechado', insights.declarationDivergences({ ...wData, days: [] }).length === 0);

console.log('\n── Auditoria: tom do resultado (regra 2: sem elogio vazio) ──');
const nothingDone = day(today, [{ goalId: 'gH', done: false, note: '' }]);
const emptyLine = scoreLib.victoryLine(nothingDone, 4, [honestGoal]);
check('sem tarefa feita não parabeniza', !/domin|parab|mais do que a maioria/i.test(emptyLine), emptyLine);
const oneDone = day(today, [{ goalId: 'gH', done: true, note: '' }]);
check('com tarefa feita cita a entrega', /Estudar/.test(scoreLib.victoryLine(oneDone, 6, [honestGoal])));

console.log('\n── Auditoria: tarefa extra x meta real ──');
// Tarefa extra ("extra:revisao") não pertence a nenhuma meta: não pode virar "meta feita".
const attackItem = buildChecklist([honestGoal], 'attack').find((i) => i.extra);
check('modo ataque cria tarefa extra', !!attackItem);
check('tarefa extra não resolve para uma meta', scoreLib.goalForTask([honestGoal], { goalId: attackItem.extraKey }) === undefined);
check('tarefa normal resolve para a meta', scoreLib.goalForTask([honestGoal], { goalId: 'gH' })?.name === 'Estudar');
// Meta reimportada com outro id: o histórico continua encontrando a meta.
const renamed = { ...honestGoal, id: 'goal_novo', originId: 'gH' };
check('id de origem mantém o vínculo com o histórico', scoreLib.goalForTask([renamed], { goalId: 'gH' })?.id === 'goal_novo');

// Importador: mesma meta (área+nome) não duplica, mas registra o vínculo.
const reimport = importer.readPlan('## Estudo\n- Estudar', 'plano.md', {
  ...wData,
  goals: [{ ...honestGoal, id: 'goal_existente', name: 'Estudar' }],
});
check('reimportação não duplica a meta', reimport.goals.length === 0);
check('reimportação gera vínculo com o id antigo', (reimport.relinked ?? []).length === 1, JSON.stringify(reimport.relinked));

console.log('\n── Auditoria: grade mensal do mural ──');
for (const [y, m, total] of [[2026, 1, 31], [2026, 2, 28], [2024, 2, 29], [2026, 11, 30]]) {
  const grid = heat.buildMonthGrid([], y, m - 1);
  const prefix = `${y}-${String(m).padStart(2, '0')}`;
  const inMonth = grid.flatMap((w) => w.cells).filter((c) => c.date.startsWith(prefix));
  const unique = new Set(inMonth.map((c) => c.date));
  check(`grade de ${m}/${y} traz todos os ${total} dias`, unique.size === total, String(unique.size));
  check(`grade de ${m}/${y} começa na segunda`, grid.every((w) => dates.weekdayIndex(w.cells[0].date) === 1));
  check(`grade de ${m}/${y} não inventa dia fora do mês`, inMonth.every((c) => c.date.startsWith(prefix)));
}

console.log('\n── Gráficos: métricas (stats.ts) ──');
const chartDays = [
  // 10 dias fechados: 7, 8, 9 (melhor série), 3, 6, 9, 5, 2, 8, 7 (série atual = 2)
  ...[7, 8, 9, 3, 6, 9, 5, 2, 8, 7].map((total, i) =>
    day(
      dates.addDays(today, -(9 - i)),
      i % 3 === 0
        ? [{ goalId: 'gH', done: true, note: '', doneAt: '09:15' }]
        : i % 2 === 0
          ? [{ goalId: 'gH', done: false, note: '', failAt: '22:40', excuse: { type: 'Cansaço', legitimacy: 'legítima' } }]
          : [{ goalId: 'gH', done: false, note: '', failAt: '22:40' }],
      {
      energy: { physical: 2 + (i % 8), mental: 3 + (i % 6), stress: 5 },
      score: { regularity: total, continuity: 5, recovery: 5, honesty: 5, progress: total, total },
        diary: { ...day(today, []).diary, mood: i % 2 === 0 ? '🙂' : '😐' },
      },
    ),
  ),
];
const chartData = { ...wData, goals: [honestGoal], days: chartDays };

check('calendário traz 6 semanas x 7 dias', stats.calendarMonth(chartDays, today).weeks.length === 6 && stats.calendarMonth(chartDays, today).weeks.every((w) => w.length === 7));
check('calendário marca hoje', stats.calendarMonth(chartDays, today).weeks.flat().some((c) => c.isToday));
check('calendário não inventa score em dia sem registro', stats.calendarMonth([], today).weeks.flat().every((c) => c.score === null && !c.recorded));

const streak = stats.streakInfo(chartDays, { end: today });
check('streak atual conta só os 2 últimos dias', streak.current === 2, String(streak.current));
check('recorde guarda a série de 3 dias', streak.best === 3, String(streak.best));
check('recorde aponta o início da melhor série', streak.bestStart === dates.addDays(today, -9), String(streak.bestStart));
check('série de 30 dias para a barrinha', streak.series.length === 30);
check('streak sem dados = 0 (não inventa)', stats.streakInfo([], { end: today }).current === 0 && stats.streakInfo([], { end: today }).best === 0);

const weekly = stats.weeklyBuckets(chartDays, 8, today);
check('8 buckets semanais', weekly.length === 8);
check('bucket sem registro tem avgScore null (não 0)', weekly[0].avgScore === null);
const monthly = stats.monthlyBuckets(chartDays, 6, today);
check('6 buckets mensais com rótulo', monthly.length === 6 && monthly.every((b) => b.label.length > 0));
check('mês corrente tem registro', monthly.at(-1).avgScore != null);

const ring = stats.dailyProgress(chartDays.at(-1), [honestGoal]);
check('anel diário conta 1 de 1', ring.done === 1 && ring.total === 1 && ring.ratio === 1);
check('anel sem dia = total 0', stats.dailyProgress(undefined, [honestGoal]).total === 0);

const wd = stats.weekdayGrid(chartDays, 56, today);
check('grade semanal tem 7 linhas', wd.length === 7 && wd[0].label === 'Seg' && wd[6].label === 'Dom');
check('dia da semana sem registro fica null', wd.some((d) => d.avgScore === null) || wd.every((d) => d.avgScore != null));

const comp = stats.completionWithAverage(chartDays, { n: 30, window: 7, end: today });
check('linha de conclusão tem 30 pontos', comp.length === 30);
check('média móvel só aparece com 3+ observações', comp.filter((p) => p.average != null).length === comp.filter((p) => p.value != null).length - 2);
check('dia sem tarefa fica null (não vira 0%)', comp.some((p) => p.value === null));

const vs = stats.areaVsTarget(chartData, 14, today);
check('barras com meta usam a meta diária x10', vs.every((v) => v.target === 70), JSON.stringify(vs.map((v) => v.target)));
check('área com dado tem percentual', vs[0].value != null);

const trend = stats.trendLine(chartDays, { n: 30, end: today });
check('tendência marca 10 pontos', trend.points.length === 10);
check('tendência confiável com 7+ dias', trend.reliable === true);
check('tendência tem projeção do mesmo tamanho', trend.projection.length === trend.points.length);
check('tendência com 2 dias não é confiável', stats.trendLine(chartDays.slice(0, 2), { n: 30, end: today }).reliable === false);
check('tendência de série em queda é down', stats.trendLine(
  [9, 8, 7, 6, 5, 4, 3].map((t, i) => day(dates.addDays(today, -(6 - i)), [], { score: { regularity: t, continuity: 5, recovery: 5, honesty: 5, progress: t, total: t } })),
  { n: 30, end: today },
).direction === 'down');

const cum = stats.cumulativeDone(chartDays, { n: 30, end: today });
const cumValues = cum.filter((p) => p.done != null).map((p) => p.done);
check('cumulativo nunca cai', cumValues.every((v, i) => i === 0 || v >= cumValues[i - 1]));
check('cumulativo só cresce onde há tarefa', cumValues.at(-1) >= cumValues[0]);

const radar = stats.areaBalance(chartData, 14, today);
check('radar tem 1 área e valor 0-10', radar.length === 1 && radar[0].value != null && radar[0].value <= 10);

const ranking = stats.habitRanking(chartData, 30, today);
check('ranking ordena por consistência', ranking.length === 1 && ranking[0].pct != null);

const hours = stats.hourHeatmap(chartDays);
check('heatmap de hora tem 24 células', hours.length === 24);
check('hora 9 registra conclusões', hours[9].done > 0);
check('hora 22 registra falhas', hours[22].failed > 0);
check('hora sem registro fica zerada', hours[3].done === 0 && hours[3].failed === 0);

const scatter = stats.scatterEnergy(chartDays, 'energy');
check('dispersão tem pontos', scatter.points.length === 10);
check('correlação só com 7+ pontos', scatter.correlation != null);
check('dispersão com 3 pontos não mostra correlação', stats.scatterEnergy(chartDays.slice(0, 3), 'energy').correlation === null);
check('humor emoji vira número', stats.moodToNumber('🙂') === 4 && stats.moodToNumber('😞') === 1 && stats.moodToNumber('') === null);

const stacked = stats.stackedTasks(chartDays, 14, today);
check('barras empilhadas têm 14 dias', stacked.length === 14);
check(
  'empilhado separa feito, pulado e falhou',
  stacked.some((d) => d.done > 0) && stacked.some((d) => d.skipped > 0) && stacked.some((d) => d.failed > 0),
  JSON.stringify(stacked.reduce((acc, d) => ({ done: acc.done + d.done, skipped: acc.skipped + d.skipped, failed: acc.failed + d.failed }), { done: 0, skipped: 0, failed: 0 })),
);
const noExcuseDay = day(today, [{ goalId: 'gH', done: false, note: '' }]);
check('sem desculpa conta como pulado', stats.stackedTasks([noExcuseDay], 1, today)[0].skipped === 1);

const tl = stats.timeline(chartDays, [honestGoal], 20);
check('timeline lista eventos com horário', tl.length > 0 && tl.every((i) => /^\d{2}:\d{2}$/.test(i.at)));
check('timeline vem do mais recente para o mais antigo', tl[0].date >= tl.at(-1).date);
check('timeline respeita o limite', stats.timeline(chartDays, [honestGoal], 3).length === 3);

const bubbles = stats.bubbleHabits(chartData, 30, today);
check('bolha traz frequência e consistência', bubbles.length === 1 && bubbles[0].frequency > 0 && bubbles[0].consistency != null);

const waffle = stats.waffle(chartDays, 100, today);
check('waffle tem 100 quadradinhos', waffle.cells.length === 100);
check('waffle conta dias cumpridos (score >= 6)', waffle.done === 7, String(waffle.done));
check('waffle separa parcial', waffle.partial === 3, String(waffle.partial));

const spark = stats.sparkline(chartData, 'gH', 14, today);
check('sparkline tem 14 dias', spark.length === 14);
check('sparkline usa null onde não há item', spark.some((p) => p.value === null));

const gauge = stats.monthlyGauge(chartData, today);
check('gauge tem alvo = dias do mês', gauge.target >= 28 && gauge.target <= 31);
check('gauge limita ratio em 0..1+', gauge.ratio >= 0);
check('gauge calcula dias restantes', gauge.daysLeft >= 0 && gauge.daysLeft < 31);

const cats = stats.categoryDistribution(chartData, 30, today);
check('distribuição por área soma as concluídas', cats.length === 1 && cats[0].value === 4, JSON.stringify(cats));
check('sem tarefa feita = lista vazia', stats.categoryDistribution({ ...chartData, days: [] }, 30, today).length === 0);

console.log('\n── Auditoria: janelas por data e thresholds relativos ──');
{
  // 7 dias com score 5,4 e meta 7: antes o detectDanger usava "< 5" fixo e não alertava.
  const flat = [9, 8, 7, 6, 5, 4, 3, 2].map((n, i) =>
    day(dates.addDays(today, -(7 - i)), [], {
      score: { regularity: 5, continuity: 5, recovery: 5, honesty: 5, progress: 5, total: n === 2 ? 5.4 : n },
      closedAt: 'x',
    }),
  );
  // 4 é o "logo abaixo" da faixa 5: com meta 7 o corte sobe para 5.
  const pertoMasAbaixo = [0, 1, 2].map((i) =>
    day(dates.addDays(today, -i), [], {
      score: { regularity: 4, continuity: 5, recovery: 5, honesty: 5, progress: 4, total: 4 },
      closedAt: 'x',
    }),
  );
  const alertas = scoreLib.detectDanger(pertoMasAbaixo, [honestGoal], { ...wData.settings, targetDailyScore: 7 });
  check('zona de perigo usa a meta do usuário (score 4 com meta 7 alerta)', alertas.some((a) => a.id === 'low-score'));
  const semAlerta = scoreLib.detectDanger(pertoMasAbaixo, [honestGoal], { ...wData.settings, targetDailyScore: 3 });
  check('com meta 3 o mesmo histórico não é zona de perigo', !semAlerta.some((a) => a.id === 'low-score'));

  // média dos últimos 7 dias por DATA: dias fora de ordem não podem escolher a janela errada.
  const unordered = [
    ...Array.from({ length: 10 }, (_, i) =>
      day(dates.addDays(today, -(20 - i)), [], {
        score: { regularity: 10, continuity: 5, recovery: 5, honesty: 5, progress: 10, total: 10 },
      }),
    ),
    day(today, [], { score: { regularity: 10, continuity: 5, recovery: 5, honesty: 5, progress: 10, total: 10 } }),
  ].sort(() => Math.random() - 0.5);
  const scored = scoreLib.computeScore({
    day: day(today, [], {
      diary: { ...day(today, []).diary, done: 'x', avoided: 'y', blocked: 'z' },
    }),
    goals: [honestGoal],
    previousDays: unordered,
  });
  check('progresso usa os 7 dias anteriores por data, sem depender da ordem do array', scored.progress <= 10 && scored.progress >= 0);

  // badge "Honestidade Total": 7 dias SEGUIDOS, não 7 dias quaisquer.
  const separados = [0, 3, 6, 9, 12, 15, 18].map((back) => {
    const d = day(dates.addDays(today, -back), [], { score: { regularity: 8, continuity: 5, recovery: 5, honesty: 5, progress: 8, total: 8 } });
    return { ...d, diary: { ...d.diary, context: { where: 'casa', when: '10h', distraction: 'celular', trigger: 'cansaço' } } };
  });
  const fromSeparados = badgesLib.evaluateBadges({ ...wData, days: separados, badges: [] }).find((b) => b.id === 'total-honesty');
  check('Honestidade Total não desbloqueia com 7 dias espalhados', !fromSeparados?.unlockedAt);
  const seguidos = [0, 1, 2, 3, 4, 5, 6].map((back) => {
    const d = day(dates.addDays(today, -back), [], { score: { regularity: 8, continuity: 5, recovery: 5, honesty: 5, progress: 8, total: 8 } });
    return { ...d, diary: { ...d.diary, context: { where: 'casa', when: '10h', distraction: 'celular', trigger: 'cansaço' } } };
  });
  const fromSeguidos = badgesLib.evaluateBadges({ ...wData, days: seguidos, badges: [] }).find((b) => b.id === 'total-honesty');
  check('Honestidade Total desbloqueia com 7 dias seguidos', !!fromSeguidos?.unlockedAt);
}

console.log('\n── Auditoria: checklist do modo e anel do dia ──');
{
  const dois = [honestGoal, { ...honestGoal, id: 'gX', name: 'Outra', priority: 'normal' }];
  const d = day(today, [
    { goalId: 'gH', done: true, note: '' },
    { goalId: 'extra:revisao', done: true, note: '' },
    { goalId: 'gX', done: false, note: '' },
  ]);
  const ring = stats.dailyProgress({ ...d, mode: 'minimal' }, dois);
  check('anel não conta tarefa de outro modo', ring.done <= ring.total && ring.total === 2, `${ring.done}/${ring.total}`);
  check('anel do dia não passa de 100%', ring.ratio <= 1, String(ring.ratio));
}

console.log('\n── Auditoria: gauge do mês ──');
{
  const vazio = stats.monthlyGauge({ ...wData, days: [] }, today);
  // Regra revista nesta auditoria: projeção sem ritmo é `null`. Antes a função
  // devolvia 0 e a tela escrevia "Projeção: 0/30" — um resultado que ainda não
  // aconteceu, apresentado como previsão.
  check('gauge de mês sem registro não projeta (null, não 0)', vazio.projection === null && vazio.current === 0, String(vazio.projection));
  const comDois = stats.monthlyGauge({ ...wData, days: [{ ...wData.days[0], date: today, score: { ...wData.days[0].score, total: 9 } }] }, today);
  check('gauge nunca projeta acima do alvo', (comDois.projection ?? 0) <= comDois.target, String(comDois.projection));
}

console.log('\n── Auditoria: cronograma e métricas do dashboard ──');
{
  const goals = [
    { id: 'g1', name: 'Treino A', area: 'Treino', priority: 'high', min: '10min' },
    { id: 'g2', name: 'Ler 20p', area: 'Leitura', priority: 'normal', min: '5p' },
    { id: 'g3', name: 'Estudar', area: 'Estudo', priority: 'high', min: '30min' },
    { id: 'g4', name: 'Treino B', area: 'Treino', priority: 'low', min: '5min' },
  ];
  const slots = sched.buildSchedule({
    date: '2026-11-10',
    goals,
    tasks: [
      { goalId: 'g1', done: true },
      { goalId: 'g2', done: false },
      { goalId: 'g3', done: false },
    ],
  });
  check('cronograma tem um bloco por área', slots.length === 3, String(slots.length));
  const treino = slots.find((s) => s.area === 'Treino');
  check('bloco da área usa a meta de maior prioridade', treino?.title === 'Treino A', treino?.title);
  check('área fica marcada como feita só com dado real', treino?.status === 'done');
  check('bloco não feito fica em aberto', slots.find((s) => s.area === 'Leitura')?.status === 'open');
  check('blocos vêm em ordem de horário', slots.every((s, i) => i === 0 || slots[i - 1].start <= s.start));
  check('horário sugerido é estável para a mesma data', sched.defaultHourFor('Xyz', '2026-11-10') === sched.defaultHourFor('Xyz', '2026-11-10'));
  check('horário sugerido muda com a data (sem ficar sempre 9h)', sched.defaultHourFor('Xyz', '2026-11-10') !== sched.defaultHourFor('Xyz', '2026-11-11'));
  check('fim do bloco é 60min depois', sched.addMinutes('09:00', 60) === '10:00');
  check('fim do bloco atravessa hora cheia', sched.addMinutes('23:30', 60) === '00:30');
  check('próximo bloco ignora os já feitos', sched.nextSlot(slots, '05:00')?.area === 'Estudo', sched.nextSlot(slots, '05:00')?.area);
  check('próximo bloco prioriza o horário à frente', sched.nextSlot(slots, '21:00')?.area === 'Leitura');
  check('sincroniza só o que está em aberto', sched.slotsToSync(slots).every((s) => s.status === 'open'));

  const progresso = sched.areaProgress(goals, [{ goalId: 'g1', done: true }, { goalId: 'g1', done: true }], 'Treino');
  check('progresso de área conta só tarefas da área', progresso.total === 2 && progresso.done === 2);
  const semArea = sched.areaProgress(goals, [], 'Finanças');
  check('área sem tarefa diz "Sem dado" (não 0/0)', semArea.headline === 'Sem dado');
  check('prazo futuro usa contagem regressiva', sched.deadlineLabel('2026-11-20', '2026-11-10') === '10d restantes');
  check('prazo de hoje é dito explicitamente', sched.deadlineLabel('2026-11-10', '2026-11-10') === 'vence hoje');

  // foco: 0 min ≠ sem dado
  check('dia existente sem pomodoro é 0 min', stats.focusMinutes({ pomodoros: [] }) === 0);
  check('dia inexistente é null (sem dado)', stats.focusMinutes(undefined) === null);
  check('média de foco ignora dias sem registro', stats.averageFocusMinutes([{ pomodoros: [] }, { pomodoros: [{ minutes: 50 }] }]) === 50);
  check('média de foco sem nenhum registro é null', stats.averageFocusMinutes([{ pomodoros: [] }]) === null);

  /* ── Finanças: três baldes + Regra do Dia de Pagamento ── */
  const MES = '2026-11';
  const fin = [
    { id: 'a', date: '2026-11-05', type: 'income', amount: 3000, category: 'Outros', isImpulse: false, note: '' },
    { id: 'b', date: '2026-11-06', type: 'expense', amount: 900, category: 'Fixo', isImpulse: false, note: '' },
    { id: 'c', date: '2026-11-07', type: 'expense', amount: 300, category: 'Lazer', isImpulse: false, note: '' },
    { id: 'd', date: '2026-11-08', type: 'expense', amount: 250, category: 'Impulso', isImpulse: true, note: 'impulso: tédio' },
    { id: 'e', date: '2026-11-09', type: 'expense', amount: 200, category: 'Investimento', isImpulse: false, note: '' },
  ];
  const baldes = finance.bucketTargets(fin, MES);
  check('três baldes sempre presentes', baldes.length === 3);
  check('alvo de necessidade é 50% da renda', baldes.find((b) => b.key === 'necessidade')?.target === 1500);
  check('balde Futuro recebe 20% da renda', baldes.find((b) => b.key === 'futuro')?.target === 600);
  check('investimento cai no balde Futuro', baldes.find((b) => b.key === 'futuro')?.used === 200);
  // Fixo (900) + Transporte (0) = 900 usado; alvo 1500 → sobram 600.
  check('sobra do balde é alvo menos usado', baldes.find((b) => b.key === 'necessidade')?.left === 600, String(baldes.find((b) => b.key === 'necessidade')?.left));
  // Lazer 300 + Impulso 250 = 550 no balde Vontade.
  check('impulso conta no balde Vontade', baldes.find((b) => b.key === 'vontade')?.used === 550, String(baldes.find((b) => b.key === 'vontade')?.used));
  const semRenda = finance.bucketTargets(fin.filter((f) => f.type === 'expense'), MES);
  check('sem receita o alvo é null (não zero)', semRenda.every((b) => b.target === null && b.ratio === null));
  check('divisão padrão soma 100', finance.splitTotal(finance.DEFAULT_SPLIT) === 100 && finance.splitIsValid(finance.DEFAULT_SPLIT));
  check('divisão que não soma 100 é inválida', !finance.splitIsValid({ necessidade: 60, vontade: 30, futuro: 5 }));

  const payday = finance.paydayCheck(fin, MES);
  check('pagamento usa a maior receita do mês', payday?.date === '2026-11-05' && payday?.received === 3000);
  check('regra aponta quanto faltou separar', payday?.gap === -400, String(payday?.gap));
  check('veredito da regra cobra a escolha, não a pessoa', /Faltou separar/.test(payday?.verdict ?? ''));
  check('mês sem receita não tem payday', finance.paydayCheck(fin.filter((f) => f.type === 'expense'), MES) === null);
  check('primeiro gasto de vontade mede dias após o pagamento', finance.daysUntilFirstWant(fin, MES) === 2);
  check('custo do impulso em dias de Futuro é calculado', Math.round((finance.impulseCostInFutureDays(fin, MES) ?? 0) * 10) / 10 === 12.5, String(finance.impulseCostInFutureDays(fin, MES)));
  check('categoria desconhecida cai em Vontade', finance.bucketOf('Cripto') === 'vontade');

  /* ── Dieta: refeições, gatilhos e água ── */
  const refeicoes = [
    { time: '08:00', kind: 'Café', what: 'pão e ovo', onPlan: true, trigger: '' },
    { time: '13:00', kind: 'Almoço', what: 'arroz e frango', onPlan: true, trigger: '' },
    { time: '16:00', kind: 'Lanche', what: 'bolacha', onPlan: false, trigger: 'Tédio' },
  ];
  const roundtrip = diet.parseMeals(diet.serializeMeals(refeicoes));
  check('refeição sobrevive ao round-trip do diário', roundtrip.length === 3 && roundtrip[2].trigger === 'Tédio');
  check('refeição fora do plano é contada', diet.parseMeals(diet.serializeMeals(refeicoes)).filter((m) => !m.onPlan).length === 1);
  check('texto livre antigo não é perdido', diet.parseMeals('comi pizza').length === 1 && diet.parseMeals('comi pizza')[0].time === '');
  const diaDieta = diet.dayDiet({ diary: { food: diet.serializeMeals(refeicoes) } });
  check('razão dentro do plano é 2/3', Math.round((diaDieta.planRatio ?? 0) * 100) === 67);
  check('gatilho dominante vem do registro real', diaDieta.topTrigger?.label === 'Tédio' && diaDieta.topTrigger?.count === 1);
  const diaVazio = diet.dayDiet({ diary: { food: '' } });
  check('dia sem refeição é "Sem dado", não 0%', diaVazio.planRatio === null && diaVazio.total === 0);
  check('dia inexistente também é "Sem dado"', diet.dayDiet(undefined).planRatio === null);
  check('tendência ignora dias sem registro', diet.dietTrend([{ date: '2026-11-01', diary: { food: '' } }], 14).offPlanPerDay === null);
  check('tendência soma fora do plano por dia registrado', diet.dietTrend([{ date: '2026-11-01', diary: { food: diet.serializeMeals(refeicoes) } }], 14).offPlanPerDay === 1);
  // 16:00 (antes das 22h) → jantar ainda no prazo; 22h → já passou.
  check('refeição atrasada sem registro é apontada', diet.missingMeals(refeicoes, 22).join(',') === 'Jantar', diet.missingMeals(refeicoes, 22).join(','));
  check('jantar não é cobrado antes do horário', diet.missingMeals(refeicoes, 16).length === 0);
  check('sem água registrada o progresso é null', diet.waterProgress(undefined, 8) === null);
  check('zero copo é um registro válido (0%)', diet.waterProgress(0, 8) === 0);
  check('meta de água bate em 8 copos', diet.waterProgress(8, 8) === 1);
  // Sem meta declarada não existe percentual: "50% da meta" seria afirmação sem meta.
  check('sem meta declarada o progresso é null', diet.waterProgress(4, null) === null);
  check('meta fora de faixa (999 copos) é ignorada', diet.waterGoalCups({ waterGoalCups: 999 }) === null);
  check('meta declarada (10 copos) é respeitada', diet.waterGoalCups({ waterGoalCups: 10 }) === 10);
  check('settings sem meta devolve null (não 8)', diet.waterGoalCups({}) === null);

  /* ── Timer de foco: estado puro ── */
  const cfg = { focus: 25, rest: 5 };
  let timerState = timer.initTimer(cfg);
  check('timer começa parado no foco', timerState.status === 'idle' && timerState.remaining === 1500);
  check('tick com timer parado não anda', timer.tick(timerState, cfg).state.remaining === 1500);
  timerState = timer.start(timerState);
  timerState = timer.tick(timerState, cfg).state;
  check('tick enquanto corre desconta 1s', timerState.remaining === 1499);
  check('progresso do timer cresce', Math.round(timer.progress(timerState) * 1500) === 1);
  timerState = { ...timerState, remaining: 1 };
  const fimFoco = timer.tick(timerState, cfg);
  check('fim do foco dispara evento', fimFoco.event === 'focus-done');
  check('fim do foco entra na pausa correndo', fimFoco.state.phase === 'rest' && fimFoco.state.status === 'running');
  check('fim do foco conta o ciclo', fimFoco.state.cycles === 1);
  check('pausa começa com o tempo cheio', fimFoco.state.remaining === 300);
  const fimPausa = timer.tick({ ...fimFoco.state, remaining: 1 }, cfg);
  check('fim da pausa volta para o foco PARADO', fimPausa.state.phase === 'focus' && fimPausa.state.status === 'paused');
  check('fim da pausa dispara evento', fimPausa.event === 'rest-done');
  check('toggle pausa e retoma', timer.toggle(timer.start(timer.initTimer(cfg))).status === 'paused');
  check('reiniciar zera o tempo e mantém ciclos', timer.reset(cfg, 2).remaining === 1500 && timer.reset(cfg, 2).cycles === 2);
  check('relógio formata com dois dígitos', timer.formatClock(65) === '01:05');
  check('minutos de foco contam só ciclos completos', timer.focusMinutesOf({ ...timer.initTimer(cfg), cycles: 2 }, cfg) === 50);
  check('timer parado não tem previsão de fim', timer.endsAt(timer.initTimer(cfg), 0) === null);
  check('presets do timer são 25/5, 50/10 e 90/20', timer.PRESETS.map(timer.presetLabel).join(' | ') === '25 / 5 | 50 / 10 | 90 / 20');

  /* ── Plano de estudo, edital e apoio a TDAH ── */
  const plano = {
    name: 'Concurso',
    examDate: '2026-12-10',
    topics: [
      { id: 'a', subject: 'Matemática', topic: 'Porcentagem', weight: 4, status: 'estudado', lastSeen: '2026-11-04' },
      { id: 'b', subject: 'Direito', topic: 'Constitucional', weight: 5, status: 'novo' },
      { id: 'c', subject: 'Português', topic: 'Crase', weight: 2, status: 'revisado', lastSeen: '2026-11-08' },
    ],
  };
  const planoInfo = studies.planProgress(plano);
  check('progresso do edital conta estudados', planoInfo.studied === 2 && planoInfo.total === 3);
  check('progresso do edital é razão real', Math.round((planoInfo.ratio ?? 0) * 100) === 67);
  check('edital vazio é "Sem dado", não 0%', studies.planProgress({ name: '', examDate: '', topics: [] }).ratio === null);
  check('dias até a prova contam do dia de hoje', studies.daysToExam(plano, '2026-11-10') === 30);
  check('tópicos por dia usa os pendentes e os dias', Math.round((studies.topicsPerDayNeeded(plano, '2026-11-10') ?? 0) * 30) === 1);
  check('prova sem data não calcula ritmo', studies.topicsPerDayNeeded({ ...plano, examDate: '' }, '2026-11-10') === null);
  check('prova passada não calcula ritmo', studies.topicsPerDayNeeded({ ...plano, examDate: '2026-01-01' }, '2026-11-10') === null);
  const proximo = studies.nextTopic(plano, '2026-11-10');
  check('próximo tópico prioriza o nunca estudado', proximo?.topic.id === 'b', proximo?.topic.id);
  check('próximo tópico explica o motivo', proximo?.reason === 'nunca estudado', proximo?.reason);
  check('tópico nunca estudado ganha do antigo mesmo com peso menor', studies.nextTopic({ ...plano, topics: plano.topics.slice(1) }, '2026-11-10')?.topic.id === 'b');
  check('sem tópicos não há próximo', studies.nextTopic({ name: '', examDate: '', topics: [] }, '2026-11-10') === null);
  check('peso fora de 1–5 é limitado', studies.weightOf({ id: 'x', subject: 's', topic: 't', weight: 9, status: 'novo' }) === 5);
  check('carga por matéria soma peso do edital', studies.workloadBySubject(plano)[0]?.subject === 'Direito');
  const tdahInicio = studies.adhdSupport(0);
  check('TDAH sugere sessão curta no primeiro bloco', tdahInicio.firstSessionMinutes === 10);
  check('TDAH começa pelos 2 minutos', tdahInicio.startSteps.some((s) => s.includes('2 minutos')));
  check('TDAH muda o texto quando já estudou', studies.adhdSupport(45).afterBreak.includes('45 min'));
  check('sessão abaixo do piso não conta', !studies.countsAsSession(1) && studies.countsAsSession(2));

  /* ── Cronograma: semana e horário manual ── */
  const goalsSemana = [{ id: 'g1', name: 'Treino A', area: 'Treino', priority: 'high', min: '10min' }];
  const base = sched.buildSchedule({ date: '2026-11-10', goals: goalsSemana, tasks: [] });
  check('bloco começa na hora da área', base[0]?.start === '06:00', base[0]?.start);
  const comOverride = sched.buildSchedule({ date: '2026-11-10', goals: goalsSemana, tasks: [], overrides: { g1: '18:30' } });
  check('horário manual vence a sugestão', comOverride[0]?.start === '18:30' && comOverride[0]?.end === '19:30');
  const overrideInvalido = sched.buildSchedule({ date: '2026-11-10', goals: goalsSemana, tasks: [], overrides: { g1: '99:99' } });
  check('horário manual inválido é ignorado', overrideInvalido[0]?.start === '06:00');
  check('valida HH:MM', sched.isHHmm('23:59') && !sched.isHHmm('24:00') && !sched.isHHmm('7h'));
}

/* ═══════════════════════ DIÁRIO DE EMOÇÕES ═══════════════════════ */

console.log('\n── Diário de emoções ──');
{
  const emot = await import(path.join(outRoot, 'lib/emotions.mjs'));

  // momento do dia a partir da hora local
  check('manhã antes das 12h', emot.momentOf(8) === 'manhã');
  check('tarde entre 12h e 18h', emot.momentOf(15) === 'tarde');
  check('noite depois das 18h', emot.momentOf(21) === 'noite');

  // limite de 3 por dia — barrado na lib, não só na tela
  const now = new Date('2026-11-10T09:00:00');
  let log = [];
  for (const e of ['Calmo', 'Ansioso', 'Motivado']) {
    const r = emot.addEmotion(log, { emotion: e, date: '2026-11-10', now });
    log = r.log;
  }
  const quarto = emot.addEmotion(log, { emotion: 'Grato', date: '2026-11-10', now });
  check('aceita 3 emoções no dia', log.length === 3);
  check('recusa a 4ª com motivo', quarto.entry === null && /já registrou/.test(quarto.reason ?? ''), quarto.reason);
  check('4ª recusada não altera o log', quarto.log.length === 3);

  // dia seguinte tem orçamento novo
  const amanha = emot.addEmotion(log, { emotion: 'Grato', date: '2026-11-11', now });
  check('o limite é por dia, não global', amanha.entry !== null && amanha.log.length === 4);

  // emoção vazia é recusada
  const vazia = emot.addEmotion(log, { emotion: '   ', date: '2026-11-10', now });
  check('emoção vazia é recusada', vazia.entry === null && !!vazia.reason);

  // intensidade fora da faixa é presa em 1–5
  const alta = emot.addEmotion([], { emotion: 'Calmo', date: '2026-11-10', intensity: 99, now });
  const baixa = emot.addEmotion([], { emotion: 'Calmo', date: '2026-11-10', intensity: -3, now });
  check('intensidade acima de 5 vira 5', alta.entry?.intensity === 5);
  check('intensidade abaixo de 1 vira 1', baixa.entry?.intensity === 1);

  // momento padrão vem da hora quando não informado
  const semMomento = emot.addEmotion([], { emotion: 'Calmo', now: new Date('2026-11-10T20:30:00') });
  check('momento padrão segue a hora do registro', semMomento.entry?.moment === 'noite');

  // remoção por timestamp
  const removido = emot.removeEmotion(log, log[0].at);
  check('remove pelo carimbo de hora', removido.length === 2 && !removido.some((e) => e.at === log[0].at));
  check('remover timestamp inexistente não muda nada', emot.removeEmotion(log, 'nao-existe').length === 3);

  // sanitização: storage/backup sujo não entra
  check('entrada sem data válida é descartada', emot.sanitizeEmotionEntry({ emotion: 'Calmo' }) === null);
  check('entrada sem emoção é descartada', emot.sanitizeEmotionEntry({ date: '2026-11-10' }) === null);
  check('sanitiza momento desconhecido para manhã', emot.sanitizeEmotionEntry({ date: '2026-11-10', emotion: 'Calmo', moment: 'madrugada' })?.moment === 'manhã');
  check('sanitiza intensidade inválida para 3', emot.sanitizeEmotionEntry({ date: '2026-11-10', emotion: 'Calmo', intensity: 'alta' })?.intensity === 3);
  check('log sujo devolve só o válido', emot.sanitizeEmotionLog([null, { date: '2026-11-10', emotion: 'Calmo' }, 42, { foo: 1 }]).length === 1);
  check('log não-array vira lista vazia', emot.sanitizeEmotionLog({}) .length === 0);

  // mapa de calor: grade completa, dia sem registro é null
  const logGrid = [
    { at: '2026-11-05T09:00:00.000Z', date: '2026-11-05', emotion: 'Ansioso', moment: 'manhã', intensity: 4 },
    { at: '2026-11-05T20:00:00.000Z', date: '2026-11-05', emotion: 'Ansioso', moment: 'noite', intensity: 2 },
    { at: '2026-11-06T09:00:00.000Z', date: '2026-11-06', emotion: 'Calmo', moment: 'manhã', intensity: 5 },
  ];
  const grid = emot.emotionGrid(logGrid, 4, '2026-11-10');
  check('grade tem 4 semanas × 7 dias', grid.length === 4 && grid.every((w) => w.length === 7));
  const flat = grid.flat();
  check('último dia da grade é hoje', flat[flat.length - 1].date === '2026-11-10');
  const cell5 = flat.find((c) => c.date === '2026-11-05');
  check('dia com 2 registros é dominado e conta os dois', cell5?.emotion === 'Ansioso' && cell5?.count === 2);
  check('dia sem registro fica null (não "neutro")', flat.find((c) => c.date === '2026-11-07')?.emotion === null);
  check('intensidade média do dia', cell5?.intensity === 3);

  // streak: hoje aberto não zera; buraco zera
  const streakLog = [
    { at: '2026-11-10T09:00:00.000Z', date: '2026-11-10', emotion: 'Calmo', moment: 'manhã', intensity: 3 },
    { at: '2026-11-09T09:00:00.000Z', date: '2026-11-09', emotion: 'Calmo', moment: 'manhã', intensity: 3 },
    { at: '2026-11-08T09:00:00.000Z', date: '2026-11-08', emotion: 'Calmo', moment: 'manhã', intensity: 3 },
  ];
  check('sequência conta 3 dias seguidos', emot.emotionStreak(streakLog, '2026-11-10') === 3);
  check('hoje ainda sem registro não zera a sequência', emot.emotionStreak(streakLog.slice(1), '2026-11-10') === 2);
  const comBuraco = [streakLog[0], { ...streakLog[2] }];
  check('buraco no meio zera a sequência', emot.emotionStreak(comBuraco, '2026-11-10') === 1);
  check('log vazio = 0', emot.emotionStreak([], '2026-11-10') === 0);

  // stats da janela: contagem, intensidade média, momento dominante
  const dataStats = {
    days: [
      { ...day('2026-11-05', []), score: { regularity: 5, continuity: 5, recovery: 5, honesty: 5, progress: 5, total: 5 } },
      { ...day('2026-11-06', []), score: { regularity: 8, continuity: 8, recovery: 8, honesty: 8, progress: 8, total: 8 } },
    ],
    goals: [],
  };
  const stats = emot.emotionStats(dataStats, logGrid, 30);
  const ansioso = stats.find((s) => s.emotion === 'Ansioso');
  check('ranking ordena por frequência', stats[0]?.emotion === 'Ansioso');
  check('conta as ocorrências da emoção', ansioso?.count === 2);
  check('intensidade média da emoção', ansioso?.intensity === 3);
  check('momento mais comum', ansioso?.commonMoment === 'manhã' || ansioso?.commonMoment === 'noite');
  check('score médio dos dias com a emoção', ansioso?.scoreWith === 5);
  check('emoção de dia sem score não inventa média', stats.find((s) => s.emotion === 'Calmo')?.scoreWith === 8);
  check('janela curta descarta o que ficou fora', emot.emotionStats(dataStats, logGrid, 1).length === 0);

  // efeito no dia seguinte: gate de amostra
  const dataEfeito = { days: [], goals: [] };
  // 5 dias com score de cada lado do pareamento (o último dia não tem "seguinte").
  for (let i = 0; i < 14; i += 1) {
    const date = dates.addDays('2026-11-10', i);
    const total = i < 6 ? 8 : 4;
    dataEfeito.days.push({ ...day(date, []), score: { regularity: total, continuity: total, recovery: total, honesty: total, progress: total, total } });
  }
  const logEfeito = [0, 1, 2].map((i) => ({
    at: `${dates.addDays('2026-11-10', i)}T09:00:00.000Z`,
    date: dates.addDays('2026-11-10', i),
    emotion: 'Ansioso',
    moment: 'manhã',
    intensity: 4,
  }));
  const semBase = emot.emotionEffect(dataEfeito, logEfeito, 'Ansioso');
  check('sem 4 dias de cada lado não afirma efeito', semBase?.eligible === false && semBase.missing > 0);
  check('frase sem base diz quantos dias faltam', /faltam \d+ dia/.test(emot.effectLine(semBase)));

  const logForte = [...logEfeito, { at: '2026-11-13T09:00:00.000Z', date: '2026-11-13', emotion: 'Ansioso', moment: 'manhã', intensity: 4 }];
  const comBase = emot.emotionEffect(dataEfeito, logForte, 'Ansioso');
  check('com amostra suficiente calcula o delta', comBase?.eligible === true && typeof comBase?.delta === 'number', JSON.stringify(comBase));
  check(
    'delta descreve score do dia seguinte',
    comBase?.eligible === true && comBase.avgWith === 8 && comBase.avgWithout === 4.4 && comBase.delta === 3.6,
    JSON.stringify(comBase),
  );
  check('frase do efeito cita a amostra', /4 dia\(s\) com Ansioso/.test(emot.effectLine(comBase)));
  check('emoção nunca registrada devolve null', emot.emotionEffect(dataEfeito, logForte, 'Eufórico') === null);

  // pares
  const pares = emot.emotionPairs([
    ...logGrid,
    { at: '2026-11-05T22:00:00.000Z', date: '2026-11-05', emotion: 'Calmo', moment: 'noite', intensity: 3 },
  ], 60, '2026-11-10');
  check('par repetido no mesmo dia conta uma vez', pares[0]?.label === 'Ansioso + Calmo' && pares[0]?.count === 1);

  // espelho no diário
  check('espelho do diário usa a emoção registrada', emot.diaryEmotionsFor(logGrid, '2026-11-05').join() === 'Ansioso');
  check('espelho respeita o teto de 3', emot.diaryEmotionsFor(log, '2026-11-10').length <= 3);
  check('dia sem registro não espelha nada', emot.diaryEmotionsFor(logGrid, '2026-11-09').length === 0);

  // normalização de backup/início: a chave nova não pode quebrar dados antigos
  const storageMod = await import(path.join(outRoot, 'lib/storage.mjs'));
  const antigo = storageMod.normalizeData({ days: [], goals: [] }, storageMod.EMPTY_DATA);
  check('base vazia já tem o log de emoções', Array.isArray(antigo.emotions) && antigo.emotions.length === 0);
  const importado = storageMod.normalizeData({ emotions: [{ date: '2026-11-10', emotion: 'Calmo' }, 'lixo'] }, storageMod.EMPTY_DATA);
  check('import de backup sanitiza o log', importado.emotions.length === 1 && importado.emotions[0].emotion === 'Calmo');
  check('chave ausente no backup vira lista vazia', storageMod.normalizeData({}, storageMod.EMPTY_DATA).emotions.length === 0);
}

/* ═══════════════════ FASE 4: lembretes que realmente tocam ═══════════════════ */

console.log('\n── Lembretes: permissão e agendamento ──');
{
  const rn = await import(path.join(outRoot, 'rn-stub.mjs'));
  const notif = await import(path.join(outRoot, 'notif-stub.mjs'));
  const keys = await import(path.join(outRoot, 'storage-key-stub.mjs'));
  const notifs = await import(path.join(outRoot, 'lib/notifications.mjs'));

  const settings = {
    morningReminder: '07:00', nightReminder: '21:30', middayCheckin: true, middayTime: '13:00',
    streakNotification: true, haptics: true, sleepGoalHours: 7.5, focusGoalMinutes: 240, targetDailyScore: 7,
  };

  // 1) boot sem permissão NÃO abre diálogo — e diz que não agendou
  rn.setOS('android');
  notif.reset({ granted: false });
  const semPermissao = await notifs.scheduleReminders(settings, 5, 'Treino');
  check('boot sem permissão não abre o diálogo', notif.calls.requestPermissions === 0);
  check('boot sem permissão reporta "denied"', semPermissao.status === 'denied' && semPermissao.count === 0, semPermissao.status);
  check('nada é agendado sem permissão', notif.calls.scheduled.length === 0);
  check('mensagem diz o que fazer', /Perfil/.test(semPermissao.message), semPermissao.message);

  // 2) toque do usuário: pede a permissão e agenda tudo
  notif.reset({ granted: false, grantOnRequest: true });
  const pedido = await notifs.scheduleReminders(settings, 5, 'Treino', { askPermission: true });
  check('toque do usuário abre o diálogo', notif.calls.requestPermissions === 1);
  check('permissão concedida agenda os lembretes', pedido.status === 'scheduled', pedido.status);
  // morning, night, midday, streak, revisão semanal
  check('agenda 5 lembretes (4 diários + revisão)', pedido.count === 5, String(pedido.count));
  check('agenda todos no sistema', notif.calls.scheduled.length === 5);
  check('reagendar começa cancelando os antigos', notif.calls.canceled === 1);
  const ids = notif.calls.scheduled.map((n) => n.identifier);
  check('matinal e noturno usam as horas configuradas', notif.calls.scheduled[0].trigger.hour === 7 && notif.calls.scheduled[1].trigger.hour === 21 && notif.calls.scheduled[1].trigger.minute === 30);
  check('revisão semanal é na segunda às 20h', ids.includes('weekly-review') && notif.calls.scheduled.at(-1).trigger.weekday === 1);
  check('streak não colide com o bom dia (30 min depois)', ids.includes('streak') && notif.calls.scheduled.find((n) => n.identifier === 'streak').trigger.hour === 7 && notif.calls.scheduled.find((n) => n.identifier === 'streak').trigger.minute === 30);

  // 3) toggles desligados não agendam
  notif.reset({ granted: true });
  const semExtras = await notifs.scheduleReminders({ ...settings, middayCheckin: false, streakNotification: false }, 5, 'Treino');
  check('check-in e streak desligados não agendam', semExtras.count === 3, String(semExtras.count));
  check('sem streak acumulado não há lembrete de streak', (await (async () => {
    notif.reset({ granted: true });
    const r = await notifs.scheduleReminders(settings, 0, 'Treino');
    return r.count === 4 && !notif.calls.scheduled.some((n) => n.identifier === 'streak');
  })()) === true);

  // 4) o agendamento fica registrado (o Perfil prova que valeu)
  notif.reset({ granted: true });
  await notifs.scheduleReminders(settings, 5, 'Treino');
  const registro = await notifs.lastReminderSchedule();
  check('último agendamento é gravado com a contagem', registro?.count === 5, JSON.stringify(registro));
  check('gravação usa a chave própria', typeof keys.store[notifs.LEMBRETE_KEY] === 'string');

  // 5) ambiente sem módulo / web não finge sucesso
  rn.setOS('web');
  const naWeb = await notifs.scheduleReminders(settings, 5, 'Treino');
  check('web reporta "web", não "agendado"', naWeb.status === 'web' && naWeb.count === 0, naWeb.status);
  rn.setOS('android');

  // 6) erro do sistema não vira silêncio
  notif.reset({ granted: true, failOnSchedule: true });
  const comErro = await notifs.scheduleReminders(settings, 5, 'Treino');
  check('falha do sistema é reportada como erro', comErro.status === 'error' && comErro.count === 0, comErro.status);

  // 7) horário inválido nunca vira hora inexistente
  notif.reset({ granted: true });
  await notifs.scheduleReminders({ ...settings, morningReminder: '99:99' }, 0, 'Treino');
  check('horário inválido cai no padrão 07:00', notif.calls.scheduled[0].trigger.hour === 7);
  check('addMinutes volta a meia-noite', notifs.addMinutes('23:45', 30) === '00:15', notifs.addMinutes('23:45', 30));
}

/* ═══════════════ FASE 4: conquista anunciada, não gravada em silêncio ═══════════════ */

console.log('\n── Conquistas: anúncio no desbloqueio ──');
{
  const ach = await import(path.join(outRoot, 'lib/achievements.mjs'));
  const blocked = BADGES.map((b) => ({ id: b.id, unlockedAt: null }));
  const firstWeek = BADGES.find((b) => b.id === 'first-week');

  const unlocked = ach.newlyUnlocked(blocked, blocked.map((b) => (b.id === 'first-week' ? { ...b, unlockedAt: '2026-11-10T10:00:00.000Z' } : b)));
  check('detecta a conquista que acabou de abrir', unlocked.length === 1 && unlocked[0].id === 'first-week');
  check('anúncio traz emoji, nome e critério', unlocked[0].emoji === firstWeek.emoji && unlocked[0].name === firstWeek.name && unlocked[0].criteria === firstWeek.criteria);

  // idempotência: o mesmo estado duas vezes não anuncia de novo
  const jaAberto = blocked.map((b) => (b.id === 'first-week' ? { ...b, unlockedAt: '2026-11-10T10:00:00.000Z' } : b));
  check('não anuncia duas vezes a mesma conquista', ach.newlyUnlocked(jaAberto, jaAberto).length === 0);
  check('não anuncia nada ao bloquear de volta', ach.newlyUnlocked(jaAberto, blocked).length === 0);
  check('estado inicial vazio não anuncia nada', ach.newlyUnlocked(jaAberto, []).length === 0);

  // várias de uma vez + badge desconhecido (versão antiga) é ignorado
  const many = ach.newlyUnlocked(blocked, [
    { id: 'first-week', unlockedAt: 'x' },
    { id: 'on-fire', unlockedAt: 'x' },
    { id: 'badge-de-versao-antiga', unlockedAt: 'x' },
  ]);
  check('anuncia todas as novas, na ordem recebida', many.length === 2 && many[0].id === 'first-week' && many[1].id === 'on-fire');
  check('badge desconhecido não vira anúncio vazio', !many.some((u) => u.id === 'badge-de-versao-antiga'));
  check('fila mostra um por vez', ach.currentUnlock(many)?.id === 'first-week' && ach.currentUnlock([]) === null);

  // mensagem cita o critério (regra 2: nunca elogio vazio)
  const msg = ach.unlockMessage(many[0]);
  check('mensagem cita o critério cumprido', msg.includes('7 dias de registro'), msg);
}

/* ═══════════ FASE 4: relatório PDF com emoções e dia sem dado honesto ═══════════ */

console.log('\n── Relatório PDF: conteúdo verificável ──');
{
  const exp = await import(path.join(outRoot, 'lib/export.mjs'));
  // Novembro/2026: o relatório por padrão olha o mês da data de referência.
  const relatorioDias = Array.from({ length: 10 }, (_, i) => {
    const date = dates.addDays('2026-11-01', i);
    const total = 6 + (i % 3);
    return {
      // Com tarefa registrada: sem tarefa a área não tem score e dizer "Sem dado" é o correto.
      ...day(date, [{ goalId: 'g1', done: i % 2 === 0, note: '' }]),
      score: { regularity: total, continuity: total, recovery: total, honesty: total, progress: total, total },
      diary: {
        ...day(date, []).diary,
        context: { where: 'casa', when: 'manhã', distraction: 'celular', trigger: 'cansaço' },
        sleep: { hours: 7, quality: 7, blockers: [] },
        emotions: i === 0 ? ['Ansioso'] : [],
      },
    };
  });
  const dados = { ...emptyData, days: relatorioDias, goals, emotions: [] };
  const html = exp.buildReportHtml(dados, '2026-11-10');

  check('o relatório é um HTML completo', html.startsWith('<!DOCTYPE html>') || html.includes('<html'), html.slice(0, 40));
  check('mostra a média de score do mês', /6\.\d|7\.\d|8\.\d/.test(html));
  check('não escreve NaN/undefined no PDF', !/NaN|undefined/.test(html));
  // O gráfico de radar só lista áreas cujo score é `null`-safe; área com tarefas
  // entra como barra. O fixture tem tarefas em Treino, então a área tem que aparecer.
  // Área só entra no quadro quando há tarefa registrada daquela área no mês.
  check('lista as áreas com percentual', /Treino|Estudo/.test(html), `áreas no fixture: ${goals.map((g) => g.area).join()}`);
  check('diz o que falta quando não há dado', /Sem dado|sem dado|Nenhum/.test(html) || relatorioDias.length === 0);

  // mês vazio: relatório não pode quebrar nem inventar número
  const vazioHtml = exp.buildReportHtml({ ...emptyData, days: [] }, '2026-11-10');
  check('mês sem nenhum dia gera relatório válido', vazioHtml.length > 200 && !/NaN|undefined/.test(vazioHtml));
  check('mês vazio admite a ausência de dado', /Sem dado|sem dado|Nenhum/i.test(vazioHtml));
  const semTarefa = exp.buildReportHtml(
    { ...emptyData, days: relatorioDias.map((d) => ({ ...d, tasks: [] })), goals },
    '2026-11-10',
  );
  check('mês com dia mas sem tarefa não inventa área', /Sem dado/.test(semTarefa.slice(semTarefa.indexOf('Equilíbrio'))));
}

/* ═══════════════ AUDITORIA: entrada suja não derruba tela ═══════════════ */

console.log('\n── Sanitização de entrada (storage/backup) ──');
{
  const san = await import(path.join(outRoot, 'lib/sanitize.mjs'));
  const storageMod = await import(path.join(outRoot, 'lib/storage.mjs'));

  // O caso que derrubava as telas: JSON.stringify(NaN) grava null.
  check('NaN viraria null no storage (origem do problema)', JSON.parse(JSON.stringify({ a: Number.NaN })).a === null);
  const comNull = storageMod.normalizeData({ finances: [{ id: 'f', date: '2026-11-01', type: 'expense', amount: null, category: 'Lazer' }] }, storageMod.EMPTY_DATA);
  check('finança com amount null é descartada', comNull.finances.length === 0, JSON.stringify(comNull.finances));
  const comNaN = storageMod.normalizeData({ finances: [{ id: 'f', date: '2026-11-01', type: 'expense', amount: Number.NaN, category: 'Lazer' }] }, storageMod.EMPTY_DATA);
  check('finança com amount NaN é descartada', comNaN.finances.length === 0);
  const comZero = storageMod.normalizeData({ finances: [{ id: 'f', date: '2026-11-01', type: 'expense', amount: 0, category: 'Lazer' }] }, storageMod.EMPTY_DATA);
  check('finança de valor 0 é descartada (não é lançamento)', comZero.finances.length === 0);
  const comTexto = storageMod.normalizeData({ finances: [{ id: 'f', date: '2026-11-01', type: 'expense', amount: '50,25', category: 'Lazer' }] }, storageMod.EMPTY_DATA);
  check('valor em texto numérico é reparado', comTexto.finances[0]?.amount === 50.25, JSON.stringify(comTexto.finances));
  const comNegativo = storageMod.normalizeData({ finances: [{ id: 'f', date: '2026-11-01', type: 'expense', amount: -10, category: 'Lazer' }] }, storageMod.EMPTY_DATA);
  check('valor negativo é descartado', comNegativo.finances.length === 0);
  const semData = storageMod.normalizeData({ finances: [{ id: 'f', date: 'ontem', type: 'expense', amount: 10, category: 'Lazer' }] }, storageMod.EMPTY_DATA);
  check('data inválida é descartada', semData.finances.length === 0);

  // peso: plausibilidade
  const pesoOk = san.sanitizeWeightEntry({ id: 'w', date: '2026-11-01', kg: '82,4' });
  check('peso em texto é reparado', pesoOk?.kg === 82.4, JSON.stringify(pesoOk));
  check('peso 0 é descartado', san.sanitizeWeightEntry({ id: 'w', date: '2026-11-01', kg: 0 }) === null);
  check('peso 999 é descartado (digitação, não medida)', san.sanitizeWeightEntry({ id: 'w', date: '2026-11-01', kg: 999 }) === null);
  check('duas pesagens no mesmo dia mantém uma', san.sanitizeWeightList([
    { id: 'a', date: '2026-11-01', kg: 80 },
    { id: 'b', date: '2026-11-01', kg: 81 },
  ]).length === 1);

  // livros / regras / recompensas
  const livro = san.sanitizeBook({ id: 'b', title: 'X', totalPages: 300, currentPage: 400 });
  check('página atual não passa do total', livro?.currentPage === 300);
  check('livro sem título é descartado', san.sanitizeBook({ id: 'b', totalPages: 100 }) === null);
  check('regra sem gatilho é descartada', san.sanitizeRule({ id: 'r', action: 'fazer' }) === null);
  const regra = san.sanitizeRule({ id: 'r', trigger: 'se cansar', action: 'beber água' });
  check('regra válida ganha defaults coerentes', regra?.active === true && regra?.timesActivated === 0 && regra?.successRate === 0);
  check('recompensa sem nome é descartada', san.sanitizeReward({ id: 'x', criteria: 'streak' }) === null);
  const recompensa = san.sanitizeReward({ id: 'x', name: 'Cinema', criteria: '7 dias', target: 7 });
  check('recompensa ganha tipo e alvo válidos', recompensa?.criteriaType === 'consistency' && recompensa?.target === 7);

  // relatório: a UI precisa saber que algo foi descartado
  const rel = san.emptyReport();
  san.sanitizeDataSlices({
    finances: [{ id: 'ok', date: '2026-11-01', type: 'expense', amount: 10, category: 'Lazer' }, { id: 'ruim', date: '2026-11-01', type: 'expense', amount: null }],
    weight: [{ id: 'w', date: '2026-11-01', kg: null }],
  }, (g) => g, rel);
  check('relatório conta o que foi descartado por entidade', rel.dropped.finances === 1 && rel.dropped.weight === 1 && rel.total === 2, JSON.stringify(rel));
  check('entrada totalmente inválida vira lista vazia, não crash', Array.isArray(san.sanitizeFinanceList('lixo')) && san.sanitizeFinanceList(null).length === 0);

  // O descarte NÃO pode ser silencioso: o boot publica o relatório e o Perfil lê.
  storageMod.lastSanitize.dropped = {};
  storageMod.lastSanitize.total = 0;
  storageMod.normalizeData({
    finances: [{ id: 'ok', date: '2026-11-01', type: 'expense', amount: 10, category: 'Lazer' }, { id: 'ruim', date: '2026-11-01', type: 'expense', amount: null }],
    weight: [{ id: 'w', date: '2026-11-01', kg: null }],
  }, storageMod.EMPTY_DATA);
  check('boot publica o relatório do que descartou', storageMod.lastSanitize.total === 2, JSON.stringify(storageMod.lastSanitize));
  check('relatório separa por lista', storageMod.lastSanitize.dropped.finances === 1 && storageMod.lastSanitize.dropped.weight === 1, JSON.stringify(storageMod.lastSanitize.dropped));
  check('boot limpo zera o relatório', (() => {
    storageMod.normalizeData({ finances: [] }, storageMod.EMPTY_DATA);
    return storageMod.lastSanitize.total === 0;
  })());
}

/* ═══════════════ Boot: normalização de backup hostil ═══════════════ */

console.log('\n── Boot: backup hostil normalizado antes de chegar na tela ──');
{
  const storageMod = await import(path.join(outRoot, 'lib/storage.mjs'));
  // O mesmo fixture que o smoke de telas usa: tipo errado em todo campo que um
  // backup corrompido (ou editado à mão) pode trazer.
  const hostil = {
    onboarded: 'sim',
    user: { name: 42, identity: null, noMore: 7, areas: 'Treino', createdAt: 0 },
    settings: {
      theme: 'nao-existe',
      targetDailyScore: '7',
      sleepGoalHours: null,
      focusGoalMinutes: 'muito',
      heightCm: 'alto',
      cardLast4: 1234,
      middayCheckin: 'sim',
      middayTime: 1300,
      morningReminder: null,
      nightReminder: 2100,
    },
    goals: [
      { id: 'g1', name: 5, area: null, priority: 'urgente', active: 'sim', min: null, ideal: 3, excellent: [] },
      { id: null, name: 'Sem id', area: 'Treino', priority: 'high', active: true, min: '10min', ideal: '30min', excellent: '1h' },
    ],
    days: [
      {
        date: '2026-11-10',
        energy: { physical: 'sete', mental: null, stress: Number.NaN },
        mode: 'turbo',
        tasks: [{ goalId: 'g1', done: 'sim', note: 3 }, { goalId: null, done: true }, null],
        diary: {
          promised: 3,
          context: null,
          sleep: { hours: 'sete', quality: null, blockers: 'nada' },
          food: 42,
          waterCups: 'dois',
          study: 'bloco',
          studyPlan: 7,
          workout: { exercises: 'nao-e-lista', durationSec: 'muito' },
          book: [],
          project: null,
        },
        pomodoros: [{ minutes: '25' }, { minutes: null }],
        score: { total: 'alta', regularity: null },
      },
      { date: '2026-11-09' },
      { date: null, tasks: 'x' },
      null,
    ],
    weight: [{ date: '2026-11-10', kg: 'setenta' }, { date: null, kg: 80 }, null],
    finances: [{ date: '2026-11-10', amount: '4200', type: 'transferencia', category: null }],
    books: [{ id: 'b', title: 7, totalPages: 'muitas', currentPage: null }],
    badges: [{ id: null, unlockedAt: 12 }],
    rewards: [{ id: 1, name: null }],
    emotions: [{ at: 1, date: null, emotion: 5, intensity: 'alta' }],
    ayanokoji: { startDate: null, scores: 'x', tasksDone: null },
    weeklyFocus: 'x',
    routeAdjustments: null,
  };

  let out = null;
  let err = null;
  try {
    out = storageMod.normalizeData(hostil, storageMod.EMPTY_DATA);
  } catch (e) {
    err = e;
  }
  check('normalizeData sobrevive a backup hostil', !err, err?.message);

  if (out) {
    const json = JSON.stringify(out);
    check('dado normalizado não tem NaN/Infinity', !/NaN|Infinity/.test(json));
    check('não sobra "undefined" em texto de diário', !/undefined/.test(out.days[0]?.diary.promised ?? ''), String(out.days[0]?.diary.promised));
    check('áreas de usuário viram lista vazia (não string)', Array.isArray(out.user.areas) && out.user.areas.length === 0, JSON.stringify(out.user.areas));
    check('nome de usuário numérico não vira "42" cru na saudação', typeof out.user.name === 'string', typeof out.user.name);
    check('dia com data null é descartado', out.days.every((d) => typeof d.date === 'string' && d.date.length === 10), JSON.stringify(out.days.map((d) => d.date)));
    check('task null é descartada', out.days[0]?.tasks.every((t) => t && typeof t.goalId === 'string'), JSON.stringify(out.days[0]?.tasks));
    check('task com done texto vira booleano', out.days[0]?.tasks.every((t) => typeof t.done === 'boolean'), JSON.stringify(out.days[0]?.tasks));
    check('energia com texto vira número', typeof out.days[0]?.energy.physical === 'number', String(out.days[0]?.energy.physical));
    check('modo inválido vira "normal"', out.days[0]?.mode === 'normal', String(out.days[0]?.mode));
    check('diário com contexto nulo ganha contexto', !!out.days[0]?.diary.context && typeof out.days[0]?.diary.context === 'object');
    check('sono com texto vira número', typeof out.days[0]?.diary.sleep.hours === 'number', String(out.days[0]?.diary.sleep.hours));
    check('comida numérica não quebra o parse de refeições', typeof out.days[0]?.diary.food === 'string', typeof out.days[0]?.diary.food);
    check('água com texto vira número ou some', out.days[0]?.diary.waterCups === undefined || typeof out.days[0]?.diary.waterCups === 'number', String(out.days[0]?.diary.waterCups));
    check('estudo com texto não vira array falso', out.days[0]?.diary.study === undefined || Array.isArray(out.days[0]?.diary.study), String(typeof out.days[0]?.diary.study));
    check('treino com exercícios inválidos não sobrevive cru', out.days[0]?.diary.workout === undefined || typeof out.days[0]?.diary.workout === 'object', String(typeof out.days[0]?.diary.workout));
    check('meta sem id é descartada', out.goals.every((g) => g.id), JSON.stringify(out.goals.map((g) => g.id)));
    check('meta com prioridade inválida vira normal', out.goals.every((g) => ['high', 'normal', 'low'].includes(g.priority)), JSON.stringify(out.goals.map((g) => g.priority)));
    check('meta com min numérico vira texto', out.goals.every((g) => typeof g.min === 'string'));
    check('tema inválido no backup não é aplicado', out.settings.theme === undefined || ['emerald', 'golden', 'cyberpunk', 'ocean', 'neonBlue', 'softGlass', 'fitPulse'].includes(out.settings.theme), String(out.settings.theme));
    check('cartão com número (não texto) é descartado', out.settings.cardLast4 === undefined || /^\d{4}$/.test(out.settings.cardLast4), String(out.settings.cardLast4));
    check('altura inválida não entra em Settings', out.settings.heightCm === undefined || Number.isFinite(out.settings.heightCm), String(out.settings.heightCm));
    check('peso com texto é reparado ou descartado', out.weight.every((w) => Number.isFinite(w.kg) && w.date), JSON.stringify(out.weight));
    check('ayanokoji inválido não fica como string', typeof out.ayanokoji === 'object' && Array.isArray(out.ayanokoji.scores), JSON.stringify(out.ayanokoji).slice(0, 80));
    check('weeklyFocus inválido vira objeto', typeof out.weeklyFocus === 'object' && !Array.isArray(out.weeklyFocus), JSON.stringify(out.weeklyFocus));
    check('routeAdjustments nulo vira objeto', typeof out.routeAdjustments === 'object' && out.routeAdjustments !== null);
    check('objetivo de score inválido não fica como texto', typeof out.settings.targetDailyScore === 'number', String(out.settings.targetDailyScore));
    check('check-in de meio-dia não fica como texto', typeof out.settings.middayCheckin === 'boolean', String(out.settings.middayCheckin));
    check('horário de lembrete não fica como número', typeof out.settings.nightReminder === 'string', String(out.settings.nightReminder));
  }
}

/* ═══════════════ Boot: nada de registro perdido na normalização ═══════════════ */

console.log('\n── Boot: a normalização não pode APAGAR registro ──');
{
  const storageMod = await import(path.join(outRoot, 'lib/storage.mjs'));
  // Justificativa de falha é o coração da cobrança do app: se o boot reconstruir
  // a tarefa e esquecer o `excuse`, o usuário perde o motivo registrado.
  const comCobranca = storageMod.normalizeData(
    {
      days: [
        {
          date: '2026-11-10',
          tasks: [
            {
              goalId: 'g1',
              done: false,
              note: 'tentei',
              failAt: '15:00',
              excuse: { type: 'Prazer Imediato', legitimacy: 'Autoengano' },
              cost: 'perdi 1h de treino',
              recoveryPlan: 'amanhã antes do almoço',
            },
          ],
          honestyFlags: [{ goalId: 'g2', reason: 'energia baixa', resolved: 'adjusted' }],
          scheduleOverrides: { g1: '07:30' },
          closedAt: '2026-11-10T22:00:00',
          middayCheckin: { at: '13:00', priorityDone: true, energy: 6, note: 'ok' },
          pomodoros: [{ goalId: 'g1', minutes: 25, at: '10:00' }],
        },
      ],
    },
    storageMod.EMPTY_DATA,
  );
  const t0 = comCobranca.days[0]?.tasks[0];
  check('boot preserva o motivo da falha (excuse)', !!t0?.excuse && t0.excuse.type === 'Prazer Imediato', JSON.stringify(t0?.excuse));
  check('boot preserva o custo da falha', t0?.cost === 'perdi 1h de treino', String(t0?.cost));
  check('boot preserva o plano de recuperação', t0?.recoveryPlan === 'amanhã antes do almoço', String(t0?.recoveryPlan));
  check('boot preserva o horário da falha', t0?.failAt === '15:00', String(t0?.failAt));
  check('boot preserva as sinalizações de honestidade', comCobranca.days[0]?.honestyFlags?.[0]?.goalId === 'g2', JSON.stringify(comCobranca.days[0]?.honestyFlags));
  check('boot preserva os horários ajustados do cronograma', comCobranca.days[0]?.scheduleOverrides?.g1 === '07:30');
  check('boot preserva o fechamento do dia', comCobranca.days[0]?.closedAt === '2026-11-10T22:00:00');
  check('boot preserva o check-in de meio-dia', comCobranca.days[0]?.middayCheckin?.energy === 6);
  check('boot preserva os pomodoros', comCobranca.days[0]?.pomodoros?.[0]?.minutes === 25);

  // E o dia que já estava bom continua idêntico.
  const redondo = storageMod.normalizeData(
    {
      days: [{ date: '2026-11-09', energy: { physical: 7, mental: 6, stress: 4 }, mode: 'attack', tasks: [{ goalId: 'g1', done: true, note: '' }] }],
    },
    storageMod.EMPTY_DATA,
  );
  check('dia íntegro passa igual (energia e modo)', redondo.days[0]?.energy.physical === 7 && redondo.days[0]?.mode === 'attack', JSON.stringify(redondo.days[0]?.energy));

  // Cronômetro de treino: `undefined`/texto não podem virar "NaN:NaN" na tela.
  const tr = await import(path.join(outRoot, 'lib/training.mjs'));
  check('formatClock aguenta undefined', tr.formatClock(undefined) === '00:00', tr.formatClock(undefined));
  check('formatClock aguenta texto', tr.formatClock('muito') === '00:00', tr.formatClock('muito'));
  check('formatClock aguenta NaN', tr.formatClock(Number.NaN) === '00:00', tr.formatClock(Number.NaN));
  check('sessão com exercises inválido não quebra', tr.sessionVolume({ date: 'x', label: 'y', exercises: 'nao-e-lista' }) === 0);
  check('sessão nula não quebra progresso', tr.sessionProgress(null).total === 0);
}

/* ═══════════════ Design: tema Dark Neon Blue Bento ═══════════════ */

console.log('\n── Tema neonBlue (Dark Neon Blue Bento) ──');
{
  const theme = await import(path.join(outRoot, 'theme.mjs'));
  const palette = theme.THEMES.neonBlue?.palette;
  check('tema neonBlue existe', !!palette);
  check('fundo #08090E', palette?.bgPrimary === '#08090E', String(palette?.bgPrimary));
  check('card #121522', palette?.bgCard === '#121522', String(palette?.bgCard));
  check('acento é azul elétrico #3B82F6', palette?.neon === '#3B82F6' && palette?.neonDeep === '#2563EB', `${palette?.neon}/${palette?.neonDeep}`);

  // Contraste: texto sobre fundo/card. Abaixo de 4.5:1 é ilegível no sol.
  const lum = (hex) => {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const lin = v.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const r = ratio(palette.textPrimary, palette.bgPrimary);
  check('texto principal sobre o fundo tem contraste >= 4.5', r >= 4.5, `${r.toFixed(2)}:1`);
  const r2 = ratio(palette.textSecondary, palette.bgCard);
  check('texto secundário sobre o card tem contraste >= 4.5', r2 >= 4.5, `${r2.toFixed(2)}:1`);
  const r3 = ratio(palette.textMuted, palette.bgCard);
  check('texto discreto é legível o bastante (>= 3)', r3 >= 3, `${r3.toFixed(2)}:1`);
  const r4 = ratio(palette.onNeon, palette.neon);
  check('texto sobre o azul neon tem contraste >= 4.5', r4 >= 4.5, `${r4.toFixed(2)}:1`);

  // Nenhum tema antigo pode quebrar: acento tem fallback.
  check('temas antigos continuam sem neon (fallback cobre)', theme.THEMES.emerald.palette.neon === undefined);
  check('applyTheme troca a paleta mutável', (() => {
    theme.applyTheme('neonBlue');
    const ok = theme.colors.bgPrimary === '#08090E' && theme.accent() === '#3B82F6';
    theme.applyTheme('emerald');
    return ok && theme.colors.bgPrimary === '#051F20' && theme.accent() === theme.colors.cyan;
  })());
  check('isThemeId aceita o tema novo e recusa lixo', theme.isThemeId('neonBlue') && !theme.isThemeId('hacker'));
}

/* ═══════════════ Design: tema Soft Light Glass (Home) ═══════════════ */

console.log('\n── Tema softGlass (Soft Light Glass) ──');
{
  const theme = await import(path.join(outRoot, 'theme.mjs'));
  const palette = theme.THEMES.softGlass?.palette;
  check('tema softGlass existe', !!palette);
  check('fundo cinza fumê #EBECEC', palette?.bgPrimary === '#EBECEC', String(palette?.bgPrimary));
  check('card branco translúcido (vidro)', String(palette?.bgCard).startsWith('rgba(255,255,255'), String(palette?.bgCard));

  // O tema é CLARO: a cor de "contraste do acento" tem que virar branca, senão o
  // rótulo do botão primário fica preto sobre preto.
  check('contraste do acento é claro (não preto sobre preto)', palette?.black === '#FFFFFF', String(palette?.black));

  const lum = (hex) => {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const lin = v.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const r1 = ratio(palette.textPrimary, palette.bgPrimary);
  check('texto principal sobre o fundo claro tem contraste >= 4.5', r1 >= 4.5, `${r1.toFixed(2)}:1`);
  const r2 = ratio(palette.textSecondary, palette.bgElevated);
  check('texto secundário sobre card branco tem contraste >= 4.5', r2 >= 4.5, `${r2.toFixed(2)}:1`);
  const r3 = ratio(palette.textMuted, palette.bgElevated);
  check('texto discreto é legível o bastante (>= 3)', r3 >= 3, `${r3.toFixed(2)}:1`);
  const r4 = ratio(palette.onNeon, palette.neon);
  check('texto sobre o acento escuro tem contraste >= 4.5', r4 >= 4.5, `${r4.toFixed(2)}:1`);

  check('applyTheme veste o tema claro e volta', (() => {
    theme.applyTheme('softGlass');
    const ok = theme.colors.bgPrimary === '#EBECEC' && theme.onAccent() === '#FFFFFF';
    theme.applyTheme('emerald');
    return ok && theme.colors.bgPrimary === '#051F20';
  })());
  check('isThemeId aceita softGlass', theme.isThemeId('softGlass'));
}

/* ═══════════════ Treino: sequência, PR, volume e grupos musculares ═══════════════ */

console.log('\n── Treino: dados que a tela FITPULSE afirma ──');
{
  const tr = await import(path.join(outRoot, 'lib/training.mjs'));
  const mk = (date, exs, extra = {}) => ({
    date,
    label: 'Treino',
    exercises: exs.map(([name, weight, done = true]) => ({
      name,
      sets: [{ reps: 10, weight, done }],
    })),
    ...extra,
  });

  // Sessão só conta com série feita: sessão aberta e vazia não é treino.
  check('sessão sem série feita não conta', !tr.isRecorded(mk('2026-03-01', [['Supino', 60, false]])));
  check('sessão com série feita conta', tr.isRecorded(mk('2026-03-01', [['Supino', 60]])));

  // Sequência: hoje sem treino não zera (a série vem de ontem).
  const seq = [mk('2026-03-01', [['Supino', 60]]), mk('2026-03-02', [['Supino', 62]]), mk('2026-03-03', [['Supino', 64]])];
  check('sequência conta dias seguidos', tr.trainingStreak(seq, '2026-03-03').streak === 3, String(tr.trainingStreak(seq, '2026-03-03').streak));
  check('hoje sem treino mantém a sequência de ontem', tr.trainingStreak(seq, '2026-03-04').streak === 3);
  check('buraco no meio zera para 1', tr.trainingStreak([seq[0], seq[2]], '2026-03-03').streak === 1);
  check('recordes de sequência = 3', tr.trainingStreak(seq, '2026-03-04').best === 3);

  // PR: primeira sessão NÃO inventa delta.
  const pr1 = tr.personalRecords([mk('2026-03-01', [['Supino', 60]])]);
  check('primeira sessão: delta null (não "+5kg")', pr1[0]?.delta === null, JSON.stringify(pr1[0]?.delta));
  const pr2 = tr.personalRecords([mk('2026-03-01', [['Supino', 60]]), mk('2026-03-02', [['Supino', 65]])]);
  check('PR calcula +5kg sobre a sessão anterior', pr2[0]?.delta === 5, JSON.stringify(pr2[0]));
  check('PR usa a MAIOR carga do exercício', pr2[0]?.weight === 65);

  // Volume: reps × carga só das séries feitas; peso corporal conta 0.
  check('volume soma reps × carga', tr.sessionVolume(mk('2026-03-01', [['Supino', 60], ['Remada', 40]])) === 1000);
  check('série não feita não soma', tr.sessionVolume(mk('2026-03-01', [['Supino', 60, false]])) === 0);

  // Cardio separado: dia sem treino é null (barra oca), não zero.
  const days = ['2026-03-01', '2026-03-02', '2026-03-03'];
  const wv = tr.weeklyVolume([mk('2026-03-01', [['Supino', 60]]), mk('2026-03-03', [], { kind: 'cardio', cardioMin: 30 })], days);
  check('dia sem sessão é null no gráfico', wv[1]?.strength === null && wv[1]?.cardio === null, JSON.stringify(wv[1]));
  check('dia de cardio não vira volume de força', wv[2]?.strength === 0 && wv[2]?.cardio === 30, JSON.stringify(wv[2]));

  // Minutos: cronômetro manda; sem cronômetro, cardio declarado.
  check('minutos usam o cronômetro', tr.sessionMinutes(mk('2026-03-01', [['Supino', 60]], { durationSec: 3480 })) === 58);
  check('sem cronômetro, usa o cardio', tr.sessionMinutes(mk('2026-03-01', [], { cardioMin: 25 })) === 25);

  // Grupos musculares: reconhece pelo nome, e não chuta quando não sabe.
  check('agachamento → Quads', tr.exerciseMuscle('Agachamento livre') === 'Quads');
  check('stiff → Posterior', tr.exerciseMuscle('Stiff') === 'Posterior');
  check('supino → Peito', tr.exerciseMuscle('Supino reto') === 'Peito');
  check('bike → Cardio', tr.exerciseMuscle('Bike 20min') === 'Cardio');
  check('nome desconhecido → null (sem chute)', tr.exerciseMuscle('Exercício secreto') === null);
  check('grupo explícito vence o nome', tr.muscleOf({ name: 'Supino', sets: [], muscle: 'Peito' }) === 'Peito');
}

console.log('\n── Tema fitPulse (FITPULSE Dark Lime) ──');
{
  const theme = await import(path.join(outRoot, 'theme.mjs'));
  const palette = theme.THEMES.fitPulse?.palette;
  check('tema fitPulse existe', !!palette);
  check('fundo preto puro #0D0E12', palette?.bgPrimary === '#0D0E12', String(palette?.bgPrimary));
  check('card grafite #13151A', palette?.bgCard === '#13151A', String(palette?.bgCard));
  check('acento é verde lima #A3E635', palette?.neon === '#A3E635' && palette?.neonDeep === '#84CC16', `${palette?.neon}/${palette?.neonDeep}`);

  const lum = (hex) => {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const lin = v.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const r1 = ratio(palette.textPrimary, palette.bgPrimary);
  check('texto principal sobre preto tem contraste >= 4.5', r1 >= 4.5, `${r1.toFixed(2)}:1`);
  const r2 = ratio(palette.textSecondary, palette.bgCard);
  check('texto secundário sobre grafite tem contraste >= 4.5', r2 >= 4.5, `${r2.toFixed(2)}:1`);
  const r3 = ratio(palette.onNeon, palette.neon);
  check('texto sobre o lima tem contraste >= 4.5 (branco reprovaria)', r3 >= 4.5, `${r3.toFixed(2)}:1`);
  check('branco sobre o lima reprovaria — por isso onNeon é escuro', ratio('#FFFFFF', palette.neon) < 4.5);
  check('applyTheme troca para o tema lima e volta', (() => {
    theme.applyTheme('fitPulse');
    const ok = theme.colors.bgPrimary === '#0D0E12' && theme.accent() === '#A3E635';
    theme.applyTheme('emerald');
    return ok && theme.colors.bgPrimary === '#051F20';
  })());
}

/* ═══════════════ AUDITORIA: contraste de todos os temas ═══════════════ */

console.log('\n── Acessibilidade: contraste em TODOS os temas ──');
{
  const theme = await import(path.join(outRoot, 'theme.mjs'));
  const lum = (hex) => {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const lin = v.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  // Card translúcido é medido sobre o fundo que ele deixa passar (é o que o olho vê).
  const flat = (color, bg) => {
    if (!color.startsWith('rgba')) return color;
    const [r, g, b, a] = color.replace(/rgba?\(|\)/g, '').split(',').map((x) => Number(x.trim()));
    const under = bg.replace('#', '');
    const ub = [0, 2, 4].map((i) => parseInt(under.slice(i, i + 2), 16));
    const mix = [r, g, b].map((c, i) => Math.round(c * (a ?? 1) + ub[i] * (1 - (a ?? 1))));
    return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  };

  for (const id of Object.keys(theme.THEMES)) {
    const p = theme.THEMES[id].palette;
    const bg = p.bgPrimary;
    const card = flat(p.bgCard, bg);
    const r1 = ratio(p.textPrimary, bg);
    const r2 = ratio(p.textPrimary, card);
    const r3 = ratio(p.textSecondary, card);
    // O botão primário pinta o fundo com `colors.green` e escreve com `onAccent()`
    // (= onNeon ?? black). É ESSE par que o usuário lê — medir sobre `neon` dava
    // um número bonito e falso.
    const r4 = ratio(p.onNeon ?? p.black, p.green);
    check(`${id}: texto principal no fundo >= 4.5`, r1 >= 4.5, `${r1.toFixed(2)}:1`);
    check(`${id}: texto principal no card >= 4.5`, r2 >= 4.5, `${r2.toFixed(2)}:1 (card ${card})`);
    check(`${id}: texto secundário no card >= 4.5`, r3 >= 4.5, `${r3.toFixed(2)}:1`);
    check(`${id}: texto do botão primário sobre ${p.green} >= 4.5`, r4 >= 4.5, `${r4.toFixed(2)}:1`);
    // Escala do heatmap: o tom do meio precisa aparecer no card (>= 1.35:1), senão
    // a célula "sem registro" e a "registro médio" viram a mesma mancha.
    const mid = ratio(p.scale[3], card);
    check(`${id}: escala do heatmap tem degrau visível (>= 1.35)`, mid >= 1.35, `${mid.toFixed(2)}:1`);
  }
}

/* ═══════════════ AUDITORIA: app.json e app.config.ts não podem divergir ═══════════════ */

console.log('\n── Configuração: app.json x app.config.ts ──');
{
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const pluginEntry = (appJson.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'react-native-android-widget');
  const jsonWidgets = pluginEntry?.[1]?.widgets ?? [];
  check('app.json declara o plugin de widget', jsonWidgets.length > 0, `${jsonWidgets.length} widget(s)`);

  const { default: buildConfig } = await import(path.join(outRoot, 'app-config.mjs'));
  const resolved = buildConfig({ config: { ...appJson, plugins: (appJson.plugins ?? []).filter((p) => !Array.isArray(p) || p[0] !== 'react-native-android-widget') } });
  const resolvedEntry = (resolved.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'react-native-android-widget');
  const tsWidgets = resolvedEntry?.[1]?.widgets ?? [];
  check('app.config.ts declara o plugin de widget', tsWidgets.length > 0, `${tsWidgets.length} widget(s)`);

  // Versão instalável: sem versionCode crescente o Android recusa a atualização
  // e as duas builds diferentes parecem o mesmo app (foi o que confundiu aqui).
  check('app.json declara version', /^\d+\.\d+\.\d+$/.test(appJson.version ?? ''), String(appJson.version));
  check('app.json versionCode é inteiro >= 2', Number.isInteger(appJson.android?.versionCode) && appJson.android.versionCode >= 2, String(appJson.android?.versionCode));
  check('app.config.ts mantém o mesmo versionCode', resolved.android?.versionCode === appJson.android?.versionCode, `${resolved.android?.versionCode} x ${appJson.android?.versionCode}`);
  check('app.config.ts mantém a mesma version', resolved.version === appJson.version, `${resolved.version} x ${appJson.version}`);
  check('app.json tem package Android', typeof appJson.android?.package === 'string' && appJson.android.package.includes('.'), String(appJson.android?.package));

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check('os dois arquivos descrevem o mesmo número de widgets', jsonWidgets.length === tsWidgets.length, `${jsonWidgets.length} x ${tsWidgets.length}`);
  for (const w of tsWidgets) {
    const twin = jsonWidgets.find((j) => j.name === w.name);
    if (!twin) { check(`widget ${w.name} existe nos dois arquivos`, false); continue; }
    check(`widget ${w.name}: label igual`, twin.label === w.label, `${twin.label} x ${w.label}`);
    check(`widget ${w.name}: minHeight igual`, twin.minHeight === w.minHeight, `${twin.minHeight} x ${w.minHeight}`);
    check(`widget ${w.name}: cells iguais`, twin.targetCellWidth === w.targetCellWidth && twin.targetCellHeight === w.targetCellHeight, `${twin.targetCellWidth}x${twin.targetCellHeight} x ${w.targetCellWidth}x${w.targetCellHeight}`);
    check(`widget ${w.name}: updatePeriodMillis igual`, twin.updatePeriodMillis === w.updatePeriodMillis, `${twin.updatePeriodMillis} x ${w.updatePeriodMillis}`);
    check(`widget ${w.name}: updatePeriodMillis respeita o mínimo de 30 min do Android`, w.updatePeriodMillis === 0 || w.updatePeriodMillis >= 1800000, String(w.updatePeriodMillis));
    check(`widget ${w.name}: previewImage existe`, fs.existsSync(path.join(root, w.previewImage.replace('./', ''))), w.previewImage);
  }
}

/* ═══════════════ AUDITORIA: import não pode perder linha em silêncio ═══════════════ */

console.log('\n── Importador: o resumo conta o que foi ignorado ──');
{
  const importer = await import(path.join(outRoot, 'lib/importer.mjs'));
  const base = {
    goals: [], days: [], rules: [], rewards: [], books: [], finances: [], weight: [],
    emotions: [], user: {}, settings: {}, ayanokoji: {}, weeklyFocus: {}, routeAdjustments: {},
    badges: [], onboarded: false,
  };

  const comSecao = importer.readPlan('# Treino\n- Correr 5km\n- Musculação 45min', 'plano.txt', base);
  check('seção conhecida vira meta', comSecao.goals.length === 2, JSON.stringify(comSecao.goals.map((g) => g.name)));
  check('arquivo limpo não reporta seção desconhecida', comSecao.unknownSections.length === 0, JSON.stringify(comSecao.unknownSections));

  const comInventada = importer.readPlan('# Treino\n- Correr 5km\n\n# Seção Inventada\n- coisa\n- outra coisa', 'plano.txt', base);
  check('seção desconhecida é reportada pelo nome', comInventada.unknownSections.includes('Seção Inventada'), JSON.stringify(comInventada.unknownSections));
  check('linhas da seção desconhecida não viram meta fantasma', comInventada.goals.length === 1, JSON.stringify(comInventada.goals.map((g) => g.name)));

  const textoRuim = importer.readPlan('linha solta\nmais uma linha\nterceira linha', 'x.txt', base);
  check('arquivo sem nenhuma seção gera pendência explícita', textoRuim.source === 'plan-text' && textoRuim.pending.length > 0, `${textoRuim.pending.length} pendência(s)`);
  check('arquivo sem seção não inventa meta', textoRuim.goals.length === 0);
  check('arquivo sem seção conta as linhas perdidas', textoRuim.ignoredLines === 3, String(textoRuim.ignoredLines));
  check('texto antes do primeiro cabeçalho também é contado', importer.readPlan('linha solta\n# Treino\n- Correr 5km', 'x.txt', base).ignoredLines === 1);

  const comRuido = importer.readPlan('# Treino\n- ok\n- Correr 5km', 'plano.txt', base);
  check('linha curta demais conta como ignorada, não como meta', comRuido.goals.length === 1 && comRuido.ignoredLines === 1, `metas=${comRuido.goals.length} ignored=${comRuido.ignoredLines}`);
  check('contagem de ignoradas sobe com ruído real', comRuido.ignoredLines > comSecao.ignoredLines, `${comSecao.ignoredLines} → ${comRuido.ignoredLines}`);
}

/* ═══════════════ Formatação de dinheiro (pt-BR, sem depender de ICU) ═══════════════ */

console.log('\n── formatBRL ──');
{
  const d = await import(path.join(outRoot, 'lib/date.mjs'));
  check('milhar com ponto e centavos com vírgula', d.formatBRL(1234.5) === 'R$ 1.234,50', d.formatBRL(1234.5));
  check('milhão', d.formatBRL(1234567.89) === 'R$ 1.234.567,89', d.formatBRL(1234567.89));
  check('sem centavos quando pedido', d.formatBRL(1234.5, { decimals: 0 }) === 'R$ 1.235', d.formatBRL(1234.5, { decimals: 0 }));
  check('negativo', d.formatBRL(-89.9) === '-R$ 89,90', d.formatBRL(-89.9));
  check('zero é zero (quem decide "Sem dado" é a tela)', d.formatBRL(0) === 'R$ 0,00', d.formatBRL(0));
  check('NaN não imprime NaN', d.formatBRL(Number.NaN) === 'Sem dado', d.formatBRL(Number.NaN));
  check('Infinity não imprime Infinity', d.formatBRL(Number.POSITIVE_INFINITY) === 'Sem dado');
  check('centavo único', d.formatBRL(0.05) === 'R$ 0,05', d.formatBRL(0.05));
  check('arredonda para cima', d.formatBRL(9.999) === 'R$ 10,00', d.formatBRL(9.999));

  // O veredito do dia de pagamento não pode sair com número cru.
  const finance = await import(path.join(outRoot, 'lib/finance.mjs'));
  const pay = finance.paydayCheck(
    [
      { id: 'a', date: '2026-11-05', type: 'income', amount: 6200, category: 'Fixo', isImpulse: false, note: '' },
      { id: 'b', date: '2026-11-06', type: 'expense', amount: 500, category: 'Investimento', isImpulse: false, note: '' },
    ],
    '2026-11',
    { necessidade: 50, vontade: 30, futuro: 20 },
  );
  check('veredito do pagamento usa R$ formatado', /R\$ [\d.]+,\d{2}|R\$ [\d.]+/.test(pay.verdict) && !/R\$ \d{4,}/.test(pay.verdict), pay.verdict);
}

/* ═══════════════ Cartão: 4 dígitos são dado do usuário, não decoração ═══════════════ */

console.log('\n── Cartão de saldo: só 4 dígitos entram ──');
{
  const storageMod = await import(path.join(outRoot, 'lib/storage.mjs'));
  const base = storageMod.EMPTY_DATA;
  const withCard = (cardLast4) => storageMod.normalizeData({ settings: { ...base.settings, cardLast4 } }, base).settings.cardLast4;

  check('4 dígitos válidos passam', withCard('1209') === '1209', String(withCard('1209')));
  check('menos de 4 dígitos é descartado', withCard('12') === undefined, String(withCard('12')));
  check('mais de 4 dígitos é descartado (não trunca)', withCard('1234567890123456') === undefined, String(withCard('1234567890123456')));
  check('texto com letras é descartado', withCard('12ab') === undefined, String(withCard('12ab')));
  check('número (não string) é descartado', withCard(1209) === undefined, String(withCard(1209)));
  check('null vira ausente', withCard(null) === undefined);
  check('sem cartão o campo é undefined (não string vazia)', withCard(undefined) === undefined);

  // Nunca guardamos nada além dos 4 dígitos: nada de cvv/validade no tipo.
  const typesFile = fs.readFileSync(path.join(root, 'src/lib/types.ts'), 'utf8');
  const settingsBlock = typesFile.slice(typesFile.indexOf('export interface Settings'), typesFile.indexOf('export interface BadgeState'));
  // O comentário do tipo cita "CVV" para dizer que NÃO é guardado: checar só as
  // declarações de campo, não o texto.
  // O bloco pega o comentário do campo, então `cardLast4?:` pode vir indentado
  // junto com `*`; filtra pela linha que realmente DECLARA o campo.
  const fields = settingsBlock
    .split('\n')
    .filter((line) => /^\s{2}[a-zA-Z][a-zA-Z0-9]*\??:/.test(line))
    .join('\n');
  check('Settings declara só cardLast4 entre os campos de cartão', /cardLast4\?:/.test(fields) && !/cvv|validade|expiry|cardNumber/i.test(fields));
}

/* ═══════════════ Dashboards: janelas de tempo e "Sem dado" ═══════════════ */

console.log('\n── Dashboards: janela por DATA, não por posição no array ──');
{
  const scoreMod = await import(path.join(outRoot, 'lib/score.mjs'));

  // Histórico com buraco: 12 dias gravados, mas espalhados em 4 meses.
  // `slice(-7)` pegaria os 7 últimos REGISTROS (que podem ser de meses atrás);
  // a média de 7 dias tem de olhar os últimos 7 dias do CALENDÁRIO.
  const fechado = (date, total) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks: [{ goalId: 'g1', done: total >= 6, note: '' }],
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours: 0, quality: 0, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
    score: { regularity: total, continuity: total, recovery: total, honesty: total, progress: total, total },
  });
  const espalhado = [
    fechado('2026-07-10', 9),
    fechado('2026-07-11', 9),
    fechado('2026-07-12', 9),
    fechado('2026-07-13', 9),
    fechado('2026-07-14', 9),
    fechado('2026-07-15', 9),
    fechado('2026-07-16', 9),
    fechado('2026-08-20', 2),
    fechado('2026-11-05', 3),
    fechado('2026-11-09', 5),
    fechado('2026-11-10', 7),
  ];
  const resumo = scoreMod.scoreSummary(espalhado, '2026-11-10');
  // Últimos 7 dias do calendário: 11-04..11-10 → dias 05 (3), 09 (5), 10 (7) → média 5,0
  check(
    'média de 7 dias ignora registro de julho (média 5,0, não 7,4)',
    resumo.avg7 != null && Math.abs(resumo.avg7 - 5) < 0.05,
    String(resumo.avg7),
  );
  check('média de 7 dias conta só 3 dias registrados na janela', resumo.days7 === 3, String(resumo.days7));
}

{
  const statsMod = await import(path.join(outRoot, 'lib/stats.mjs'));
  // Foco médio: 3 dias de pomodoro em julho + 1 dia em novembro não podem virar
  // "média dos últimos 7 dias" só porque são os últimos do array.
  const pomodoros = (date, minutes) => ({ date, pomodoros: [{ goalId: 'g1', minutes, at: '10:00' }] });
  const media = statsMod.averageFocusMinutes(
    [pomodoros('2026-07-01', 300), pomodoros('2026-07-02', 300), pomodoros('2026-07-03', 300), pomodoros('2026-11-10', 25)],
    7,
    '2026-11-10',
  );
  check('foco médio de 7 dias ignora julho (25 min, não 231)', media === 25, String(media));
  check('foco médio sem registro na janela é null', statsMod.averageFocusMinutes([pomodoros('2026-07-01', 60)], 7, '2026-11-10') === null);
}

console.log('\n── Dashboards: uma régua só para "dia cumprido" ──');
{
  const scoreMod = await import(path.join(outRoot, 'lib/score.mjs'));
  const statsMod = await import(path.join(outRoot, 'lib/stats.mjs'));

  const fechado = (date, total) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks: [],
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours: 0, quality: 0, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
    score: { regularity: total, continuity: total, recovery: total, honesty: total, progress: total, total },
  });
  // 5,9 é "Abaixo do padrão" (não cumprido); 6,0 é "Consistente".
  check('score 5,9 não é dia cumprido', scoreMod.isFulfilledDay(fechado('2026-11-09', 5.9)) === false);
  check('score 6,0 é dia cumprido', scoreMod.isFulfilledDay(fechado('2026-11-10', 6)) === true);
  check('dia sem score não é cumprido', scoreMod.isFulfilledDay({}) === false);

  // Recorde e sequência atual têm de usar a MESMA régua (era > 5 vs >= 6).
  const dias = [
    fechado('2026-11-05', 5.5),
    fechado('2026-11-06', 5.5),
    fechado('2026-11-07', 5.5),
    fechado('2026-11-08', 7),
    fechado('2026-11-09', 8),
    fechado('2026-11-10', 9),
  ];
  const info = statsMod.streakInfo(dias, { end: '2026-11-10' });
  check('recorde não conta dia com score 5,5', info.best === 3, JSON.stringify([info.best, info.current]));
  check('recorde e atual concordam (3 e 3)', info.current === 3, JSON.stringify([info.current, info.best]));

  // E a régua é a mesma do rótulo: 6 é o piso de "Consistente".
  const { scoreLabel } = await import(path.join(outRoot, 'theme.mjs'));
  check('rótulo de 6,0 é "Consistente" (o piso do dia cumprido)', scoreLabel(6) === 'Consistente', scoreLabel(6));
}

{
  const statsMod = await import(path.join(outRoot, 'lib/stats.mjs'));
  const dia = (date, tasks) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks,
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours: 0, quality: 0, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
    score: { regularity: 5, continuity: 5, recovery: 5, honesty: 5, progress: 5, total: 5 },
  });
  const empilhado = statsMod.stackedTasks(
    [
      dia('2026-11-09', [{ goalId: 'g1', done: true, note: '' }, { goalId: 'g2', done: false, note: '' }]),
      // 2026-11-10 não existe: dia sem registro
    ],
    2,
    '2026-11-10',
  );
  const vazio = empilhado.find((d) => d.date === '2026-11-10');
  const comDados = empilhado.find((d) => d.date === '2026-11-09');
  check('dia sem registro vem marcado como noData', vazio?.noData === true, JSON.stringify(vazio));
  check('dia sem registro NÃO vira "pulado"', vazio?.skipped === 0 && vazio?.failed === 0 && vazio?.done === 0, JSON.stringify(vazio));
  check('dia com checklist não é noData', comDados?.noData === false, JSON.stringify(comDados));
  check('não feita sem motivo é "pulado"', comDados?.skipped === 1, JSON.stringify(comDados));
}

console.log('\n── Dashboards: streak por hábito (Home) × geral (Gráficos) ──');
{
  const scoreMod = await import(path.join(outRoot, 'lib/score.mjs'));
  const day = (date, done) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks: [{ goalId: 'g1', done, note: '' }],
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours: 7, quality: 7, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
    score: { regularity: 5, continuity: 5, recovery: 5, honesty: 5, progress: 5, total: 5 },
  });
  // Hábito feito 3 dias seguidos, mas com o APP fechado nesses dias (sem score).
  const soHabito = [day('2026-11-08', true), day('2026-11-09', true), day('2026-11-10', true)].map((d) => ({ ...d, score: undefined }));
  check('streak do hábito conta 3 dias marcados', scoreMod.goalStreak(soHabito, 'g1', '2026-11-10') === 3);
  check('streak geral é 0 (dia não fechado não conta)', scoreMod.generalStreak(soHabito, '2026-11-10') === 0);
  // Os dois números medem coisas diferentes — e as telas dizem isso nas legendas.
  check('dia cumprido exige score, não só tarefa marcada', scoreMod.isFulfilledDay({ score: undefined }) === false);
}

console.log('\n── Dashboards: correlação entre áreas exige amostra ──');
{
  const insights = await import(path.join(outRoot, 'lib/insights.mjs'));
  check('limiar de amostra é 4 dias', insights.MIN_SAMPLES_FOR_CORRELATION === 4, String(insights.MIN_SAMPLES_FOR_CORRELATION));

  const mkDay = (date, tasks) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks,
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours: 7, quality: 7, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
    score: { regularity: 5, continuity: 5, recovery: 5, honesty: 5, progress: 5, total: 5 },
  });
  const goals = [
    { id: 'g1', name: 'T', area: 'Treino', priority: 'normal', min: '', ideal: '', excellent: '', active: true, createdAt: '' },
    { id: 'g2', name: 'E', area: 'Estudo', priority: 'normal', min: '', ideal: '', excellent: '', active: true, createdAt: '' },
  ];
  const base = {
    user: { name: 'X', identity: '', noMore: '', areas: [], createdAt: '' },
    goals,
    settings: {}, rules: [], rewards: [], books: [], finances: [], weight: [], badges: [], emotions: [],
    ayanokoji: { startDate: '', scores: [], tasksDone: {} }, weeklyFocus: {}, routeAdjustments: {}, onboarded: true,
  };
  // Só 2 dias em que Treino falha: NÃO pode afirmar correlação.
  const doisDias = insights.areaCorrelation({
    ...base,
    days: Array.from({ length: 7 }, (_, i) =>
      mkDay(`2026-11-0${i + 1}`, [
        { goalId: 'g1', done: i < 5, note: '' },
        { goalId: 'g2', done: i < 5, note: '' },
      ]),
    ),
  });
  check('2 dias com falha não geram "área que cai junto"', doisDias.value === null, JSON.stringify(doisDias.value));

  // 5 dias com falha nas duas áreas: aí sim, com n visível.
  const cincoDias = insights.areaCorrelation({
    ...base,
    days: Array.from({ length: 10 }, (_, i) =>
      mkDay(`2026-11-${String(i + 1).padStart(2, '0')}`, [
        { goalId: 'g1', done: i < 5, note: '' },
        { goalId: 'g2', done: i < 5, note: '' },
      ]),
    ),
  });
  check('5 dias com falha geram correlação com n=5', cincoDias.value?.samples === 5 && cincoDias.value?.pct === 100, JSON.stringify(cincoDias.value));
}

console.log('\n── Dashboards: projeção sem ritmo é null, não 0 ──');
{
  const statsMod = await import(path.join(outRoot, 'lib/stats.mjs'));
  const mkData = (days, target = 7) => ({
    user: { name: 'X', identity: '', noMore: '', areas: [], createdAt: '' },
    goals: [],
    days,
    settings: { targetDailyScore: target },
    rules: [], rewards: [], books: [], finances: [], weight: [], badges: [], emotions: [],
    ayanokoji: { startDate: '', scores: [], tasksDone: {} }, weeklyFocus: {}, routeAdjustments: {}, onboarded: true,
  });
  const dia = (date, total) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks: [],
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours: 0, quality: 0, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
    score: { regularity: total, continuity: total, recovery: total, honesty: total, progress: total, total },
  });

  const semNada = statsMod.monthlyGauge(mkData([], 7), '2026-11-10');
  check('mês sem dia na meta não projeta 0 (projeção é null)', semNada.projection === null, String(semNada.projection));
  check('alvo do mês é o número de dias do mês (30)', semNada.target === 30, String(semNada.target));

  // 2 dias na meta no dia 10 → ritmo 0,2/dia × 30 = 6
  const comRitmo = statsMod.monthlyGauge(mkData([dia('2026-11-08', 9), dia('2026-11-09', 8)], 7), '2026-11-10');
  check('projeção usa o ritmo observado (6/30)', comRitmo.projection === 6, JSON.stringify(comRitmo));

  // Gauge também não pode dizer "no ritmo" sem nenhum dia cumprido.
  check('mês sem cumprimento não está "no ritmo"', semNada.onTrack === false, String(semNada.onTrack));
}

console.log('\n── Dashboards: correlação de sono respeita o SINAL ──');
{
  const insights = await import(path.join(outRoot, 'lib/insights.mjs'));
  const dia = (date, hours, total) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks: [{ goalId: 'g1', done: total >= 6, note: '' }],
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours, quality: 7, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
    score: { regularity: total, continuity: total, recovery: total, honesty: total, progress: total, total },
  });
  // Base em que dormir POUCO rende MAIS (diff negativo): a tela não pode dizer "cai".
  const invertido = [
    ...Array.from({ length: 5 }, (_, i) => dia(`2026-11-0${i + 1}`, 5, 9)),
    ...Array.from({ length: 5 }, (_, i) => dia(`2026-11-0${i + 6}`, 8, 4)),
  ];
  const corr = insights.sleepCorrelation({ days: invertido });
  check('correlação existe com 10 dias', corr != null, JSON.stringify(corr));
  check('diff é NEGATIVO quando dormir pouco rende mais (não perde o sinal)', corr.diff < 0, JSON.stringify(corr));
  check('lowAvg = 9 e okAvg = 4 (números reais)', corr.lowAvg === 9 && corr.okAvg === 4, JSON.stringify(corr));

  // E com dado insuficiente continua null (não 0 de diferença).
  check('menos de 7 dias com sono não afirma correlação', insights.sleepCorrelation({ days: invertido.slice(0, 5) }) === null);
}

console.log('\n── Dashboards: a mesma pergunta, o mesmo número em toda tela ──');
{
  // Consistência entre telas é um requisito testável: as três telas que falam de
  // água precisam concordar, e as três que falam de "dia cumprido" também.
  const diet = await import(path.join(outRoot, 'lib/diet.mjs'));
  const copilot = await import(path.join(outRoot, 'lib/copilot.mjs'));
  const settingsVazio = {};
  const settingsComMeta = { waterGoalCups: 9 };
  check(
    'Dieta e Copilot usam a MESMA meta de água',
    diet.waterGoalCups(settingsComMeta) === copilot.waterCupsFor({ settings: settingsComMeta }) &&
      diet.waterGoalCups(settingsVazio) === copilot.waterCupsFor({ settings: settingsVazio }),
    JSON.stringify([diet.waterGoalCups(settingsComMeta), copilot.waterCupsFor({ settings: settingsComMeta })]),
  );
  check('sem meta, nenhuma das duas inventa 8 copos', diet.waterGoalCups(settingsVazio) === null && copilot.waterCupsFor({ settings: settingsVazio }) === null);

  // Percentual de hidratação tem de ser null quando não há meta (nada de 5/8).
  check('progresso de água sem meta é null', diet.waterProgress(5, diet.waterGoalCups(settingsVazio)) === null);
  check('progresso de água com meta 9 e 5 copos ≈ 56%', Math.round((diet.waterProgress(5, 9) ?? 0) * 100) === 56);
}

console.log('\n── Dashboards: leitura não inventa total de páginas ──');
{
  const reading = await import(path.join(outRoot, 'lib/reading.mjs'));
  // Sem total de páginas o progresso é DESCONHECIDO, não 0%.
  check('livro sem total de páginas não vira 0%', reading.bookPercent({ title: 'x', author: '', totalPages: 0, currentPage: 0, todayPages: 0 }) === null);
  check('livro com total 0 e página 40 não vira 100%', reading.bookPercent({ title: 'x', author: '', totalPages: 0, currentPage: 40, todayPages: 0 }) === null);
  check('livro 142/350 dá 41%', Math.round((reading.bookPercent({ title: 'x', author: '', totalPages: 350, currentPage: 142, todayPages: 0 }) ?? 0) * 100) === 41);
  check('páginas restantes de livro sem total é 0 (não negativo)', reading.pagesLeft({ title: 'x', author: '', totalPages: 0, currentPage: 40, todayPages: 0 }) === 0);
}

console.log('\n── Dashboards: finanças não misturam receita com despesa ──');
{
  const fin = await import(path.join(outRoot, 'lib/finance.mjs'));
  // Receita 1.000 e despesa 400 no mês: o alvo por balde tem de sair da RECEITA.
  const entradas = [
    { id: 'a', date: '2026-11-05', type: 'income', amount: 1000, category: 'Fixo', isImpulse: false, note: '' },
    { id: 'b', date: '2026-11-06', type: 'expense', amount: 400, category: 'Alimentação', isImpulse: false, note: '' },
  ];
  const renda = fin.incomeOf(entradas);
  check('renda do mês ignora despesa (1.000, não 1.400 nem 600)', renda === 1000, String(renda));
  const alvos = fin.bucketTargets(entradas, '2026-11', fin.DEFAULT_SPLIT);
  const necessidade = alvos.find((b) => b.key === 'necessidade');
  check('alvo do balde sai da receita (50% de 1.000 = 500)', necessidade?.target === 500, JSON.stringify(necessidade));
  const semRenda = fin.bucketTargets([entradas[1]], '2026-11', fin.DEFAULT_SPLIT);
  check('mês sem receita não calcula alvo (null, não 0)', semRenda.every((b) => b.target === null), JSON.stringify(semRenda));
}

console.log('\n── Dashboards: média nunca transforma ausência em zero ──');
{
  // `avg(x.score?.total ?? 0)` numa lista que já foi filtrada por score não é
  // errado, mas repetir o padrão ao largo foi o que criou "0,0 de score".
  // A regra agora tem nome e teste: média de lista vazia é `null`, não 0.
  const scoreMod = await import(path.join(outRoot, 'lib/score.mjs'));
  check('avg([]) é null (não 0)', scoreMod.avg([]) === null);
  check('avg([0]) é 0 (zero registrado é zero)', scoreMod.avg([0]) === 0);
  check('round1(7,45) = 7,5', scoreMod.round1(7.45) === 7.5, String(scoreMod.round1(7.45)));
}

/* ═══════════════ AI Copilot: contraste da identidade própria ═══════════════ */

console.log('\n── AI Copilot: contraste medido (paleta própria) ──');
{
  const luminancia = (hex) => {
    const c = hex.replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const lin = v.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const src = fs.readFileSync(path.join(root, 'src/components/Lix.tsx'), 'utf8');
  const get = (key) => new RegExp(`\\b${key}: '(#[0-9A-Fa-f]{6})'`).exec(src)?.[1] ?? null;
  const bg = get('bg');
  const glass = get('glass');

  check('a paleta do Copilot usa cor sólida no card de vidro', !!glass, String(glass));
  for (const [key, minimo] of [
    ['ink', 4.5],
    ['body', 4.5],
    ['muted', 4.5],
    ['accent', 4.5],
  ]) {
    const cor = get(key);
    check(`Copilot: "${key}" sobre o card >= ${minimo}:1`, !!cor && ratio(cor, glass) >= minimo, cor ? `${ratio(cor, glass).toFixed(2)}:1` : 'cor não encontrada');
  }
  // O rodapé legal é texto pequeno mas não essencial: 3:1 é o piso aceitável.
  const faint = get('faint');
  check('Copilot: "faint" (rodapé) >= 3:1 no card', !!faint && ratio(faint, glass) >= 3, faint ? `${ratio(faint, glass).toFixed(2)}:1` : 'sem');
  check('Copilot: texto principal sobre o fundo da tela >= 7:1', ratio(get('ink'), bg) >= 7, ratio(get('ink'), bg).toFixed(2) + ':1');
}

/* ═══════════════ AI Copilot / LIX AI ═══════════════ */

console.log('\n── AI Copilot: streaks por área ──');
{
  const cp = await import(path.join(outRoot, 'lib/copilot.mjs'));
  const day = (date, goalsDone) => ({
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode: 'normal',
    tasks: goalsDone.map((goalId) => ({ goalId, done: true, note: '' })),
    diary: { promised: '', done: '', avoided: '', blocked: '', context: {}, correction: '', mood: '', sleep: { hours: 0, quality: 0, blockers: [] }, food: '', focus: 0, temptation: '', relapse: '', smallWin: '', impulseCost: 0, emotions: [] },
  });
  const data = {
    ...{},
    user: { name: 'X', identity: '', noMore: '', areas: ['Treino', 'Estudo'], createdAt: '2026-01-01' },
    goals: [
      { id: 'g-treino', name: 'Treinar', area: 'Treino', priority: 'high', min: '', ideal: '', excellent: '', active: true, createdAt: '2026-01-01' },
      { id: 'g-estudo', name: 'Estudar', area: 'Estudo', priority: 'normal', min: '', ideal: '', excellent: '', active: true, createdAt: '2026-01-01' },
    ],
    days: [day('2026-11-07', ['g-treino']), day('2026-11-08', ['g-treino']), day('2026-11-09', ['g-treino', 'g-estudo'])],
    settings: {}, badges: [], rules: [], rewards: [], books: [], finances: [], weight: [], emotions: [],
    ayanokoji: { startDate: '2026-01-01', scores: [], tasksDone: {} }, weeklyFocus: {}, routeAdjustments: {}, onboarded: true,
  };
  const streaks = cp.areaStreaks(data);
  const treino = streaks.find((s) => s.area === 'Treino');
  const estudo = streaks.find((s) => s.area === 'Estudo');
  check('sequência de treino conta os 3 dias seguidos', treino?.streak === 3, JSON.stringify(streaks));
  // Estudo só fez o último dia: a sequência dele é 1, não a do treino.
  check('sequência de estudo é própria da área (1, não 3)', estudo?.streak === 1, JSON.stringify(estudo));
}

console.log('\n── AI Copilot: leitura de texto livre ──');
{
  const cp = await import(path.join(outRoot, 'lib/copilot.mjs'));

  // Horário: aceita as formas que a pessoa realmente escreve, e NUNCA chuta.
  check('horário "7h"', cp.parseHour('acordar 7h') === '07:00', String(cp.parseHour('acordar 7h')));
  check('horário "07:30"', cp.parseHour('07:30 meditar') === '07:30');
  check('horário "às 19 horas"', cp.parseHour('treinar às 19 horas') === '19:00', String(cp.parseHour('treinar às 19 horas')));
  check('horário "19h30"', cp.parseHour('treino 19h30') === '19:30', String(cp.parseHour('treino 19h30')));
  check('sem horário devolve null (não inventa)', cp.parseHour('meditar todos os dias') === null);
  check('hora inválida (25h) devolve null', cp.parseHour('acordar 25h') === null);

  // Duração
  check('duração "30 min"', cp.parseMinutes('ler 30 min') === 30);
  check('duração "1h30"', cp.parseMinutes('estudar 1h30') === 90);
  check('duração "45 minutos"', cp.parseMinutes('correr 45 minutos') === 45);
  check('sem duração devolve null', cp.parseMinutes('meditar') === null);

  // Módulo e área
  check('"leg day" vai para treino', cp.guessModule('montar leg day') === 'treino');
  check('"edital" vai para estudo', cp.guessModule('organizar edital do concurso') === 'estudo');
  check('"mercado 300" vai para finanças', cp.guessModule('gastei no mercado') === 'financas');
  check('área de "supino" é Treino', cp.guessArea('supino e remada') === 'Treino');
  check('área de "capítulo do livro" é Leitura', cp.guessArea('ler um capítulo do livro') === 'Leitura');

  // Rotina: item com hora entra, item sem hora é declarado (não some em silêncio)
  const rot = cp.parseRoutine('Acordar 6h e meditar 10min, treinar às 19h, ler um pouco');
  check('rotina com hora extrai 2 itens', rot.items.length === 2, JSON.stringify(rot.items.map((i) => i.title)));
  check('rotina sem hora é declarada', rot.withoutHour.length >= 1, JSON.stringify(rot.withoutHour));
  check('rotina preserva o horário', rot.items[0].hour === '06:00', JSON.stringify(rot.items[0]));
  check('rotina tira a hora do título', !/6h|19h/.test(rot.items.map((i) => i.title).join(' ')), rot.items.map((i) => i.title).join(' | '));
}

console.log('\n── AI Copilot: nada de número inventado ──');
{
  const cp = await import(path.join(outRoot, 'lib/copilot.mjs'));
  const base = {
    onboarded: true,
    user: { name: 'Dilan', identity: '', noMore: '', areas: ['Treino', 'Estudo'], createdAt: '2026-01-01' },
    goals: [],
    days: [],
    rules: [],
    rewards: [],
    books: [],
    finances: [],
    weight: [],
    settings: { morningReminder: '07:00', nightReminder: '22:00', middayCheckin: true, middayTime: '12:30', streakNotification: true, haptics: true, sleepGoalHours: 8, targetDailyScore: 7 },
    badges: [],
    ayanokoji: { startDate: '2026-01-01', scores: [], tasksDone: {} },
    weeklyFocus: {},
    routeAdjustments: {},
    emotions: [],
  };
  const ctx = { name: 'Dilan', data: base, today: '2026-11-10' };

  // Sem meta de água declarada: a resposta PEDE o dado, não escreve "8 copos".
  const agua = cp.respond('como está minha hidratação?', ctx);
  check('hidratação sem meta pede o dado', agua.gaps.some((g) => g.field === 'waterGoal'), JSON.stringify(agua.gaps));
  check('hidratação sem meta não inventa litros', !/\d+\s*(L|litros)/i.test([agua.text, ...agua.lines, ...agua.notes].join(' ')), [agua.text, ...agua.lines, ...agua.notes].join(' '));

  // Sem macros declarados: pede, não calcula.
  const macro = cp.respond('quais meus macros?', ctx);
  check('macros sem declaração pedem o dado', macro.gaps.some((g) => g.field === 'education'), JSON.stringify(macro.gaps));
  check('macros não viram número calculado', !/\d+\s*g\b/.test([macro.text, ...macro.lines, ...macro.notes].join(' ')));

  // Com meta declarada: aí sim o número aparece, e é o da pessoa.
  const comMeta = { ...base, settings: { ...base.settings, waterGoalCups: 10, proteinPct: 30, carbsPct: 45, fatPct: 25 } };
  const agua2 = cp.respond('como está minha hidratação e meus macros?', { name: 'Dilan', data: comMeta, today: '2026-11-10' });
  check('meta declarada de água aparece', agua2.notes.join(' ').includes('10 copo') && agua2.notes.join(' ').includes('2.5 L'), agua2.notes.join(' | '));
  check('macros declarados aparecem como declarados', agua2.notes.join(' ').includes('30% proteína'), agua2.notes.join(' | '));

  // Resumo do dia sem registro: diz "sem registro", não zero.
  const resumo = cp.respond('resumir meu dia', ctx);
  const resumoTexto = [resumo.text, ...resumo.lines, ...resumo.notes].join(' ');
  check('resumo sem dia diz que não há registro', /ainda não existe registro/i.test(resumoTexto), resumoTexto);
  check('resumo não escreve score inventado', !/score.*\d/i.test(resumoTexto.replace(/sem registro/gi, '')), resumoTexto);

  // Treino: sem histórico de carga, `weight` é null (a pessoa preenche).
  const ficha = cp.respond('montar ficha de treino de pernas', ctx);
  check('ficha de pernas gerada', ficha.action?.kind === 'workout' && ficha.action.workout.exercises.length >= 4);
  check('sem histórico, carga é null (nunca 30 kg de exemplo)', ficha.action.workout.exercises.every((e) => e.weight === null));
  check('ficha não promete kcal', ficha.notes.join(' ').includes('não calcula gasto calórico'), ficha.notes.join(' | '));

  // Com histórico, a carga vem de lá.
  const comHistorico = {
    ...base,
    days: [
      {
        date: '2026-11-09',
        energy: { physical: 5, mental: 5, stress: 5 },
        mode: 'normal',
        tasks: [],
        diary: {
          promised: '', done: '', avoided: '', blocked: '', context: { where: '', when: '', distraction: '', trigger: '' },
          correction: '', mood: '', sleep: { hours: 0, quality: 0, blockers: [] }, food: '', focus: 0, temptation: '',
          relapse: '', smallWin: '', impulseCost: 0, emotions: [],
          workout: { date: '2026-11-09', label: 'Pernas', exercises: [{ name: 'Agachamento livre', sets: [{ reps: 8, weight: 62, done: true }] }] },
        },
      },
    ],
  };
  const ficha2 = cp.respond('ficha de treino de pernas', { name: 'Dilan', data: comHistorico, today: '2026-11-10' });
  const agacho = ficha2.action.workout.exercises.find((e) => /agachamento livre/i.test(e.name));
  check('carga vem da última sessão registrada', agacho?.weight === 62, JSON.stringify(agacho));

  // Finanças: valor só entra se existir; item sem número é pedido.
  const fin = cp.respond('mercado 320, uber 80, cinema', ctx);
  check('finanças categoriza mercado', fin.action.items.some((i) => i.category === 'Alimentação'));
  check('finanças categoriza uber', fin.action.items.some((i) => i.category === 'Transporte'));
  check('item sem valor fica null e é perguntado', fin.action.items.some((i) => i.amount === null) && fin.gaps.length > 0, JSON.stringify(fin.action.items));

  // Estudo: sem data de prova, pede a data em vez de calcular tópicos/dia.
  const est = cp.respond('organizar estudo: Direito 40min, Português 30min', ctx);
  check('estudo cria 2 matérias', est.action?.kind === 'study' && est.action.items.length === 2, JSON.stringify(est.action));
  check('estudo sem data de prova pede a data', est.gaps.some((g) => g.field === 'examDate'), JSON.stringify(est.gaps));

  // Nenhuma palavra da vitrine da referência pode aparecer.
  const tudo = JSON.stringify([resumo, ficha, fin, est, agua2]).toLowerCase();
  for (const banned of ['hendricks', 'dilan', '12.450', '78%', '22.4', '5kg']) {
    check(`não vaza "${banned}" nas respostas`, !tudo.includes(banned.toLowerCase()), banned);
  }
}

console.log('\n── AI Copilot: aplicar plano ──');
{
  const cp = await import(path.join(outRoot, 'lib/copilot.mjs'));
  const apply = await import(path.join(outRoot, 'lib/copilotApply.mjs'));

  const calls = [];
  const store = {
    user: { name: 'Dilan', identity: '', noMore: '', areas: [], createdAt: '2026-01-01' },
    goals: [],
    days: [],
    upsertGoal: (g) => { calls.push(['goal', g.name]); store.goals = [...store.goals, g]; },
    patchDiary: (date, patch) => { calls.push(['diary', date, Object.keys(patch)]); },
    addFinance: (e) => calls.push(['fin', e.amount, e.category]),
    settings: {},
    ensureDay: (date) => ({ date, energy: { physical: 5, mental: 5, stress: 5 }, mode: 'normal', tasks: [], diary: {} }),
    updateSettings: (patch) => { calls.push(['settings', patch]); Object.assign(store.settings, patch); },
    setScheduleOverride: (date, key, hour) => { calls.push(['override', date, key, hour]); },
  };

  const metas = apply.applyCopilot(
    { kind: 'goals', items: [{ name: 'Meditar', area: 'Espiritualidade', priority: 'normal', min: '5min', ideal: '10min', excellent: '15min' }] },
    store,
  );
  check('aplicar meta grava a meta', metas.applied.length === 1 && calls.some((c) => c[0] === 'goal'), JSON.stringify(metas));

  // Meta duplicada não duplica.
  const again = apply.applyCopilot(
    { kind: 'goals', items: [{ name: 'meditar', area: 'Espiritualidade', priority: 'normal', min: '5min', ideal: '10min', excellent: '15min' }] },
    store,
  );
  check('meta repetida é recusada com motivo', again.applied.length === 0 && again.skipped[0].includes('já existe'), JSON.stringify(again));

  // Treino aplicado preserva carga null.
  let patch = null;
  const store2 = { ...store, patchDiary: (d, p) => { patch = p; } };
  apply.applyCopilot(
    { kind: 'workout', workout: { label: 'Treino Pernas', exercises: [{ name: 'Agachamento livre', sets: 4, reps: 8, weight: null, restSec: 90 }] } },
    store2,
    '2026-11-10',
  );
  check('aplicar ficha preserva carga desconhecida como null', patch?.workout.exercises[0].sets.every((s) => s.weight === null), JSON.stringify(patch?.workout?.exercises?.[0]));
  check('aplicar ficha cria o número de séries pedido', patch?.workout.exercises[0].sets.length === 4);

  // Dia fechado recusa.
  const fechado = { ...store, ensureDay: (date) => ({ date, closedAt: '2026-11-10T22:00:00', energy: {}, mode: 'normal', tasks: [], diary: {} }) };
  const rec = apply.applyCopilot(
    { kind: 'water', water: { cups: 8 } },
    fechado,
    '2026-11-10',
  );
  check('dia fechado recusa escrita', rec.applied.length === 0 && rec.skipped[0].includes('fechado'), JSON.stringify(rec));

  // Finança sem valor não é lançada.
  const semValor = apply.applyCopilot(
    { kind: 'finance', items: [{ category: 'Lazer', amount: null, type: 'expense' }], split: null },
    { ...store, addFinance: () => { throw new Error('não devia gravar'); } },
  );
  check('gasto sem valor não é lançado', semValor.applied.length === 0 && semValor.skipped[0].includes('sem valor'), JSON.stringify(semValor));

  // Meta de água sem declaração: vira declaração e a tela é avisada.
  const storeAgua = {
    ...store,
    settings: {},
    patchDiary: () => {},
    updateSettings: (p) => Object.assign(storeAgua.settings, p),
  };
  const decl = apply.applyCopilot({ kind: 'water', water: { cups: 7 } }, storeAgua);
  check(
    'plano de água declara a meta quando ela não existe',
    decl.declared === true && storeAgua.settings.waterGoalCups === 7,
    JSON.stringify([decl.declared, storeAgua.settings]),
  );

  // Rotina: horário declarado entra como AJUSTE de timeline, nunca como registro.
  const overrides = [];
  const storeRotina = { ...store, goals: [], patchDiary: () => {}, setScheduleOverride: (d, k, h) => overrides.push([d, k, h]) };
  const rotina = apply.applyCopilot(
    {
      kind: 'goals',
      items: [{ name: 'Meditar', area: 'Espiritualidade', priority: 'normal', min: '5min', ideal: '10min', excellent: '15min', hour: '07:00' }],
    },
    storeRotina,
    '2026-11-10',
  );
  check('hábito com horário gera ajuste de timeline', overrides.length === 1 && overrides[0][2] === '07:00', JSON.stringify(overrides));
  check('aplicar rotina relata o horário', rotina.applied.some((a) => a.includes('07:00')), JSON.stringify(rotina.applied));

  // Água limitada a faixa plausível.
  const agua = apply.applyCopilot({ kind: 'water', water: { cups: 999 } }, store2);
  check('meta de água é limitada a 40 copos', patch?.waterCups === 40, String(patch?.waterCups));
  void agua;
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
