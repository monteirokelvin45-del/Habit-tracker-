/**
 * Testes de AÇÃO do store (Zustand) — não é lógica pura, é estado.
 *
 * Compila `src/lib` (exceto storage, que tem AsyncStorage) com um stub de
 * persistência, importa o store real e exercita as ações como a UI faz.
 * É onde vivem os bugs caros: histórico reescrito, score obsoleto, ação que
 * não grava, checklist atrasado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, '.store-build');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

/* 1. stubs de persistência (mesma API que o store importa) */
fs.writeFileSync(
  path.join(outRoot, 'storage-stub.mjs'),
  `export const state = { writes: [] };
export const DEFAULT_SETTINGS = {
  morningReminder: '07:00', nightReminder: '21:00', middayCheckin: true, middayTime: '13:00',
  streakNotification: true, haptics: true, sleepGoalHours: 7.5, targetDailyScore: 7,
};
export const EMPTY_DATA = {
  onboarded: false,
  user: { name: '', identity: '', noMore: '', areas: [], createdAt: '' },
  goals: [], days: [], rules: [], rewards: [], books: [], finances: [], weight: [],
  settings: DEFAULT_SETTINGS, badges: [],
  ayanokoji: { startDate: '', scores: [], tasksDone: {} },
  weeklyFocus: {}, routeAdjustments: {},
};
export const snapshots = {};
export function sanitizeGoal(g) {
  return { id: String(g.id ?? ''), name: String(g.name ?? ''), area: String(g.area ?? ''),
    priority: ['high','normal','low'].includes(g.priority) ? g.priority : 'normal',
    min: g.min ?? '10min', ideal: g.ideal ?? '30min', excellent: g.excellent ?? '1h',
    active: g.active ?? true, archived: g.archived ?? false, createdAt: g.createdAt ?? '' };
}
export function normalizeDay(d) {
  return { ...d, energy: d.energy ?? { physical: 5, mental: 5, stress: 5 }, mode: d.mode ?? 'normal',
    tasks: Array.isArray(d.tasks) ? d.tasks : [], diary: d.diary ?? {} };
}
export async function loadAll() { return globalThis.__loadAllResult ?? EMPTY_DATA; }
export async function listSnapshots() {
  return Object.entries(snapshots).map(([field, snap]) => ({
    key: field, field, at: snap.at,
    count: Array.isArray(snap.value) ? snap.value.length : snap.value ? 1 : 0,
  }));
}
export async function restoreSnapshots() {
  const days = snapshots.days?.value ?? [];
  if (!days.length) return null;
  return { days: days.map((d) => ({ ...d, diary: d.diary ?? {} })), goals: snapshots.goals?.value ?? [] };
}
export async function discardSnapshots() { for (const k of Object.keys(snapshots)) delete snapshots[k]; }
export async function persist(key, value) { state.writes.push([key, value]); }
export async function persistMany(entries) { state.writes.push(...entries); }
export async function resetAll() { state.writes.push(['reset']); }
export async function normalizeData(input, base) { return { ...base, ...(input ?? {}) }; }
`,
);

/* 2. compila src/lib trocando storage pelo stub e completando extensões */
for (const file of fs
  .readdirSync(path.join(root, 'src/lib'))
  .filter((f) => f.endsWith('.ts') && f !== 'storage.ts')) {
  const full = path.join(root, 'src/lib', file);
  let js = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: full,
  }).outputText;
  js = js
    .replace(/from '\.\/storage'/g, "from './storage-stub.mjs'")
    .replace(/from '(\.\/[a-zA-Z0-9_-]+)'/g, "from '$1.mjs'")
    // `await import('./storage')` (carregamento tardio no store) também vai ao stub.
    .replace(/import\('\.\/storage'\)/g, "import('./storage-stub.mjs')")
    .replace(/import\('(\.\/[a-zA-Z0-9_-]+)'\)/g, "import('$1.mjs')");
  fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, '.mjs')), js);
}

const { useStore, sanitizeDay } = await import(pathToFileURL(path.join(outRoot, 'store.mjs')).href);
const dates = await import(pathToFileURL(path.join(outRoot, 'date.mjs')).href);
const types = await import(pathToFileURL(path.join(outRoot, 'types.mjs')).href);
const scoreLib = await import(pathToFileURL(path.join(outRoot, 'score.mjs')).href);

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const today = dates.todayKey();
const yesterday = dates.addDays(today, -1);
const twoDaysAgo = dates.addDays(today, -2);

