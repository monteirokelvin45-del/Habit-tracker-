/**
 * Estudos — "iDraft Soft UI" (monocromático).
 *
 * Redesenho visual da tela. TODA a lógica existente continua: blocos de estudo,
 * Pomodoro 25/5 e 50/10, modo foco rígido com detector de fuga, edital com peso
 * e fila de revisão, apoio TDAH, histórico por matéria.
 *
 * Regras de dado (as mesmas do resto do app):
 *  - semana sem registro fica `null`: a linha do gráfico QUEBRA, não cai a zero;
 *  - anel sem base de cálculo mostra só o trilho e "Sem dado";
 *  - avaliação/desempenho NÃO é inventado: só aparece com amostra suficiente
 *    (≥ 3 dias com estudo), senão "Sem dado" (Regra 4).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Row, Txt } from '../../src/components/ui';
import { spacing } from '../../src/theme';
import {
  SOFT,
  SoftButton,
  SoftCard,
  SoftCheck,
  SoftLabel,
  SoftNote,
  SoftRing,
  SoftWeekLine,
} from '../../src/components/SoftStudy';
import { useStore } from '../../src/lib/store';
import { addDays, todayKey, WEEKDAYS_SHORT } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { exportPdf } from '../../src/lib/export';
import { watchEscapes, type EscapeRecord } from '../../src/lib/native';
import { pendingDoubts, pomodoroPreset, studyProgress, type StudyBlock } from '../../src/lib/study';
import {
  TOPIC_STATUS_LABEL,
  adhdSupport,
  countsAsSession,
  daysToExam,
  nextTopic,
  planProgress,
  topicsPerDayNeeded,
  workloadBySubject,
  type EditalTopic,
  type StudyPlan,
} from '../../src/lib/studies';
import { formatClock } from '../../src/lib/training';

/** Quantos dias de estudo são necessários para "desempenho" virar afirmação. */
const MIN_DAYS_FOR_PERFORMANCE = 3;

