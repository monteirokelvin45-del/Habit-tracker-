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
import {
  PRESETS,
  formatClock,
  initTimer,
  presetLabel,
  progress,
  reset,
  tick,
  toggle,
  type TimerConfig,
  type TimerState,
} from '../../src/lib/timer';

const PRESET_LABELS = PRESETS.map(presetLabel);

export default function PomodoroScreen() {
  const store = useStore();
  const today = todayKey();
  const day = store.days.find((d) => d.date === today);
  const items = useMemo(() => buildChecklist(store.goals, day?.mode ?? 'normal'), [store.goals, day?.mode]);
  // O checklist pode ter extras do modo ("extra:revisao"): a chave da tarefa é o
  // extraKey, senão o pomodoro era gravado num goalId que não existe no dia.
  const taskKey = (i: (typeof items)[number]) => i.extraKey ?? i.goal.id;

  // Todo o relógio vive em `src/lib/timer.ts` (estado puro): a tela só chama
  // `tick` a cada segundo. Assim a regra "fim do foco entra em pausa, fim da
  // pausa volta PARADO" é a mesma no app e no teste.
  const [config, setConfig] = useState<TimerConfig>(PRESETS[0]!);
  const [state, setState] = useState<TimerState>(() => initTimer(PRESETS[0]!));
  const [goalId, setGoalId] = useState<string>(items[0] ? taskKey(items[0]) : '');
  const configRef = useRef(config);
  configRef.current = config;

  // A lista de tarefas muda depois (nova meta, outro modo): mantém a seleção válida.
  useEffect(() => {
    if (!items.length) return;
    if (!items.some((i) => taskKey(i) === goalId)) setGoalId(taskKey(items[0]!));
  }, [items, goalId]);

  const goalIdRef = useRef(goalId);
  goalIdRef.current = goalId;

  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => {
      setState((prev) => {
        const result = tick(prev, configRef.current);
        // Efeitos colaterais fora do updater: StrictMode roda o updater 2×.
        if (result.event === 'focus-done') {
          haptic('success');
          void notifyNow('Ciclo concluído', `${configRef.current.focus} min de foco registrados. Hora de ${configRef.current.rest} min de pausa.`);
          store.addPomodoro(today, goalIdRef.current, configRef.current.focus);
        }
        if (result.event === 'rest-done') {
          haptic('medium');
          void notifyNow('Pausa encerrada', 'Pronto para o próximo ciclo? Retomar é sua escolha.');
        }
        return result.state;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.status, store, today]);

  const todayPomodoros = day?.pomodoros ?? [];
  const totalMinutes = todayPomodoros.reduce((a, b) => a + b.minutes, 0);

  const changePreset = (p: TimerConfig) => {
    setConfig(p);
    setState(reset(p, state.cycles));
  };
  const resetTimer = () => setState(reset(config, state.cycles));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="⏱️ Foco" subtitle="Pomodoro vinculado a uma tarefa real" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Row gap={spacing.sm}>
          {PRESETS.map((p) => (
            <Chip
              key={presetLabel(p)}
              label={presetLabel(p)}
              color={colors.cyan}
              selected={presetLabel(config) === presetLabel(p)}
              onPress={() => changePreset(p)}
            />
          ))}
        </Row>
        <Muted>Presets: {PRESET_LABELS.join(' · ')} (foco / pausa, em minutos)</Muted>

        <Card style={{ alignItems: 'center', gap: spacing.sm }} accent={state.phase === 'focus' ? colors.cyan + '55' : colors.blue + '55'}>
          <Badge label={state.phase === 'focus' ? 'foco' : 'pausa'} color={state.phase === 'focus' ? colors.cyan : colors.blue} />
          <Txt style={{ fontSize: 62, fontWeight: '800', color: state.phase === 'focus' ? colors.cyan : colors.blue, fontVariant: ['tabular-nums'] }}>
            {formatClock(state.remaining)}
          </Txt>
          <View style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.track }}>
            <View style={{ width: `${progress(state) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: state.phase === 'focus' ? colors.cyan : colors.blue }} />
          </View>
          <Muted style={{ letterSpacing: 0 }}>
            {state.status === 'running' ? 'correndo' : state.status === 'paused' ? 'pausado — retomar é escolha' : 'parado'} · fase {state.phase}
          </Muted>
          <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
            <SecondaryButton
              label={state.status === 'running' ? 'Pausar' : 'Iniciar'}
              style={{ height: 46, minWidth: 110 }}
              onPress={() => setState((prev) => toggle(prev))}
            />
            <SecondaryButton
              color={colors.textSecondary}
              label="Reiniciar"
              style={{ height: 46, minWidth: 110 }}
              onPress={resetTimer}
            />
          </Row>
        </Card>

        <Txt variant="caption" color={colors.textSecondary}>Tarefa vinculada</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {items.length === 0 ? <NoData label="Nenhuma tarefa no checklist de hoje" /> : null}
          {items.map((i) => (
            <Chip
              key={taskKey(i)}
              label={i.goal.name}
              selected={goalId === taskKey(i)}
              onPress={() => setGoalId(taskKey(i))}
            />
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
            Ciclos finalizados nesta sessão: {state.cycles}. Cada ciclo vira registro de tempo na tarefa e alimenta a checagem de honestidade.
          {' '}Ciclo interrompido não conta: só o que chega ao fim é tempo de foco registrado.
          </Txt>
        </Card>

        <View style={{ alignItems: 'center', opacity: 0.18 }}>
          <ScoreRing score={Math.min(10, todayPomodoros.length)} color={colors.cyan} animated={false} size={120} />
        </View>
      </ScrollView>
    </View>
  );
}
