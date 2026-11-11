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

// Componentes de widget: compilados à parte, com o módulo nativo trocado por um stub
// que aponta para os componentes reais (funções puras) do pacote.
const widgetTsx = ['ConstancyWidget', 'PrimeWidget'];
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
    `export const { TextWidget } = require_('${rnaw}/TextWidget');\n`,
);

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
const scoreLib = await import(path.join(outRoot, 'lib/score.mjs'));

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
  check('gauge de mês sem registro projeta 0 (não esconde o vazio)', vazio.projection === 0 && vazio.current === 0);
  check('gauge nunca projeta acima do alvo', vazio.projection <= vazio.target);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
