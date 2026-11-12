/**
 * Hoje — Tela Principal (Home Dashboard) no estilo "Management / Coders".
 *
 * Soft light + glassmorphism: fundo cinza fumê, cards brancos translúcidos
 * misturados com cards pretos de destaque. O resto do app continua com os temas
 * escuros; a Home obedece ao tema ativo (o tema `softGlass` existe para vestir
 * exatamente este desenho).
 *
 * Regras que valem em toda esta tela:
 *  1. Nenhum número inventado. Sem registro, o card escreve "Sem dado" — 68.5%,
 *     43 tarefas, 28 projetos e os nomes da referência são exemplo de layout.
 *  2. Ponto do gráfico e da barra é `null` quando o dia não tem registro: a linha
 *     QUEBRA e a barra fica oca, em vez de cair para zero.
 *  3. A timeline é SUGESTÃO de bloco (derivada de área + prioridade), como
 *     `buildSchedule` já faz; o card de destaque mostra pendências reais do
 *     checklist, não um "hábito em foco" fabricado.
 *  4. Nada esconde registro atrás de filtro: Dia/Semana/Mês/Ano filtram a
 *     timeline e o gráfico, e o resumo do dia continua visível.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { areaColor, MODES, mindsetOfDay, spacing, useTheme } from '../../src/theme';
import { Muted, PrimaryButton, Row, SecondaryButton, Sheet, Txt } from '../../src/components/ui';
import { EnergyCard } from '../../src/components/EnergyCard';
import { ChecklistCard, modeHint } from '../../src/components/ChecklistCard';
import { FailureSheet, type FailurePayload } from '../../src/components/FailureSheet';
import { DiarySheet } from '../../src/components/DiarySheet';
import { DayResult } from '../../src/components/DayResult';
import { MiddaySheet, type MiddayPayload } from '../../src/components/MiddaySheet';
import { Confetti } from '../../src/lib/anim';
import { TopPriorities } from '../../src/components/TopPriorities';
import { DaySchedule } from '../../src/components/DaySchedule';
import { ScheduleView } from '../../src/components/ScheduleView';
import { MonthRing } from '../../src/components/MonthRing';
import { Icon } from '../../src/components/Icon';
import { MiniHeatmap } from '../../src/components/Heatmap';
import { FadeInDown } from '../../src/components/FadeIn';
import { UnlockBanner } from '../../src/components/UnlockBanner';
import { AreaDot, GLASS, GlassBar, GlassCard, GlassChip, GlassLabel, GlassRing, SmoothLine } from '../../src/components/SoftHome';
import { useStore } from '../../src/lib/store';
import { addDays, formatMinutes, monthLabel, nowHHmm, todayKey } from '../../src/lib/date';
import { buildChecklist, detectDanger, generalStreak, goalStreak, priorityTasksUndone, scoreOf } from '../../src/lib/score';
import { nextReward } from '../../src/lib/insights';
import { averageFocusMinutes, focusMinutes } from '../../src/lib/stats';
import { areaHeadline, areaProgress, buildSchedule, nextSlot, parseHHmm, slotsToSync } from '../../src/lib/schedule';
import { createNativeAlarm, openAppLimits, syncDayToCalendar } from '../../src/lib/native';
import { haptic } from '../../src/lib/haptics';
import { useWidgetSync } from '../../src/widget/sync';
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

/** Filtros do topo. `Dia` é o padrão: não existe recorte "padrão" inventado. */
type Period = 'dia' | 'semana' | 'mes' | 'ano';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'ano', label: 'Ano' },
];

/** Janela de cada filtro, em dias (usada no gráfico e na média de conclusão). */
const PERIOD_DAYS: Record<Period, number> = { dia: 1, semana: 7, mes: 30, ano: 365 };

/** Hora mínima/máxima da timeline (a janela útil do app, igual ao cronograma). */
const TIMELINE_FROM = 5;
const TIMELINE_TO = 23;

