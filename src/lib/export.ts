import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { AppData } from './types';
import { SCHEMA_VERSION } from './storage';
import { colors } from '../theme';
import { areaConsistency, closedDays, failureMap, topExcuse } from './insights';
import { avg, round1 } from './score';
import { monthLabel, todayKey, daysInMonth } from './date';

/** Exporta todos os dados como JSON e abre o share sheet. */
export async function exportJson(data: AppData): Promise<string | null> {
  const payload = {
    app: 'MY PRIME',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    settings: data.settings,
    user: data.user,
    goals: data.goals,
    days: data.days,
    rules: data.rules,
    rewards: data.rewards,
    books: data.books,
    finances: data.finances,
    weight: data.weight,
    badges: data.badges,
    ayanokoji: data.ayanokoji,
    weeklyFocus: data.weeklyFocus,
    routeAdjustments: data.routeAdjustments,
    emotions: data.emotions,
    // Formato explícito: um backup sem esta chave é lido como v0.
    schemaVersion: SCHEMA_VERSION,
  };
  const json = JSON.stringify(payload, null, 2);

  if (Platform.OS === 'web') {
    return json;
  }

  try {
    // SDK 54: API nova de arquivos (File/Paths) no lugar do antigo cacheDirectory.
    const file = new File(Paths.cache, `myprime-backup-${todayKey()}.json`);
    file.create({ overwrite: true });
    file.write(json);
    const uri = file.uri;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Exportar dados MY PRIME' });
      return uri;
    }
    // Sem share sheet (emulador sem app de arquivos): devolve o conteúdo para a tela exibir/copiar.
    return json;
  } catch (e) {
    console.warn('[MY PRIME] exportJson', e);
    return null;
  }
}

/** Relatório mensal em PDF (capa, score, série diária, radar de áreas, padrões). */
export async function exportPdf(data: AppData, reference = todayKey()): Promise<string | null> {
  const html = buildReportHtml(data, reference);
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Relatório MY PRIME' });
    }
    return uri;
  } catch (e) {
    console.warn('[MY PRIME] exportPdf', e);
    return null;
  }
}

function bar(pct: number, color: string): string {
  return `<div style="height:6px;background:#2A2A2A;border-radius:3px;overflow:hidden">
    <div style="height:6px;width:${Math.max(0, Math.min(100, pct))}%;background:${color};border-radius:3px"></div></div>`;
}

/** Compartilha (ou baixa, no web) o modelo de plano em Markdown. */
export async function sharePlanTemplate(): Promise<string | null> {
  const { PLAN_TEMPLATE } = await import('./importer');
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([PLAN_TEMPLATE], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-prime-plano-modelo.md';
      a.click();
      URL.revokeObjectURL(url);
      return null;
    } catch {
      return PLAN_TEMPLATE;
    }
  }
  try {
    const file = new File(Paths.cache, 'my-prime-plano-modelo.md');
    file.create({ overwrite: true });
    file.write(PLAN_TEMPLATE);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: 'Modelo de plano MY PRIME' });
      return file.uri;
    }
    return PLAN_TEMPLATE;
  } catch (e) {
    console.warn('[MY PRIME] template', e);
    return null;
  }
}

