import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../../src/components/ModalHeader';
import { Icon } from '../../src/components/Icon';
import { Badge, Card, Muted, PrimaryButton, Row, SecondaryButton, Sheet, Txt } from '../../src/components/ui';
import { colors, radius, spacing, useTheme } from '../../src/theme';
import { useStore } from '../../src/lib/store';
import { todayKey, addDays, shortDate } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { restTimerAlarm } from '../../src/lib/native';
import { formatClock, loadDelta, loadSeries, sessionProgress, sessionVolume } from '../../src/lib/training';
import { LineChart } from '../../src/components/charts';
import type { ExerciseEntry, WorkoutSession } from '../../src/lib/training';

/**
 * Detalhamento da área TREINO.
 *
 * Sessão com séries, carga por série, comparativo com a última sessão, timer de
 * descanso e volume total. A sessão é salva no diário do dia (campo `diary`),
 * então não precisa de chave nova no storage.
 */

const TEMPLATE: ExerciseEntry[] = [
  { name: 'Supino reto', sets: [0, 1, 2, 3].map(() => ({ reps: 12, weight: 30, done: false })) },
  { name: 'Supino inclinado', sets: [0, 1, 2].map(() => ({ reps: 12, weight: 24, done: false })) },
  { name: 'Crucifixo', sets: [0, 1, 2].map(() => ({ reps: 15, weight: 12, done: false })) },
  { name: 'Tríceps corda', sets: [0, 1, 2].map(() => ({ reps: 15, weight: 20, done: false })) },
];

const REST_OPTIONS = [60, 90, 120];

