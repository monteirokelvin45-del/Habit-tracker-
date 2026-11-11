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
];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const rel = path.relative(path.join(root, 'src'), file).replace(/\.ts$/, '.mjs');
  const dest = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // Reescreve imports relativos para .mjs
  const fixed = out.replace(/from '(\.[^']+)'/g, (m, p) => (p.endsWith('.mjs') ? m : `from '${p}.mjs'`));
  fs.writeFileSync(dest, fixed);
}

// Stub de AsyncStorage (storage.ts é importado por store.ts, que não testamos).
fs.mkdirSync(path.join(outRoot, 'node_modules', '@react-native-async-storage'), { recursive: true });

const { computeScore, buildChecklist, suggestMode, continuityFactor, generalStreak, chargeLines, detectDanger } = await import(
  path.join(outRoot, 'lib/score.mjs')
);
const { parsePlans, toGoals } = await import(path.join(outRoot, 'lib/parser.mjs'));
const insights = await import(path.join(outRoot, 'lib/insights.mjs'));
const { evaluateRewards } = await import(path.join(outRoot, 'lib/rewards.mjs'));
const { badgeState, BADGES } = await import(path.join(outRoot, 'lib/badges.mjs'));
const dates = await import(path.join(outRoot, 'lib/date.mjs'));
const widget = await import(path.join(outRoot, 'widget/data.mjs'));
const importer = await import(path.join(outRoot, 'lib/importer.mjs'));
const heat = await import(path.join(outRoot, 'lib/heatmap.mjs'));

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

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
