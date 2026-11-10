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

const files = fs
  .readdirSync(path.join(root, 'src/lib'))
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.tsx'))
  .map((f) => path.join(root, 'src/lib', f));

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

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
