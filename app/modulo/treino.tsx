/**
 * Treino — Módulo de Treino e Fitness "FITPULSE" (Bento Box, preto + verde lima).
 *
 * Referência: dashboard FITPULSE (KPIs, volume semanal, treino do dia, nutrição,
 * body stats, PRs + sono, treinos recentes).
 *
 * Regras que valem em toda esta tela:
 *  1. Nada de número inventado. "128 treinos", "12.450 kcal", "18 dias",
 *     "78kg / 42% / 16% / 22.4", "PR +5kg" e "7h 32m" são exemplo de LAYOUT. Sem
 *     registro, o card escreve "Sem dado" — não um zero nem um número de vitrine.
 *  2. Calorias e bpm nunca são calculados pelo app: só aparecem se a pessoa
 *     digitar (o app não tem o dado de gasto energético).
 *  3. IMC precisa de altura E peso. Sem altura cadastrada, é "Sem dado" — não
 *     existe IMC de 22,4 sem saber a altura.
 *  4. Dia sem treino é `null` no gráfico (coluna oca), diferente de treinou-zero.
 *  5. A foto de capa da referência virou forma geométrica: imagem de outra pessoa
 *     não é registro do usuário.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../../src/components/ModalHeader';
import { Icon } from '../../src/components/Icon';
import { Muted, PrimaryButton, Row, SecondaryButton, Sheet, Txt } from '../../src/components/ui';
import {
  FitBadge,
  FitBar,
  FitCard,
  FitCheck,
  FitLabel,
  FitMetric,
  FitRing,
  FitVolumeChart,
  MuscleMap,
  WorkoutCover,
  accentOf,
} from '../../src/components/FitPulse';
import { LineChart } from '../../src/components/charts';
import { radius, spacing, useTheme } from '../../src/theme';
import { useStore } from '../../src/lib/store';
import { addDays, formatMinutes, longDate, shortDate, todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { restTimerAlarm } from '../../src/lib/native';
import { parseMeals, WATER_CUP_ML } from '../../src/lib/diet';
import {
  formatClock,
  isRecorded,
  loadDelta,
  loadSeries,
  muscleOf,
  personalRecords,
  sessionMinutes,
  sessionProgress,
  sessionVolume,
  trainingStreak,
  weeklyVolume,
} from '../../src/lib/training';
import type { ExerciseEntry, WorkoutSession } from '../../src/lib/training';

/**
 * Template inicial: nomes de exercício são vocabulário de treino, não registro.
 * Carga e reps começam em 0 para a pessoa preencher — antes vinham 30 kg fixos,
 * o que parecia dado do usuário.
 */
const TEMPLATE: ExerciseEntry[] = [
  { name: 'Agachamento livre', sets: [0, 1, 2, 3].map(() => ({ reps: 0, weight: null, done: false })), restSec: 90 },
  { name: 'Leg press', sets: [0, 1, 2].map(() => ({ reps: 0, weight: null, done: false })), restSec: 90 },
  { name: 'Cadeira flexora', sets: [0, 1, 2].map(() => ({ reps: 0, weight: null, done: false })), restSec: 60 },
  { name: 'Panturrilha em pé', sets: [0, 1, 2].map(() => ({ reps: 0, weight: null, done: false })), restSec: 45 },
];

const REST_OPTIONS = [45, 60, 90, 120];

/**
 * Sessão salva → sessão editável.
 *
 * Um backup antigo/editado pode trazer `sets` ausente ou carga em texto; sem isto
 * um `undefined.map` derruba a tela. Exercício sem série vira série única vazia
 * (a pessoa edita), nunca desaparece em silêncio.
 */
function toSession(saved: WorkoutSession | undefined, today: string): WorkoutSession {
  if (!saved || !Array.isArray(saved.exercises) || !saved.exercises.length) {
    return { date: today, label: 'Treino A — Pernas', exercises: TEMPLATE, kind: 'forca' };
  }
  const exercises: ExerciseEntry[] = saved.exercises.map((ex) => {
    const rawSets = Array.isArray(ex?.sets) ? ex.sets : [];
    const sets = rawSets.length
      ? rawSets.map((s) => ({
          reps: Number.isFinite(s?.reps) ? Number(s.reps) : 0,
          weight: s?.weight != null && Number.isFinite(Number(s.weight)) ? Number(s.weight) : null,
          done: !!s?.done,
        }))
      : [{ reps: 0, weight: null, done: false }];
    return {
      name: String(ex?.name ?? 'Exercício'),
      sets,
      note: typeof ex?.note === 'string' ? ex.note : undefined,
      restSec: Number.isFinite(Number(ex?.restSec)) ? Number(ex.restSec) : undefined,
      muscle: typeof ex?.muscle === 'string' ? ex.muscle : undefined,
    };
  });
  return {
    date: saved.date || today,
    label: typeof saved.label === 'string' && saved.label.trim() ? saved.label : 'Treino',
    exercises,
    kind: saved.kind === 'cardio' ? 'cardio' : 'forca',
    durationSec: Number.isFinite(Number(saved.durationSec)) ? Number(saved.durationSec) : undefined,
    cardioMin: Number.isFinite(Number(saved.cardioMin)) ? Number(saved.cardioMin) : undefined,
    kcal: Number.isFinite(Number(saved.kcal)) ? Number(saved.kcal) : undefined,
    bpm: Number.isFinite(Number(saved.bpm)) ? Number(saved.bpm) : undefined,
  };
}