const goal = (id, extra = {}) => ({
  id,
  name: `Meta ${id}`,
  area: 'Treino',
  priority: 'high',
  min: '10min',
  ideal: '30min',
  excellent: '1h',
  active: true,
  createdAt: today,
  ...extra,
});

const score = (total) => ({ regularity: total, continuity: 5, recovery: 5, honesty: 5, progress: total, total });

const day = (date, tasks, extra = {}) => ({
  date,
  energy: { physical: 5, mental: 5, stress: 5 },
  mode: 'normal',
  tasks,
  diary: types.emptyDiary(),
  ...extra,
});

const closedDay = (date, tasks, total = 5) => day(date, tasks, { closedAt: `${date}T23:00:00`, score: score(total) });

const seed = ({ goals = [goal('g1')], days = [] } = {}) => {
  useStore.setState({ ...useStore.getInitialState(), goals, days, status: 'ready', rewards: [], badges: [] });
};

console.log('\n── Store: dia fechado é registro fechado ──');
{
  seed({ days: [closedDay(today, [{ goalId: 'g1', done: false, note: '' }])] });
  useStore.getState().toggleTask(today, 'g1', true);
  check(
    'toggle no dia fechado de hoje não muda o checklist',
    useStore.getState().days[0].tasks[0].done === false,
  );

  seed({ days: [closedDay(yesterday, [{ goalId: 'g1', done: true, note: '' }])] });
  useStore.getState().setTaskExcuse(yesterday, 'g1', {
    type: 'Fuga',
    legitimacy: 'Fraca',
    cost: 'R$ 20',
    recoveryPlan: 'amanhã',
  });
  check('falha registrada em dia fechado é recusada', useStore.getState().days[0].tasks[0].done === true);

  seed({ days: [closedDay(yesterday, [])] });
  useStore.getState().setEnergy(yesterday, { physical: 1, mental: 1, stress: 10 });
  check('energia de dia fechado não muda', useStore.getState().days[0].energy.physical === 5);

  useStore.getState().setMode(yesterday, 'recovery');
  check('modo de dia fechado não muda', useStore.getState().days[0].mode === 'normal');

  useStore.getState().setMidday(yesterday, { priorityDone: true, energy: 9, note: 'x' });
  check('check-in de meio do dia em dia fechado é recusado', useStore.getState().days[0].middayCheckin === undefined);

  useStore.getState().addPomodoro(yesterday, 'g1', 25);
  check('pomodoro em dia fechado é recusado', useStore.getState().days[0].pomodoros === undefined);

  useStore.getState().patchDiary(yesterday, { mood: '🙂' });
  check('diário de dia fechado não muda por fora', useStore.getState().days[0].diary.mood === '');
}

console.log('\n── Store: reabrir o dia ──');
{
  seed({ days: [closedDay(yesterday, [{ goalId: 'g1', done: true, note: '' }], 7)] });
  useStore.getState().reopenDay(yesterday);
  const reopened = useStore.getState().days[0];
  check('reabrir remove o closedAt', reopened.closedAt === undefined);
  check('reabrir descarta o score (não conta como dia cumprido)', reopened.score === undefined);
  check('reabrir mantém as tarefas registradas', reopened.tasks[0].done === true);
}

console.log('\n── Store: pomodoro e check-in não se perdem ──');
{
  seed({ days: [] });
  useStore.getState().addPomodoro(today, 'g1', 25);
  const saved = useStore.getState().days[0];
  check('pomodoro cria o dia quando ele ainda não existe', !!saved, 'nenhum dia foi criado');
  check('pomodoro é gravado na tarefa', saved?.pomodoros?.[0]?.minutes === 25);

  seed({ days: [] });
  useStore.getState().patchDiary(today, { mood: '😐', temptation: 'doce' });
  check(
    'patchDiary cria o dia e grava o campo',
    useStore.getState().days[0]?.diary.temptation === 'doce',
  );
}

