import React from 'react';
import { View } from 'react-native';
import { colors, scoreColor, scoreLabel, spacing } from '../theme';
import { Card, Muted, Row, Txt } from './ui';
import { ScoreRing } from '../lib/anim';
import { CLOSING_LINE, chargeLines, victoryLine } from '../lib/score';
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

  return (
    <View style={{ gap: spacing.md }}>
      <Card accent={color + '55'} style={{ alignItems: 'center', gap: spacing.sm }}>
        <ScoreRing score={score} color={color} animated={animate} />
        <Txt variant="caption" color={color} style={{ fontWeight: '700', letterSpacing: 1 }}>
          {scoreLabel(score)}
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

      <Card>
        <Txt variant="caption" color={colors.green}>{CLOSING_LINE}</Txt>
      </Card>
    </View>
  );
}