export function buildReportHtml(data: AppData, reference = todayKey()): string {
  const year = Number(reference.slice(0, 4));
  const month = Number(reference.slice(5, 7)) - 1;
  const dates = daysInMonth(year, month);
  const monthDays = closedDays(data.days).filter((d) => dates.includes(d.date));
  const score = avg(monthDays.map((d) => d.score?.total ?? 0));
  const consistency = areaConsistency(data, dates);
  const excuse = topExcuse(data);
  const failures = failureMap(data);

  const points = dates.map((d) => {
    const day = data.days.find((x) => x.date === d);
    return { label: d.slice(8, 10), value: day?.score?.total ?? null };
  });
  const width = 640;
  const height = 180;
  const max = 10;
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((p, i) => (p.value == null ? null : `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(height - (p.value / max) * height).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');

  const radarMax = Math.max(1, ...consistency.map((c) => c.score ?? 0));
  const radarBars = consistency
    .filter((c) => c.score != null)
    .map(
      (c) => `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#888">
          <span>${c.area}</span><span>${c.score?.toFixed(1)}/10</span>
        </div>
        ${bar(((c.score ?? 0) / 10) * 100, '#00FF88')}
      </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, sans-serif; background:#0A0A0A; color:#FFF; margin:0; padding:32px; }
  .cover { border:1px solid #2A2A2A; border-radius:16px; padding:28px; margin-bottom:20px; }
  h1 { font-size:30px; margin:0; color:#00FF88; letter-spacing:2px; }
  h2 { font-size:16px; margin:24px 0 8px; color:#FFF; }
  .muted { color:#888; font-size:12px; }
  .card { border:1px solid #2A2A2A; border-radius:16px; padding:16px; margin-bottom:12px; }
  .big { font-size:40px; font-weight:800; color:#00FF88; }
  .grid { display:flex; gap:12px; }
  .grid > div { flex:1; }
  .table { width:100%; border-collapse:collapse; font-size:12px; }
  .table td, .table th { text-align:left; padding:6px 4px; border-bottom:1px solid #2A2A2A; color:#CCC; }
</style></head>
<body>
  <div class="cover">
    <h1>MY PRIME</h1>
    <div class="muted">Relatório ${monthLabel(reference)}</div>
    <div class="muted" style="margin-top:8px">Disciplina é sistema, não humor · loop: intenção → execução → registro → análise → correção → recompensa</div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="muted">SCORE MÉDIO DO MÊS</div>
      <div class="big">${score != null ? round1(score).toFixed(1) : '—'}</div>
      <div class="muted">${monthDays.length} dia(s) encerrados de ${dates.length}</div>
    </div>
    <div class="card">
      <div class="muted">CONSISTÊNCIA MÉDIA</div>
      <div class="big">${consistency.length ? round1(avg(consistency.map((c) => c.score ?? 0)) ?? 0).toFixed(1) : '—'}</div>
      <div class="muted">média das áreas registradas</div>
    </div>
  </div>

  <h2>Score diário</h2>
  <div class="card">
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}">
      <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#2A2A2A" />
      <line x1="0" y1="0" x2="${width}" y2="0" stroke="#2A2A2A" />
      ${path ? `<path d="${path}" fill="none" stroke="#00FF88" stroke-width="2" />` : ''}
    </svg>
    <div class="muted">${points.length} pontos · dias sem registro não são interpolados</div>
  </div>

  <h2>Equilíbrio por área</h2>
  <div class="card">${radarBars || '<div class="muted">Sem dado</div>'}<div class="muted">Escala 0-10 relativa (max ${radarMax.toFixed(0)} neste mês)</div></div>

  <h2>Top padrões</h2>
  <div class="card">
    <table class="table">
      <tr><th>Padrão</th><th>Ocorrências</th></tr>
      <tr><td>Desculpa dominante</td><td>${excuse.value ? `${excuse.value.type} / ${excuse.value.legitimacy}` : 'Sem dado'}</td></tr>
      ${(failures.sequences.length ? failures.sequences : []).map((f) => `<tr><td>${f.label}</td><td>${f.count}x</td></tr>`).join('')}
      <tr><td>Fim de semana vs semana</td><td>${failures.weekendDrop != null ? `${failures.weekendDrop}% de queda` : 'Sem dado'}</td></tr>
    </table>
  </div>

  <div class="muted" style="margin-top:24px">Gerado localmente pelo MY PRIME · ${new Date().toLocaleString('pt-BR')} · nenhum padrão é exibido com menos de 7 dias de dados.</div>
</body></html>`;
}

export const PDF_COLORS = colors;
