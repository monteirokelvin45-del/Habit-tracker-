import { differenceInCalendarDays, parseISO } from 'date-fns';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** YYYY-MM-DD no fuso local (nunca usar toISOString, que volta para UTC). */
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toKey(new Date());
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}

export function longDate(key: string): string {
  const d = keyToDate(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function shortDate(key: string): string {
  const d = keyToDate(key);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const d = keyToDate(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

export function weekdayShort(key: string): string {
  return WEEKDAYS_SHORT[keyToDate(key).getDay()] ?? '';
}

export function weekdayIndex(key: string): number {
  return keyToDate(key).getDay();
}

/** "Bom dia" 5–11, "Boa tarde" 12–17, "Boa noite" 18–4. */
export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function currentHour(): number {
  return new Date().getHours();
}

/** Segunda-feira da semana da data (ISO). */
export function weekStart(key: string): string {
  const d = keyToDate(key);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return toKey(d);
}

export function weekKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
}

export function lastNDays(n: number, end = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, -(n - 1 - i)));
}

export function lastNWeeks(n: number, end = todayKey()): string[] {
  const thisWeek = weekStart(end);
  return Array.from({ length: n }, (_, i) => addDays(thisWeek, -7 * (n - 1 - i)));
}

export function quarterOf(key: string): { year: number; quarter: number } {
  const d = keyToDate(key);
  return { year: d.getFullYear(), quarter: Math.floor(d.getMonth() / 3) + 1 };
}

export function quarterLabel(q: { year: number; quarter: number }): string {
  return `${q.quarter}º trimestre / ${q.year}`;
}

export function daysInMonth(year: number, month: number): string[] {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => toKey(new Date(year, month, i + 1, 12)));
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function parseDurationToMinutes(text: string): number {
  if (!text) return 0;
  const t = text.toLowerCase().replace(',', '.').trim();
  // "1h30", "1h 30min", "1:30" → horas E minutos. Antes o "30" era engolido.
  const both = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hora[s]?)\s*(\d+)\s*(?:m|min|minuto[s]?)?/);
  if (both && both[1] && both[2]) return Math.round(parseFloat(both[1]) * 60 + parseInt(both[2], 10));
  const hMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hora[s]?)/);
  const mMatch = t.match(/(\d+)\s*(?:m|min|minuto[s]?)/);
  if (hMatch && hMatch[1]) return Math.round(parseFloat(hMatch[1]) * 60 + (mMatch && mMatch[1] ? parseInt(mMatch[1], 10) : 0));
  if (mMatch && mMatch[1]) return parseInt(mMatch[1], 10);
  const num = t.match(/(\d+)/);
  return num && num[1] ? parseInt(num[1], 10) : 0;
}

export function relevantDateLabel(count: number): string {
  return `${count} ${count === 1 ? 'dia' : 'dias'}`;
}

export { MONTHS, MONTHS_SHORT, WEEKDAYS, WEEKDAYS_SHORT };
