import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../../src/components/ModalHeader';
import { Icon } from '../../src/components/Icon';
import { Badge, Card, Muted, PrimaryButton, Row, SecondaryButton, Txt } from '../../src/components/ui';
import { colors, radius, spacing, useTheme } from '../../src/theme';
import { useStore } from '../../src/lib/store';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { watchEscapes, type EscapeRecord } from '../../src/lib/native';
import { pendingDoubts, pomodoroPreset, studyProgress, type StudyBlock } from '../../src/lib/study';
import {
  TOPIC_STATUS_LABEL,
  adhdSupport,
  daysToExam,
  nextTopic,
  planProgress,
  topicsPerDayNeeded,
  workloadBySubject,
  type EditalTopic,
  type StudyPlan,
} from '../../src/lib/studies';
import { formatClock } from '../../src/lib/training';

/**
 * Detalhamento da área ESTUDO.
 *
 * Blocos por matéria, material, Pomodoro com preset 25/5 ou 50/10, Modo Foco
 * Rígido (detector de fuga) e resumo ativo com dúvidas para revisar.
 */
export default function EstudoScreen() {
  useTheme();
  const store = useStore();
  const today = todayKey();
  const saved = (store.days.find((d) => d.date === today)?.diary.study ?? []) as StudyBlock[];

  const [blocks, setBlocks] = useState<StudyBlock[]>(
    saved.length
      ? saved
      : [{ subject: '', plannedMinutes: 120, doneMinutes: 0, material: 'Livro', doubts: [] }],
  );
  const [preset, setPreset] = useState<'25/5' | '50/10'>('25/5');
  const [left, setLeft] = useState(pomodoroPreset('25/5').focus * 60);
  const [running, setRunning] = useState(false);
  const [strict, setStrict] = useState(false);
  const [escapes, setEscapes] = useState<EscapeRecord[]>([]);
  const [charge, setCharge] = useState<EscapeRecord | null>(null);
  const stopWatch = useRef<(() => EscapeRecord[]) | null>(null);

  /* pomodoro */
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

  /* bloco em foco recebe os minutos estudados */
  const logMinutes = (minutes: number) => {
    setBlocks((prev) => prev.map((b, i) => (i === 0 ? { ...b, doneMinutes: b.doneMinutes + minutes } : b)));
  };

  /* detector de fuga */
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
  const doneToday = blocks.reduce((sum, b) => sum + (b.doneMinutes || 0), 0);
  const support = adhdSupport(doneToday);

  /**
   * Marca o tópico: novo → estudado → revisado. Grava no diário e usa a data de
   * hoje como `lastSeen`, que é o que alimenta a fila de "próximo tópico".
   */
  const setTopicStatus = (id: string, status: EditalTopic['status']) => {
    const topics = plan.topics.map((t) => (t.id === id ? { ...t, status, lastSeen: status === 'novo' ? t.lastSeen : today } : t));
    store.patchDiary(today, { studyPlan: { ...plan, topics } });
    haptic('select');
  };

  const progress = studyProgress(blocks);
  const doubts = pendingDoubts(blocks);
  const presetValue = pomodoroPreset(preset);

  const save = () => {
    store.patchDiary(today, { study: blocks });
    haptic('success');
  };

  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of store.days.slice(-14)) {
      for (const b of ((d.diary.study ?? []) as StudyBlock[])) {
        if (!b.subject.trim()) continue;
        map.set(b.subject, (map.get(b.subject) ?? 0) + b.doneMinutes);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [store.days]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ModalHeader title="Estudo" subtitle="Blocos, foco e revisão" onAdd={save} addLabel="Salvar" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        {/* RESUMO */}
        <Card style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
                Hoje
              </Txt>
              <Txt variant="h2" color={colors.green}>
                {progress.done}min
                <Txt variant="caption" color={colors.textMuted}> / {progress.planned}min</Txt>
              </Txt>
            </View>
            <Badge label={progress.planned ? `${Math.round(progress.ratio * 100)}%` : 'Sem meta'} color={colors.purple} />
          </Row>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.track, overflow: 'hidden' }}>
            <View style={{ height: 4, width: `${progress.ratio * 100}%`, backgroundColor: colors.purple }} />
          </View>
        </Card>

        {/* PLANO + EDITAL */}
        <Card style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
              Edital
            </Txt>
            <Txt variant="micro" color={examDays == null ? colors.textMuted : examDays < 0 ? colors.red : colors.purple} style={{ letterSpacing: 0 }}>
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
            <Muted>Sem dado — nenhum tópico de edital cadastrado ainda.</Muted>
          ) : (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" color={colors.textPrimary}>
                  {planInfo.studied}/{planInfo.total} tópicos estudados
                </Txt>
                <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 0 }}>
                  {planInfo.reviewed} revisados
                </Txt>
              </Row>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.track, overflow: 'hidden' }}>
                <View style={{ height: 4, width: `${(planInfo.ratio ?? 0) * 100}%`, backgroundColor: colors.green }} />
              </View>
              <Muted>
                {perDay == null
                  ? 'Sem ritmo calculável (precisa de data de prova futura e tópico pendente).'
                  : `${perDay.toFixed(1)} tópico(s) por dia para fechar o edital a tempo.`}
              </Muted>
              {next ? (
                <View style={{ gap: 2, marginTop: 2 }}>
                  <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 1.2 }}>
                    Estudar agora
                  </Txt>
                  <Txt variant="caption" color={colors.textPrimary}>
                    {next.topic.subject} — {next.topic.topic}
                  </Txt>
                  <Muted>{next.reason}</Muted>
                  <Row gap={spacing.sm} style={{ marginTop: 4 }}>
                    <SecondaryButton
                      label={next.topic.status === 'estudado' ? 'Marcar revisado' : 'Marcar estudado'}
                      style={{ height: 38, flex: 1 }}
                      onPress={() => setTopicStatus(next.topic.id, next.topic.status === 'estudado' ? 'revisado' : 'estudado')}
                    />
                  </Row>
                </View>
              ) : null}
              {workload.length ? (
                <View style={{ gap: 3, marginTop: 4 }}>
                  {workload.slice(0, 4).map((w) => (
                    <Row key={w.subject} style={{ justifyContent: 'space-between' }}>
                      <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 0 }} numberOfLines={1}>
                        {w.subject}
                      </Txt>
                      <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                        {w.pending} pendente(s) · peso {w.weight}
                      </Txt>
                    </Row>
                  ))}
                </View>
              ) : null}
              <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 2 }}>
                {plan.topics.slice(0, 8).map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setTopicStatus(t.id, t.status === 'novo' ? 'estudado' : t.status === 'estudado' ? 'revisado' : 'novo')}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.subject} ${t.topic}: ${TOPIC_STATUS_LABEL[t.status]}`}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: t.status === 'novo' ? colors.border : t.status === 'estudado' ? colors.purple : colors.green,
                    }}
                  >
                    <Txt variant="micro" color={t.status === 'novo' ? colors.textMuted : t.status === 'estudado' ? colors.purple : colors.green} style={{ letterSpacing: 0 }}>
                      {t.topic}
                    </Txt>
                  </Pressable>
                ))}
              </Row>
            </>
          )}
        </Card>

        {/* APOIO TDAH */}
        <Card style={{ gap: 4 }} accent={colors.yellow + '22'}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="micro" color={colors.yellow} style={{ letterSpacing: 1.6 }}>
              Começar é a parte difícil
            </Txt>
            <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 0 }}>
              {support.firstSessionMinutes}min sugeridos
            </Txt>
          </Row>
          {support.startSteps.map((step, i) => (
            <Txt key={i} variant="caption" color={colors.textPrimary}>
              {i + 1}. {step}
            </Txt>
          ))}
          <Muted>{support.afterBreak}</Muted>
        </Card>

        {/* BLOCOS */}
        {blocks.map((block, index) => (
          <Card key={index} style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 1.4 }}>
                Bloco {index + 1}
              </Txt>
              {blocks.length > 1 ? (
                <Txt variant="micro" color={colors.red} onPress={() => setBlocks((prev) => prev.filter((_, i) => i !== index))}>
                  remover
                </Txt>
              ) : null}
            </Row>
            <TextInput
              value={block.subject}
              onChangeText={(v) => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, subject: v } : b)))}
              placeholder="Matéria / assunto do dia"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bgInput,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.textPrimary,
                fontSize: 15,
                fontWeight: '600',
              }}
            />
            <Row gap={spacing.sm}>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                  previsto (min)
                </Txt>
                <TextInput
                  value={String(block.plannedMinutes)}
                  onChangeText={(v) => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, plannedMinutes: Number(v.replace(/\D/g, '')) || 0 } : b)))}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: colors.bgInput,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    color: colors.textPrimary,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                  feito (min)
                </Txt>
                <TextInput
                  value={String(block.doneMinutes)}
                  onChangeText={(v) => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, doneMinutes: Number(v.replace(/\D/g, '')) || 0 } : b)))}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: colors.bgInput,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    color: colors.textPrimary,
                  }}
                />
              </View>
            </Row>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {(['Livro', 'Vídeo', 'PDF', 'Aula'] as const).map((mat) => (
                <Pressable
                  key={mat}
                  onPress={() => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, material: mat } : b)))}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: block.material === mat ? colors.purple : colors.border,
                    backgroundColor: block.material === mat ? colors.purple + '22' : 'transparent',
                  }}
                >
                  <Txt variant="micro" color={block.material === mat ? colors.purple : colors.textSecondary} style={{ letterSpacing: 0.5 }}>
                    {mat}
                  </Txt>
                </Pressable>
              ))}
            </Row>
            <TextInput
              value={block.learned ?? ''}
              onChangeText={(v) => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, learned: v } : b)))}
              placeholder="O que aprendi hoje (resumo ativo)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                backgroundColor: colors.bgInput,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.textPrimary,
                minHeight: 70,
                textAlignVertical: 'top',
                fontSize: 14,
              }}
            />
            <Row gap={spacing.sm}>
              <TextInput
                value={block.doubts[0] ?? ''}
                onChangeText={(v) => setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, doubts: [v] } : b)))}
                placeholder="Dúvida para revisar"
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  backgroundColor: colors.bgInput,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 14,
                }}
              />
            </Row>
          </Card>
        ))}

        <SecondaryButton
          label="+ Adicionar bloco"
          color={colors.purple}
          onPress={() =>
            setBlocks((prev) => [...prev, { subject: '', plannedMinutes: 60, doneMinutes: 0, material: 'Vídeo', doubts: [] }])
          }
        />

        {/* POMODORO + FOCO RÍGIDO */}
        <Card style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
              Pomodoro
            </Txt>
            <Row gap={6}>
              {(['25/5', '50/10'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => {
                    setPreset(p);
                    setRunning(false);
                    setLeft(pomodoroPreset(p).focus * 60);
                  }}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: preset === p ? colors.green : colors.border,
                  }}
                >
                  <Txt variant="micro" color={preset === p ? colors.green : colors.textMuted} style={{ letterSpacing: 0 }}>
                    {p}
                  </Txt>
                </Pressable>
              ))}
            </Row>
          </Row>
          <Txt variant="metric" color={running ? colors.green : colors.textPrimary} style={{ textAlign: 'center' }}>
            {formatClock(left)}
          </Txt>
          <Row gap={spacing.sm}>
            <SecondaryButton
              label={running ? 'Pausar' : 'Iniciar foco'}
              color={running ? colors.yellow : colors.green}
              style={{ flex: 1 }}
              onPress={() => {
                haptic('light');
                setRunning((r) => !r);
              }}
            />
            <SecondaryButton
              label="Registrar bloco"
              color={colors.textSecondary}
              style={{ flex: 1 }}
              onPress={() => {
                logMinutes(presetValue.focus);
                haptic('success');
              }}
            />
          </Row>

          <Pressable
            onPress={() => {
              haptic('warning');
              setStrict((s) => !s);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              borderWidth: 1,
              borderColor: strict ? colors.red + '88' : colors.border,
              backgroundColor: strict ? colors.red + '12' : colors.bgInput,
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <Icon name="fuga" size={16} color={strict ? colors.red : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color={strict ? colors.red : colors.textPrimary}>
                {strict ? 'Foco rígido ativo' : 'Ativar modo foco rígido'}
              </Txt>
              <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                {strict
                  ? 'Sair do app durante a sessão fica registrado e cobrado.'
                  : 'Detecta quando você sai do app e registra a fuga.'}
              </Txt>
            </View>
          </Pressable>
          {escapes.length ? (
            <Muted>
              {escapes.length} saída(s) detectada(s) · {Math.round(escapes.reduce((s, e) => s + e.awayMs, 0) / 1000)}s fora
            </Muted>
          ) : null}
        </Card>

        {/* DÚVIDAS ABERTAS */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Fila de revisão
          </Txt>
          {doubts.length === 0 ? (
            <Muted>Sem dado — nenhuma dúvida aberta.</Muted>
          ) : (
            doubts.map((d, i) => (
              <Row key={`${d.subject}-${i}`} gap={spacing.sm}>
                <Icon name="estudo" size={13} color={colors.purple} />
                <Txt variant="caption" color={colors.textPrimary} style={{ flex: 1 }}>
                  {d.doubt}
                </Txt>
                <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                  {d.subject || 'sem matéria'}
                </Txt>
              </Row>
            ))
          )}
        </Card>

        {/* HISTÓRICO */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Minutos por matéria · 14 dias
          </Txt>
          {bySubject.length === 0 ? (
            <Muted>Sem dado — registre blocos com matéria para ver o ranking.</Muted>
          ) : (
            bySubject.map(([subject, minutes]) => {
              const max = bySubject[0]![1] || 1;
              return (
                <View key={subject} style={{ gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="caption" color={colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
                      {subject}
                    </Txt>
                    <Txt variant="micro" color={colors.textSecondary}>
                      {minutes}min
                    </Txt>
                  </Row>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.track, overflow: 'hidden' }}>
                    <View style={{ height: 4, width: `${(minutes / max) * 100}%`, backgroundColor: colors.purple }} />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <PrimaryButton label="Salvar registro de estudo" onPress={save} />
      </ScrollView>

      {/* COBRANÇA DE FUGA */}
      {charge ? (
        <View
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: spacing.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.red + '88',
            backgroundColor: colors.bgElevated,
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Txt variant="caption" color={colors.red} style={{ fontWeight: '700' }}>
            Você saiu da sessão por {Math.round(charge.awayMs / 1000)}s.
          </Txt>
          <Muted>Isso não diz nada sobre você — diz sobre o ambiente. Registre o motivo para o padrão aparecer.</Muted>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {['Rede social', 'Notificação', 'Urgência', 'Preguiça'].map((reason) => (
              <Pressable
                key={reason}
                onPress={() => {
                  store.patchDiary(today, { distraction: reason });
                  setCharge(null);
                  haptic('warning');
                }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}
              >
                <Txt variant="micro" color={colors.textSecondary}>
                  {reason}
                </Txt>
              </Pressable>
            ))}
          </Row>
          <SecondaryButton label="Fechar" onPress={() => setCharge(null)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
