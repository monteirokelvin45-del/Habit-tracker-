import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { areaColor, colors, MODES, spacing } from '../../src/theme';
import { Badge, Card, Muted, PrimaryButton, Row, SecondaryButton, Txt } from '../../src/components/ui';
import { EnergyCard } from '../../src/components/EnergyCard';
import { ChecklistCard, modeHint } from '../../src/components/ChecklistCard';
import { FailureSheet, type FailurePayload } from '../../src/components/FailureSheet';
import { DiarySheet } from '../../src/components/DiarySheet';
import { DayResult } from '../../src/components/DayResult';
import { MiddaySheet, type MiddayPayload } from '../../src/components/MiddaySheet';
import { Confetti } from '../../src/lib/anim';
import { useStore } from '../../src/lib/store';
import { addDays, greeting, longDate, nowHHmm, todayKey } from '../../src/lib/date';
import { buildChecklist, generalStreak, goalStreak, priorityTasksUndone, scoreOf } from '../../src/lib/score';
import { haptic } from '../../src/lib/haptics';
import type { Day, DayMode, Goal } from '../../src/lib/types';

export default function TodayScreen() {
  const router = useRouter();
  const store = useStore();
  const today = todayKey();

  // Garante que o dia exista ao abrir o app (sem efeito colateral em render duplicado).
  const day = useMemo<Day>(() => {
    const existing = store.days.find((d) => d.date === today);
    if (existing) return existing;
    return {
      date: today,
      energy: { physical: 5, mental: 5, stress: 5 },
      mode: 'normal',
      tasks: buildChecklist(store.goals, 'normal').map((i) => ({
        goalId: i.extraKey ?? i.goal.id,
        done: false,
        note: '',
      })),
      diary: {
        promised: '',
        done: '',
        avoided: '',
        blocked: '',
        context: { where: '', when: '', distraction: '', trigger: '' },
        correction: '',
        mood: '',
        sleep: { hours: 0, quality: 0, blockers: [] },
        food: '',
        focus: 0,
        temptation: '',
        relapse: '',
        smallWin: '',
        impulseCost: 0,
        emotions: [],
      },
    };
  }, [store.days, store.goals, today]);

  const yesterday = store.days.find((d) => d.date === addDays(today, -1));
  const checklist = buildChecklist(store.goals, day.mode);
  const checklistNames = checklist.map((i) => i.goal.name);
  const doneCount = day.tasks.filter((t) => t.done).length;

  const [failFor, setFailFor] = useState<string | null>(null);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [middayOpen, setMiddayOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const activeGoals = store.goals.filter((g) => g.active && !g.archived);
  const highPriority = activeGoals.filter((g) => g.priority === 'high');
  const highUndone = priorityTasksUndone(day, store.goals);
  const streak = generalStreak(store.days, today);
  const bestArea = useMemo(() => {
    const scored = store.goals
      .filter((g) => g.active)
      .map((g) => ({ goal: g, s: goalStreak(store.days, g.id, today) }))
      .sort((a, b) => b.s - a.s);
    return scored[0];
  }, [store.goals, store.days, today]);

  const failGoal: Goal | undefined = failFor
    ? store.goals.find((g) => g.id === failFor) ??
      checklist.find((i) => (i.extraKey ?? i.goal.id) === failFor)?.goal
    : undefined;

  const ensureDayExists = () => {
    if (!store.days.some((d) => d.date === today)) store.ensureDay(today);
  };

  const onToggle = (goalId: string, done: boolean) => {
    ensureDayExists();
    if (!done) {
      // Desmarcar = registrar falha (motivo + custo + plano). Só desmarca ao salvar.
      setFailFor(goalId);
      return;
    }
    store.toggleTask(today, goalId, done);
    // Confetti só quando o checklist inteiro do modo fecha.
    const allDone =
      checklist.length > 0 &&
      checklist.every((item) => {
        const key = item.extraKey ?? item.goal.id;
        return key === goalId || !!day.tasks.find((t) => t.goalId === key)?.done;
      });
    if (allDone) {
      setConfetti(true);
      haptic('success');
    }
  };

  const onFailureSave = (payload: FailurePayload) => {
    if (!failFor) return;
    ensureDayExists();
    store.setTaskExcuse(today, failFor, payload);
    setFailFor(null);
    haptic('warning');
  };

  const closeDay = (diary: Day['diary']) => {
    ensureDayExists();
    const closed = store.closeDay(today, diary);
    setDiaryOpen(false);
    setShowResult(true);
    if ((closed.score?.total ?? 0) >= 6) setConfetti(true);
  };

  const hour = parseInt(nowHHmm().slice(0, 2), 10);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <Confetti visible={confetti} onDone={() => setConfetti(false)} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.green}
            onRefresh={() => {
              setRefreshing(true);
              store.refreshRewards();
              setTimeout(() => setRefreshing(false), 400);
            }}
          />
        }
      >
        {/* HEADER */}
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="h1">
              {greeting()}, {store.user.name || 'atleta'}
            </Txt>
            <Muted style={{ marginTop: 2 }}>{longDate(today)}</Muted>
          </View>
          <Badge label={`${MODES[day.mode].emoji} ${MODES[day.mode].label}`} color={MODES[day.mode].color} />
        </Row>

        {/* STREAKS */}
        <Row gap={spacing.sm}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/modulo/recompensas')}>
            <Card style={{ padding: spacing.md }}>
              <Txt variant="micro" color={colors.textSecondary}>Streak geral</Txt>
              <Txt variant="h2" color={colors.green}>🔥 {streak}</Txt>
            </Card>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Card style={{ padding: spacing.md }}>
              <Txt variant="micro" color={colors.textSecondary}>Melhor área</Txt>
              <Txt variant="h3" color={bestArea ? areaColor(bestArea.goal.area) : colors.textSecondary} numberOfLines={1}>
                {bestArea ? `${bestArea.goal.area} · ${bestArea.s}d` : 'Sem dado'}
              </Txt>
            </Card>
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/modulo/pomodoro')}>
            <Card style={{ padding: spacing.md }}>
              <Txt variant="micro" color={colors.textSecondary}>Foco</Txt>
              <Txt variant="h3" color={colors.cyan}>⏱️ {day.pomodoros?.length ?? 0}</Txt>
            </Card>
          </Pressable>
        </Row>

        {/* CHECK-IN DE ENERGIA */}
        <EnergyCard
          day={day}
          yesterdayScore={scoreOf(yesterday) ?? undefined}
          onEnergy={(energy) => {
            ensureDayExists();
            store.setEnergy(today, energy);
          }}
          onMode={(mode: DayMode) => {
            ensureDayExists();
            store.setMode(today, mode);
          }}
        />

        <Muted style={{ marginTop: -4 }}>{modeHint(day.mode)}</Muted>

        {/* CHECK-IN DE MEIO DO DIA */}
        <Card accent={day.middayCheckin ? colors.cyan + '44' : undefined}>
          {day.middayCheckin ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={colors.textSecondary}>Meio do dia · {day.middayCheckin.at}</Txt>
                <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 2 }}>
                  Prioridade: {day.middayCheckin.priorityDone ? 'feita' : 'não feita'} · energia {day.middayCheckin.energy}/10
                </Txt>
                {day.middayCheckin.note ? <Muted>{day.middayCheckin.note}</Muted> : null}
              </View>
              <Txt variant="micro" color={colors.cyan} onPress={() => setMiddayOpen(true)}>editar</Txt>
            </Row>
          ) : (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={colors.textSecondary}>Check-in de 30 segundos</Txt>
                <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 2 }}>Como está a metade do dia?</Txt>
              </View>
              <Txt variant="caption" color={colors.cyan} onPress={() => setMiddayOpen(true)} style={{ fontWeight: '700' }}>
                abrir
              </Txt>
            </Row>
          )}
        </Card>

        {/* CHECKLIST */}
        <ChecklistCard
          day={day}
          goals={store.goals}
          onToggle={onToggle}
          onLongFail={(goalId) => {
            ensureDayExists();
            setFailFor(goalId);
          }}
          onNote={(goalId, note) => {
            ensureDayExists();
            store.setTaskNote(today, goalId, note);
          }}
        />

        {/* ALERTAS RÁPIDOS */}
        {highUndone.length && day.closedAt === undefined ? (
          <Card accent={colors.red + '44'}>
            <Txt variant="caption" color={colors.red} style={{ fontWeight: '700' }}>
              {highUndone.length} prioridade(s) alta(s) em aberto
            </Txt>
            {highUndone.slice(0, 2).map(({ goal }) => (
              <Muted key={goal.id} style={{ marginTop: 4 }}>
                • {goal.name} — mínimo {goal.min}
              </Muted>
            ))}
          </Card>
        ) : null}

        {/* RESULTADO */}
        {day.score ? <DayResult day={day} goals={store.goals} animate={showResult} /> : null}

        {day.closedAt ? (
          <>
            <Row gap={spacing.sm}>
              <SecondaryButton label="Reabrir dia" style={{ flex: 1 }} onPress={() => { store.reopenDay(today); setShowResult(false); }} />
              <SecondaryButton label="Ver revisões" color={colors.cyan} style={{ flex: 1 }} onPress={() => router.push('/(tabs)/revisoes')} />
            </Row>
            <Pressable
              onPress={() => {
                store.setMode(today, day.mode === 'recovery' ? 'normal' : 'recovery');
                router.push('/(tabs)/inteligencia');
              }}
            >
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="caption" color={colors.textSecondary}>Amanhã o loop recomeça.</Txt>
                  <Txt variant="caption" color={colors.green}>Ver Amanhã →</Txt>
                </Row>
              </Card>
            </Pressable>
          </>
        ) : null}

        <Muted style={{ textAlign: 'center', marginTop: spacing.md }}>
          {highPriority.length ? `${highPriority.length} prioridade(s) alta(s) ativa(s)` : 'Nenhuma prioridade alta definida'}
          {activeGoals.length > 8 ? ' · ⚠️ volume alto — considere reduzir metas' : ''}
        </Muted>
      </ScrollView>

      {/* FECHAR O DIA */}
      {!day.closedAt ? (
        <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md }}>
          <PrimaryButton
            label={hour >= 18 ? '🌙 Encerrar Dia' : `🌙 Fechar o dia (${doneCount} feitas)`}
            onPress={() => {
              ensureDayExists();
              setDiaryOpen(true);
            }}
          />
        </View>
      ) : null}

      <FailureSheet
        visible={!!failFor}
        goal={failGoal}
        onClose={() => setFailFor(null)}
        onSave={onFailureSave}
      />

      <MiddaySheet
        visible={middayOpen}
        onClose={() => setMiddayOpen(false)}
        onSave={(payload: MiddayPayload) => {
          ensureDayExists();
          store.setMidday(today, { priorityDone: payload.priorityDone, energy: payload.energy, note: payload.note });
          setMiddayOpen(false);
        }}
      />

      <DiarySheet
        visible={diaryOpen}
        date={longDate(today)}
        diary={day.diary}
        goals={store.goals}
        score={day.score?.total ?? 5}
        checklistNames={checklistNames}
        onClose={() => setDiaryOpen(false)}
        onSubmit={closeDay}
      />
    </SafeAreaView>
  );
}
