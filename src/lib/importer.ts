import { sanitizeEmotionLog } from './emotions';
import type { AppData, Book, FinanceEntry, Goal, Reward, Rule, WeightEntry } from './types';
import { todayKey } from './date';
import { parsePlans, guessArea, AREA_HINTS } from './parser';

/**
 * Importador de PLANO COMPLETO.
 *
 * Aceita: plano em texto livre (.md/.txt), JSON do próprio app (backup) ou JSON
 * com chaves conhecidas. Sempre separa em:
 *   1. o que deu para montar automaticamente
 *   2. o que já existia (não duplica)
 *   3. o que NÃO deu (tintim por tintim) — porque só a pessoa tem essa informação
 *
 * Regra 1 do produto: nunca inventar. Campo sem base vira pendência, não chute.
 */

export type PendingKind = 'identity' | 'goal' | 'rule' | 'reward' | 'reading' | 'finance' | 'sleep' | 'dia';

export interface PendingItem {
  id: string;
  kind: PendingKind;
  title: string;
  why: string;
  where: string;
  example?: string;
  severity: 'blocker' | 'important' | 'optional';
}

export interface ImportSummary {
  /** Origem detectada do arquivo. */
  source: 'backup' | 'plan-json' | 'plan-text';
  filename: string;

  goals: Goal[];
  areas: string[];

  rules: Rule[];
  rewards: Reward[];
  books: Book[];
  settings: Partial<AppData['settings']>;
  user: Partial<AppData['user']>;
  ayanokoji: { weeks?: number };
  /** Backup completo (JSON do app). */
  full?: AppData;
  counts: { days: number; finances: number; weight: number; badges: number };
  finances: FinanceEntry[];
  weight: WeightEntry[];

  pending: PendingItem[];
  skippedDuplicates: string[];
  /** Metas já existentes que ganharam vínculo com o id antigo (histórico preservado). */
  relinked?: Goal[];
  unknownSections: string[];
  ignoredLines: number;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function newIdFrom(prefix: string, seed: string): string {
  return `${prefix}_${slug(seed) || Math.random().toString(36).slice(2, 8)}`;
}

/* ────────────────────────── detecção de formato ────────────────────────── */

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function isBackup(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === 'MY PRIME' ||
    (Array.isArray(v.days) && Array.isArray(v.goals) && !!v.user && typeof v.user === 'object') ||
    (Array.isArray(v.goals) && Array.isArray(v.rules) && Array.isArray(v.rewards))
  );
}

/* ────────────────────────── parser de seções ────────────────────────── */

interface Section {
  /** título normalizado: identidade | metas | treino | regras | recompensas | leitura | financas | sono | ayanokoji | peso | outro */
  key: string;
  title: string;
  lines: string[];
}

const SECTION_KEYWORDS: { key: string; regex: RegExp }[] = [
  { key: 'identidade', regex: /identidade|quem sou|sobre mim|prop[oó]sito|n[aã]o aceito/i },
  { key: 'metas', regex: /metas?|objetivos?|prioridades/i },
  { key: 'regras', regex: /se[\s-]*ent[aã]o|implementa|inten[çc][oõ]es|regras/i },
  { key: 'recompensas', regex: /recompensa|pr[eê]mio|gratifica/i },
  { key: 'leitura', regex: /leitura|livros?|biblioteca/i },
  { key: 'financas', regex: /finan[çc]|or[çc]amento|dinheiro|gastos/i },
  { key: 'sono', regex: /sono|dormir|descanso/i },
  { key: 'ayanokoji', regex: /ayanokoji|protocolo|autocontrole/i },
  { key: 'peso', regex: /peso|medidas|pesagem|corpo/i },
  { key: 'treino', regex: /treino|academia|exerc[ií]cio|muscula|corrida/i },
];