export default function EstudoScreen() {
  const store = useStore();
  const today = todayKey();
  const saved = (store.days.find((d) => d.date === today)?.diary.study ?? []) as StudyBlock[];

  const [blocks, setBlocks] = useState<StudyBlock[]>(
    saved.length ? saved : [{ subject: '', plannedMinutes: 120, doneMinutes: 0, material: 'Livro', doubts: [] }],
  );
  const [preset, setPreset] = useState<'25/5' | '50/10'>('25/5');
  const [left, setLeft] = useState(pomodoroPreset('25/5').focus * 60);
  const [running, setRunning] = useState(false);
  const [strict, setStrict] = useState(false);
  const [escapes, setEscapes] = useState<EscapeRecord[]>([]);
  const [charge, setCharge] = useState<EscapeRecord | null>(null);
  const [noteMenu, setNoteMenu] = useState<number | null>(null);
  const [reportNote, setReportNote] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Record<number, boolean>>({});
  const [editIndex, setEditIndex] = useState<number | null>(0);
  const [weekPick, setWeekPick] = useState<number | null>(null);
  const stopWatch = useRef<(() => EscapeRecord[]) | null>(null);

  /* ───────────────────────────── pomodoro ───────────────────────────── */

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          setRunning(false);
          haptic('success');
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const logMinutes = (minutes: number) => {
    setBlocks((prev) => prev.map((b, i) => (i === 0 ? { ...b, doneMinutes: b.doneMinutes + minutes } : b)));
  };

  /* ─────────────────────────── detector de fuga ─────────────────────────── */

  useEffect(() => {
    if (!strict) {
      stopWatch.current?.();
      stopWatch.current = null;
      return;
    }
    stopWatch.current = watchEscapes((record) => {
      setEscapes((prev) => [...prev, record]);
      setCharge(record);
    });
    return () => {
      stopWatch.current?.();
      stopWatch.current = null;
    };
  }, [strict]);

  /* ───────────────────────────── edital ───────────────────────────── */

  const plan: StudyPlan = (store.days.find((d) => d.date === today)?.diary.studyPlan as StudyPlan | undefined) ?? {
    name: '',
    examDate: '',
    topics: [],
  };
  const planInfo = planProgress(plan);
  const examDays = daysToExam(plan, today);
  const perDay = topicsPerDayNeeded(plan, today);
  const next = nextTopic(plan, today);
  const workload = workloadBySubject(plan);
  const doneToday = blocks.reduce<number>((sum, b) => sum + (b.doneMinutes || 0), 0);
  const support = adhdSupport(doneToday);

  const setTopicStatus = (id: string, status: EditalTopic['status']) => {
    const topics = plan.topics.map((t) =>
      t.id === id ? { ...t, status, lastSeen: status === 'novo' ? t.lastSeen : today } : t,
    );
    store.patchDiary(today, { studyPlan: { ...plan, topics } });
    haptic('select');
  };

  const progress = studyProgress(blocks);
  const doubts = pendingDoubts(blocks);
  const presetValue = pomodoroPreset(preset);

  const save = () => {
    store.patchDiary(today, { study: blocks });
    haptic('success');
    setReportNote('Registro do dia salvo.');
  };

  /* ─────────────────────────── dados derivados ─────────────────────────── */

  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of store.days.slice(-14)) {
      for (const b of (d.diary.study ?? []) as StudyBlock[]) {
        if (!b.subject.trim()) continue;
        map.set(b.subject, (map.get(b.subject) ?? 0) + b.doneMinutes);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [store.days]);

  /** Minutos por dia da semana atual (segunda → domingo). */
  const weekSeries = useMemo(() => {
    const dow = new Date(`${today}T12:00:00`).getDay(); // 0 = domingo
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = addDays(today, mondayOffset);
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const points = labels.map((_, i) => {
      const key = addDays(monday, i);
      // Dia futuro não tem dado (e não é zero): `null`.
      if (key > today) return null;
      const day = store.days.find((d) => d.date === key);
      const study = (day?.diary.study ?? []) as StudyBlock[];
      const total = study.reduce<number>((acc, b) => acc + (b.doneMinutes || 0), 0);
      return total > 0 ? total : null;
    });
    const weekMinutes = points.reduce<number>((acc, p) => acc + (p ?? 0), 0);
    return { labels, points, weekMinutes, monday };
  }, [store.days, today]);

  /** Dias com estudo nos últimos 7 dias — base do "desempenho" (Regra 4). */
  const studyDays7 = useMemo(() => {
    let count = 0;
    let planned = 0;
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const key = addDays(today, -i);
      const study = (store.days.find((d) => d.date === key)?.diary.study ?? []) as StudyBlock[];
      const d = study.reduce<number>((acc, b) => acc + (b.doneMinutes || 0), 0);
      if (d > 0) {
        count += 1;
        done += d;
        planned += study.reduce<number>((acc, b) => acc + (b.plannedMinutes || 0), 0);
      }
    }
    return { count, done, planned, ratio: planned > 0 ? done / planned : null };
  }, [store.days, today]);

  /** Metas de estudo reais (área Estudo) — o checklist do card "Metas do mês". */
  const studyGoals = useMemo(() => store.goals.filter((g) => g.active && g.area === 'Estudo'), [store.goals]);
  const todayDay = store.days.find((d) => d.date === today);
  const goalDone = (goalId: string) => !!todayDay?.tasks.find((t) => t.goalId === goalId)?.done;
  const closedToday = !!todayDay?.closedAt;

  /** Meta mensal: horas estudadas no mês contra a meta declarada nos objetivos. */
  const monthProgress = useMemo(() => {
    const monthK = today.slice(0, 7);
    let done = 0;
    for (const d of store.days) {
      if (!d.date.startsWith(monthK)) continue;
      for (const b of (d.diary.study ?? []) as StudyBlock[]) done += b.doneMinutes || 0;
    }
    // Meta declarada: soma do alvo "ideal" diário das metas de Estudo × dias do mês.
    const goalMinutesPerDay = studyGoals.reduce<number>((sum, g) => {
      const m = /(\d+)\s*(h|min)/i.exec(g.ideal ?? '');
      if (!m) return sum;
      const n = Number(m[1]);
      return sum + (m[2]!.toLowerCase() === 'h' ? n * 60 : n);
    }, 0);
    const monthTarget = goalMinutesPerDay > 0 ? goalMinutesPerDay * 30 : null;
    return {
      done,
      target: monthTarget,
      ratio: monthTarget == null || monthTarget <= 0 ? null : done / monthTarget,
    };
  }, [store.days, today, studyGoals]);

  /* ───────────────────────────── ações ───────────────────────────── */

  const downloadReport = async () => {
    haptic('light');
    try {
      const out = await exportPdf(store);
      setReportNote(out ? 'Relatório PDF gerado — use "Compartilhar" na tela que abriu.' : 'Não foi possível gerar o PDF neste dispositivo.');
    } catch {
      setReportNote('Não foi possível gerar o PDF neste dispositivo.');
    }
  };

  const dataFmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  /* ───────────────────────────── tela ───────────────────────────── */

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SOFT.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        {/* CABEÇALHO: saudação + pílulas de ação */}
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 11 }}>
              {WEEKDAYS_SHORT[new Date(`${today}T12:00:00`).getDay()]}, {dataFmt(today)}
            </Txt>
            <Txt variant="h2" upper={false} color={SOFT.ink} style={{ fontSize: 24, fontWeight: '700' }}>
              Olá, {(store.user.name || 'estudante').split(' ')[0]}!
            </Txt>
          </View>
          <Row gap={6}>
            <SoftButton label="⌕" variant="icon" accessibilityLabel="Buscar" onPress={() => setReportNote('A busca fica na aba Metas e no Histórico abaixo.')} />
            <SoftButton label="＋" variant="solid" accessibilityLabel="Criar bloco de estudo" onPress={() => {
              setBlocks((prev) => [...prev, { subject: '', plannedMinutes: 60, doneMinutes: 0, material: 'Vídeo', doubts: [] }]);
              haptic('light');
            }} />
          </Row>
        </Row>

        {/* CARD ESCURO PRINCIPAL — Overall Information */}
        <SoftCard dark style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <SoftLabel dark>Overall Information</SoftLabel>
            <Txt variant="caption" upper={false} color="#B9B9C0">
              ⋯
            </Txt>
          </Row>
          <Row gap={spacing.md} style={{ alignItems: 'flex-end' }}>
            <View style={{ gap: 2 }}>
              <Txt variant="h1" upper={false} color="#FFFFFF" style={{ fontSize: 34, fontWeight: '700' }}>
                {String(Math.floor(progress.done / 60)).padStart(2, '0')}
                <Txt variant="caption" upper={false} color="#B9B9C0">
                  h{String(progress.done % 60).padStart(2, '0')}
                </Txt>
              </Txt>
              <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 10 }}>
                estudadas hoje
              </Txt>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Txt variant="h1" upper={false} color="#FFFFFF" style={{ fontSize: 34, fontWeight: '700' }}>
                {planInfo.studied}
              </Txt>
              <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 10 }}>
                tópicos do edital
              </Txt>
            </View>
          </Row>

          <Row gap={spacing.sm}>
            <View style={{ flex: 1, backgroundColor: '#212126', borderRadius: 16, padding: 12, alignItems: 'center', gap: 2 }}>
              <Txt variant="h3" upper={false} color="#FFFFFF" style={{ fontSize: 18 }}>
                {studyDays7.count}
              </Txt>
              <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 9 }}>
                dias com estudo (7d)
              </Txt>
            </View>
            <View style={{ flex: 1, backgroundColor: '#212126', borderRadius: 16, padding: 12, alignItems: 'center', gap: 2 }}>
              <Txt variant="h3" upper={false} color="#FFFFFF" style={{ fontSize: 18 }}>
                {formatClock(left)}
              </Txt>
              <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 9 }}>
                pomodoro {preset}
              </Txt>
            </View>
            <View style={{ flex: 1, backgroundColor: '#212126', borderRadius: 16, padding: 12, alignItems: 'center', gap: 2 }}>
              <Txt variant="h3" upper={false} color="#FFFFFF" style={{ fontSize: 18 }}>
                {planInfo.reviewed}
              </Txt>
              <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 9 }}>
                revisados
              </Txt>
            </View>
          </Row>
        </SoftCard>

        {/* PROGRESSO SEMANAL + META MENSAL */}
        <Row gap={spacing.md} style={{ alignItems: 'stretch' }}>
          <SoftCard style={{ flex: 1.5, gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <SoftLabel>Progresso semanal</SoftLabel>
              <Txt variant="micro" upper={false} color={SOFT.ink} style={{ fontSize: 9, fontWeight: '700' }}>
                {weekSeries.weekMinutes > 0 ? `${Math.floor(weekSeries.weekMinutes / 60)}h${String(weekSeries.weekMinutes % 60).padStart(2, '0')}` : 'Sem dado'}
              </Txt>
            </Row>
            <SoftWeekLine
              points={weekSeries.points}
              labels={weekSeries.labels}
              highlight={weekPick}
              height={92}
            />
            <Row gap={4} style={{ flexWrap: 'wrap' }}>
              {weekSeries.labels.map((l, i) => (
                <Txt
                  key={l}
                  variant="micro"
                  upper={false}
                  color={weekPick === i ? SOFT.ink : SOFT.muted}
                  onPress={() => {
                    haptic('light');
                    setWeekPick((p) => (p === i ? null : i));
                  }}
                  style={{ fontSize: 9, paddingHorizontal: 3 }}
                >
                  {l} {weekSeries.points[i] == null ? '·' : `${weekSeries.points[i]}min`}
                </Txt>
              ))}
            </Row>
          </SoftCard>

          <SoftCard style={{ flex: 1, gap: spacing.sm, alignItems: 'center' }}>
            <SoftLabel>Meta mensal</SoftLabel>
            <SoftRing
              ratio={monthProgress.ratio}
              size={82}
              label={
                monthProgress.ratio == null
                  ? 'Sem dado'
                  : `${Math.round(monthProgress.ratio * 100)}%`
              }
              caption={monthProgress.ratio == null ? 'sem meta' : 'da meta'}
            />
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9, textAlign: 'center' }}>
              {monthProgress.target == null
                ? 'Sem meta de estudo cadastrada'
                : `${Math.floor(monthProgress.done / 60)}h de ${Math.round(monthProgress.target / 60)}h`}
            </Txt>
            <SoftButton label="Baixar relatório ↓" small onPress={downloadReport} />
          </SoftCard>
        </Row>

        {/* METAS DO MÊS — metas reais da área Estudo */}
        <SoftCard style={{ gap: 2 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <SoftLabel>Metas do mês</SoftLabel>
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
              {studyGoals.length ? `${studyGoals.filter((g) => goalDone(g.id)).length}/${studyGoals.length}` : ''}
            </Txt>
          </Row>
          {studyGoals.length === 0 ? (
            <Txt variant="caption" upper={false} color={SOFT.muted} style={{ fontSize: 12 }}>
              Sem dado — nenhuma meta na área Estudo. Crie em Metas para ela aparecer aqui.
            </Txt>
          ) : (
            studyGoals.map((g) => (
              <SoftCheck
                key={g.id}
                label={g.name}
                checked={goalDone(g.id)}
                disabled={closedToday}
                trailing={closedToday ? 'dia fechado' : g.ideal}
                onToggle={() => {
                  haptic('light');
                  store.toggleTask(today, g.id, !goalDone(g.id));
                }}
              />
            ))
          )}
        </SoftCard>

        {/* EM ANDAMENTO — post-its = blocos de estudo */}
        <View style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <SoftLabel>Tarefas em andamento ({blocks.length})</SoftLabel>
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
              toque em ⋯ para fixar, editar ou excluir
            </Txt>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {blocks.map((b, i) => (
              <View key={`note-${i}`} style={{ width: '48%' }}>
                <SoftNote
                  title={b.subject.trim() || `Bloco ${i + 1} · sem matéria`}
                  subtitle={
                    b.learned?.trim()
                      ? b.learned.trim().slice(0, 70)
                      : b.doubts?.[0]
                        ? `Dúvida: ${b.doubts[0]}`
                        : `${b.material} · ${b.doneMinutes}/${b.plannedMinutes}min`
                  }
                  meta={countsAsSession(b.doneMinutes) ? 'sessão contabilizada' : 'menos de 2min — não conta'}
                  pinned={!!pinned[i]}
                  onMenu={() => {
                    haptic('light');
                    setNoteMenu(noteMenu === i ? null : i);
                  }}
                  onPress={() => setEditIndex(editIndex === i ? null : i)}
                />
                {noteMenu === i ? (
                  <Row gap={6} style={{ marginTop: 6, justifyContent: 'center' }}>
                    <SoftButton label={pinned[i] ? 'Desafixar' : 'Fixar'} small onPress={() => {
                      setPinned((p) => ({ ...p, [i]: !p[i] }));
                      setNoteMenu(null);
                    }} />
                    <SoftButton label="Editar" small onPress={() => {
                      setEditIndex(i);
                      setNoteMenu(null);
                    }} />
                    <SoftButton
                      label="Excluir"
                      small
                      disabled={blocks.length <= 1}
                      onPress={() => {
                        setBlocks((prev) => prev.filter((_, k) => k !== i));
                        setNoteMenu(null);
                        haptic('warning');
                      }}
                    />
                  </Row>
                ) : null}
              </View>
            ))}

            {/* Adicionar tarefa — borda tracejada */}
            <View style={{ width: '48%' }}>
              <SoftCard
                dashed
                style={{ minHeight: 132, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}
              >
                <View
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar tópico de estudo"
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={() => {
                    setBlocks((prev) => [...prev, { subject: '', plannedMinutes: 60, doneMinutes: 0, material: 'Vídeo', doubts: [] }]);
                    setEditIndex(blocks.length);
                    haptic('light');
                  }}
                  style={{ alignItems: 'center', gap: 6 }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: SOFT.lineStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt variant="caption" upper={false} color={SOFT.ink}>
                      ＋
                    </Txt>
                  </View>
                  <Txt variant="micro" upper={false} color={SOFT.body} style={{ fontSize: 10 }}>
                    Adicionar tarefa
                  </Txt>
                </View>
              </SoftCard>
            </View>
          </View>
        </View>

        {/* CADASTRO DO BLOCO SELECIONADO */}
        {editIndex != null && blocks[editIndex] ? (
          <SoftCard style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <SoftLabel>Bloco {editIndex + 1}</SoftLabel>
              <SoftButton label="Fechar" small onPress={() => setEditIndex(null)} />
            </Row>
            {(() => {
              const block = blocks[editIndex]!;
              const update = (patch: Partial<StudyBlock>) =>
                setBlocks((prev) => prev.map((b, i) => (i === editIndex ? { ...b, ...patch } : b)));
              return (
                <>
                  <TextInput
                    value={block.subject}
                    onChangeText={(v) => update({ subject: v })}
                    placeholder="Matéria / assunto do dia"
                    placeholderTextColor={SOFT.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: SOFT.line,
                      borderRadius: 14,
                      padding: spacing.md,
                      color: SOFT.ink,
                      fontSize: 15,
                      fontWeight: '600',
                      backgroundColor: SOFT.white,
                    }}
                  />
                  <Row gap={spacing.sm}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <SoftLabel>previsto (min)</SoftLabel>
                      <TextInput
                        value={String(block.plannedMinutes)}
                        onChangeText={(v) => update({ plannedMinutes: Number(v.replace(/\D/g, '')) || 0 })}
                        keyboardType="number-pad"
                        style={{
                          borderWidth: 1,
                          borderColor: SOFT.line,
                          borderRadius: 10,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          color: SOFT.ink,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <SoftLabel>feito (min)</SoftLabel>
                      <TextInput
                        value={String(block.doneMinutes)}
                        onChangeText={(v) => update({ doneMinutes: Number(v.replace(/\D/g, '')) || 0 })}
                        keyboardType="number-pad"
                        style={{
                          borderWidth: 1,
                          borderColor: SOFT.line,
                          borderRadius: 10,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          color: SOFT.ink,
                        }}
                      />
                    </View>
                  </Row>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    {(['Livro', 'Vídeo', 'PDF', 'Aula'] as const).map((mat) => (
                      <SoftButton
                        key={mat}
                        label={mat}
                        small
                        variant={block.material === mat ? 'solid' : 'ghost'}
                        onPress={() => update({ material: mat })}
                      />
                    ))}
                  </Row>
                  <TextInput
                    value={block.learned ?? ''}
                    onChangeText={(v) => update({ learned: v })}
                    placeholder="O que aprendi hoje (resumo ativo)"
                    placeholderTextColor={SOFT.muted}
                    multiline
                    style={{
                      borderWidth: 1,
                      borderColor: SOFT.line,
                      borderRadius: 14,
                      padding: spacing.md,
                      color: SOFT.ink,
                      minHeight: 64,
                      textAlignVertical: 'top',
                      fontSize: 13,
                    }}
                  />
                  <TextInput
                    value={block.doubts[0] ?? ''}
                    onChangeText={(v) => update({ doubts: [v] })}
                    placeholder="Dúvida para revisar"
                    placeholderTextColor={SOFT.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: SOFT.line,
                      borderRadius: 14,
                      padding: spacing.md,
                      color: SOFT.ink,
                      fontSize: 13,
                    }}
                  />
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
                      {progress.planned > 0 ? `hoje: ${progress.done} de ${progress.planned} min` : 'Sem meta de minutos hoje'}
                    </Txt>
                    <SoftButton label="Salvar bloco" variant="solid" small onPress={save} />
                  </Row>
                </>
              );
            })()}
          </SoftCard>
        ) : null}

        {/* POMODORO + FOCO RÍGIDO */}
        <SoftCard style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <SoftLabel>Pomodoro</SoftLabel>
            <Row gap={6}>
              {(['25/5', '50/10'] as const).map((p) => (
                <SoftButton
                  key={p}
                  label={p}
                  small
                  variant={preset === p ? 'solid' : 'ghost'}
                  onPress={() => {
                    setPreset(p);
                    setRunning(false);
                    setLeft(pomodoroPreset(p).focus * 60);
                  }}
                />
              ))}
            </Row>
          </Row>
          <Txt
            variant="h1"
            upper={false}
            color={running ? SOFT.ink : SOFT.body}
            style={{ textAlign: 'center', fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] }}
          >
            {formatClock(left)}
          </Txt>
          <Row gap={spacing.sm}>
            <View style={{ flex: 1 }}>
              <SoftButton
                label={running ? 'Pausar' : 'Iniciar foco'}
                variant="solid"
                onPress={() => {
                  haptic('light');
                  setRunning((r) => !r);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SoftButton
                label="Registrar bloco"
                onPress={() => {
                  logMinutes(presetValue.focus);
                  haptic('success');
                }}
              />
            </View>
          </Row>

          <View
            accessibilityRole="switch"
            accessibilityState={{ checked: strict }}
            accessibilityLabel="Modo foco rígido"
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => {
              haptic('warning');
              setStrict((s) => !s);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: strict ? SOFT.ink : SOFT.line,
              backgroundColor: strict ? SOFT.ink : SOFT.chip,
              borderRadius: 16,
              padding: spacing.md,
            }}
          >
            <Icon name="fuga" size={16} color={strict ? '#FFFFFF' : SOFT.muted} />
            <View style={{ flex: 1 }}>
              <Txt variant="caption" upper={false} color={strict ? '#FFFFFF' : SOFT.ink} style={{ fontSize: 12, fontWeight: '600' }}>
                {strict ? 'Foco rígido ativo' : 'Ativar modo foco rígido'}
              </Txt>
              <Txt variant="micro" upper={false} color={strict ? '#B9B9C0' : SOFT.muted} style={{ fontSize: 9 }}>
                {strict
                  ? 'Sair do app durante a sessão fica registrado e cobrado.'
                  : 'Detecta quando você sai do app e registra a fuga.'}
              </Txt>
            </View>
          </View>
          {escapes.length ? (
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
              {escapes.length} saída(s) detectada(s) · {Math.round(escapes.reduce<number>((acc, e) => acc + e.awayMs, 0) / 1000)}s
              fora
            </Txt>
          ) : null}
        </SoftCard>

        {/* EDITAL */}
        <SoftCard style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <SoftLabel>Edital</SoftLabel>
            <Txt
              variant="micro"
              upper={false}
              color={examDays != null && examDays < 0 ? SOFT.danger : SOFT.muted}
              style={{ fontSize: 9 }}
            >
              {plan.examDate
                ? examDays == null
                  ? 'data inválida'
                  : examDays < 0
                    ? `prova passou (${Math.abs(examDays)}d)`
                    : `${examDays}d até a prova`
                : 'sem data de prova'}
            </Txt>
          </Row>
          {planInfo.total === 0 ? (
            <Txt variant="caption" upper={false} color={SOFT.muted} style={{ fontSize: 12 }}>
              Sem dado — nenhum tópico de edital cadastrado ainda.
            </Txt>
          ) : (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" upper={false} color={SOFT.ink} style={{ fontSize: 12 }}>
                  {planInfo.studied}/{planInfo.total} tópicos estudados
                </Txt>
                <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
                  {planInfo.reviewed} revisados
                </Txt>
              </Row>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: SOFT.line }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    width: `${Math.min(100, (planInfo.ratio ?? 0) * 100)}%`,
                    backgroundColor: SOFT.ink,
                  }}
                />
              </View>
              <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
                {perDay == null
                  ? 'Sem ritmo calculável (precisa de data de prova futura e tópico pendente).'
                  : `${perDay.toFixed(1)} tópico(s) por dia para fechar o edital a tempo.`}
              </Txt>
              {next ? (
                <View style={{ gap: 4, backgroundColor: SOFT.chip, borderRadius: 16, padding: spacing.md }}>
                  <SoftLabel>Estudar agora</SoftLabel>
                  <Txt variant="caption" upper={false} color={SOFT.ink} style={{ fontSize: 13, fontWeight: '700' }}>
                    {next.topic.subject} — {next.topic.topic}
                  </Txt>
                  <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
                    {next.reason}
                  </Txt>
                  <SoftButton
                    label={next.topic.status === 'estudado' ? 'Marcar revisado' : 'Marcar estudado'}
                    variant="solid"
                    small
                    onPress={() =>
                      setTopicStatus(next.topic.id, next.topic.status === 'estudado' ? 'revisado' : 'estudado')
                    }
                  />
                </View>
              ) : null}
              {workload.length ? (
                <View style={{ gap: 3 }}>
                  {workload.slice(0, 4).map((w) => (
                    <Row key={w.subject} style={{ justifyContent: 'space-between' }}>
                      <Txt variant="micro" upper={false} color={SOFT.body} style={{ fontSize: 10 }} numberOfLines={1}>
                        {w.subject}
                      </Txt>
                      <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
                        {w.pending} pendente(s) · peso {w.weight}
                      </Txt>
                    </Row>
                  ))}
                </View>
              ) : null}
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                {plan.topics.slice(0, 8).map((t) => (
                  <SoftButton
                    key={t.id}
                    label={`${t.topic} · ${TOPIC_STATUS_LABEL[t.status]}`}
                    small
                    variant={t.status === 'revisado' ? 'solid' : 'ghost'}
                    accessibilityLabel={`${t.subject} ${t.topic}: ${TOPIC_STATUS_LABEL[t.status]}`}
                    onPress={() =>
                      setTopicStatus(t.id, t.status === 'novo' ? 'estudado' : t.status === 'estudado' ? 'revisado' : 'novo')
                    }
                  />
                ))}
              </Row>
            </>
          )}
        </SoftCard>

        {/* APOIO TDAH */}
        <SoftCard style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <SoftLabel>Começar é a parte difícil</SoftLabel>
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
              {support.firstSessionMinutes}min sugeridos
            </Txt>
          </Row>
          {support.startSteps.map((step, i) => (
            <Txt key={i} variant="caption" upper={false} color={SOFT.ink} style={{ fontSize: 12 }}>
              {i + 1}. {step}
            </Txt>
          ))}
          <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
            {support.afterBreak}
          </Txt>
        </SoftCard>

        {/* FILA DE REVISÃO */}
        <SoftCard style={{ gap: spacing.sm }}>
          <SoftLabel>Fila de revisão</SoftLabel>
          {doubts.length === 0 ? (
            <Txt variant="caption" upper={false} color={SOFT.muted} style={{ fontSize: 12 }}>
              Sem dado — nenhuma dúvida aberta.
            </Txt>
          ) : (
            doubts.map((d, i) => (
              <Row key={`${d.subject}-${i}`} gap={spacing.sm}>
                <Icon name="estudo" size={13} color={SOFT.muted} />
                <Txt variant="caption" upper={false} color={SOFT.ink} style={{ flex: 1, fontSize: 12 }}>
                  {d.doubt}
                </Txt>
                <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
                  {d.subject || 'sem matéria'}
                </Txt>
              </Row>
            ))
          )}
        </SoftCard>

        {/* CURSOS / MATÉRIAS ATIVAS — cards escuros com anel */}
        <View style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <SoftLabel>Matérias ativas · 14 dias</SoftLabel>
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
              {bySubject.length ? `${bySubject.length}` : ''}
            </Txt>
          </Row>
          {bySubject.length === 0 ? (
            <SoftCard>
              <Txt variant="caption" upper={false} color={SOFT.muted} style={{ fontSize: 12 }}>
                Sem dado — registre blocos com matéria para ver o progresso por matéria.
              </Txt>
            </SoftCard>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {bySubject.map(([subject, minutes], i) => {
                const max = bySubject[0]![1] || 1;
                return (
                  <SoftCard key={subject} dark style={{ width: '48%', gap: 6 }}>
                    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt variant="caption" upper={false} color="#FFFFFF" style={{ fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                          {subject}
                        </Txt>
                        <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 9 }}>
                          {i === 0 ? 'mais estudada' : 'em andamento'}
                        </Txt>
                      </View>
                      <SoftRing
                        ratio={minutes / max}
                        size={38}
                        dark
                        label={`${Math.round((minutes / max) * 100)}%`}
                      />
                    </Row>
                    <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 9 }}>
                      {minutes}min no período
                    </Txt>
                  </SoftCard>
                );
              })}
            </View>
          )}
        </View>

        {/* DESEMPENHO: só com amostra suficiente (Regra 4) */}
        <SoftCard style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <SoftLabel>Desempenho (7 dias)</SoftLabel>
            <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
              {studyDays7.count} dia(s) com estudo
            </Txt>
          </Row>
          {studyDays7.count < MIN_DAYS_FOR_PERFORMANCE || studyDays7.ratio == null ? (
            <Txt variant="caption" upper={false} color={SOFT.muted} style={{ fontSize: 12 }}>
              Sem dado suficiente: precisa de {MIN_DAYS_FOR_PERFORMANCE}+ dias com estudo e minutos previstos para
              comparar. Não vou afirmar desempenho com {studyDays7.count} dia(s).
            </Txt>
          ) : (
            <>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Txt variant="h2" upper={false} color={SOFT.ink} style={{ fontSize: 26 }}>
                  {Math.round(studyDays7.ratio * 100)}%
                </Txt>
                <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
                  {studyDays7.done}min feitos de {studyDays7.planned}min previstos
                </Txt>
              </Row>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: SOFT.line }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    width: `${Math.min(100, studyDays7.ratio * 100)}%`,
                    backgroundColor: SOFT.ink,
                  }}
                />
              </View>
            </>
          )}
        </SoftCard>

        {reportNote ? (
          <SoftCard>
            <Txt variant="caption" upper={false} color={SOFT.body} style={{ fontSize: 12 }}>
              {reportNote}
            </Txt>
          </SoftCard>
        ) : null}

        <SoftButton label="Salvar registro de estudo" variant="solid" onPress={save} />
      </ScrollView>

      {/* COBRANÇA DE FUGA */}
      {charge ? (
        <View
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: spacing.lg,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: SOFT.ink,
            backgroundColor: SOFT.white,
            padding: spacing.lg,
            gap: spacing.sm,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Txt variant="caption" upper={false} color={SOFT.danger} style={{ fontWeight: '700', fontSize: 13 }}>
            Você saiu da sessão por {Math.round(charge.awayMs / 1000)}s.
          </Txt>
          <Txt variant="micro" upper={false} color={SOFT.body} style={{ fontSize: 10 }}>
            Isso não diz nada sobre você — diz sobre o ambiente. Registre o motivo para o padrão aparecer.
          </Txt>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {['Rede social', 'Notificação', 'Urgência', 'Preguiça'].map((reason) => (
              <SoftButton
                key={reason}
                label={reason}
                small
                onPress={() => {
                  store.patchDiary(today, { distraction: reason });
                  setCharge(null);
                  haptic('warning');
                }}
              />
            ))}
          </Row>
          <SoftButton label="Fechar" variant="solid" small onPress={() => setCharge(null)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
