import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import { Badge, Card, Chip, Muted, NoData, Row, SecondaryButton, Txt } from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { ScoreRing } from '../../src/lib/anim';
import { useStore } from '../../src/lib/store';
import { buildChecklist } from '../../src/lib/score';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { notifyNow } from '../../src/lib/notifications';

type Preset = { label: string; focus: number; rest: number };

const PRESETS: Preset[] = [
  { label: '25 / 5', focus: 25, rest: 5 },
  { label: '50 / 10', focus: 50, rest: 10 },
  { label: '90 / 20', focus: 90, rest: 20 },
];

export default function PomodoroScreen() {
  const store = useStore();
  const today = todayKey();
  const day = store.days.find((d) => d.date === today);
  const items = useMemo(() => buildChecklist(store.goals, day?.mode ?? 'normal'), [store.goals, day?.mode]);

  const [preset, setPreset] = useState<Preset>(PRESETS[0]!);
  const [goalId, setGoalId] = useState<string>(items[0]?.goal.id ?? '');
  const [phase, setPhase] = useState<'focus' | 'rest'>('focus');
  const [remaining, setRemaining] = useState(preset.focus * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (tick.current) clearInterval(tick.current);
      return;
    }
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        // fim do ciclo
        if (phase === 'focus') {
          haptic('success');
          void notifyNow('Ciclo concluído', `${preset.focus} min de foco registrados. Hora de ${preset.rest} min de pausa.`);
          store.addPomodoro(today, goalId, preset.focus);
          setCompleted((c) => c + 1);
          setPhase('rest');
          return preset.rest * 60;
        }
        haptic('medium');
        void notifyNow('Pausa encerrada', 'Pronto para o próximo ciclo? O loop continua.');
        setPhase('focus');
        setRunning(false);
        return preset.focus * 60;
      });
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running, phase, preset, goalId, store, today]);

  const total = (phase === 'focus' ? preset.focus : preset.rest) * 60;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const todayPomodoros = day?.pomodoros ?? [];
  const totalMinutes = todayPomodoros.reduce((a, b) => a + b.minutes, 0);

  const changePreset = (p: Preset) => {
    setPreset(p);
    setRunning(false);
    setPhase('focus');
    setRemaining(p.focus * 60);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="⏱️ Foco" subtitle="Pomodoro vinculado a uma tarefa real" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Row gap={spacing.sm}>
          {PRESETS.map((p) => (
            <Chip key={p.label} label={p.label} color={colors.cyan} selected={preset.label === p.label} onPress={() => changePreset(p)} />
          ))}
        </Row>

        <Card style={{ alignItems: 'center', gap: spacing.sm }} accent={phase === 'focus' ? colors.cyan + '55' : colors.blue + '55'}>
          <Badge label={phase === 'focus' ? 'foco' : 'pausa'} color={phase === 'focus' ? colors.cyan : colors.blue} />
          <Txt style={{ fontSize: 62, fontWeight: '800', color: phase === 'focus' ? colors.cyan : colors.blue, fontVariant: ['tabular-nums'] }}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Txt>
          <View style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.track }}>
            <View style={{ width: `${(1 - remaining / total) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: phase === 'focus' ? colors.cyan : colors.blue }} />
          </View>
          <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
            <SecondaryButton label={running ? 'Pausar' : 'Iniciar'} style={{ height: 46, minWidth: 110 }} onPress={() => setRunning((r) => !r)} />
            <SecondaryButton
              color={colors.textSecondary}
              label="Reiniciar"
              style={{ height: 46, minWidth: 110 }}
              onPress={() => {
                setRunning(false);
                setPhase('focus');
                setRemaining(preset.focus * 60);
              }}
            />
          </Row>
        </Card>

        <Txt variant="caption" color={colors.textSecondary}>Tarefa vinculada</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {items.length === 0 ? <NoData label="Nenhuma tarefa no checklist de hoje" /> : null}
          {items.map((i) => (
            <Chip key={i.goal.id} label={i.goal.name} selected={goalId === i.goal.id} onPress={() => setGoalId(i.goal.id)} />
          ))}
        </View>

        <Card>
          <Txt variant="h3">Pomodoros hoje: {todayPomodoros.length}</Txt>
          <Muted style={{ marginTop: 2 }}>
            {Math.round(totalMinutes)} min de foco ({Math.floor(totalMinutes / 60)}h{String(totalMinutes % 60).padStart(2, '0')})
          </Muted>
          {todayPomodoros.length ? (
            <View style={{ marginTop: spacing.sm, gap: 4 }}>
              {todayPomodoros.slice(-5).reverse().map((p, i) => (
                <Row key={`${p.at}-${i}`} style={{ justifyContent: 'space-between' }}>
                  <Txt variant="micro" color={colors.textSecondary}>
                    {store.goals.find((g) => g.id === p.goalId)?.name ?? 'Tarefa'} · {p.minutes}min
                  </Txt>
                  <Muted>{p.at}</Muted>
                </Row>
              ))}
            </View>
          ) : null}
        </Card>

        <Card>
          <Txt variant="caption" color={colors.textSecondary}>
            Ciclos finalizados nesta sessão: {completed}. Cada ciclo vira registro de tempo na tarefa e alimenta a checagem de honestidade.
          </Txt>
        </Card>

        <View style={{ alignItems: 'center', opacity: 0.18 }}>
          <ScoreRing score={Math.min(10, todayPomodoros.length)} color={colors.cyan} animated={false} size={120} />
        </View>
      </ScrollView>
    </View>
  );
}