function splitSections(text: string): { sections: Section[]; ignored: string[] } {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  const ignored: string[] = [];
  let current: Section | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Cabeçalhos markdown, "ÁREA:" isolada, ou "== TÍTULO =="
    const isHeading =
      /^#{1,4}\s+/.test(line) ||
      /^=+\s*.+\s*=+$/.test(line) ||
      /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ\s/&()]{2,40}:$/.test(line) ||
      /^\*\*[^*]+\*\*$/.test(line);

    if (isHeading) {
      const title = line.replace(/^#{1,4}\s+/, '').replace(/^=+|=+$/g, '').replace(/\*\*/g, '').replace(/:$/, '').trim();
      const match = SECTION_KEYWORDS.find((s) => s.regex.test(title));
      const key = match?.key ?? findAreaKey(title) ?? 'outro';
      // Seção desconhecida: as linhas dela não viram meta. Antes elas sumiam em
      // silêncio e o resumo dizia "0 seções não reconhecidas".
      if (key === 'outro' && title !== 'Início') ignored.push(title);
      current = { key, title, lines: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { key: 'outro', title: 'Início', lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }

  return { sections, ignored };
}

function findAreaKey(title: string): string | null {
  for (const area of Object.keys(AREA_HINTS)) {
    if (new RegExp(`^${area}$`, 'i').test(title)) return `área:${area}`;
  }
  return null;
}

function bullets(lines: string[]): string[] {
  return lines
    .map((l) => l.replace(/^([-*•·–—]|\d+[.)])\s+/, '').trim())
    .filter((l) => l.length >= 3);
}

/** Quantas linhas de uma seção `bullets()` descartou (curtas demais para virar meta). */
function droppedByBullets(lines: string[]): number {
  return lines.filter((l) => l.replace(/^([-*•·–—]|\d+[.)])\s+/, '').trim().length < 3).length;
}

/* ────────────────────────── regras / recompensas / livros ────────────────────────── */

function parseRules(lines: string[]): Rule[] {
  const rules: Rule[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^([-*•·]|\d+[.)])\s+/, '').trim();
    if (!line) continue;
    // "SE x ENTÃO y PORQUE z" (tolerante a maiúsculas/acentos e setas)
    const m = /^se\s+(.+?)\s*(?:,|→|->|ent[aã]o)\s*(?:ent[aã]o\s+)?(?:eu\s+)?(.+?)(?:\s*(?:porque|pois|pq)\s+(.+))?$/i.exec(line);
    if (!m) continue;
    const trigger = m[1]?.trim();
    const action = m[2]?.trim();
    if (!trigger || !action) continue;
    rules.push({
      id: newIdFrom('rule', `${trigger}-${action}`),
      trigger,
      action,
      reason: m[3]?.trim() ?? '',
      active: true,
      timesActivated: 0,
      successRate: 0,
      createdAt: new Date().toISOString(),
    });
  }
  return rules;
}

function parseRewards(lines: string[]): Reward[] {
  const rewards: Reward[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^([-*•·]|\d+[.)])\s+/, '').trim();
    if (!line) continue;
    // "Delivery → 7 dias seguidos com score > 7"
    const [namePart, criteriaPart] = line.split(/→|->|\s-\s|:\s/);
    const name = (namePart ?? '').replace(/^(recompensa|premio|prêmio)\s*:?\s*/i, '').trim();
    const criteria = (criteriaPart ?? '').trim();
    if (!name || name.length < 3) continue;

    const numbers = criteria.match(/\d+/g)?.map(Number) ?? [];
    const target = numbers[0] ?? 0;
    let criteriaType: Reward['criteriaType'] = 'streak';
    if (/%|consist/i.test(criteria)) criteriaType = 'consistency';
    else if (/score|nota/i.test(criteria)) criteriaType = 'score';
    else if (/seguid|streak|dias/i.test(criteria)) criteriaType = 'streak';

    rewards.push({
      id: newIdFrom('reward', name),
      name,
      criteria: criteria || 'Critério não informado no arquivo',
      criteriaType,
      target: target || 7,
      current: 0,
      unlocked: false,
    });
  }
  return rewards;
}

function parseBooks(lines: string[]): Book[] {
  const books: Book[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^([-*•·]|\d+[.)])\s+/, '').trim();
    if (!line) continue;
    // "Sapiens — Yuval Harari — 443 páginas"
    const parts = line.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
    const title = parts[0] ?? '';
    if (!title || title.length < 2) continue;
    const author = parts[1] && !/\d/.test(parts[1]) ? parts[1] : '';
    const pagesMatch = line.match(/(\d{2,4})\s*(p[aá]g|páginas|paginas|pgs?)/i);
    const totalPages = pagesMatch?.[1] ? Number(pagesMatch[1]) : 0;
    const currentMatch = line.match(/at[eé]\s*(?:a\s*)?p[aá]g(?:ina)?\s*(\d+)/i);
    books.push({
      id: newIdFrom('book', title),
      title,
      author,
      totalPages,
      currentPage: currentMatch?.[1] ? Number(currentMatch[1]) : 0,
      dailyGoal: { min: 10, ideal: 20, excellent: 30 },
      finished: false,
      log: [],
    });
  }
  return books;
}

