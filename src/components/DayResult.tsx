import React from 'react';
import { View } from 'react-native';
import { colors, scoreColor, scoreLabel, spacing } from '../theme';
import { Card, Muted, Row, Txt } from './ui';
import { ScoreRing } from '../lib/anim';
import { CLOSING_LINE, chargeLines, goalForTask, victoryLine } from '../lib/score';
import type { Day, Goal } from '../lib/types';

const FACTORS: { key: keyof NonNullable<Day['score']>; label: string; weight: string }[] = [
  { key: 'regularity', label: 'Regularidade', weight: '30%' },
  { key: 'continuity', label: 'Continuidade', weight: '20%' },
  { key: 'recovery', label: 'Recuperação', weight: '15%' },
  { key: 'honesty', label: 'Honestidade', weight: '15%' },
  { key: 'progress', label: 'Progresso real', weight: '20%' },
];

/** Seção 4 — Resultado do dia: score + vitória + cobrança + fechamento. */
export function DayResult({ day, goals, animate = true }: { day: Day; goals: Goal[]; animate?: boolean }) {
  if (!day.score) {
    return (
      <Card>
        <Muted>Dia ainda não encerrado. O score aparece depois do diário.</Muted>
      </Card>
    );
  }
  const score = day.score.total;
  const color = scoreColor(score);
  const charges = chargeLines(day, goals);

  const doneTasks = day.tasks.filter((t) => t.done);
  const highlightGoal = doneTasks
    .map((t) => goalForTask(goals, t))
    .find((g) => g?.priority === 'high') ?? (doneTasks[0] ? goalForTask(goals, doneTasks[0]) : undefined);
  const highlight = highlightGoal
    ? `${highlightGoal.name} (${highlightGoal.area}) entregue${doneTasks.length > 1 ? ` — ${doneTasks.length} tarefas no total` : ''}.`
    : day.diary.smallWin.trim() || 'Sem tarefa concluída hoje.';

  const undone = day.tasks.filter((t) => !t.done);
  const focusGoal = undone.map((t) => goalForTask(goals, t)).find((g) => g?.priority === 'high');
  const focusLine = focusGoal
    ? `${focusGoal.name} — mínimo ${focusGoal.min}, antes da metade do dia.`
    : undone.length
      ? `${(undone[0] ? goalForTask(goals, undone[0])?.name : undefined) ?? 'Tarefa em aberto'} continua em aberto.`
      : day.diary.correction.trim() || 'Nada em aberto: mantenha o padrão.';

  const blockers = Array.from(
    new Set(
      [
        ...(day.diary.sleep.blockers ?? []).filter((b) => b !== 'Nada'),
        day.diary.blocked.trim(),
        day.diary.temptation.trim(),
        day.diary.relapse.trim() ? `Recaída: ${day.diary.relapse.trim()}` : '',
      ].filter(Boolean),
    ),
  ).slice(0, 4);

  return (
    <View style={{ gap: spacing.md }}>
      <Card accent={color + '55'} style={{ alignItems: 'center', gap: spacing.sm }}>
        <ScoreRing score={score} color={color} animated={animate} />
        <Txt variant="caption" color={color} style={{ fontWeight: '700', letterSpacing: 1 }}>
          {scoreLabel(score, doneTasks.length)}
        </Txt>
        <Txt variant="body" style={{ textAlign: 'center', marginTop: spacing.sm }}>
          {victoryLine(day, score, goals)}
        </Txt>
        <View style={{ width: '100%', gap: 6, marginTop: spacing.md }}>
          {FACTORS.map((f) => {
            const value = day.score?.[f.key] ?? 0;
            return (
              <View key={f.key} style={{ gap: 3 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="micro" color={colors.textSecondary}>
                    {f.label} · {f.weight}
                  </Txt>
                  <Txt variant="micro" color={colors.textPrimary}>{value.toFixed(1)}</Txt>
                </Row>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.track }}>
                  <View style={{ width: `${(value / 10) * 100}%`, height: '100%', borderRadius: 2, backgroundColor: color }} />
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {charges.length ? (
        <Card accent={colors.red + '44'}>
          <Txt variant="h3" color={colors.red} style={{ marginBottom: spacing.sm }}>
            Cobrança direta
          </Txt>
          {charges.map((c, i) => (
            <Txt key={i} variant="caption" color={colors.textPrimary} style={{ marginBottom: 8, lineHeight: 20 }}>
              {c.text}
            </Txt>
          ))}
          <Muted>Prioridade alta não feita = cobrança com custo. Normal = ajuste. Baixa = registro sem cobrança.</Muted>
        </Card>
      ) : null}

      {/* Resumo do dia: destaque, foco e bloqueios (Seção 4 do briefing) */}
      <Card style={{ gap: 10 }}>
        <View>
          <Txt variant="micro" color={colors.green}>📌 DESTAQUE</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 2 }}>
            {highlight}
          </Txt>
        </View>
        <View>
          <Txt variant="micro" color={colors.cyan}>FOCO DE HOJE</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 2 }}>
            {focusLine}
          </Txt>
        </View>
        <View>
          <Txt variant="micro" color={colors.red}>BLOQUEIOS</Txt>
          {blockers.length ? (
            blockers.map((b) => (
              <Txt key={b} variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                • {b}
              </Txt>
            ))
          ) : (
            <Muted style={{ marginTop: 2 }}>Sem dado</Muted>
          )}
        </View>
        <View>
          <Txt variant="micro" color={colors.yellow}>CORREÇÃO PARA AMANHÃ</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 2 }}>
            {day.diary.correction.trim() || 'Sem dado'}
          </Txt>
        </View>
      </Card>

      <Card>
        <Txt variant="caption" color={colors.green}>{CLOSING_LINE}</Txt>
      </Card>
    </View>
  );
}
