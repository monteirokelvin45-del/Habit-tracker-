import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { areaColor, MODES, mindsetOfDay, scoreColor, spacing, useTheme } from '../../src/theme';
import { Badge, Card, Muted, PrimaryButton, Row, SecondaryButton, Sheet, Txt } from '../../src/components/ui';
import { EnergyCard } from '../../src/components/EnergyCard';
import { ChecklistCard, modeHint } from '../../src/components/ChecklistCard';
import { FailureSheet, type FailurePayload } from '../../src/components/FailureSheet';
import { DiarySheet } from '../../src/components/DiarySheet';
import { DayResult } from '../../src/components/DayResult';
import { MiddaySheet, type MiddayPayload } from '../../src/components/MiddaySheet';
import { Confetti } from '../../src/lib/anim';
import { MetricGrid, type MetricCell } from '../../src/components/MetricGrid';
import { TopPriorities } from '../../src/components/TopPriorities';
import { DaySchedule } from '../../src/components/DaySchedule';
import { ScheduleView } from '../../src/components/ScheduleView';
import { AreaGrid, type AreaCardData } from '../../src/components/AreaGrid';
import { MonthRing } from '../../src/components/MonthRing';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/lib/store';
import { addDays, formatMinutes, greeting, longDate, monthLabel, nowHHmm, todayKey } from '../../src/lib/date';
import { buildChecklist, detectDanger, generalStreak, goalStreak, priorityTasksUndone, scoreOf } from '../../src/lib/score';
import { nextReward } from '../../src/lib/insights';
import { averageFocusMinutes, focusMinutes } from '../../src/lib/stats';
import { areaHeadline, areaProgress, buildSchedule, nextSlot, slotsToSync } from '../../src/lib/schedule';
import { createNativeAlarm, openAppLimits, syncDayToCalendar } from '../../src/lib/native';
import { haptic } from '../../src/lib/haptics';
import { useWidgetSync } from '../../src/widget/sync';
import { FadeInDown } from '../../src/components/FadeIn';
import { UnlockBanner } from '../../src/components/UnlockBanner';
import { MiniHeatmap } from '../../src/components/Heatmap';
import { LIFE_AREAS, emptyDiary } from '../../src/lib/types';
import type { Day, DayMode } from '../../src/lib/types';

/** Abre o detalhamento da área; área sem tela dedicada cai em Metas. */
const AREA_ROUTES: Record<string, string> = {
  Treino: '/modulo/treino',
  Estudo: '/modulo/estudo',
  Leitura: '/modulo/leitura',
  'Finanças': '/modulo/financas',
  Sono: '/modulo/sono',
  'Saúde': '/modulo/peso',
  Dieta: '/modulo/dieta',
  'Projeto Pessoal': '/modulo/projeto',
};