function parseIdentity(lines: string[]): Partial<AppData['user']> {
  const user: Partial<AppData['user']> = {};
  for (const raw of lines) {
    const line = raw.replace(/^([-*•·]|\d+[.)])\s+/, '').trim();
    if (!line) continue;

    const pair = /^([^:]{2,32}):\s*(.+)$/.exec(line);
    if (pair?.[1] && pair[2]) {
      const label = pair[1].toLowerCase();
      const value = pair[2].trim();
      if (/nome|me chamo|sou o|sou a/.test(label)) user.name = value;
      else if (/quem sou|identidade|prop[oó]sito|quero da vida/.test(label)) user.identity = value;
      else if (/n[aã]o aceito|nunca mais|chega de/.test(label)) user.noMore = value;
      continue;
    }
    if (/^(me chamo|meu nome é|meu nome e)\s+/i.test(line)) {
      user.name = line.replace(/^(me chamo|meu nome é|meu nome e)\s+/i, '').trim();
    }
  }
  return user;
}

function parseAyanokoji(lines: string[]): { weeks?: number } {
  for (const raw of lines) {
    const m = /(\d{1,2})\s*semanas?/i.exec(raw);
    if (m?.[1]) return { weeks: Number(m[1]) };
  }
  return {};
}

function parseSettings(lines: string[]): Partial<AppData['settings']> {
  const settings: Partial<AppData['settings']> = {};
  for (const raw of lines) {
    const m = /(\d{1,2})[:h](\d{2})?/.exec(raw);
    if (!m) continue;
    const hour = String(Number(m[1])).padStart(2, '0');
    const minute = String(Number(m[2] ?? 0)).padStart(2, '0');
    const time = `${hour}:${minute}`;
    if (/matinal|manh[aã]|acordar/i.test(raw)) settings.morningReminder = time;
    else if (/noturn|noite|dormir|deitar/i.test(raw) && !/horas dormidas/i.test(raw)) {
      settings.nightReminder = time;
      settings.sleepGoalHours = Number(m[1]) + Number(m[2] ?? 0) / 60 >= 5 ? settings.sleepGoalHours : settings.sleepGoalHours;
    } else if (/meio do dia|almo[çc]o|13h|tarde/i.test(raw)) settings.middayCheckin = true;
  }
  const sleepGoal = /(?:dormir|sono)\D{0,12}(\d{1,2})(?:[h:](\d{2}))?/i.exec(lines.join(' '));
  if (sleepGoal?.[1]) settings.sleepGoalHours = Number(sleepGoal[1]) + Number(sleepGoal[2] ?? 0) / 60;
  return settings;
}

