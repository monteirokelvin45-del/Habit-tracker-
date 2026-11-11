import type { Goal } from './types';
import { newId } from './id';

/**
 * Extração de metas/áreas de um plano enviado pelo usuário (.txt/.md/.json).
 * Pattern matching conservador: melhor importar menos e certo do que inventar.
 */

export const KNOWN_AREAS = [
  'Treino',
  'Estudo',
  'Finanças',
  'Leitura',
  'Sono',
  'Relacionamentos',
  'Espiritualidade',
  'Trabalho',
  'Projeto Pessoal',
  'Saúde',
];

export const AREA_HINTS: Record<string, RegExp> = {
  Treino: /trein|academia|muscula|correr|corrida|exercíc|exercic|cardio|yoga/i,
  Estudo: /estud|concurso|faculdade|curso|matéria|materia|prova/i,
  Finanças: /financ|dinheiro|poup|invest|orçament|orcament|economiz/i,
  Leitura: /lei(?:o|tura)|livro|páginas|paginas|ler\b/i,
  Sono: /dorm|sono|acordar|deitar/i,
  Relacionamentos: /famíl|famil|amig|namorad|esposa|marido|relacion/i,
  Espiritualidade: /orar|oração|oracao|medita|espiritual|igreja|gratid/i,
  Trabalho: /trabalh|carreira|promoç|promoc|client|freela/i,
  'Projeto Pessoal': /projeto|negócio|negocio|app|blog|canal|lançar|lancar/i,
  Saúde: /saúde|saude|médic|medic|peso|dieta|água|agua|alongam/i,
};

const MIN_IDEAL: Record<string, [string, string, string]> = {
  default: ['15min', '30min', '1h'],
  Leitura: ['10 páginas', '20 páginas', '30 páginas'],
  Finanças: ['1 registro', '1 registro/dia', 'revisão semanal'],
  Sono: ['7h', '7h30', '8h'],
  Treino: ['15min', '45min', '1h30'],
  Estudo: ['30min', '2h', '4h'],
};

export interface ParsedGoal {
  name: string;
  area: string;
  priority: 'high' | 'normal' | 'low';
}

export interface ParseResult {
  goals: ParsedGoal[];
  areas: string[];
  ignoredLines: number;
}

export function guessArea(line: string): string | null {
  for (const [area, regex] of Object.entries(AREA_HINTS)) {
    if (regex.test(line)) return area;
  }
  return null;
}

function guessPriority(line: string): 'high' | 'normal' | 'low' {
  if (/prioridade|urgente|essencial|principal|crític|critic/i.test(line)) return 'high';
  if (/opcional|se der|quando possível|quando possivel|baixa/i.test(line)) return 'low';
  return 'normal';
}

function cleanName(line: string): string {
  return line
    .replace(/^[\s\-*•·–—#>\d.)]+/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[.;]+$/, '')
    .trim();
}

export function parsePlans(text: string, filename = ''): ParseResult {
  const goals: ParsedGoal[] = [];

  // JSON: tenta formato direto {goals:[...]} ou array de metas.
  if (filename.toLowerCase().endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      const data = JSON.parse(text);
      const list: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.goals) ? data.goals : [];
      for (const raw of list) {
        const item = raw as Record<string, unknown>;
        const name = String(item.name ?? item.meta ?? item.title ?? '').trim();
        if (!name) continue;
        const area = String(item.area ?? item.categoria ?? guessArea(name) ?? 'Projeto Pessoal');
        const priorityRaw = String(item.priority ?? '').toLowerCase();
        goals.push({
          name,
          area,
          priority: priorityRaw === 'high' || priorityRaw === 'alta' ? 'high' : priorityRaw === 'low' || priorityRaw === 'baixa' ? 'low' : 'normal',
        });
      }
      if (goals.length) {
        return { goals: dedupe(goals), areas: Array.from(new Set(goals.map((g) => g.area))), ignoredLines: 0 };
      }
    } catch {
      // segue para o parser de texto
    }
  }

  const lines = text.split(/\r?\n/);
  let currentArea: string | null = null;
  let ignored = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Cabeçalho de área: "## Treino" ou "Treino:" ou "ÁREA: Treino"
    const known = KNOWN_AREAS.find((a) => new RegExp(`^(${a})[:\\s]?$`, 'i').test(line.replace(/^#+\s*/, '')));
    if (known) {
      currentArea = known;
      continue;
    }
    const areaHeader = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ\s]{2,20}):\s*$/.exec(line);
    if (areaHeader?.[1]) {
      currentArea = areaHeader[1].trim();
      continue;
    }

    const isBullet = /^([-*•·–—]|\d+[.)])\s+/.test(line);
    // Fora de bullet, só aceita intenção explícita no começo da frase ("Quero...", "Meta: ...").
    const looksLikeGoal = isBullet || /^(quero|vou|pretendo|preciso|meta\s*[:—-]|objetivo\s*[:—-])/i.test(line);
    if (!looksLikeGoal) {
      ignored += 1;
      continue;
    }

    const cleaned = cleanName(line);
    if (cleaned.length < 4 || cleaned.length > 90) {
      ignored += 1;
      continue;
    }

    const area = currentArea ?? guessArea(cleaned) ?? 'Projeto Pessoal';
    goals.push({ name: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), area, priority: guessPriority(line) });
  }

  const deduped = dedupe(goals);
  return {
    goals: deduped,
    areas: Array.from(new Set(deduped.map((g) => g.area))),
    ignoredLines: ignored,
  };
}

function dedupe(goals: ParsedGoal[]): ParsedGoal[] {
  const seen = new Set<string>();
  return goals.filter((g) => {
    const key = g.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toGoals(parsed: ParsedGoal[]): Goal[] {
  return parsed.map((p) => {
    const levels = MIN_IDEAL[p.area] ?? MIN_IDEAL.default!;
    return {
      id: newId('goal'),
      name: p.name,
      area: p.area,
      priority: p.priority,
      min: levels[0]!,
      ideal: levels[1]!,
      excellent: levels[2]!,
      active: true,
      createdAt: new Date().toISOString(),
    };
  });
}