export default function TodayScreen() {
  const router = useRouter();
  const t = useTheme();
  const store = useStore();
  useWidgetSync();
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
      diary: emptyDiary(),
    };
  }, [store.days, store.goals, today]);

  const dayClosed = !!day.closedAt;
  const yesterday = store.days.find((d) => d.date === addDays(today, -1));
  const checklist = buildChecklist(store.goals, day.mode);
  const checklistNames = checklist.map((i) => i.goal.name);
  const doneCount = day.tasks.filter((task) => task.done).length;

  const [failFor, setFailFor] = useState<string | null>(null);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [middayOpen, setMiddayOpen] = useState(false);
  const [honestyNote, setHonestyNote] = useState<{ goalId: string; text: string } | null>(null);
  const [sheetNote, setSheetNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const activeGoals = store.goals.filter((g) => g.active && !g.archived);
  const highPriority = activeGoals.filter((g) => g.priority === 'high');
  const highUndone = priorityTasksUndone(day, store.goals);
  const streak = generalStreak(store.days, today);
  const bestStreak = useMemo(
    () =>
      activeGoals
        .map((g) => ({ goal: g, s: goalStreak(store.days, g.id, today) }))
        .sort((a, b) => b.s - a.s)[0],
    [activeGoals, store.days, today],
  );
  const alerts = useMemo(() => detectDanger(store.days, store.goals, store.settings), [store.days, store.goals, store.settings]);
  const reward = useMemo(() => nextReward(store), [store]);
  const doneKeys = useMemo(() => new Set(day.tasks.filter((x) => x.done).map((x) => x.goalId)), [day.tasks]);
  const isDone = (key: string) => doneKeys.has(key);

  const ensureDayExists = () => {
    const exists = useStore.getState().days.some((d) => d.date === today);
    if (!exists) store.ensureDay(today);
  };

  const onToggle = (goalId: string, done: boolean) => {
    if (dayClosed) {
      setSheetNote('Dia encerrado — reabra o dia para alterar o checklist.');
      return;
    }
    const wasDone = !!day.tasks.find((task) => task.goalId === goalId)?.done;
    if (wasDone) {
      // Já estava feito e o usuário está desmarcando: foi toque errado. Volta atrás
      // sem exigir o formulário de falha.
      store.toggleTask(today, goalId, false);
      haptic('light');
      setSheetNote('Tarefa desmarcada. Desmarque de novo para registrar uma falha com motivo.');
      return;
    }
    if (!done) {
      setFailFor(goalId);
      return;
    }
    store.toggleTask(today, goalId, done);
    const allDone =
      checklist.length > 0 &&
      checklist.every((item) => {
        const key = item.extraKey ?? item.goal.id;
        return key === goalId || !!day.tasks.find((task) => task.goalId === key)?.done;
      });
    if (allDone) {
      setConfetti(true);
      haptic('success');
    }
    const goal = store.goals.find((g) => g.id === goalId);
    const avgEnergy = (day.energy.physical + day.energy.mental) / 2;
    if (goal?.priority === 'high' && avgEnergy < 3) {
      setHonestyNote({
        goalId,
        text: `Energia ${avgEnergy.toFixed(1)}/10 hoje e prioridade alta concluída. Foi completo ou parcial? O registro honesto vale mais que o número.`,
      });
    }
  };

  const onFailureSave = (payload: FailurePayload) => {
    if (!failFor) return;
    ensureDayExists();
    store.setTaskExcuse(today, failFor, payload);
    setFailFor(null);
    haptic('warning');
  };

  const onFailureClose = () => {
    setFailFor(null);
    setSheetNote('Falha não registrada — a tarefa continua como estava. Desmarcar exige o motivo.');
  };

  const closeDay = (diary: Day['diary']) => {
    ensureDayExists();
    const closed = store.closeDay(today, diary);
    setDiaryOpen(false);
    setShowResult(true);
    if ((closed.score?.total ?? 0) >= 6) setConfetti(true);
  };

  /* ─────────────────────────── métricas reais ─────────────────────────── */

  const focusMin = focusMinutes(day) ?? 0;
  const avgFocus = averageFocusMinutes(store.days, 7);
  const focusTarget = store.settings.focusGoalMinutes ?? 240;
  const score = day.score?.total ?? null;
  const recent = store.days.filter((d) => d.score).slice(-7);
  const avgScore = recent.length
    ? Math.round((recent.reduce((sum, d) => sum + (d.score?.total ?? 0), 0) / recent.length) * 10) / 10
    : null;
  const bestStreakEver = useMemo(() => {
    let best = 0;
    let run = 0;
    for (const d of [...store.days].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      if ((d.score?.total ?? 0) >= 6) {
        run += 1;
        best = Math.max(best, run);
      } else run = 0;
    }
    return best;
  }, [store.days]);

  const metrics: MetricCell[] = [
    {
      icon: 'foco',
      label: 'Foco',
      value: formatMinutes(focusMin),
      hint: avgFocus == null ? `meta ${formatMinutes(focusTarget)}` : `média ${formatMinutes(avgFocus)}`,
      progress: focusTarget ? Math.min(1, focusMin / focusTarget) : null,
      color: t.cyan,
      onPress: () => router.push('/modulo/pomodoro'),
    },
    {
      icon: 'tarefas',
      label: 'Tarefas',
      value: `${doneCount}/${checklist.length || day.tasks.length}`,
      hint: checklist.length ? `${Math.round((doneCount / Math.max(1, checklist.length)) * 100)}% do checklist` : 'Sem dado',
      progress: checklist.length ? doneCount / checklist.length : null,
      color: t.textPrimary,
    },
    {
      icon: 'streak',
      label: 'Streak',
      value: `${streak}`,
      hint: bestStreakEver ? `recorde ${bestStreakEver}d` : 'Sem recorde ainda',
      progress: bestStreakEver ? Math.min(1, streak / bestStreakEver) : null,
      color: t.green,
      onPress: () => router.push('/modulo/recompensas'),
    },
    {
      icon: 'score',
      label: 'Score hoje',
      value: score == null ? '—' : score.toFixed(1),
      hint: avgScore == null ? 'Sem média ainda' : `média 7d ${avgScore.toFixed(1)}`,
      progress: score == null ? null : score / 10,
      color: score == null ? t.textMuted : scoreColor(score),
    },
  ];

  /* ─────────────────────────── cronograma e áreas ─────────────────────────── */

  const schedule = useMemo(
    () =>
      buildSchedule({
        date: today,
        goals: activeGoals.map((g) => ({ id: g.id, name: g.name, area: g.area, priority: g.priority, min: g.min })),
        tasks: day.tasks,
        overrides: day.scheduleOverrides,
      }),
    [activeGoals, day.tasks, today],
  );
  const next = nextSlot(schedule, nowHHmm());

  // Até 6 áreas (grid 2×3): área sem meta de hoje continua entrando se a pessoa
  // escolheu essa área, porque o detalhamento tem o que registrar mesmo sem meta.
  const areas = useMemo(() => {
    const chosen = store.user.areas.filter((a) => LIFE_AREAS.includes(a as never));
    return Array.from(new Set([...activeGoals.map((g) => g.area), ...chosen])).slice(0, 6);
  }, [activeGoals, store.user.areas]);
  const areaCards: AreaCardData[] = areas.map((area) => {
    const progress = areaProgress(activeGoals, day.tasks, area);
    return {
      area,
      headline: areaHeadline(activeGoals, area),
      progressLabel: progress.headline,
      progress: progress.total ? progress.done / progress.total : null,
      onPress: () => {
        // Área com tela dedicada abre o detalhamento mesmo sem meta ativa hoje;
        // área sem tela cai em Metas para criar a primeira meta.
        const route = AREA_ROUTES[area];
        if (route) router.push(route as never);
        else router.push('/(tabs)/metas');
      },
    };
  });

  /* ─────────────────────────── anel do mês ─────────────────────────── */

  const monthDays = useMemo(() => {
    const mk = today.slice(0, 7);
    const registered = new Map(store.days.filter((d) => d.date.startsWith(mk)).map((d) => [d.date, d]));
    const total = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
    return Array.from({ length: total }, (_, i) => {
      const date = `${mk}-${String(i + 1).padStart(2, '0')}`;
      const d = registered.get(date);
      return { date, score: d?.score?.total ?? null, isFuture: date > today };
    });
  }, [store.days, today]);
  const monthScores = monthDays.filter((d) => d.score != null).map((d) => d.score as number);
  const monthAvg = monthScores.length
    ? Math.round((monthScores.reduce((a, b) => a + b, 0) / monthScores.length) * 10) / 10
    : null;

  const runSync = async () => {
    setSyncing(true);
    const result = await syncDayToCalendar(slotsToSync(schedule), today);
    setSyncing(false);
    haptic(result.ok ? 'success' : 'error');
    setSheetNote(result.message);
    if (result.ok && !store.settings.syncCalendar) store.updateSettings({ syncCalendar: true });
  };

  const runAlarm = async (slot: { start: string; title: string }) => {
    const [h, m] = slot.start.split(':').map(Number);
    const result = await createNativeAlarm(h ?? 9, m ?? 0, slot.title);
    haptic(result.ok ? 'success' : 'error');
    setSheetNote(result.message);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }} edges={['top']}>
      <Confetti visible={confetti} onDone={() => setConfetti(false)} />
      {/* Conquista recém-desbloqueada: antes o badge era gravado em silêncio. */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <UnlockBanner />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={t.green}
            onRefresh={() => {
              setRefreshing(true);
              store.refreshRewards();
              setTimeout(() => setRefreshing(false), 400);
            }}
          />
        }
      >
        {/* 1 — HEADER DINÂMICO */}
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 2 }}>
              {greeting()}, {(store.user.name || 'operador').toUpperCase()}
            </Txt>
            <Badge label={MODES[day.mode].label.toUpperCase()} color={MODES[day.mode].color} />
          </Row>
          <Txt variant="h1">{longDate(today)}</Txt>
          <Txt variant="caption" color={t.textSecondary} style={{ fontStyle: 'italic' }}>
            “{mindsetOfDay(today)}”
          </Txt>
        </View>

        {/* 2 — GRID DE MÉTRICAS */}
        <MetricGrid cells={metrics} />

        {/* ALERTA ATIVO */}
        {alerts.length ? (
          <Card accent={alerts[0]!.level === 'red' ? t.red : t.yellow} pulse={alerts[0]!.level === 'red'}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="caption" color={alerts[0]!.level === 'red' ? t.red : t.yellow} style={{ fontWeight: '700' }}>
                {alerts[0]!.title}
              </Txt>
              <Txt variant="micro" color={t.textSecondary} onPress={() => router.push('/(tabs)/inteligencia')}>
                ver
              </Txt>
            </Row>
            <Muted style={{ marginTop: 2 }}>{alerts[0]!.detail}</Muted>
          </Card>
        ) : null}

        {/* PRÓXIMA AÇÃO */}
        {!dayClosed && next ? (
          <Pressable onPress={() => router.push('/modulo/pomodoro')}>
            <Card accent={t.borderAccent} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: t.borderAccent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="relogio" size={16} color={t.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={t.textMuted} style={{ letterSpacing: 1.4 }}>
                  Próxima ação · {next.start}
                </Txt>
                <Txt variant="caption" color={t.textPrimary} numberOfLines={1}>
                  {next.title}
                </Txt>
              </View>
              <Icon name="seta" size={16} color={t.green} />
            </Card>
          </Pressable>
        ) : null}

        {/* 3 — TOP 3 PRIORIDADES */}
        <FadeInDown delay={20}>
          <TopPriorities
            items={checklist}
            doneOf={isDone}
            onToggle={onToggle}
            readOnly={dayClosed}
            onOpenArea={(goalId, area) => {
              const route = AREA_ROUTES[area];
              if (route) router.push(route as never);
              else router.push('/(tabs)/metas');
              void goalId;
            }}
          />
        </FadeInDown>

        {/* 4 — CRONOGRAMA + ÁREAS */}
        <FadeInDown delay={40}>
          <DaySchedule
            slots={schedule}
            now={nowHHmm()}
            syncEnabled={!!store.settings.syncCalendar}
            syncing={syncing}
            onSyncCalendar={() => void runSync()}
            onAlarm={(slot) => void runAlarm(slot)}
          />
        </FadeInDown>
        <FadeInDown delay={45}>
          {/* Visão de semana: setas esquerda/direita trocam o dia. */}
          <ScheduleView goals={store.goals} days={store.days} date={today} now={nowHHmm()} />
        </FadeInDown>
        <FadeInDown delay={50}>
          <AreaGrid areas={areaCards} />
        </FadeInDown>

        {/* 5 — CHECK-IN DE ENERGIA */}
        <FadeInDown delay={60}>
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
            collapsedByDefault
          />
        </FadeInDown>
        <Muted style={{ marginTop: -4 }}>{modeHint(day.mode)}</Muted>

        {/* CHECK-IN DE MEIO DO DIA */}
        <Card accent={day.middayCheckin ? t.cyan + '44' : undefined}>
          {day.middayCheckin ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={t.textSecondary}>
                  Meio do dia · {day.middayCheckin.at}
                </Txt>
                <Txt variant="caption" color={t.textPrimary} style={{ marginTop: 2 }}>
                  Prioridade:{' '}
                  {day.middayCheckin.priorityDone ? 'feita' : day.middayCheckin.partial ? 'parcial' : 'não feita'} · energia{' '}
                  {day.middayCheckin.energy}/10
                </Txt>
                {day.middayCheckin.note ? <Muted>{day.middayCheckin.note}</Muted> : null}
              </View>
              <Txt variant="micro" color={t.cyan} onPress={() => setMiddayOpen(true)}>
                editar
              </Txt>
            </Row>
          ) : (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={t.textSecondary}>
                  Check-in de 30 segundos
                </Txt>
                <Txt variant="caption" color={t.textPrimary} style={{ marginTop: 2 }}>
                  Como está a metade do dia?
                </Txt>
              </View>
              <Txt variant="caption" color={t.cyan} onPress={() => setMiddayOpen(true)} style={{ fontWeight: '700' }}>
                abrir
              </Txt>
            </Row>
          )}
        </Card>

        {/* 6 — CONSTÂNCIA DO MÊS */}
        <FadeInDown delay={70}>
          <MonthRing
            days={monthDays}
            monthLabel={monthLabel(today).toUpperCase()}
            average={monthAvg}
            streak={streak || null}
            onPress={() => router.push('/(tabs)/revisoes')}
          />
        </FadeInDown>

        {/* CHECKLIST COMPLETO */}
        <FadeInDown delay={80}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 2 }}>
              Checklist do dia · {MODES[day.mode].label}
            </Txt>
            {bestStreak && bestStreak.s > 0 ? (
              <Txt variant="micro" color={areaColor(bestStreak.goal.area)} style={{ letterSpacing: 0.5 }}>
                melhor: {bestStreak.goal.area}
              </Txt>
            ) : null}
          </Row>
          {dayClosed ? (
            <Card accent={t.cyan + '44'}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" color={t.cyan}>
                  Dia encerrado — checklist congelado.
                </Txt>
                <Txt variant="micro" color={t.cyan} onPress={() => store.reopenDay(today)}>
                  reabrir
                </Txt>
              </Row>
              <Muted style={{ marginTop: 2 }}>O score já foi calculado sobre este registro.</Muted>
            </Card>
          ) : null}
          <ChecklistCard
            day={day}
            goals={store.goals}
            readOnly={dayClosed}
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
        </FadeInDown>

        {/* MURAL DE CONSTÂNCIA (6 semanas) */}
        <FadeInDown delay={90}>
          <Pressable onPress={() => router.push('/modulo/constancia')}>
            <Card>
              <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <View>
                  <Txt variant="micro" color={t.textSecondary}>
                    Últimas 6 semanas
                  </Txt>
                  <Muted>toque para o mural completo</Muted>
                </View>
                <Txt variant="caption" color={t.green}>
                  ver ano ›
                </Txt>
              </Row>
              <MiniHeatmap days={store.days} weeks={6} />
            </Card>
          </Pressable>
        </FadeInDown>

        {/* ALERTAS RÁPIDOS */}
        {highUndone.length && !dayClosed ? (
          <Card accent={t.red + '44'}>
            <Txt variant="caption" color={t.red} style={{ fontWeight: '700' }}>
              {highUndone.length} prioridade(s) alta(s) em aberto
            </Txt>
            {highUndone.slice(0, 2).map(({ goal }) => (
              <Muted key={goal.id} style={{ marginTop: 4 }}>
                • {goal.name} — mínimo {goal.min}
              </Muted>
            ))}
          </Card>
        ) : null}

        {reward ? (
          <Pressable onPress={() => router.push('/modulo/recompensas')}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" color={t.textSecondary}>
                  A {reward.remaining} dia(s) de desbloquear
                </Txt>
                <Txt variant="caption" color={t.green} style={{ fontWeight: '700' }}>
                  {reward.name}
                </Txt>
              </Row>
            </Card>
          </Pressable>
        ) : null}

        {/* RESULTADO */}
        {day.score ? <DayResult day={day} goals={store.goals} animate={showResult} /> : null}

        {day.closedAt && day.middayCheckin ? (
          <Card>
            <Txt variant="micro" color={t.textSecondary}>
              Ponto de virada
            </Txt>
            <Txt variant="caption" color={t.textPrimary} style={{ marginTop: 4 }}>
              {day.middayCheckin.at} · prioridade{' '}
              {day.middayCheckin.priorityDone ? 'feita' : day.middayCheckin.partial ? 'parcial' : 'não feita'} · energia{' '}
              {day.middayCheckin.energy}/10
            </Txt>
          </Card>
        ) : null}

        {day.closedAt ? (
          <>
            <Row gap={spacing.sm}>
              <SecondaryButton
                label="Reabrir dia"
                style={{ flex: 1 }}
                onPress={() => {
                  store.reopenDay(today);
                  setShowResult(false);
                }}
              />
              <SecondaryButton label="Ver revisões" color={t.cyan} style={{ flex: 1 }} onPress={() => router.push('/(tabs)/revisoes')} />
            </Row>
          </>
        ) : null}

        {sheetNote ? (
          <Card accent={t.yellow + '44'}>
            <Txt variant="caption" color={t.yellow} onPress={() => setSheetNote(null)}>
              {sheetNote}
            </Txt>
          </Card>
        ) : null}

        <Row gap={spacing.sm} style={{ justifyContent: 'space-between' }}>
          <Txt variant="micro" color={t.textMuted} style={{ flex: 1 }}>
            {highPriority.length ? `${highPriority.length} prioridade(s) alta(s)` : 'Nenhuma prioridade alta'}
            {activeGoals.length > 8 ? ' · volume alto: considere reduzir metas' : ''}
          </Txt>
          <Txt variant="micro" color={t.textMuted} onPress={() => void openAppLimits().then((r) => setSheetNote(r.message))}>
            limitar apps
          </Txt>
        </Row>
      </ScrollView>

      {/* 7 — RODAPÉ FIXO */}
      {!day.closedAt ? (
        <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md }}>
          <PrimaryButton
            label={`Fechar o dia (${doneCount}/${checklist.length || day.tasks.length} feitas)`}
            onPress={() => {
              ensureDayExists();
              setDiaryOpen(true);
            }}
          />
        </View>
      ) : null}

      <FailureSheet
        visible={!!failFor}
        goal={failFor ? store.goals.find((g) => g.id === failFor) : undefined}
        onClose={onFailureClose}
        onSave={onFailureSave}
      />

      <Sheet
        visible={!!honestyNote}
        onClose={() => setHonestyNote(null)}
        title="Confere comigo"
        footer={
          <Row gap={spacing.sm}>
            <SecondaryButton
              label="Ajustar registro"
              color={t.yellow}
              style={{ flex: 1 }}
              onPress={() => {
                if (!honestyNote) return;
                store.resolveHonestyFlag(today, honestyNote.goalId, 'adjusted');
                setFailFor(honestyNote.goalId);
                setHonestyNote(null);
              }}
            />
            <PrimaryButton
              label="Confirmar como feito"
              style={{ flex: 1 }}
              onPress={() => {
                if (!honestyNote) return;
                store.resolveHonestyFlag(today, honestyNote.goalId, 'confirmed');
                setHonestyNote(null);
              }}
            />
          </Row>
        }
      >
        <Txt variant="caption" color={t.textPrimary} style={{ lineHeight: 20 }}>
          {honestyNote?.text}
        </Txt>
        <Muted>Não é acusação: é o sistema pedindo consistência entre o que você marca e o que aconteceu.</Muted>
      </Sheet>

      <MiddaySheet
        visible={middayOpen}
        onClose={() => setMiddayOpen(false)}
        onSave={(payload: MiddayPayload) => {
          ensureDayExists();
          store.setMidday(today, {
            priorityDone: payload.priorityDone,
            partial: payload.partial ?? false,
            energy: payload.energy,
            note: payload.note,
          });
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