function parseFinance(lines: string[]): FinanceEntry[] {
  const entries: FinanceEntry[] = [];
  for (const raw of lines) {
    const m = /(r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i.exec(raw);
    if (!m?.[2]) continue;
    const amount = Number(m[2].replace(',', '.'));
    if (!amount) continue;
    const isIncome = /receita|ganh|entrada|sal[aá]rio/i.test(raw);
    const isImpulse = /impulso/i.test(raw);
    entries.push({
      id: newIdFrom('fin', raw),
      date: todayKey(),
      type: isIncome ? 'income' : 'expense',
      amount,
      category: guessFinanceCategory(raw),
      isImpulse,
      note: 'Importado do plano (revisar data)',
    });
  }
  return entries;
}

function guessFinanceCategory(line: string): string {
  if (/alimenta|comida|mercado|restaurante/i.test(line)) return 'Alimentação';
  if (/transporte|uber|ônibus|onibus|combust/i.test(line)) return 'Transporte';
  if (/lazer|cinema|jogo|assinatura/i.test(line)) return 'Lazer';
  if (/impulso/i.test(line)) return 'Impulso';
  if (/aluguel|fixo|conta|internet|luz/i.test(line)) return 'Fixo';
  if (/invest|poup|reserva/i.test(line)) return 'Investimento';
  return 'Outros';
}

/* ────────────────────────── pendências manuais ────────────────────────── */

function buildPending(summary: Omit<ImportSummary, 'pending'>, goalsBefore: Goal[], data: AppData): PendingItem[] {
  const pending: PendingItem[] = [];
  const push = (p: Omit<PendingItem, 'id'>) => pending.push({ id: `${p.kind}:${pending.length}`, ...p });
  // Backup parcial não pode derrubar a revisão de pendências.
  const finances = data.finances ?? [];
  const ayanokojiScores = data.ayanokoji?.scores ?? [];
  const days = data.days ?? [];

  // 1. Identidade
  if (!summary.user.identity || summary.user.identity.trim().length < 20) {
    push({
      kind: 'identity',
      severity: 'blocker',
      title: 'Escrever "Quem sou eu" (mín. 20 caracteres)',
      why: 'É a base do loop: sem direção escrita, o app não tem contra o que te cobrar. Não dá para inferir de um arquivo de metas.',
      where: 'Perfil → Identidade → editar',
      example: 'Quero ser alguém que treina mesmo sem vontade e termina o que começa.',
    });
  }
  if (!summary.user.noMore || summary.user.noMore.trim().length < 20) {
    push({
      kind: 'identity',
      severity: 'blocker',
      title: 'Escrever "O que NÃO aceito mais" (mín. 20 caracteres)',
      why: 'É o limite que você define para si. Só você sabe o que já não tolera.',
      where: 'Perfil → Identidade → editar',
      example: 'Não aceito mais prometer e não cumprir comigo mesmo.',
    });
  }

  // 2. Metas sem nível (só a pessoa sabe o que é mínimo/ideal/excelente)
  for (const goal of summary.goals) {
    const hasLevels = goal.min && goal.ideal && goal.excellent;
    if (!hasLevels) {
      push({
        kind: 'goal',
        severity: 'important',
        title: `Definir mín/ideal/excelente de "${goal.name}"`,
        why: 'O modo do dia escolhe o nível — sem os três valores, o checklist mínimo e o de ataque ficam iguais.',
        where: `Metas → ${goal.area} → ${goal.name}`,
        example: 'mín 3x · ideal 5x · excelente 6x',
      });
    }
    if (!goal.priority || goal.priority === 'normal') {
      push({
        kind: 'goal',
        severity: 'important',
        title: `Confirmar prioridade de "${goal.name}"`,
        why: 'Prioridade alta gera cobrança direta no fechamento do dia. Se tudo for normal, nada é cobrado.',
        where: `Metas → ${goal.area} → ${goal.name}`,
        example: '🔴 para no máximo 3 metas',
      });
    }
  }

  // 3. Regras
  if (!summary.rules.length) {
    push({
      kind: 'rule',
      severity: 'important',
      title: 'Criar pelo menos 1 regra SE-ENTÃO',
      why: 'Regra SE-ENTÃO é o que liga gatilho a ação sem depender de motivação. Não aparece em lista de metas.',
      where: 'Inteligência → Regras SE-ENTÃO → + Nova',
      example: 'SE eu chegar em casa cansado → ENTÃO faço 15min de treino mínimo.',
    });
  }

  // 4. Recompensas
  if (!summary.rewards.length) {
    push({
      kind: 'reward',
      severity: 'optional',
      title: 'Definir 1 recompensa com critério verificável',
      why: 'Sem recompensa real, o loop começa em cobrança e termina em cobrança.',
      where: 'Perfil → Recompensas → + Nova',
      example: 'Delivery → 7 dias seguidos com score ≥ 7',
    });
  }

  // 5. Leitura
  if (!summary.books.length) {
    push({
      kind: 'reading',
      severity: 'optional',
      title: 'Cadastrar o livro atual e a página',
      why: 'O módulo de leitura calcula ritmo e previsão de término a partir da página atual.',
      where: 'Metas → Leitura → + Livro',
      example: 'Sapiens — Yuval Harari — 443 páginas — página 120',
    });
  }

  // 6. Finanças
  const financeGoals = summary.goals.filter((g) => g.area === 'Finanças');
  if (financeGoals.length && !finances.length) {
    push({
      kind: 'finance',
      severity: 'optional',
      title: 'Lançar receitas/despesas reais do mês',
      why: 'O plano traz a intenção, não os números. Gráficos de finanças sem lançamento ficam vazios.',
      where: 'Metas → Finanças → + Lançamento',
      example: 'R$ 250 · Alimentação · 05/11',
    });
  }

  // 7. Sono
  if (summary.goals.some((g) => g.area === 'Sono')) {
    push({
      kind: 'sleep',
      severity: 'optional',
      title: 'Registrar horário de dormir e acordar de ontem',
      why: 'A correlação "sono < 6h → score cai X" só existe com horas registradas por noite.',
      where: 'Metas → Sono avançado → + Registrar',
    });
  }

  // 8. Ayanokoji sem nota semanal
  if (ayanokojiScores.length === 0) {
    push({
      kind: 'dia',
      severity: 'optional',
      title: 'Dar as 4 notas semanais do Protocolo Ayanokoji',
      why: 'O radar é autoavaliação: nenhum arquivo consegue dizer seu nível de autocontrole.',
      where: 'Metas → Protocolo Ayanokoji → avaliar semana',
      example: 'Autocontrole 6 · Comunicação 5 · Disciplina 7 · Observação 5',
    });
  }

  // 9. Diário de hoje
  if (!days.some((d) => d.date === todayKey())) {
    push({
      kind: 'dia',
      severity: 'blocker',
      title: 'Fazer o check-in de hoje (energia + modo)',
      why: 'O dia de hoje nunca vem do arquivo: o modo depende da sua energia de agora.',
      where: 'Aba Hoje → card "Como você está?"',
    });
  }

  // 10. Duplicatas
  if (summary.skippedDuplicates.length) {
    push({
      kind: 'goal',
      severity: 'optional',
      title: `Revisar ${summary.skippedDuplicates.length} item(ns) que já existiam`,
      why: 'Não dupliquei metas para não inflar o checklist. Confira se a versão antiga ainda é a certa.',
      where: 'Metas',
      example: summary.skippedDuplicates.slice(0, 3).join(' · '),
    });
  }

  void goalsBefore;
  return pending;
}

/* ────────────────────────── entrada principal ────────────────────────── */

export function readPlan(text: string, filename: string, current: AppData): ImportSummary {
  const today = todayKey();
  const parsedJson = tryParseJson(text);

  // A) Backup completo do app
  if (parsedJson && isBackup(parsedJson)) {
    const backup = parsedJson as AppData;
    // Arquivo pode estar incompleto (versão antiga, editado à mão, truncado).
    // Normalizar aqui evita `undefined.length` mais adiante.
    const full: AppData = {
      ...current,
      user: {
        ...current.user,
        ...backup.user,
        name: backup.user?.name ?? current.user.name,
        identity: backup.user?.identity ?? current.user.identity,
        noMore: backup.user?.noMore ?? current.user.noMore,
        createdAt: backup.user?.createdAt ?? current.user.createdAt,
        areas: backup.user?.areas ?? [],
      },
      goals: backup.goals ?? [],
      days: backup.days ?? [],
      rules: backup.rules ?? [],
      rewards: backup.rewards ?? [],
      books: backup.books ?? [],
      finances: backup.finances ?? [],
      weight: backup.weight ?? [],
      settings: { ...current.settings, ...(backup.settings ?? {}) },
      badges: backup.badges ?? [],
      ayanokoji: backup.ayanokoji ?? current.ayanokoji,
      weeklyFocus: backup.weeklyFocus ?? {},
      routeAdjustments: backup.routeAdjustments ?? {},
      // Log de emoções entra pelo mesmo caminho dos dias: sanitizado.
      emotions: sanitizeEmotionLog((backup as { emotions?: unknown }).emotions),
      onboarded: true,
    };
    const summary: Omit<ImportSummary, 'pending'> = {
      source: 'backup',
      filename,
      goals: full.goals,
      areas: full.user.areas,
      rules: full.rules,
      rewards: full.rewards,
      books: full.books,
      settings: full.settings,
      user: full.user,
      ayanokoji: {},
      full,
      counts: {
        days: full.days.length,
        finances: full.finances.length,
        weight: full.weight.length,
        badges: full.badges.filter((b) => b.unlockedAt).length,
      },
      finances: full.finances,
      weight: full.weight,
      skippedDuplicates: [],
      unknownSections: [],
      ignoredLines: 0,
    };
    return { ...summary, pending: buildPending(summary, current.goals, full) };
  }

  // B) JSON de plano (metas, regras, recompensas, livros)
  if (parsedJson && typeof parsedJson === 'object') {
    const obj = parsedJson as Record<string, unknown>;
    const goalsRaw = Array.isArray(obj.goals) ? obj.goals : Array.isArray(obj.metas) ? obj.metas : [];
    if (goalsRaw.length) {
      const planJson = JSON.stringify({
        goals: goalsRaw.map((g) => {
          const item = g as Record<string, unknown>;
          return {
            name: item.name ?? item.nome,
            area: item.area ?? item.categoria,
            priority: item.priority ?? item.prioridade,
            min: item.min,
            ideal: item.ideal,
            excellent: item.excellent ?? item.excelente,
          };
        }),
      });
      const parsed = parsePlans(planJson, 'plan.json');
      const goals = mergeGoals(parsed.goals.map(toGoal), current.goals);
      const rules = Array.isArray(obj.rules) ? (obj.rules as Rule[]).map((r) => ({ ...r, id: r.id ?? newIdFrom('rule', `${r.trigger}${r.action}`) })) : [];
      const rewards = Array.isArray(obj.rewards) ? (obj.rewards as Reward[]) : [];
      const books = Array.isArray(obj.books) ? (obj.books as Book[]) : [];
      const summary: Omit<ImportSummary, 'pending'> = {
        source: 'plan-json',
        filename,
        goals: goals.fresh,
        areas: Array.from(new Set(goals.fresh.map((g) => g.area))),
        rules,
        rewards,
        books,
        settings: {},
        user: {},
        ayanokoji: {},
        counts: { days: 0, finances: 0, weight: 0, badges: 0 },
        finances: [],
        weight: [],
        skippedDuplicates: goals.skipped,
        relinked: goals.relinked,
        unknownSections: [],
        ignoredLines: 0,
      };
      return { ...summary, pending: buildPending(summary, current.goals, current) };
    }
  }

  // C) Plano em texto livre
  void today;
  const { sections, ignored } = splitSections(text);
  // Seção fora do vocabulário conhecido entra na lista de "não reconhecidas".
  const unknownSections: string[] = [...ignored];
  const rules: Rule[] = [];
  const rewards: Reward[] = [];
  const books: Book[] = [];
  let user: Partial<AppData['user']> = {};
  let settings: Partial<AppData['settings']> = {};
  let ayanokoji: { weeks?: number } = {};
  let finances: FinanceEntry[] = [];
  let weight: WeightEntry[] = [];

  const goalCandidates: (GoalLine & { area: string })[] = [];
  // Linhas que o parser leu e NÃO aproveitou (nome curto demais, linha de
  // configuração, ruído). Antes o resumo sempre dizia 0 e o usuário não sabia
  // que metade do arquivo tinha sido ignorada.
  let ignoredCount = 0;
  const ignore = () => {
    ignoredCount += 1;
  };

  for (const section of sections) {
    if (section.key.startsWith('área:')) {
      const area = section.key.slice('área:'.length);
      ignoredCount += droppedByBullets(section.lines);
      for (const line of bullets(section.lines)) {
        const parsedLine = parseGoalLine(line);
        if (!parsedLine.name) {
          ignore();
          continue;
        }
        goalCandidates.push({
          name: parsedLine.name,
          area,
          priority: parsedLine.priority,
          min: parsedLine.min,
          ideal: parsedLine.ideal,
          excellent: parsedLine.excellent,
        });
      }
      continue;
    }

    switch (section.key) {
      case 'identidade':
        user = { ...user, ...parseIdentity(section.lines) };
        break;
      case 'metas':
      case 'treino':
      case 'leitura':
      case 'sono':
      case 'financas':
      case 'ayanokoji':
      case 'peso': {
        const areaFromKey =
          section.key === 'metas' ? null : (Object.keys(AREA_HINTS).find((a) => AREA_HINTS[a]!.test(section.title)) ?? null);
        ignoredCount += droppedByBullets(section.lines);
        for (const line of bullets(section.lines)) {
          if (section.key === 'leitura' && /—|–|->/.test(line)) {
            books.push(...parseBooks([line]));
            continue;
          }
          if (section.key === 'financas' && /r\$|\d+[.,]\d{2}/i.test(line)) {
            finances = [...finances, ...parseFinance([line])];
          }
          if (section.key === 'peso' && /\d+([.,]\d+)?\s*(kg|cm)/i.test(line)) {
            const kg = /(\d{2,3}(?:[.,]\d)?)\s*kg/i.exec(line);
            if (kg?.[1]) weight = [...weight, { date: today, kg: Number(kg[1].replace(',', '.')) }];
            continue;
          }
          if (section.key === 'ayanokoji') {
            ignore();
            continue;
          }
          // Linhas que são configuração/registro não viram meta.
          const isSettingLine =
            (section.key === 'sono' && /lembrete|meta de sono|\d{1,2}[:h]\d{2}/i.test(line)) ||
            (section.key === 'financas' && /r\$\s*\d+[.,]\d{2}/i.test(line));
          if (isSettingLine) {
            ignore();
            continue;
          }

          const area = areaFromKey ?? guessArea(line) ?? 'Projeto Pessoal';
          const parsedLine = parseGoalLine(line);
          if (!parsedLine.name || parsedLine.name.length < 3) {
            ignore();
            continue;
          }
          goalCandidates.push({
            name: parsedLine.name,
            area,
            priority: parsedLine.priority,
            min: parsedLine.min,
            ideal: parsedLine.ideal,
            excellent: parsedLine.excellent,
          });
        }
        if (section.key === 'ayanokoji') ayanokoji = parseAyanokoji(section.lines);
        if (section.key === 'sono') settings = { ...settings, ...parseSettings(section.lines) };
        break;
      }
      case 'regras':
        rules.push(...parseRules(section.lines));
        break;
      case 'recompensas':
        rewards.push(...parseRewards(section.lines));
        break;
      default:
        // Seção desconhecida já foi contabilizada em splitSections. O bloco
        // "Início" (texto antes de qualquer cabeçalho) não tem título: cada
        // linha ali foi lida e descartada — antes isso dava `ignoredLines: 0`
        // e o usuário achava que o arquivo inteiro tinha sido usado.
        if (section.title === 'Início') ignoredCount += section.lines.length;
        break;
    }
  }

  const dedupedCandidates = dedupeCandidates(goalCandidates);
  const merged = mergeGoals(dedupedCandidates.map(toGoal), current.goals);

  const summary: Omit<ImportSummary, 'pending'> = {
    source: 'plan-text',
    filename,
    goals: merged.fresh,
    areas: Array.from(new Set(merged.fresh.map((g) => g.area))),
    rules,
    rewards,
    books,
    settings,
    user,
    ayanokoji,
    counts: { days: 0, finances: finances.length, weight: weight.length, badges: 0 },
    finances,
    weight,
    skippedDuplicates: merged.skipped,
    relinked: merged.relinked,
    unknownSections,
    ignoredLines: ignoredCount,
  };
  return { ...summary, pending: buildPending(summary, current.goals, current) };
}

interface GoalLine {
  name: string;
  min?: string;
  ideal?: string;
  excellent?: string;
  priority: 'high' | 'normal' | 'low';
}

/** "Treinar 5x | mín 3x | ideal 5x | excelente 6x | prioridade" */
export function parseGoalLine(line: string): GoalLine {
  const segments = line.split(/\s*[|;]\s*/).map((x) => x.trim()).filter(Boolean);
  let min: string | undefined;
  let ideal: string | undefined;
  let excellent: string | undefined;
  let priority: GoalLine['priority'] = 'normal';
  const nameParts: string[] = [];

  for (const seg of segments) {
    const level = /^m[ií]n(?:imo)?\s*[:=]?\s*(.+)$/i.exec(seg);
    const idealM = /^ideal\s*[:=]?\s*(.+)$/i.exec(seg);
    const exc = /^(?:exc(?:elente)?|m[aá]ximo)\s*[:=]?\s*(.+)$/i.exec(seg);
    if (level?.[1]) min = level[1].trim();
    else if (idealM?.[1]) ideal = idealM[1].trim();
    else if (exc?.[1]) excellent = exc[1].trim();
    else if (/^prioridade(\s+(alta|m[aá]xima))?$/i.test(seg)) priority = 'high';
    else if (/^prioridade\s+baixa$/i.test(seg) || /^opcional$/i.test(seg)) priority = 'low';
    else nameParts.push(seg);
  }

  const name = nameParts.join(' ').replace(/\s{2,}/g, ' ').trim();
  if (!min && !ideal && !excellent) {
    const low = /prioridade|urgente|essencial/i.test(name) ? 'high' : /opcional|se der/i.test(name) ? 'low' : priority;
    priority = low;
  }
  return { name, min, ideal, excellent, priority };
}

function dedupeCandidates(items: (GoalLine & { area: string })[]) {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.area}|${i.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return i.name.length >= 3 && i.name.length <= 120;
  });
}