/** Meta semanal de treino: 4 sessões é o padrão que a pessoa pode mudar aqui. */
const WEEKS_GOAL = 4;

export default function TreinoScreen() {
  const router = useRouter();
  const t = useTheme();
  const store = useStore();
  const today = todayKey();
  const day = store.days.find((d) => d.date === today);
  const savedToday = day?.diary.workout as WorkoutSession | undefined;

  const [session, setSession] = useState<WorkoutSession>(() =>
    toSession(savedToday, today),
  );
  // Sessão já registrada hoje vira ponto de partida: reabrir a tela não apaga o
  // que foi feito. Antes só o cronômetro voltava e as séries marcadas sumiam.
  // A normalização fica no inicializador (e não num efeito) para o primeiro
  // render já sair certo — efeito rodaria depois do HTML.
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(savedToday?.durationSec ?? 0);
  const [rest, setRest] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [saved, setSaved] = useState(!!savedToday);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);
  const [heightOpen, setHeightOpen] = useState(false);
  const [heightDraft, setHeightDraft] = useState(String(store.settings.heightCm ?? ''));
  const [kcalDraft, setKcalDraft] = useState(savedToday?.kcal ? String(savedToday.kcal) : '');
  const [bpmDraft, setBpmDraft] = useState(savedToday?.bpm ? String(savedToday.bpm) : '');
  const [goalWeek, setGoalWeek] = useState(WEEKS_GOAL);
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

  /* ─────────────────────────── histórico real ─────────────────────────── */

  const history = useMemo<WorkoutSession[]>(
    () =>
      store.days
        .map((d) => d.diary.workout as WorkoutSession | undefined)
        .filter((w): w is WorkoutSession => !!w)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [store.days],
  );

  const previous = useMemo(() => {
    const past = history.filter((s) => s.date !== today);
    return past.length ? past[past.length - 1] : undefined;
  }, [history, today]);

  const progress = sessionProgress(session);
  const volumeKg = sessionVolume(session);
  const series = loadSeries(history, session.exercises[0]?.name ?? '');
  const records = useMemo(() => personalRecords(history, 3), [history]);
  const streak = useMemo(() => trainingStreak(history, today), [history, today]);

  /** Últimos 28 dias: os 7 da semana atual para o gráfico, 28 para o KPI. */
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i))), [today]);
  const weekBars = useMemo(
    () =>
      weeklyVolume(history, weekDays).map((d, i) => ({
        label: shortDate(d.date).slice(0, 2),
        strength: d.strength,
        cardio: d.cardio,
        isToday: i === weekDays.length - 1,
      })),
    [history, weekDays, today],
  );

  const weekSessions = weekDays.filter((d) => isRecorded(history.find((s) => s.date === d))).length;
  const weekMinutes = weekDays.reduce((total, d) => {
    const s = history.find((x) => x.date === d);
    return total + (s ? sessionMinutes(s) : 0);
  }, 0);

  const last28 = useMemo(() => Array.from({ length: 28 }, (_, i) => addDays(today, -i)), [today]);
  const sessions28 = last28.filter((d) => isRecorded(history.find((s) => s.date === d))).length;
  const minutes28 = last28.reduce((total, d) => {
    const s = history.find((x) => x.date === d);
    return total + (s ? sessionMinutes(s) : 0);
  }, 0);

  /* ─────────────────────────── nutrição e corpo ─────────────────────────── */

  const meals = useMemo(() => parseMeals(day?.diary.food), [day?.diary.food]);
  const waterCups = day?.diary.waterCups;
  const weightNow = useMemo(() => {
    const sorted = [...store.weight].filter((w) => Number.isFinite(w.kg)).sort((a, b) => (a.date < b.date ? -1 : 1));
    return sorted.length ? sorted[sorted.length - 1]! : null;
  }, [store.weight]);
  const weightDelta = useMemo(() => {
    const sorted = [...store.weight].filter((w) => Number.isFinite(w.kg)).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (sorted.length < 2) return null;
    const last = sorted[sorted.length - 1]!;
    const prev = sorted[sorted.length - 2]!;
    return Math.round((last.kg - prev.kg) * 10) / 10;
  }, [store.weight]);

  /** IMC só com altura cadastrada e peso registrado. */
  const bmi = useMemo(() => {
    const h = store.settings.heightCm;
    if (!h || !Number.isFinite(h) || h < 80 || !weightNow) return null;
    const m = h / 100;
    return Math.round((weightNow.kg / (m * m)) * 10) / 10;
  }, [store.settings.heightCm, weightNow]);
  const bmiClass = bmi == null ? null : bmi < 18.5 ? 'Abaixo' : bmi < 25 ? 'Faixa saudável' : bmi < 30 ? 'Sobrepeso' : 'Obesidade';

  /** Macro do dia: soma feita com o que a pessoa registrou, não estimativa do app. */
  const macros = useMemo(() => {
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    for (const m of meals) {
      const p = /(\d+(?:[.,]\d+)?)\s*g\s*(?:de\s*)?prot/i.exec(m.what);
      const c = /(\d+(?:[.,]\d+)?)\s*g\s*(?:de\s*)?carb/i.exec(m.what);
      const f = /(\d+(?:[.,]\d+)?)\s*g\s*(?:de\s*)?(?:gord|fat)/i.exec(m.what);
      if (p?.[1]) protein += Number(p[1].replace(',', '.'));
      if (c?.[1]) carbs += Number(c[1].replace(',', '.'));
      if (f?.[1]) fat += Number(f[1].replace(',', '.'));
    }
    const entered = protein + carbs + fat > 0;
    return { protein, carbs, fat, entered };
  }, [meals]);

  /* ─────────────────────────── sono da noite ─────────────────────────── */

  const sleep = day?.diary.sleep;
  const sleepHours = sleep && sleep.hours > 0 ? sleep.hours : null;

  /* ─────────────────────────── escrita ─────────────────────────── */

  const setSet = (exIndex: number, setIndex: number, patch: Partial<{ reps: number; weight: number | null; done: boolean }>) => {
    setSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, ei) =>
        ei !== exIndex ? ex : { ...ex, sets: ex.sets.map((s, si) => (si !== setIndex ? s : { ...s, ...patch })) },
      ),
    }));
  };

  /** Marcar a última série de um exercício inicia o descanso prescrito dele. */
  const toggleSet = (exIndex: number, setIndex: number) => {
    const ex = session.exercises[exIndex];
    const set = ex?.sets[setIndex];
    if (!ex || !set) return;
    const next = !set.done;
    haptic(next ? 'success' : 'light');
    setSet(exIndex, setIndex, { done: next });
    if (next && ex.restSec) {
      setRest(ex.restSec);
      void restTimerAlarm(ex.restSec);
    }
  };

  const save = () => {
    if (progress.done === 0) return;
    store.patchDiary(today, {
      workout: {
        ...session,
        durationSec: elapsed,
        kcal: kcalDraft.trim() ? Number(kcalDraft.replace(/[^\d]/g, '')) : undefined,
        bpm: bpmDraft.trim() ? Number(bpmDraft.replace(/[^\d]/g, '')) : undefined,
      },
    });
    setSaved(true);
    haptic('success');
  };

  const restart = () => {
    setSession({ date: today, label: 'Treino A — Pernas', exercises: TEMPLATE.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })), kind: 'forca' });
    setElapsed(0);
    setSaved(false);
    setRunning(false);
  };

  /* ─────────────────────────── derivados de exibição ─────────────────────────── */

  const focusGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const ex of session.exercises) {
      const g = muscleOf(ex);
      if (g) groups.add(g);
    }
    return [...groups];
  }, [session.exercises]);

  const recent = useMemo(
    () =>
      [...history]
        .filter((s) => s.date !== today && isRecorded(s))
        .reverse()
        .slice(0, 3),
    [history, today],
  );

  const firstName = (store.user.name || 'operador').split(' ')[0] ?? 'operador';
  const nextLabel = session.label;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgPrimary }} edges={['top']}>
      <ModalHeader title="Treino" subtitle={nextLabel} onAdd={restart} addLabel="Reiniciar" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, gap: spacing.md }}>
        {/* ── CABEÇALHO FITPULSE ────────────────────────────────────────── */}
        <View style={{ gap: 6 }}>
          <Row gap={8} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                backgroundColor: accentOf(),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="raio" size={16} color={t.onNeon ?? t.black} strokeWidth={2.4} />
            </View>
            <Txt variant="h1" upper={false} color={t.textPrimary} style={{ fontSize: 22, letterSpacing: 1.4, fontWeight: '900' }}>
              FITPULSE
            </Txt>
            <View style={{ flex: 1 }} />
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 10 }} onPress={() => setHeightOpen(true)}>
              perfil
            </Txt>
          </Row>
          <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 13.5, fontWeight: '700' }} numberOfLines={2}>
            Olá, {firstName} — bora treinar {session.kind === 'cardio' ? 'cardio' : 'pernas'}?
          </Txt>
          <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 10 }}>
            {longDate(today).replace(/^\w/, (c) => c.toUpperCase())}
          </Txt>
        </View>

        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <Row gap={8} style={{ alignItems: 'stretch' }}>
          {[
            {
              icon: 'treino' as const,
              label: 'Treinos',
              value: String(sessions28),
              unit: '28d',
              foot: sessions28 ? 'sessões registradas' : 'Sem dado',
              extra: previous ? `${sessionMinutes(previous)}min na última` : 'Sem sessão anterior',
            },
            {
              icon: 'streak' as const,
              label: 'Sequência',
              value: String(streak.streak),
              unit: streak.streak === 1 ? 'dia' : 'dias',
              foot: streak.best ? `recorde ${streak.best}d` : 'sem recorde',
              extra: weekSessions >= goalWeek ? 'meta da semana batida' : `${weekSessions}/${goalWeek} na semana`,
            },
          ].map((k) => (
            <FitCard key={k.label} style={{ flex: 1 }} padding={12} dense>
              <Row gap={6} style={{ alignItems: 'center' }}>
                <Icon name={k.icon} size={13} color={accentOf()} />
                <FitLabel>{k.label}</FitLabel>
              </Row>
              <FitMetric value={k.value} unit={k.unit} size={22} />
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }} numberOfLines={1}>
                {k.foot}
              </Txt>
              <Txt variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 8 }} numberOfLines={1}>
                {k.extra}
              </Txt>
            </FitCard>
          ))}
        </Row>
        <Row gap={8} style={{ alignItems: 'stretch' }}>
          {[
            {
              icon: 'relogio' as const,
              label: 'Minutos ativos',
              value: String(minutes28),
              unit: 'min',
              foot: minutes28 ? 'cronômetro somado (28d)' : 'Sem dado',
              extra: avgLabel(minutes28, sessions28),
            },
            {
              icon: 'raio' as const,
              label: 'Volume hoje',
              value: volumeKg > 0 ? volumeKg.toFixed(0) : '—',
              unit: volumeKg > 5000 ? 'ton' : 'kg',
              foot: previous && isRecorded(previous) ? `último ${sessionVolume(previous).toFixed(0)}kg` : 'Sem referência',
              extra: progress.done ? `${progress.done}/${progress.total} séries` : 'nenhuma série feita',
            },
          ].map((k) => (
            <FitCard key={k.label} style={{ flex: 1 }} padding={12} dense>
              <Row gap={6} style={{ alignItems: 'center' }}>
                <Icon name={k.icon} size={13} color={t.cyan} />
                <FitLabel>{k.label}</FitLabel>
              </Row>
              <FitMetric value={k.value} unit={k.unit} size={22} />
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }} numberOfLines={1}>
                {k.foot}
              </Txt>
              <Txt variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 8 }} numberOfLines={1}>
                {k.extra}
              </Txt>
            </FitCard>
          ))}
        </Row>

        {/* ── VOLUME SEMANAL + META ────────────────────────────────────── */}
        <FitCard padding={16}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 13, fontWeight: '700' }}>
                Volume da semana
              </Txt>
              <FitLabel>últimos 7 dias · carga × reps e cardio</FitLabel>
            </View>
            <Row gap={6}>
              <Row gap={4} style={{ alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentOf() }} />
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8 }}>
                  força
                </Txt>
              </Row>
              <Row gap={4} style={{ alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.cyan }} />
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8 }}>
                  cardio
                </Txt>
              </Row>
            </Row>
          </Row>

          <Row gap={10} style={{ alignItems: 'center', marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <FitVolumeChart bars={weekBars} highlight={6} height={104} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <FitRing
                ratio={goalWeek > 0 ? Math.min(1, weekSessions / goalWeek) : null}
                size={84}
                label={goalWeek > 0 ? `${Math.round(Math.min(1, weekSessions / goalWeek) * 100)}%` : '—'}
                caption={goalWeek > 0 ? `meta ${goalWeek}x` : 'sem meta'}
              />
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8, marginTop: 2 }}>
                {weekSessions}/{goalWeek} sessões
              </Txt>
            </View>
          </Row>

          <Row gap={6} style={{ marginTop: 8 }}>
            {[3, 4, 5].map((g) => (
              <Pressable key={g} accessibilityRole="button" accessibilityLabel={`Meta de ${g} treinos por semana`} onPress={() => setGoalWeek(g)}>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: radius.pill,
                    backgroundColor: goalWeek === g ? accentOf() : t.bgSubtle,
                  }}
                >
                  <Txt variant="micro" upper={false} color={goalWeek === g ? (t.onNeon ?? t.black) : t.textMuted} style={{ fontSize: 9, fontWeight: '700' }}>
                    {g}x/semana
                  </Txt>
                </View>
              </Pressable>
            ))}
          </Row>

          {/* Botão principal, como o "Start Workout" da referência */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pausar treino' : 'Começar treino'}
            onPress={() => {
              haptic('medium');
              setRunning((r) => !r);
            }}
            style={{
              marginTop: 12,
              height: 46,
              borderRadius: 16,
              backgroundColor: accentOf(),
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Icon name={running ? 'pausa' : 'play'} size={15} color={t.onNeon ?? t.black} strokeWidth={2.6} />
            <Txt variant="caption" upper={false} color={t.onNeon ?? t.black} style={{ fontSize: 13.5, fontWeight: '800' }}>
              {running ? `Pausar · ${formatClock(elapsed)}` : elapsed ? `Continuar · ${formatClock(elapsed)}` : 'Começar treino'}
            </Txt>
          </Pressable>
          <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
              {progress.done ? `${progress.done}/${progress.total} séries · ${volumeKg.toFixed(0)} kg` : 'marque as séries para registrar'}
            </Txt>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }} onPress={() => setExtrasOpen(true)}>
              finalizar e salvar ›
            </Txt>
          </Row>
        </FitCard>

        {/* ── TREINO DE HOJE ───────────────────────────────────────────── */}
        <FitCard padding={16} accentBorder>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 13, fontWeight: '700' }}>
                Treino de hoje
              </Txt>
              <FitLabel>{session.label}</FitLabel>
            </View>
            <FitBadge label={progress.done ? `${progress.done}/${progress.total} séries` : 'não iniciado'} tone={progress.done ? 'accent' : 'muted'} small />
          </Row>

          <Row gap={10} style={{ marginTop: 10, alignItems: 'center' }}>
            <MuscleMap groups={focusGroups} width={86} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
                grupos do treino
              </Txt>
              {focusGroups.length ? (
                focusGroups.map((g) => (
                  <Txt key={g} variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11 }}>
                    · {g}
                  </Txt>
                ))
              ) : (
                <Txt variant="caption" upper={false} color={t.textMuted} style={{ fontSize: 10.5 }}>
                  Sem grupo identificado pelos nomes dos exercícios.
                </Txt>
              )}
            </View>
          </Row>

          <View style={{ marginTop: 12, gap: 10 }}>
            {session.exercises.map((ex, exIndex) => {
              const delta = loadDelta(ex, history);
              const done = ex.sets.filter((s) => s.done).length;
              const muscle = muscleOf(ex);
              return (
                <View key={`${ex.name}-${exIndex}`} style={{ gap: 5 }}>
                  <Row gap={8} style={{ alignItems: 'center' }}>
                    <FitCheck
                      checked={done === ex.sets.length && ex.sets.length > 0}
                      onToggle={() => {
                        const allDone = ex.sets.every((s) => s.done);
                        ex.sets.forEach((_, si) => setSet(exIndex, si, { done: !allDone }));
                        haptic(!allDone ? 'success' : 'light');
                      }}
                      label={`Marcar todas as séries de ${ex.name}`}
                    />
                    <Txt variant="caption" upper={false} color={t.textPrimary} style={{ flex: 1, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                      {ex.name}
                    </Txt>
                    <Txt
                      variant="micro"
                      upper={false}
                      color={done ? accentOf() : t.textMuted}
                      style={{ fontSize: 9.5, fontWeight: '700' }}
                    >
                      {done}/{ex.sets.length}
                    </Txt>
                  </Row>
                  <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5, paddingLeft: 25 }} numberOfLines={1}>
                    {ex.sets.length} séries · {muscle ?? 'grupo não informado'}
                    {ex.restSec ? ` · descanso ${ex.restSec}s` : ''} · {delta.label}
                  </Txt>

                  {/* séries: marcar + reps + carga */}
                  <View style={{ paddingLeft: 25, gap: 4 }}>
                    {ex.sets.map((set, setIndex) => (
                      <Row key={setIndex} gap={6} style={{ alignItems: 'center' }}>
                        <FitCheck
                          checked={set.done}
                          onToggle={() => toggleSet(exIndex, setIndex)}
                          label={`Série ${setIndex + 1} de ${ex.name}`}
                        />
                        <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5, width: 20 }}>
                          {setIndex + 1}ª
                        </Txt>
                        <TextInput
                          value={set.reps ? String(set.reps) : ''}
                          onChangeText={(v) => setSet(exIndex, setIndex, { reps: Number(v.replace(/\D/g, '')) || 0 })}
                          keyboardType="number-pad"
                          placeholder="reps"
                          placeholderTextColor={t.textFaint}
                          style={{
                            width: 54,
                            backgroundColor: t.bgInput,
                            borderWidth: 1,
                            borderColor: t.border,
                            borderRadius: 8,
                            paddingVertical: 4,
                            paddingHorizontal: 6,
                            color: t.textPrimary,
                            fontSize: 11,
                          }}
                        />
                        <TextInput
                          value={set.weight == null ? '' : String(set.weight)}
                          onChangeText={(v) => {
                            const clean = v.replace(/[^\d.,]/g, '').replace(',', '.');
                            setSet(exIndex, setIndex, { weight: clean ? Number(clean) : null });
                          }}
                          keyboardType="decimal-pad"
                          placeholder="kg"
                          placeholderTextColor={t.textFaint}
                          style={{
                            width: 54,
                            backgroundColor: t.bgInput,
                            borderWidth: 1,
                            borderColor: t.border,
                            borderRadius: 8,
                            paddingVertical: 4,
                            paddingHorizontal: 6,
                            color: t.textPrimary,
                            fontSize: 11,
                          }}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Anotar fadiga em ${ex.name}`}
                          onPress={() => setNoteFor(exIndex)}
                          style={{ flex: 1 }}
                        >
                          <Txt variant="micro" upper={false} color={ex.note ? t.textSecondary : t.textFaint} style={{ fontSize: 8.5 }} numberOfLines={1}>
                            {ex.note ? `nota: ${ex.note}` : '+ anotação'}
                          </Txt>
                        </Pressable>
                      </Row>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          <Row gap={6} style={{ marginTop: 12 }}>
            {REST_OPTIONS.map((sec) => (
              <Pressable
                key={sec}
                accessibilityRole="button"
                accessibilityLabel={`Descanso de ${sec} segundos`}
                onPress={() => {
                  haptic('light');
                  setRest(sec);
                  void restTimerAlarm(sec);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  backgroundColor: restLeft > 0 && rest === sec ? accentOf() : t.bgSubtle,
                }}
              >
                <Txt
                  variant="micro"
                  upper={false}
                  color={restLeft > 0 && rest === sec ? (t.onNeon ?? t.black) : t.textMuted}
                  style={{ fontSize: 9.5, fontWeight: '700' }}
                >
                  {sec}s
                </Txt>
              </Pressable>
            ))}
          </Row>
          {restLeft > 0 ? (
            <Txt variant="h2" upper={false} color={accentOf()} style={{ textAlign: 'center', marginTop: 6, fontSize: 24 }}>
              {formatClock(restLeft)}
            </Txt>
          ) : (
            <Muted style={{ fontSize: 9.5, marginTop: 6 }}>O aviso do descanso chega como notificação mesmo com o app em segundo plano.</Muted>
          )}
        </FitCard>

        {/* ── PRÓXIMO TREINO + HIDRATAÇÃO ───────────────────────────────── */}
        <FitCard padding={16}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <FitLabel>Próximo treino</FitLabel>
              <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 13, fontWeight: '700' }}>
                {nextLabel}
              </Txt>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
                {savedToday ? 'registrado hoje' : 'a fazer hoje'} · {focusGroups.slice(0, 3).join(' · ') || 'grupos a definir'}
              </Txt>
            </View>
            <Icon name="calendário" size={16} color={t.textMuted} />
          </Row>

          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 10 }} />

          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <FitLabel>Água</FitLabel>
            <Row gap={6}>
              <Txt
                variant="micro"
                upper={false}
                color={t.textMuted}
                style={{ fontSize: 10 }}
                onPress={() => store.patchDiary(today, { waterCups: Math.max(0, (waterCups ?? 0) - 1) })}
              >
                −
              </Txt>
              <Txt
                variant="micro"
                upper={false}
                color={accentOf()}
                style={{ fontSize: 13, fontWeight: '800' }}
                onPress={() => store.patchDiary(today, { waterCups: (waterCups ?? 0) + 1 })}
              >
                +
              </Txt>
            </Row>
          </Row>
          <Txt variant="h1" upper={false} color={t.textPrimary} style={{ fontSize: 20, letterSpacing: -0.5, marginTop: 2 }}>
            {waterCups == null ? '—' : `${((waterCups * WATER_CUP_ML) / 1000).toFixed(1)}L`}
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 10 }}>
              {' '}
              de 2,0L
            </Txt>
          </Txt>
          <View style={{ marginTop: 6 }}>
            <FitBar ratio={waterCups == null ? null : waterCups / 8} height={7} label="Hidratação do dia" />
          </View>
          <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5, marginTop: 4 }}>
            {waterCups == null
              ? 'Sem registro de água hoje — toque no + para começar.'
              : `${waterCups} copo(s) de 250 ml · ${Math.max(0, 8 - waterCups)} para a meta de 8`}
          </Txt>
        </FitCard>

        {/* ── NUTRIÇÃO DE HOJE ─────────────────────────────────────────── */}
        <FitCard padding={16}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <FitLabel>Nutrição de hoje</FitLabel>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }} onPress={() => router.push('/modulo/dieta' as never)}>
              módulo dieta ›
            </Txt>
          </Row>
          {meals.length ? (
            <View style={{ gap: 8 }}>
              {meals.slice(0, 4).map((m, i) => (
                <Row key={`${m.time}-${i}`} gap={8} style={{ alignItems: 'center' }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.onPlan ? accentOf() : t.yellow }} />
                  <Txt variant="micro" upper={false} color={t.textSecondary} style={{ fontSize: 9, width: 34 }}>
                    {m.time || '—'}
                  </Txt>
                  <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11, flex: 1 }} numberOfLines={1}>
                    {m.kind} · {m.what}
                  </Txt>
                  {!m.onPlan ? <FitBadge label="fora do plano" tone="down" small /> : null}
                </Row>
              ))}
              {meals.length > 4 ? (
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
                  +{meals.length - 4} refeição(ões) registrada(s)
                </Txt>
              ) : null}
            </View>
          ) : (
            <Muted style={{ fontSize: 10.5 }}>Sem refeição registrada hoje. O app não estima caloria nem macro.</Muted>
          )}

          <View style={{ marginTop: 10, gap: 6 }}>
            {[
              { label: 'Proteína', value: macros.protein, unit: 'g' },
              { label: 'Carbo', value: macros.carbs, unit: 'g' },
              { label: 'Gordura', value: macros.fat, unit: 'g' },
            ].map((m) => (
              <Row key={m.label} gap={8} style={{ alignItems: 'center' }}>
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9, width: 56 }}>
                  {m.label}
                </Txt>
                <View style={{ flex: 1 }}>
                  {/* Sem meta de macro cadastrada: a barra mostra o que foi escrito, sem alvo inventado */}
                  <FitBar ratio={macros.entered ? Math.min(1, m.value / 150) : null} height={5} label={`${m.label} do dia`} />
                </View>
                <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5, width: 42, textAlign: 'right' }}>
                  {macros.entered ? `${m.value.toFixed(0)}${m.unit}` : '—'}
                </Txt>
              </Row>
            ))}
          </View>
          <Txt variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 8, marginTop: 6 }}>
            Soma dos gramas escritos nas refeições (“120g proteína”). Sem gramas no texto, não há macro para somar.
          </Txt>
        </FitCard>

        {/* ── BODY STATS ───────────────────────────────────────────────── */}
        <FitCard padding={16}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <FitLabel>Corpo</FitLabel>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }} onPress={() => setHeightOpen(true)}>
              altura {store.settings.heightCm ? `${store.settings.heightCm} cm` : 'não informada'} ›
            </Txt>
          </Row>
          {[
            {
              label: 'Peso',
              value: weightNow ? `${weightNow.kg.toFixed(1).replace('.', ',')} kg` : '—',
              extra: weightDelta == null ? 'sem comparação' : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1).replace('.', ',')} kg vs anterior`,
              tone: weightDelta == null ? 'muted' : weightDelta > 0 ? 'down' : 'accent',
            },
            {
              label: 'IMC',
              value: bmi == null ? '—' : bmi.toFixed(1).replace('.', ','),
              extra: bmi == null ? 'precisa de peso e altura' : (bmiClass as string),
              tone: 'muted',
            },
            {
              label: 'Gordura',
              value: '—',
              extra: 'o app não mede composição corporal',
              tone: 'muted',
            },
            {
              label: 'Massa muscular',
              value: '—',
              extra: 'o app não mede composição corporal',
              tone: 'muted',
            },
          ].map((row) => (
            <Row key={row.label} style={{ justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
              <Txt variant="caption" upper={false} color={t.textSecondary} style={{ fontSize: 11.5 }}>
                {row.label}
              </Txt>
              <Row gap={8} style={{ alignItems: 'center' }}>
                <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 12, fontWeight: '700' }}>
                  {row.value}
                </Txt>
                <Txt
                  variant="micro"
                  upper={false}
                  color={row.tone === 'down' ? t.red : row.tone === 'accent' ? accentOf() : t.textMuted}
                  style={{ fontSize: 8.5, maxWidth: 128, textAlign: 'right' }}
                  numberOfLines={2}
                >
                  {row.extra}
                </Txt>
              </Row>
            </Row>
          ))}
          <Muted style={{ fontSize: 9, marginTop: 4 }}>
            Peso vem do módulo Peso. Composição corporal e IMC exigem dados que o app não coleta sozinho.
          </Muted>
        </FitCard>

        {/* ── RECORDES + SONO ──────────────────────────────────────────── */}
        <FitCard padding={16}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <FitLabel>Recordes pessoais</FitLabel>
            <Icon name="trofeu" size={14} color={accentOf()} />
          </Row>
          {records.length ? (
            <View style={{ marginTop: 6, gap: 6 }}>
              {records.map((r) => (
                <Row key={r.exercise} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 11.5, flex: 1 }} numberOfLines={1}>
                    {r.exercise}
                  </Txt>
                  <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9, marginRight: 8 }}>
                    {r.weight} kg · {shortDate(r.date)}
                  </Txt>
                  <FitBadge
                    label={r.delta == null ? 'PR' : `PR ${r.delta > 0 ? '+' : ''}${r.delta}kg`}
                    tone={r.delta == null ? 'muted' : r.delta > 0 ? 'accent' : 'down'}
                    small
                  />
                </Row>
              ))}
            </View>
          ) : (
            <Muted style={{ fontSize: 10.5, marginTop: 4 }}>
              Sem recorde: nenhuma série com carga registrada ainda.
            </Muted>
          )}

          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 10 }} />

          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <FitLabel>Sono da noite</FitLabel>
              <Txt variant="h1" upper={false} color={t.textPrimary} style={{ fontSize: 20, letterSpacing: -0.5 }}>
                {sleepHours == null ? '—' : `${Math.floor(sleepHours)}h ${String(Math.round((sleepHours % 1) * 60)).padStart(2, '0')}`}
              </Txt>
              <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }}>
                {sleepHours == null
                  ? 'sem registro de sono hoje'
                  : sleep && sleep.quality > 0
                    ? `qualidade ${sleep.quality}/10`
                    : 'qualidade não informada'}
              </Txt>
            </View>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5 }} onPress={() => router.push('/modulo/sono' as never)}>
              módulo sono ›
            </Txt>
          </Row>
        </FitCard>

        {/* ── TREINOS RECENTES ─────────────────────────────────────────── */}
        <View style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 13, fontWeight: '700' }}>
              Treinos recentes
            </Txt>
            <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }}>
              {history.filter(isRecorded).length} registrado(s)
            </Txt>
          </Row>
          {recent.length ? (
            recent.map((s) => (
              <FitCard key={s.date} padding={12} dense>
                <Row gap={10} style={{ alignItems: 'center' }}>
                  <View style={{ width: 92 }}>
                    <WorkoutCover area="Treino" height={62} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="caption" upper={false} color={t.textPrimary} style={{ fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                      {s.label}
                    </Txt>
                    <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 9 }} numberOfLines={1}>
                      {sessionMinutes(s)}min
                      {s.kcal ? ` · ${s.kcal} kcal (informado)` : ''}
                      {s.bpm ? ` · ${s.bpm} bpm (informado)` : ''}
                    </Txt>
                    <Txt variant="micro" upper={false} color={t.textFaint} style={{ fontSize: 8.5 }}>
                      {sessionVolume(s) > 0 ? `${sessionVolume(s).toFixed(0)} kg de volume` : 'sem carga registrada'} · {shortDate(s.date)}
                    </Txt>
                  </View>
                  <FitBadge label={streakLabel(s.date, today)} tone="muted" small />
                </Row>
              </FitCard>
            ))
          ) : (
            <FitCard padding={14}>
              <Muted style={{ fontSize: 10.5 }}>
                Nenhum treino anterior registrado. A primeira sessão salva aparece aqui.
              </Muted>
            </FitCard>
          )}
        </View>

        {/* ── CARGA PROGRESSIVA ────────────────────────────────────────── */}
        <FitCard padding={16}>
          <FitLabel>Carga progressiva · {session.exercises[0]?.name ?? 'Sem dado'}</FitLabel>
          {series.length < 2 ? (
            <Muted style={{ fontSize: 10.5, marginTop: 6 }}>
              Sem dado suficiente — são necessárias 2 sessões com carga nesse exercício para traçar tendência.
            </Muted>
          ) : (
            <View style={{ marginTop: 6 }}>
              <LineChart
                series={[{ name: 'carga', color: accentOf(), points: series.map((p) => p.weight) }]}
                labels={series.map((p) => shortDate(p.date))}
                height={130}
                unit="kg"
                max={Math.max(1, ...series.map((p) => p.weight)) * 1.2}
              />
            </View>
          )}
        </FitCard>

        {/* ── ÚLTIMOS 7 DIAS ───────────────────────────────────────────── */}
        <FitCard padding={14}>
          <FitLabel>Últimos 7 dias</FitLabel>
          <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {weekDays.map((d) => {
              const s = history.find((x) => x.date === d);
              const has = isRecorded(s);
              return (
                <View
                  key={d}
                  accessibilityLabel={`${shortDate(d)}: ${has ? 'treinou' : 'sem treino'}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: has ? accentOf() : t.border,
                    backgroundColor: has ? `${accentOf()}22` : t.bgInput,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt variant="micro" upper={false} color={has ? accentOf() : t.textMuted} style={{ fontSize: 9 }}>
                    {d.slice(8)}
                  </Txt>
                </View>
              );
            })}
          </Row>
          <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 8.5, marginTop: 6 }}>
            {weekSessions} de 7 dias com treino · {formatMinutes(weekMinutes)} no total
          </Txt>
        </FitCard>

        <Row gap={spacing.sm} style={{ alignItems: 'center' }}>
          <Muted style={{ flex: 1, fontSize: 9.5 }}>
            {progress.done === 0 ? 'Marque as séries feitas para registrar a sessão.' : `${progress.done} séries prontas · ${volumeKg.toFixed(0)} kg.`}
          </Muted>
          <PrimaryButton label={saved ? 'Salvo' : 'Salvar treino'} disabled={progress.done === 0} onPress={save} />
        </Row>
      </ScrollView>

      {/* ── SHEETS ───────────────────────────────────────────────────── */}
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
              placeholderTextColor={t.textMuted}
              multiline
              style={{
                backgroundColor: t.bgInput,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: t.textPrimary,
                minHeight: 90,
                textAlignVertical: 'top',
              }}
            />
            <PrimaryButton label="Pronto" onPress={() => setNoteFor(null)} />
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={extrasOpen} onClose={() => setExtrasOpen(false)} title="Finalizar sessão">
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Muted>
            Calorias e bpm são opcionais e vêm do que você digitar (relógio, esteira, app de fora). O app não calcula gasto calórico.
          </Muted>
          <Txt variant="micro" color={t.textSecondary}>
            Calorias (kcal)
          </Txt>
          <TextInput
            value={kcalDraft}
            onChangeText={(v) => setKcalDraft(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            placeholder="Sem dado"
            placeholderTextColor={t.textMuted}
            style={{
              backgroundColor: t.bgInput,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: radius.md,
              padding: spacing.md,
              color: t.textPrimary,
            }}
          />
          <Txt variant="micro" color={t.textSecondary}>
            Frequência média (bpm)
          </Txt>
          <TextInput
            value={bpmDraft}
            onChangeText={(v) => setBpmDraft(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            placeholder="Sem dado"
            placeholderTextColor={t.textMuted}
            style={{
              backgroundColor: t.bgInput,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: radius.md,
              padding: spacing.md,
              color: t.textPrimary,
            }}
          />
          <PrimaryButton
            label="Salvar treino"
            disabled={progress.done === 0}
            onPress={() => {
              save();
              setExtrasOpen(false);
            }}
          />
          <Txt variant="micro" color={t.textMuted} style={{ fontSize: 9 }}>
            {progress.done === 0 ? 'Nenhuma série marcada: nada será salvo.' : `${progress.done} série(s) · ${volumeKg.toFixed(0)} kg de volume · ${formatClock(elapsed)}`}
          </Txt>
        </View>
      </Sheet>

      <Sheet visible={heightOpen} onClose={() => setHeightOpen(false)} title="Altura (para o IMC)">
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Muted>O IMC precisa da altura. Sem ela, o card mostra “Sem dado” em vez de um número inventado.</Muted>
          <TextInput
            value={heightDraft}
            onChangeText={(v) => setHeightDraft(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            placeholder="Ex.: 178"
            placeholderTextColor={t.textMuted}
            style={{
              backgroundColor: t.bgInput,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: radius.md,
              padding: spacing.md,
              color: t.textPrimary,
            }}
          />
          <PrimaryButton
            label="Salvar altura"
            onPress={() => {
              const cm = Number(heightDraft);
              store.updateSettings({ heightCm: Number.isFinite(cm) && cm >= 80 && cm <= 260 ? cm : undefined });
              setHeightOpen(false);
            }}
          />
          {store.settings.heightCm ? (
            <SecondaryButton
              label="Remover altura (IMC volta a “Sem dado”)"
              onPress={() => {
                store.updateSettings({ heightCm: undefined });
                setHeightDraft('');
                setHeightOpen(false);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet visible={waterOpen} onClose={() => setWaterOpen(false)} title="Hidratação">
        <View style={{ padding: spacing.lg }}>
          <Muted>
            Um copo = {WATER_CUP_ML} ml. Meta de 8 copos (2 L). O registro é o mesmo do módulo Dieta — não existe contador paralelo.
          </Muted>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

/** Média de minutos por sessão — `null` quando não há sessão (não 0min). */
function avgLabel(minutes: number, sessions: number): string {
  if (!sessions) return 'sem sessão';
  return `média ${Math.round(minutes / sessions)}min`;
}

/** "hoje", "ontem", "há N dias" — relativo ao dia atual, sem inventar data. */
function streakLabel(date: string, today: string): string {
  const a = new Date(`${date}T12:00:00`).getTime();
  const b = new Date(`${today}T12:00:00`).getTime();
  const diff = Math.round((b - a) / 86_400_000);
  if (diff <= 0) return 'hoje';
  if (diff === 1) return 'ontem';
  return `há ${diff}d`;
}