console.log('\n── Store: metas e checklist de hoje ──');
{
  seed({ days: [day(today, [{ goalId: 'g1', done: false, note: '' }, { goalId: 'g2', done: true, note: '' }])] });
  useStore.getState().upsertGoal(goal('g2', { active: false }));
  check(
    'desativar meta tira a tarefa do checklist de hoje',
    !useStore.getState().days[0].tasks.some((t) => t.goalId === 'g2'),
  );

  seed({ days: [] });
  useStore.getState().archiveGoal('g1');
  check('arquivar desativa a meta', useStore.getState().goals[0].active === false);
  useStore.getState().archiveGoal('g1');
  check(
    'desarquivar devolve o estado anterior (não reativa meta desativada)',
    useStore.getState().goals[0].active === false,
  );

  seed({
    days: [day(twoDaysAgo, [{ goalId: 'g1', done: true, note: '' }])],
  });
  useStore.getState().deleteGoal('g1');
  check(
    'excluir meta preserva histórico de dias passados (mesmo abertos)',
    useStore.getState().days[0].tasks.length === 1,
  );

  seed({ days: [day(today, [{ goalId: 'g1', done: true, note: '' }])] });
  useStore.getState().deleteGoal('g1');
  check('excluir meta remove a tarefa do dia de hoje', useStore.getState().days[0].tasks.length === 0);
}

console.log('\n── Store: fechar o dia ──');
{
  seed({ days: [day(today, [{ goalId: 'g1', done: true, note: '' }])] });
  const diary = { ...types.emptyDiary(), done: 'treinei', avoided: 'nada', blocked: 'cansaço' };
  const closed = useStore.getState().closeDay(today, diary);
  check('fechar o dia calcula o score', typeof closed.score?.total === 'number');
  const tomorrow = dates.addDays(today, 1);
  const next = useStore.getState().days.find((d) => d.date === tomorrow);
  check('fechar o dia abre o dia seguinte com o checklist', !!next && next.tasks.length > 0);

  // reabrir + fechar de novo não pode apagar o que já foi registrado amanhã
  useStore.setState({
    days: useStore.getState().days.map((d) =>
      d.date === tomorrow ? { ...d, middayCheckin: { priorityDone: true, energy: 8, note: 'feito', at: '13:00' } } : d,
    ),
  });
  useStore.getState().reopenDay(today);
  useStore.getState().closeDay(today, diary);
  const nextAfter = useStore.getState().days.find((d) => d.date === tomorrow);
  check(
    'refechar o dia não recria/preserva o dia seguinte',
    nextAfter?.middayCheckin?.note === 'feito',
    'o dia seguinte foi recriado do zero',
  );
}

console.log('\n── Store: dado antigo não quebra o app ──');
{
  const old = sanitizeDay({ date: today, tasks: [{ goalId: 'g1', done: true }] });
  check('sanitizeDay preenche energia padrão', old.energy.physical === 5);
  check('sanitizeDay preenche diário completo', old.diary.context.where === '' && Array.isArray(old.diary.emotions));
  check('sanitizeDay normaliza tarefa sem nota', old.tasks[0]?.note === '');

  let crashed = false;
  try {
    scoreLib.computeScore({ day: old, goals: [goal('g1')], previousDays: [] });
  } catch {
    crashed = true;
  }
  check('computeScore aceita dia normalizado (sem crash)', !crashed);
}

console.log('\n── Memória de dados: snapshot e recuperação ──');
{
  const storageStub = await import(pathToFileURL(path.join(outRoot, 'storage-stub.mjs')).href);
  const historique = [closedDay(yesterday, [{ goalId: 'g1', done: true, note: '' }], 8)];

  // boot sem dias + snapshot com histórico → o app avisa em vez de abrir vazio
  storageStub.snapshots.days = { at: '2026-11-09T10:00:00.000Z', value: historique };
  globalThis.__loadAllResult = { ...storageStub.EMPTY_DATA, onboarded: true };
  await useStore.getState().load();
  check('boot sem dias mas com snapshot marca a recuperação', useStore.getState().recovery?.days === 1);

  const ok = await useStore.getState().restoreFromSnapshot();
  check('restaurar devolve o histórico do snapshot', ok && useStore.getState().days.length === 1);
  check('restaurar recalcula badges sem quebrar', Array.isArray(useStore.getState().badges));
  check('restaurar limpa o aviso', useStore.getState().recovery === null);

  // boot normal (com dias) não deve acusar perda
  globalThis.__loadAllResult = { ...storageStub.EMPTY_DATA, onboarded: true, days: historique };
  await useStore.getState().load();
  check('boot com dias não acusa recuperação', useStore.getState().recovery === null);

  // restore sem snapshot não finge sucesso
  storageStub.snapshots.days = { at: '2026-11-09T10:00:00.000Z', value: [] };
  check('restore sem histórico devolve false', (await useStore.getState().restoreFromSnapshot()) === false);
  globalThis.__loadAllResult = undefined;
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