function toGoal(candidate: GoalLine & { area: string }): Goal {
  // Níveis por área só quando o arquivo não traz: é o único "default" do sistema,
  // e a pendência "definir mín/ideal/excelente" avisa que precisa revisar.
  const levels = levelsFor(candidate.area);
  return {
    id: newIdFrom('goal', `${candidate.area}-${candidate.name}`),
    name: candidate.name,
    area: candidate.area,
    priority: candidate.priority,
    min: candidate.min ?? levels[0],
    ideal: candidate.ideal ?? levels[1],
    excellent: candidate.excellent ?? levels[2],
    active: true,
    createdAt: new Date().toISOString(),
  };
}

function levelsFor(area: string): [string, string, string] {
  switch (area) {
    case 'Leitura':
      return ['10 páginas', '20 páginas', '30 páginas'];
    case 'Finanças':
      return ['1 registro', '1 registro/dia', 'revisão semanal'];
    case 'Sono':
      return ['7h', '7h30', '8h'];
    case 'Treino':
      return ['15min', '45min', '1h30'];
    case 'Estudo':
      return ['30min', '2h', '4h'];
    default:
      return ['15min', '30min', '1h'];
  }
}

const goalKey = (g: Goal) => `${g.area}|${g.name.toLowerCase().replace(/\s+/g, ' ').trim()}`;