export default function TodayScreen() {
  const router = useRouter();
  const t = useTheme();
  const store = useStore();
  useWidgetSync();
  const today = todayKey();
  const [period, setPeriod] = useState<Period>('dia');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

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
  const [quickOpen, setQuickOpen] = useState(false);

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

  /* ───────────────────── faixa semanal (gráfico do topo) ───────────────────── */

  /**
   * Conclusão média por dia da janela do filtro. Dia sem checklist registrado é
   * `null` — não é "0% de conclusão", é "não houve registro".
   */
  const windowDays = PERIOD_DAYS[period];
  const concludeSeries = useMemo(() => {
    const byDate = new Map(store.days.map((d) => [d.date, d]));
    const keys = Array.from({ length: windowDays }, (_, i) => addDays(today, -(windowDays - 1 - i)));
    return keys.map((k) => {
      const d = byDate.get(k);
      if (!d) return null;
      const ids = new Set(store.goals.filter((g) => g.active && !g.archived).map((g) => g.id));
      const mine = d.tasks.filter((task) => ids.has(task.goalId));
      if (!mine.length) return null;
      const done = mine.filter((task) => task.done).length;
      return Math.round((done / mine.length) * 100);
    });
  }, [store.days, store.goals, today, windowDays]);

  /**
   * No filtro `Dia` o número grande é o DIA de hoje; a linha do gráfico é a
   * tendência dos últimos 7 dias. São duas coisas diferentes e cada uma tem seu
   * rótulo — misturar as duas seria afirmar uma média que ninguém pediu.
   */
  const trendDays = period === 'dia' ? 7 : windowDays;
  const trendSeries = useMemo(() => {
    if (trendDays === windowDays) return concludeSeries;
    const byDate = new Map(store.days.map((d) => [d.date, d]));
    const ids = new Set(store.goals.filter((g) => g.active && !g.archived).map((g) => g.id));
    return Array.from({ length: trendDays }, (_, i) => {
      const d = byDate.get(addDays(today, -(trendDays - 1 - i)));
      if (!d) return null;
      const mine = d.tasks.filter((task) => ids.has(task.goalId));
      if (!mine.length) return null;
      return Math.round((mine.filter((task) => task.done).length / mine.length) * 100);
    });
  }, [trendDays, windowDays, concludeSeries, store.days, store.goals, today]);

  const concludedAvg = useMemo(() => {
    const vals = concludeSeries.filter((v): v is number => v != null);
    if (!vals.length) return null; // "Sem dado" — nada de 0% quando não há registro
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [concludeSeries]);

  /** Comparação com o período imediatamente anterior (mesma janela). */
  const concludedDelta = useMemo(() => {
    if (concludedAvg == null) return null;
    const byDate = new Map(store.days.map((d) => [d.date, d]));
    const ids = new Set(store.goals.filter((g) => g.active && !g.archived).map((g) => g.id));
    const vals: number[] = [];
    for (let i = windowDays; i < windowDays * 2; i++) {
      const d = byDate.get(addDays(today, -i));
      if (!d) continue;
      const mine = d.tasks.filter((task) => ids.has(task.goalId));
      if (mine.length) vals.push(Math.round((mine.filter((task) => task.done).length / mine.length) * 100));
    }
    if (!vals.length) return null;
    return concludedAvg - Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [concludedAvg, store.days, store.goals, today, windowDays]);

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

  /* ───────────────────── hero: pendências reais de hoje ───────────────────── */

  /**
   * O "File Preview" da referência é o hábito em foco. Aqui, o foco é a próxima
   * pendência REAL do checklist (prioridade alta primeiro). Sem checklist, o card
   * diz o que fazer — não inventa um hábito para preencher o espaço.
   */
  const hero = useMemo(() => {
    const pending = checklist
      .filter((i) => !isDone(i.extraKey ?? i.goal.id))
      .sort((a, b) => {
        const w = (p: string) => (p === 'high' ? 0 : p === 'normal' ? 1 : 2);
        return w(a.goal.priority) - w(b.goal.priority);
      });
    const goal = pending[0]?.goal;
    if (!goal) return null;
    const doneOfArea = day.tasks.filter((task) => {
      const g = store.goals.find((x) => x.id === task.goalId);
      return g?.area === goal.area && task.done;
    }).length;
    const totalOfArea = checklist.filter((i) => i.goal.area === goal.area).length;
    return {
      name: goal.name,
      area: goal.area,
      min: goal.min,
      streak: goalStreak(store.days, goal.id, today),
      ratio: totalOfArea ? doneOfArea / totalOfArea : null,
      doneOfArea,
      totalOfArea,
    };
    // `isDone` deriva de `doneKeys`; o memo precisa reagir a ele.
  }, [checklist, doneKeys, day.tasks, store.goals, store.days, today]);

  /* ───────────────────── timeline (sugestão de blocos) ───────────────────── */

  const timeline = schedule.filter((s) => {
    const h = Math.floor(parseHHmm(s.start) / 60);
    return h >= TIMELINE_FROM && h <= TIMELINE_TO;
  });

  /* ───────────────────── notas e registros do dia ───────────────────── */

  const diaryNotes = useMemo(() => {
    const d = day.diary;
    // `String(...)`: um backup antigo pode ter número num campo de texto do
    // diário, e `.trim()` em número derrubava o card inteiro.
    const items: { label: string; area: string; text: string }[] = [
      { label: 'Prometido', area: 'Estudo', text: String(d.promised ?? '') },
      { label: 'Feito', area: 'Treino', text: String(d.done ?? '') },
      { label: 'Evitado', area: 'Saúde', text: String(d.avoided ?? '') },
      { label: 'Travado em', area: 'Trabalho', text: String(d.blocked ?? '') },
      { label: 'Correção', area: 'Projeto Pessoal', text: String(d.correction ?? '') },
      { label: 'Pequena vitória', area: 'Leitura', text: String(d.smallWin ?? '') },
    ];
    const filled = items.filter((i) => i.text.trim().length > 0);
    // Filtro de busca do topo: procura no texto e no rótulo.
    const q = search.trim().toLowerCase();
    return q ? filled.filter((i) => `${i.label} ${i.text}`.toLowerCase().includes(q)) : filled;
  }, [day.diary, search]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return {
      goals: activeGoals.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 4),
      notes: diaryNotes.length,
    };
  }, [activeGoals, diaryNotes.length, search]);

  /** Diário de hoje filtrado pela busca (o card "Registros do dia" respeita o termo). */

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

  const firstName = (store.user.name || 'operador').split(' ')[0] ?? 'operador';
  const periodLabel = monthLabel(today);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }} edges={['top']}>
      <Confetti visible={confetti} onDone={() => setConfetti(false)} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <UnlockBanner />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={t.textPrimary}
            onRefresh={() => {
              setRefreshing(true);
              store.refreshRewards();
              setTimeout(() => setRefreshing(false), 400);
            }}
          />
        }
      >
        {/* ── HEADER: saudação + pílulas ─────────────────────────────────── */}
        <View style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="h1" upper={false} color={t.textPrimary} style={{ fontSize: 26, letterSpacing: -0.8 }}>
                Olá, {firstName}!
              </Txt>
            </View>
            <Row gap={8} style={{ alignItems: 'center' }}>
              <GlassChip
                label="✦"
                round
                accessibilityLabel="Pedir ao AI Copilot"
                onPress={() => router.push('/(tabs)/copilot')}
              />
              <GlassChip label="＋" round accessibilityLabel="Criar" onPress={() => setQuickOpen(true)} />
              <GlassChip
                label="⌕"
                round
                active={searchOpen}
                accessibilityLabel="Busca"
                onPress={() => {
                  setSearchOpen((v) => !v);
                  if (searchOpen) setSearch('');
                }}
              />
              <GlassChip
                label="◔"
                round
                accessibilityLabel={`Notificações${alerts.length ? `: ${alerts.length}` : ''}`}
                onPress={() => router.push('/(tabs)/inteligencia')}
              />
              <GlassChip round label={firstName.slice(0, 1).toUpperCase()} active onPress={() => router.push('/(tabs)/perfil')} accessibilityLabel="Perfil" />
            </Row>
          </Row>

          {/* filtros em pílula + data */}
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Row gap={6} style={{ alignItems: 'center' }}>
              <Icon name="calendário" size={13} color={t.textMuted} />
              <Txt variant="micro" upper={false} color={t.textSecondary} style={{ fontSize: 11 }}>
                {periodLabel}
              </Txt>
            </Row>
            <Row gap={4}>
              {PERIODS.map((p) => (
                <GlassChip
                  key={p.id}
                  label={p.label}
                  active={period === p.id}
                  accessibilityLabel={`Filtro ${p.label}`}
                  onPress={() => {
                    haptic('light');
                    setPeriod(p.id);
                  }}
                />
              ))}
            </Row>
          </Row>

          <Txt variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 9.5, fontStyle: 'italic' }} numberOfLines={1}>
            “{mindsetOfDay(today)}”
          </Txt>

          {searchOpen ? (
            <GlassCard padding={12} strong>
              <Row gap={8} style={{ alignItems: 'center' }}>
                <Icon name="cerebro" size={14} color={t.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar meta ou registro do dia"
                  placeholderTextColor={t.textMuted}
                  autoFocus
                  returnKeyType="search"
                  accessibilityLabel="Buscar meta ou registro do dia"
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: t.textPrimary,
                    paddingVertical: 2,
                  }}
                />
                {search ? (
                  <GlassChip label="limpar" small accessibilityLabel="Limpar busca" onPress={() => setSearch('')} />
                ) : null}
              </Row>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5, marginTop: 4 }}>
                Procura nas metas ativas e nos registros do diário de hoje. Data e histórico completo ficam em Revisões.
              </Txt>
            </GlassCard>
          ) : null}
        </View>

        {/* ── ALERTA ATIVO ──────────────────────────────────────────────── */}
        {alerts.length ? (
          <GlassCard padding={14}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Row gap={8} style={{ alignItems: 'center', flex: 1 }}>
                <AreaDot area="Saúde" size={8} />
                <Txt variant="caption" upper={false} color={alerts[0]!.level === 'red' ? t.red : t.yellow} style={{ fontWeight: '700', fontSize: 12 }}>
                  {alerts[0]!.title}
                </Txt>
              </Row>
              <Txt variant="micro" upper={false} color={t.textMuted} onPress={() => router.push('/(tabs)/inteligencia')}>
                ver
              </Txt>
            </Row>
            <Muted style={{ marginTop: 3, fontSize: 11 }}>{alerts[0]!.detail}</Muted>
          </GlassCard>
        ) : null}

        {/* ── TAXA DE CONCLUSÃO + HERO ESCURO ───────────────────────────── */}
        <Row gap={spacing.md} style={{ alignItems: 'stretch' }}>
          <GlassCard style={{ flex: 1.05 }} padding={16}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <GlassLabel>Conclusão</GlassLabel>
              <Icon name="tendencia" size={13} color={t.textMuted} />
            </Row>
            <Txt
              variant="h1"
              upper={false}
              color={t.textPrimary}
              style={{ fontSize: 30, letterSpacing: -1.2, marginTop: 2 }}
            >
              {concludedAvg == null ? '—' : `${concludedAvg}%`}
            </Txt>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9.5, marginBottom: 6 }}>
              {concludedAvg == null
                ? 'Sem registro no período'
                : concludedDelta == null
                  ? 'sem período anterior para comparar'
                  : `${concludedDelta >= 0 ? '+' : ''}${concludedDelta} pts vs. ${period === 'dia' ? 'ontem' : `os ${windowDays}d anteriores`}`}
            </Txt>
            <SmoothLine
              points={trendSeries}
              height={52}
              stroke={t.textPrimary}
              fill={t.bgSubtle}
              highlight={trendSeries.length - 1}
            />
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
                {period === 'dia' ? 'tendência' : PERIODS.find((p) => p.id === period)?.label}
              </Txt>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
                {trendDays}d
              </Txt>
            </Row>
          </GlassCard>

          <GlassCard dark style={{ flex: 1 }} padding={16}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <GlassLabel dark>Em foco agora</GlassLabel>
              <Icon name="raio" size={13} color={GLASS.onInkSoft} />
            </Row>
            {hero ? (
              <>
                <Txt variant="caption" upper={false} color={GLASS.onInk} style={{ fontSize: 14, fontWeight: '700', marginTop: 4 }} numberOfLines={2}>
                  {hero.name}
                </Txt>
                <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 9.5 }}>
                  {hero.area} · mínimo {hero.min}
                </Txt>
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <GlassRing
                    ratio={hero.ratio}
                    size={78}
                    dark
                    label={hero.ratio == null ? '—' : `${Math.round(hero.ratio * 100)}%`}
                    caption={hero.ratio == null ? 'sem base' : `${hero.doneOfArea}/${hero.totalOfArea}`}
                  />
                </View>
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 8.5 }}>
                      streak
                    </Txt>
                    <Txt variant="caption" upper={false} color={GLASS.onInk} style={{ fontSize: 12, fontWeight: '700' }}>
                      {hero.streak} dia(s)
                    </Txt>
                  </View>
                  <GlassChip
                    label="abrir"
                    dark
                    accessibilityLabel="Abrir a área do hábito em foco"
                    onPress={() => {
                      const route = AREA_ROUTES[hero.area];
                      if (route) router.push(route as never);
                      else router.push('/(tabs)/metas');
                    }}
                  />
                </Row>
              </>
            ) : (
              <>
                <Txt variant="caption" upper={false} color={GLASS.onInk} style={{ fontSize: 14, fontWeight: '700', marginTop: 4 }}>
                  {checklist.length ? 'Checklist do dia concluído' : 'Sem meta ativa para hoje'}
                </Txt>
                <Muted style={{ color: GLASS.onInkSoft, fontSize: 10.5, marginTop: 4 }}>
                  {checklist.length
                    ? 'Nada pendente. O foco agora é registrar o dia.'
                    : 'Crie uma meta em Metas para o app ter o que acompanhar.'}
                </Muted>
                <View style={{ marginTop: 10 }}>
                  <GlassChip
                    label={checklist.length ? 'fechar o dia' : 'criar meta'}
                    dark
                    onPress={() => (checklist.length ? setDiaryOpen(true) : router.push('/(tabs)/metas'))}
                  />
                </View>
              </>
            )}
          </GlassCard>
        </Row>

        {/* ── RESUMO DO DIA (métricas reais) ────────────────────────────── */}
        <GlassCard padding={16}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <GlassLabel>Tudo de hoje</GlassLabel>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
              {MODES[day.mode].label.toUpperCase()}
            </Txt>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            {[
              { k: 'concluídas', v: checklist.length ? `${doneCount}/${checklist.length}` : '—', s: 'tarefas' },
              { k: 'foco', v: formatMinutes(focusMin), s: avgFocus == null ? `meta ${formatMinutes(focusTarget)}` : `média ${formatMinutes(avgFocus)}` },
              { k: 'streak', v: `${streak}`, s: bestStreakEver ? `recorde ${bestStreakEver}d` : 'sem recorde' },
              { k: 'score', v: score == null ? '—' : score.toFixed(1), s: avgScore == null ? 'sem média' : `média 7d ${avgScore.toFixed(1)}` },
            ].map((cell) => (
              <View key={cell.k} style={{ alignItems: 'center', flex: 1 }}>
                <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 13, fontWeight: '700' }}>
                  {cell.v}
                </Txt>
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
                  {cell.k}
                </Txt>
                <Txt variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 7.5 }} numberOfLines={1}>
                  {cell.s}
                </Txt>
              </View>
            ))}
          </Row>
        </GlassCard>

        {/* ── TIMELINE DE HÁBITOS (Dia) ─────────────────────────────────── */}
        <FadeInDown delay={20}>
          <GlassCard padding={16}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <GlassLabel>Timeline de hoje</GlassLabel>
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                  blocos sugeridos por área
                </Txt>
              </View>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                {next ? `próximo ${next.start}` : 'nada pendente'}
              </Txt>
            </Row>

            {timeline.length ? (
              <View style={{ marginTop: 12 }}>
                {/* régua de horas */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  {[0, 0.25, 0.5, 0.75].map((f) => {
                    const h = TIMELINE_FROM + Math.round((TIMELINE_TO - TIMELINE_FROM) * f);
                    return (
                      <Txt key={f} variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 8 }}>
                        {String(h).padStart(2, '0')}h
                      </Txt>
                    );
                  })}
                  <Txt variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 8 }}>
                    {TIMELINE_TO}h
                  </Txt>
                </View>
                <View style={{ height: 1, backgroundColor: t.border, marginBottom: 10 }} />

                {timeline.map((slot) => {
                  const startMin = parseHHmm(slot.start);
                  const offsetH = startMin / 60 - TIMELINE_FROM;
                  const spanH = Math.max(0.4, Math.min(1, (parseHHmm(slot.end) - startMin) / 60));
                  // Largura mínima legível: no celular, 1h em 18h de janela dá ~19px e não
                  // caberia o texto. O bloco tem largura mínima e é preso dentro do card;
                  // a âncora de horário fica na coluna da esquerda.
                  const rawLeft = (offsetH / (TIMELINE_TO - TIMELINE_FROM)) * 100;
                  const widthPct = Math.max(46, Math.min(100, (spanH / (TIMELINE_TO - TIMELINE_FROM)) * 100));
                  const leftPct = Math.max(0, Math.min(100 - widthPct, rawLeft));
                  const done = slot.status === 'done';
                  return (
                    <Pressable
                      key={slot.key}
                      accessibilityRole="button"
                      accessibilityLabel={`${slot.title}, ${slot.start} às ${slot.end}, ${done ? 'feito' : 'em aberto'}`}
                      onPress={() => setQuickOpen(true)}
                      style={{ marginBottom: 8 }}
                    >
                      <Row gap={6} style={{ alignItems: 'center' }}>
                        <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5, width: 32 }}>
                          {slot.start}
                        </Txt>
                        <View style={{ flex: 1, height: 26 }}>
                          <View
                            style={{
                              position: 'absolute',
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: 26,
                              borderRadius: 13,
                              paddingHorizontal: 10,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              backgroundColor: done ? t.bgSubtle : GLASS.ink,
                              borderWidth: done ? 1 : 0,
                              borderColor: t.border,
                            }}
                          >
                            <AreaDot area={slot.area} size={14} />
                            <Txt
                              variant="micro"
                              upper={false}
                              color={done ? t.textSecondary : GLASS.onInk}
                              style={{ fontSize: 9, fontWeight: '600', flexShrink: 1 }}
                              numberOfLines={1}
                            >
                              {slot.area}
                            </Txt>
                            <Txt
                              variant="micro"
                              upper={false}
                              color={done ? t.textMuted : GLASS.onInkSoft}
                              style={{ fontSize: 8 }}
                              numberOfLines={1}
                            >
                              {done ? 'feito' : totalMinutesLabel(parseHHmm(slot.end) - startMin)}
                            </Txt>
                          </View>
                        </View>
                      </Row>
                    </Pressable>
                  );
                })}
                <Muted style={{ fontSize: 10, marginTop: 2 }}>
                  Horário é sugestão por área (a mesma do cronograma), ajustável no bloco abaixo.
                </Muted>
              </View>
            ) : (
              <Muted style={{ fontSize: 11, marginTop: 8 }}>
                Sem bloco para hoje: nenhuma meta ativa com área definida.
              </Muted>
            )}
          </GlassCard>
        </FadeInDown>

        {/* ── REGISTROS & NOTAS DO DIA ──────────────────────────────────── */}
        <FadeInDown delay={30}>
          <GlassCard padding={16}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <GlassLabel>Registros do dia</GlassLabel>
              <Row gap={6} style={{ alignItems: 'center' }}>
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                  {diaryNotes.length} de {6}
                </Txt>
                <Txt variant="micro" upper={false} color={t.textPrimary} style={{ fontSize: 10, fontWeight: '700' }} onPress={() => setDiaryOpen(true)}>
                  preencher
                </Txt>
              </Row>
            </Row>
            {diaryNotes.length ? (
              <View style={{ marginTop: 8, gap: 8 }}>
                {diaryNotes.slice(0, 4).map((n) => (
                  <Row key={n.label} gap={8} style={{ alignItems: 'center' }}>
                    <AreaDot area={n.area} size={18} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
                        {n.label}
                      </Txt>
                      <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11.5 }} numberOfLines={1}>
                        {n.text}
                      </Txt>
                    </View>
                    <Icon name="chevronDireita" size={12} color={t.textFaint} />
                  </Row>
                ))}
                {diaryNotes.length > 4 ? (
                  <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }} onPress={() => setDiaryOpen(true)}>
                    +{diaryNotes.length - 4} registro(s) no diário
                  </Txt>
                ) : null}
              </View>
            ) : (
              <Muted style={{ fontSize: 11, marginTop: 6 }}>
                {search.trim() ? 'Nada encontrado para essa busca.' : 'Nenhum registro escrito hoje. O diário aceita texto livre.'}
              </Muted>
            )}
          </GlassCard>
        </FadeInDown>

        {/* ── BUSCA: resultados reais ───────────────────────────────────── */}
        {matches ? (
          <GlassCard padding={14} strong>
            <GlassLabel>Busca · {search.trim()}</GlassLabel>
            {matches.goals.length ? (
              matches.goals.map((g) => (
                <Row key={g.id} gap={8} style={{ alignItems: 'center', marginTop: 6 }}>
                  <AreaDot area={g.area} size={16} />
                  <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11.5, flex: 1 }} numberOfLines={1}>
                    {g.name}
                  </Txt>
                  <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                    {g.area}
                  </Txt>
                </Row>
              ))
            ) : (
              <Muted style={{ fontSize: 11, marginTop: 4 }}>Nenhuma meta ativa com esse nome.</Muted>
            )}
            <Muted style={{ fontSize: 10, marginTop: 6 }}>{matches.notes} registro(s) do diário casam com a busca.</Muted>
          </GlassCard>
        ) : null}

        {/* ── PRÓXIMA AÇÃO ──────────────────────────────────────────────── */}
        {!dayClosed && next ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Próxima ação às ${next.start}: ${next.title}`}
            onPress={() => router.push('/modulo/pomodoro')}
          >
            <GlassCard dark padding={14}>
              <Row gap={spacing.md} style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="relogio" size={15} color={GLASS.onInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 8.5, letterSpacing: 1.2 }}>
                    PRÓXIMA AÇÃO · {next.start}
                  </Txt>
                  <Txt variant="caption" upper={false} color={GLASS.onInk} style={{ fontSize: 12 }} numberOfLines={1}>
                    {next.title}
                  </Txt>
                </View>
                <Icon name="seta" size={15} color={GLASS.onInk} />
              </Row>
            </GlassCard>
          </Pressable>
        ) : null}

        {/* ── TOP 3 PRIORIDADES ─────────────────────────────────────────── */}
        <FadeInDown delay={40}>
          <GlassCard padding={16}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <GlassLabel>Prioridades do dia</GlassLabel>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                {checklist.length ? `${doneCount}/${checklist.length}` : 'sem checklist'}
              </Txt>
            </Row>
            {checklist.length ? (
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
            ) : (
              <Muted style={{ fontSize: 11 }}>Nenhuma meta ativa. Crie a primeira em Metas.</Muted>
            )}
          </GlassCard>
        </FadeInDown>

        {/* ── CATEGORIAS (card escuro inferior) ─────────────────────────── */}
        <FadeInDown delay={50}>
          <GlassCard dark padding={16}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <GlassLabel dark>Progresso por área</GlassLabel>
                <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 9 }}>
                  {areas.length ? `${areas.length} área(s) acompanhada(s)` : 'nenhuma área escolhida'}
                </Txt>
              </View>
              <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 9 }}>
                {periodLabel}
              </Txt>
            </Row>

            {areas.length ? (
              <View style={{ gap: 12 }}>
                {areas.map((area) => {
                  const progress = areaProgress(activeGoals, day.tasks, area);
                  const ratio = progress.total ? progress.done / progress.total : null;
                  const areaStreak = Math.max(
                    0,
                    ...activeGoals.filter((g) => g.area === area).map((g) => goalStreak(store.days, g.id, today)),
                  );
                  return (
                    <Pressable
                      key={area}
                      accessibilityRole="button"
                      accessibilityLabel={`${area}: ${progress.headline}`}
                      onPress={() => {
                        const route = AREA_ROUTES[area];
                        if (route) router.push(route as never);
                        else router.push('/(tabs)/metas');
                      }}
                    >
                      <Row gap={10} style={{ alignItems: 'center' }}>
                        <AreaDot area={area} size={22} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Row style={{ justifyContent: 'space-between' }}>
                            <Txt variant="caption" upper={false} color={GLASS.onInk} style={{ fontSize: 11.5, fontWeight: '600' }} numberOfLines={1}>
                              {area}
                            </Txt>
                            <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 9.5 }}>
                              {ratio == null ? 'Sem dado' : `${Math.round(ratio * 100)}%`}
                            </Txt>
                          </Row>
                          <GlassBar
                            ratio={ratio}
                            color={areaColor(area)}
                            track="rgba(255,255,255,0.14)"
                            height={5}
                          />
                          <Row style={{ justifyContent: 'space-between' }}>
                            <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 8.5 }} numberOfLines={1}>
                              {areaHeadline(activeGoals, area)}
                            </Txt>
                            <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 8.5 }}>
                              {areaStreak > 0 ? `${areaStreak}d seguidos` : 'sem sequência'}
                            </Txt>
                          </Row>
                        </View>
                      </Row>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Muted style={{ color: GLASS.onInkSoft, fontSize: 11 }}>
                Escolha suas áreas no Perfil (ou crie metas) para ver o progresso por área.
              </Muted>
            )}

            <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <GlassRing
                ratio={monthAvg == null ? null : Math.min(1, monthAvg / 10)}
                size={54}
                dark
                label={monthAvg == null ? '—' : monthAvg.toFixed(1)}
                caption="mês"
              />
              <View style={{ flex: 1 }}>
                <Txt variant="micro" upper={false} color={GLASS.onInkSoft} style={{ fontSize: 8.5 }}>
                  média do mês
                </Txt>
                <Txt variant="caption" upper={false} color={GLASS.onInk} style={{ fontSize: 11.5 }}>
                  {monthScores.length ? `${monthScores.length} dia(s) com score` : 'Sem dado no mês'}
                </Txt>
              </View>
              <GlassChip label="ver mês" dark accessibilityLabel="Ver constância do mês" onPress={() => router.push('/(tabs)/revisoes')} />
            </View>
          </GlassCard>
        </FadeInDown>

        {/* ── CRONOGRAMA (ajuste fino) + SEMANA ─────────────────────────── */}
        <FadeInDown delay={60}>
          <GlassCard padding={16}>
            <DaySchedule
              slots={schedule}
              now={nowHHmm()}
              syncEnabled={!!store.settings.syncCalendar}
              syncing={syncing}
              onSyncCalendar={() => void runSync()}
              onAlarm={(slot) => void runAlarm(slot)}
            />
          </GlassCard>
        </FadeInDown>
        <FadeInDown delay={65}>
          <GlassCard padding={16}>
            <ScheduleView goals={store.goals} days={store.days} date={today} now={nowHHmm()} />
          </GlassCard>
        </FadeInDown>

        {/* ── CHECK-IN DE ENERGIA ───────────────────────────────────────── */}
        <FadeInDown delay={70}>
          <GlassCard padding={16}>
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
            <Muted style={{ marginTop: 6, fontSize: 10.5 }}>{modeHint(day.mode)}</Muted>
          </GlassCard>
        </FadeInDown>

        {/* ── CHECK-IN DE MEIO DO DIA ───────────────────────────────────── */}
        <GlassCard padding={14}>
          {day.middayCheckin ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                  Meio do dia · {day.middayCheckin.at}
                </Txt>
                <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11.5, marginTop: 2 }}>
                  Prioridade: {day.middayCheckin.priorityDone ? 'feita' : day.middayCheckin.partial ? 'parcial' : 'não feita'} · energia{' '}
                  {day.middayCheckin.energy}/10
                </Txt>
                {day.middayCheckin.note ? <Muted style={{ fontSize: 10.5 }}>{day.middayCheckin.note}</Muted> : null}
              </View>
              <Txt variant="micro" upper={false} color={t.textPrimary} style={{ fontSize: 10, fontWeight: '700' }} onPress={() => setMiddayOpen(true)}>
                editar
              </Txt>
            </Row>
          ) : (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                  Check-in de 30 segundos
                </Txt>
                <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11.5, marginTop: 2 }}>
                  Como está a metade do dia?
                </Txt>
              </View>
              <Txt variant="caption" upper={false} color={t.textPrimary} onPress={() => setMiddayOpen(true)} style={{ fontWeight: '700', fontSize: 11.5 }}>
                abrir
              </Txt>
            </Row>
          )}
        </GlassCard>

        {/* ── CONSTÂNCIA DO MÊS ─────────────────────────────────────────── */}
        <FadeInDown delay={80}>
          <GlassCard padding={14}>
            <MonthRing
              days={monthDays}
              monthLabel={monthLabel(today).toUpperCase()}
              average={monthAvg}
              streak={streak || null}
              onPress={() => router.push('/(tabs)/revisoes')}
            />
          </GlassCard>
        </FadeInDown>

        {/* ── CHECKLIST COMPLETO ────────────────────────────────────────── */}
        <FadeInDown delay={90}>
          <GlassCard padding={16}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <GlassLabel>Checklist completo · {MODES[day.mode].label}</GlassLabel>
              {bestStreak && bestStreak.s > 0 ? (
                <Txt variant="micro" upper={false} color={areaColor(bestStreak.goal.area)} style={{ fontSize: 9.5 }}>
                  melhor: {bestStreak.goal.area}
                </Txt>
              ) : null}
            </Row>
            {dayClosed ? (
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Txt variant="micro" upper={false} color={t.textSecondary} style={{ fontSize: 10 }}>
                  Dia encerrado — checklist congelado.
                </Txt>
                <Txt variant="micro" upper={false} color={t.textPrimary} style={{ fontSize: 10, fontWeight: '700' }} onPress={() => store.reopenDay(today)}>
                  reabrir
                </Txt>
              </Row>
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
          </GlassCard>
        </FadeInDown>

        {/* ── MURAL DE CONSTÂNCIA (6 semanas) ───────────────────────────── */}
        <FadeInDown delay={100}>
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir o mural de constância" onPress={() => router.push('/modulo/constancia')}>
            <GlassCard padding={16}>
              <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <View>
                  <GlassLabel>Últimas 6 semanas</GlassLabel>
                  <Muted style={{ fontSize: 10 }}>toque para o mural completo</Muted>
                </View>
                <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11 }}>
                  ver ano ›
                </Txt>
              </Row>
              <MiniHeatmap days={store.days} weeks={6} />
            </GlassCard>
          </Pressable>
        </FadeInDown>

        {/* ── ALERTAS RÁPIDOS ───────────────────────────────────────────── */}
        {highUndone.length && !dayClosed ? (
          <GlassCard padding={14}>
            <Txt variant="caption" upper={false} color={t.red} style={{ fontWeight: '700', fontSize: 11.5 }}>
              {highUndone.length} prioridade(s) alta(s) em aberto
            </Txt>
            {highUndone.slice(0, 2).map(({ goal }) => (
              <Muted key={goal.id} style={{ marginTop: 4, fontSize: 10.5 }}>
                • {goal.name} — mínimo {goal.min}
              </Muted>
            ))}
          </GlassCard>
        ) : null}

        {reward ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Recompensa: ${reward.name}`} onPress={() => router.push('/modulo/recompensas')}>
            <GlassCard padding={14}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" upper={false} color={t.textSecondary} style={{ fontSize: 11 }}>
                  A {reward.remaining} dia(s) de desbloquear
                </Txt>
                <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontWeight: '700', fontSize: 11 }}>
                  {reward.name}
                </Txt>
              </Row>
            </GlassCard>
          </Pressable>
        ) : null}

        {/* ── RESULTADO E HISTÓRICO ─────────────────────────────────────── */}
        {day.score ? <DayResult day={day} goals={store.goals} animate={showResult} /> : null}

        {day.closedAt && day.middayCheckin ? (
          <GlassCard padding={14}>
            <GlassLabel>Ponto de virada</GlassLabel>
            <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11.5, marginTop: 4 }}>
              {day.middayCheckin.at} · prioridade {day.middayCheckin.priorityDone ? 'feita' : day.middayCheckin.partial ? 'parcial' : 'não feita'} · energia{' '}
              {day.middayCheckin.energy}/10
            </Txt>
          </GlassCard>
        ) : null}

        {day.closedAt ? (
          <Row gap={spacing.sm}>
            <SecondaryButton
              label="Reabrir dia"
              style={{ flex: 1 }}
              onPress={() => {
                store.reopenDay(today);
                setShowResult(false);
              }}
            />
            <SecondaryButton label="Ver revisões" style={{ flex: 1 }} onPress={() => router.push('/(tabs)/revisoes')} />
          </Row>
        ) : null}

        {sheetNote ? (
          <GlassCard padding={14} strong>
            <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11 }} onPress={() => setSheetNote(null)}>
              {sheetNote}
            </Txt>
          </GlassCard>
        ) : null}

        <Row gap={spacing.sm} style={{ justifyContent: 'space-between' }}>
          <Txt variant="micro" upper={false} color={t.textMuted} style={{ flex: 1, fontSize: 9 }}>
            {highPriority.length ? `${highPriority.length} prioridade(s) alta(s)` : 'Nenhuma prioridade alta'}
            {activeGoals.length > 8 ? ' · volume alto: considere reduzir metas' : ''}
          </Txt>
          <Txt
            variant="micro"
            upper={false}
            color={t.textMuted}
            style={{ fontSize: 9 }}
            onPress={() => void openAppLimits().then((r) => setSheetNote(r.message))}
          >
            limitar apps
          </Txt>
        </Row>
      </ScrollView>

      {/* ── RODAPÉ FIXO ─────────────────────────────────────────────────── */}
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

      {/* ── AÇÕES RÁPIDAS (pílula +) ─────────────────────────────────────── */}
      <Sheet visible={quickOpen} onClose={() => setQuickOpen(false)} title="O que você quer abrir?">
        <View style={{ gap: 8 }}>
          {[
            { label: 'Registrar foco (pomodoro)', route: '/modulo/pomodoro' },
            { label: 'Escrever no diário de hoje', route: null },
            { label: 'Criar ou ajustar metas', route: '/(tabs)/metas' },
            { label: 'Ver revisões e constância', route: '/(tabs)/revisoes' },
            { label: 'Estudos, treino, finanças…', route: '/(tabs)/metas' },
          ].map((item) => (
            <GlassCard key={item.label} padding={14} strong>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 12 }}>
                  {item.label}
                </Txt>
                <Txt
                  variant="micro"
                  upper={false}
                  color={t.textMuted}
                  style={{ fontSize: 10 }}
                  onPress={() => {
                    setQuickOpen(false);
                    if (item.route) router.push(item.route as never);
                    else setDiaryOpen(true);
                  }}
                >
                  abrir ›
                </Txt>
              </Row>
            </GlassCard>
          ))}
          <Muted style={{ fontSize: 10.5 }}>
            O “＋” não cria registro sozinho: cada módulo guarda o que é dele (bloco de estudo, série, lançamento).
          </Muted>
        </View>
      </Sheet>

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
        date={monthLabel(today)}
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

/** "1h", "30min" — duração curta para caber dentro do bloco da timeline. */
function totalMinutesLabel(min: number): string {
  const safe = Number.isFinite(min) && min > 0 ? min : 0;
  if (safe < 60) return `${safe}min`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
