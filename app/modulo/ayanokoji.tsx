import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import {
  Badge,
  Card,
  Checkbox,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  SecondaryButton,
  Sheet,
  Slider,
  Txt,
} from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { RadarChart } from '../../src/components/charts';
import { useStore } from '../../src/lib/store';
import { addDays, todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';

const AXES = [
  { key: 'selfControl' as const, label: 'Autocontrole' },
  { key: 'communication' as const, label: 'Comunicação' },
  { key: 'discipline' as const, label: 'Disciplina' },
  { key: 'observation' as const, label: 'Observação' },
];

const MICRO_TASKS = [
  { id: 'mask', label: 'Manter expressão neutra em uma situação desconfortável' },
  { id: 'observe', label: 'Observar 3 comportamentos alheios sem julgar' },
  { id: 'pause', label: 'Pausar 3 segundos antes de responder algo impulsivo' },
  { id: 'solitude', label: '30 min de estudo sem estímulo externo' },
  { id: 'body', label: 'Postura e respiração controladas por 5 min' },
  { id: 'note', label: 'Registrar uma manipulação social que reconheceu no dia' },
];

export default function AyanokojiScreen() {
  const store = useStore();
  const start = store.ayanokoji.startDate || todayKey();
  const today = todayKey();
  const daysPassed = Math.floor((new Date(today).getTime() - new Date(start).getTime()) / 86400000);
  const week = Math.min(24, Math.max(1, Math.floor(daysPassed / 7) + 1));
  const progress = Math.min(100, (week / 24) * 100);

  const [sheet, setSheet] = useState(false);
  const [scores, setScores] = useState({ selfControl: 5, communication: 5, discipline: 5, observation: 5 });

  const currentScores = store.ayanokoji.scores.find((s) => s.week === week);
  const previousScores = store.ayanokoji.scores.find((s) => s.week === week - 1);

  const radar = AXES.map((a) => ({ label: a.label, value: currentScores?.[a.key] ?? null }));
  const overlay = previousScores ? AXES.map((a) => ({ label: a.label, value: previousScores[a.key] })) : undefined;

  const doneToday = store.ayanokoji.tasksDone[today] ?? [];
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, (week - 1) * 7 + i)), [start, week]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="🎭 Protocolo Ayanokoji" subtitle="24 semanas · autocontrole como prática, não como pose" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Card accent={'#9B7BFF55'}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt variant="micro" color={colors.textSecondary}>Progresso do protocolo</Txt>
              <Txt variant="h2" color="#9B7BFF">Semana {week} de 24</Txt>
            </View>
            <Badge label={`${Math.round(progress)}%`} color="#9B7BFF" />
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track, marginTop: spacing.sm }}>
            <View style={{ width: `${progress}%`, height: '100%', borderRadius: 4, backgroundColor: '#9B7BFF' }} />
          </View>
          <Muted style={{ marginTop: 6 }}>Início em {start} · {daysPassed} dia(s) de protocolo</Muted>
        </Card>

        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Txt variant="h3">Radar semanal</Txt>
            <Txt variant="micro" color="#9B7BFF" onPress={() => {
              const base = currentScores ?? { selfControl: 5, communication: 5, discipline: 5, observation: 5 };
              setScores({ selfControl: base.selfControl, communication: base.communication, discipline: base.discipline, observation: base.observation });
              setSheet(true);
            }}>
              avaliar semana
            </Txt>
          </Row>
          {currentScores ? (
            <RadarChart data={radar} overlay={overlay} overlayColor={colors.purple} size={280} />
          ) : (
            <NoData label={`Sem avaliação da semana ${week} ainda`} />
          )}
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Microtarefas de hoje</Txt>
          {MICRO_TASKS.map((t) => (
            <Row key={t.id} gap={spacing.md} style={{ marginBottom: 10, alignItems: 'flex-start' }}>
              <Checkbox
                checked={doneToday.includes(t.id)}
                color="#9B7BFF"
                onPress={() => {
                  haptic('light');
                  store.toggleAyanokojiTask(today, t.id);
                }}
              />
              <Txt variant="caption" color={doneToday.includes(t.id) ? colors.textSecondary : colors.textPrimary} style={{ flex: 1 }}>
                {t.label}
              </Txt>
            </Row>
          ))}
          <Muted>{doneToday.length}/{MICRO_TASKS.length} hoje</Muted>
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Semana atual</Txt>
          {weekDays.map((d) => {
            const count = (store.ayanokoji.tasksDone[d] ?? []).length;
            return (
              <Row key={d} style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <Muted>{d}</Muted>
                <Txt variant="micro" color={count >= 4 ? '#9B7BFF' : colors.textMuted}>
                  {d > today ? '—' : `${count}/${MICRO_TASKS.length}`}
                </Txt>
              </Row>
            );
          })}
        </Card>

        <Card>
          <Txt variant="caption" color={colors.textSecondary}>
            O protocolo é uma ferramenta de autorregulação — não substitui acompanhamento de saúde mental. As notas são suas, sobre comportamento observável.
          </Txt>
        </Card>
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={`Avaliação da semana ${week}`}
        footer={
          <PrimaryButton
            label="Salvar avaliação"
            color="#9B7BFF"
            onPress={() => {
              store.setAyanokojiScore(week, scores);
              setSheet(false);
              haptic('success');
            }}
          />
        }
      >
        {AXES.map((a) => (
          <View key={a.key}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="caption" color={colors.textSecondary}>{a.label}</Txt>
              <Txt variant="caption" color="#9B7BFF">{scores[a.key]}/10</Txt>
            </Row>
            <Slider value={scores[a.key]} onChange={(v) => setScores((s) => ({ ...s, [a.key]: v }))} color="#9B7BFF" />
          </View>
        ))}
        <Muted>Notas dadas por você na revisão semanal, com base no que aconteceu de fato.</Muted>
        <SecondaryButton label="Fechar" onPress={() => setSheet(false)} />
      </Sheet>
    </View>
  );
}