export default function TreinoScreen() {
  useTheme();
  const store = useStore();
  const today = todayKey();
  const day = store.days.find((d) => d.date === today);

  const [session, setSession] = useState<WorkoutSession>({ date: today, label: 'Treino A — Peito e Tríceps', exercises: TEMPLATE });
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  /* cronômetro de treino */
  useEffect(() => {
    if (!running) {
      if (tick.current) clearInterval(tick.current);
      tick.current = null;
      return;
    }
    tick.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
      tick.current = null;
    };
  }, [running]);

  /* timer de descanso */
  useEffect(() => {
    if (rest == null) return;
    setRestLeft(rest);
    const id = setInterval(() => {
      setRestLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          setRest(null);
          haptic('success');
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [rest]);

  /* histórico: sessões anteriores salvas no diário */
  const history = useMemo<WorkoutSession[]>(() => {
    return store.days
      .filter((d) => d.date !== today && d.diary.workout)
      .map((d) => d.diary.workout as WorkoutSession)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [store.days, today]);

  const progress = sessionProgress(session);
  const volume = sessionVolume(session);
  const lastVolume = history.length ? sessionVolume(history[history.length - 1]!) : null;

  const setSet = (exIndex: number, setIndex: number, patch: Partial<{ reps: number; weight: number | null; done: boolean }>) => {
    setSession((prev) => {
      const exercises = prev.exercises.map((ex, ei) =>
        ei !== exIndex
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, si) => (si !== setIndex ? s : { ...s, ...patch })),
            },
      );
      return { ...prev, exercises };
    });
  };

  const save = () => {
    if (progress.done === 0) return;
    store.patchDiary(today, { workout: { ...session, durationSec: elapsed } });
    setSaved(true);
    haptic('success');
  };

  const dayNames = useMemo(() => [7, 6, 5, 4, 3, 2, 1].map((back) => addDays(today, -back)), [today]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ModalHeader
        title="Treino"
        subtitle={session.label}
        onAdd={() => {
          setSession({ ...session, exercises: TEMPLATE.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })) });
          setElapsed(0);
          setSaved(false);
        }}
        addLabel="Reiniciar"
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        {/* CRONÔMETRO */}
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
                Sessão
              </Txt>
              <Txt variant="metric" color={running ? colors.green : colors.textPrimary}>
                {formatClock(elapsed)}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Badge label={`${progress.done}/${progress.total} séries`} color={colors.cyan} />
              <Txt variant="caption" color={colors.textSecondary}>
                volume {volume.toFixed(0)} kg
                {lastVolume != null ? ` · último ${lastVolume.toFixed(0)}` : ''}
              </Txt>
            </View>
          </Row>
          <Row gap={spacing.sm}>
            <SecondaryButton
              label={running ? 'Pausar' : elapsed ? 'Continuar' : 'Iniciar'}
              color={running ? colors.yellow : colors.green}
              style={{ flex: 1 }}
              onPress={() => {
                haptic('light');
                setRunning((r) => !r);
              }}
            />
            <SecondaryButton
              label="Finalizar"
              color={colors.textSecondary}
              style={{ flex: 1 }}
              onPress={() => {
                setRunning(false);
                haptic('light');
              }}
            />
          </Row>
        </Card>

        {/* EXERCÍCIOS */}
        {session.exercises.map((ex, exIndex) => {
          const delta = loadDelta(ex, history);
          return (
            <Card key={ex.name} style={{ gap: spacing.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="h3">{ex.name}</Txt>
                  <Txt variant="micro" color={delta.delta == null ? colors.textMuted : delta.delta > 0 ? colors.green : colors.yellow} style={{ letterSpacing: 0 }}>
                    {delta.label}
                    {delta.current != null ? ` · ${delta.current}kg` : ''}
                  </Txt>
                </View>
                <Icon name="treino" size={18} color={colors.textMuted} />
              </Row>

              {ex.sets.map((set, setIndex) => (
                <Row key={setIndex} gap={spacing.sm} style={{ alignItems: 'center' }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: set.done }}
                    onPress={() => {
                      haptic(set.done ? 'light' : 'success');
                      setSet(exIndex, setIndex, { done: !set.done });
                    }}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      borderWidth: 2,
                      borderColor: set.done ? colors.green : colors.borderAccent,
                      backgroundColor: set.done ? colors.green : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {set.done ? <Icon name="tarefas" size={15} color={colors.bgPrimary} strokeWidth={3} /> : null}
                  </Pressable>
                  <Txt variant="micro" color={colors.textMuted} style={{ width: 22 }}>
                    {setIndex + 1}ª
                  </Txt>
                  <View style={{ flex: 1, flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                        reps
                      </Txt>
                      <TextInput
                        value={String(set.reps)}
                        onChangeText={(v) => setSet(exIndex, setIndex, { reps: Number(v.replace(/\D/g, '')) || 0 })}
                        keyboardType="number-pad"
                        style={{
                          backgroundColor: colors.bgInput,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 8,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          color: colors.textPrimary,
                          fontSize: 15,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                        carga (kg)
                      </Txt>
                      <TextInput
                        value={set.weight == null ? '' : String(set.weight)}
                        onChangeText={(v) => {
                          const clean = v.replace(/[^\d.,]/g, '').replace(',', '.');
                          setSet(exIndex, setIndex, { weight: clean ? Number(clean) : null });
                        }}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          backgroundColor: colors.bgInput,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 8,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          color: colors.textPrimary,
                          fontSize: 15,
                        }}
                      />
                    </View>
                  </View>
                </Row>
              ))}

              <Pressable onPress={() => setNoteFor(exIndex)}>
                <Txt variant="caption" color={ex.note ? colors.textSecondary : colors.textMuted} numberOfLines={2}>
                  {ex.note ? `nota: ${ex.note}` : '+ anotação de fadiga'}
                </Txt>
              </Pressable>
            </Card>
          );
        })}

        {/* DESCANSO */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Descanso entre séries
          </Txt>
          <Row gap={spacing.sm}>
            {REST_OPTIONS.map((sec) => (
              <SecondaryButton
                key={sec}
                label={`${sec}s`}
                color={restLeft > 0 && rest === sec ? colors.green : colors.textSecondary}
                style={{ flex: 1 }}
                onPress={() => {
                  haptic('light');
                  setRest(sec);
                  void restTimerAlarm(sec);
                }}
              />
            ))}
          </Row>
          {restLeft > 0 ? (
            <Txt variant="h2" color={colors.green} style={{ textAlign: 'center' }}>
              {formatClock(restLeft)}
            </Txt>
          ) : (
            <Muted>O aviso chega como notificação mesmo com o app em segundo plano.</Muted>
          )}
        </Card>

        {/* CARGA PROGRESSIVA */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Carga progressiva · {session.exercises[0]?.name ?? 'Sem dado'}
          </Txt>
          {(() => {
            const series = loadSeries(history, session.exercises[0]?.name ?? '');
            if (series.length < 2) {
              return <Muted>Sem dado suficiente — são necessárias 2 sessões registradas para mostrar tendência.</Muted>;
            }
            return (
              <LineChart
                series={[{ name: 'carga', color: colors.green, points: series.map((p) => p.weight) }]}
                labels={series.map((p) => shortDate(p.date))}
                height={140}
                unit="kg"
                max={Math.max(1, ...series.map((p) => p.weight)) * 1.2}
              />
            );
          })()}
        </Card>

        <Row gap={spacing.sm}>
          <Muted style={{ flex: 1 }}>
            {progress.done === 0 ? 'Marque as séries feitas para registrar a sessão.' : `${progress.done} séries prontas.`}
          </Muted>
          <PrimaryButton label={saved ? 'Salvo' : 'Salvar treino'} disabled={progress.done === 0} onPress={save} />
        </Row>

        <Card>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Últimos 7 dias
          </Txt>
          <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
            {dayNames.map((d) => {
              const s = store.days.find((x) => x.date === d)?.diary.workout as WorkoutSession | undefined;
              const has = !!s;
              return (
                <View
                  key={d}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: has ? colors.green : colors.border,
                    backgroundColor: has ? colors.green + '22' : colors.bgInput,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt variant="micro" color={has ? colors.green : colors.textMuted} style={{ letterSpacing: 0 }}>
                    {d.slice(8)}
                  </Txt>
                </View>
              );
            })}
          </Row>
        </Card>
        {day && !day.tasks.length ? <Muted>Sem dado do checklist hoje.</Muted> : null}
      </ScrollView>

      <Sheet visible={noteFor != null} onClose={() => setNoteFor(null)} title="Anotação de fadiga">
        {noteFor != null ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <TextInput
              value={session.exercises[noteFor]?.note ?? ''}
              onChangeText={(v) =>
                setSession((prev) => ({
                  ...prev,
                  exercises: prev.exercises.map((ex, i) => (i === noteFor ? { ...ex, note: v } : ex)),
                }))
              }
              placeholder="Ex.: ombro travou na 3ª série"
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                backgroundColor: colors.bgInput,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.textPrimary,
                minHeight: 90,
                textAlignVertical: 'top',
              }}
            />
            <PrimaryButton label="Pronto" onPress={() => setNoteFor(null)} />
          </View>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}