function mergeGoals(
  incoming: Goal[],
  existing: Goal[],
): { fresh: Goal[]; skipped: string[]; relinked: Goal[] } {
  const byKey = new Map(existing.filter((g) => !g.archived).map((g) => [goalKey(g), g]));
  const claimed = new Set(existing.filter((g) => !g.archived).map((g) => g.id));
  const fresh: Goal[] = [];
  const skipped: string[] = [];
  const relinked: Goal[] = [];

  for (const goal of incoming) {
    const key = goalKey(goal);
    const same = byKey.get(key);
    // Já existe meta com mesmo nome/área: não duplica (senão inflaria o checklist),
    // mas garante o vínculo com o id antigo — o histórico do dia não pode ficar órfão.
    if (same) {
      skipped.push(`${goal.area}: ${goal.name}`);
      if (same.id !== goal.id && same.originId !== goal.id) {
        relinked.push({ ...same, originId: same.originId ?? goal.id });
      }
      continue;
    }
    if (claimed.has(goal.id)) {
      skipped.push(`${goal.area}: ${goal.name}`);
      continue;
    }
    claimed.add(goal.id);
    fresh.push(goal);
  }
  return { fresh, skipped, relinked };
}

/* ────────────────────────── template ────────────────────────── */

export const PLAN_TEMPLATE = `# IDENTIDADE
Nome: Seu nome
Quem sou: escreva em uma frase a pessoa que você está construindo (mín. 20 caracteres)
Não aceito mais: o que você não tolera mais em você (mín. 20 caracteres)

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
- Meta de sono: dormir 7h30

# REGRAS SE-ENTÃO
- SE eu chegar em casa cansado → ENTÃO faço 15min de treino mínimo PORQUE mato a resistência inicial
- SE eu pegar o celular na cama → ENTÃO leio 10 páginas antes

# RECOMPENSAS
- Delivery no fim de semana → 7 dias seguidos com score ≥ 7
- Cinema → 85% de consistência em 14 dias

# PROTOCOLO AYANOKOJI
- 24 semanas
- Autocontrole 6 | Comunicação 5 | Disciplina 7 | Observação 5

# SONO
- Lembrete matinal 07:00
- Lembrete noturno 21:00
- Meta de sono 7h30
`;
