import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { areaColor, colors, spacing } from '../../src/theme';
import {
  Badge,
  Card,
  Chip,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  SecondaryButton,
  SectionTitle,
  Sheet,
  Txt,
} from '../../src/components/ui';
import { LineChart, RadarChart } from '../../src/components/charts';
import { useStore, newId } from '../../src/lib/store';
import {
  areaConsistency,
  areaCorrelation,
  bestHour,
  closedDays,
  emotionCorrelation,
  emotionsHeatmap,
  failureHour,
  failureMap,
  declarationDivergences,
  honestyChecks,
  sleepCorrelation,
  topExcuse,
  triggerMap,
} from '../../src/lib/insights';
import { detectDanger } from '../../src/lib/score';
import { lastNDays, shortDate, todayKey, weekStart } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import type { Rule } from '../../src/lib/types';

const RULE_SUGGESTIONS = [
  { trigger: 'eu chegar em casa cansado', action: 'faço 15min de treino mínimo', reason: 'matar a resistência inicial' },
  { trigger: 'eu pegar o celular na cama', action: 'leio 10 páginas antes', reason: 'trocar estímulo passivo por leitura' },
  { trigger: 'for sábado de manhã', action: 'faço a revisão semanal', reason: 'fechar o loop antes da semana começar' },
];

export default function IntelligenceScreen() {
  const store = useStore();
  const [ruleSheet, setRuleSheet] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [trigger, setTrigger] = useState('');
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');

  const closed = closedDays(store.days);
  const alerts = useMemo(() => detectDanger(store.days, store.goals, store.settings), [store.days, store.goals, store.settings]);
  const fHour = failureHour(store);
  const pHour = bestHour(store);
  const excuse = topExcuse(store);
  const triggers = triggerMap(store);
  const failures = failureMap(store);
  const sleep = sleepCorrelation(store);
  const emotions = emotionsHeatmap(store);
  const honest = honestyChecks(store);
  const divergences = declarationDivergences(store);
  const resolvedHonesty = store.days.reduce(
    (acc, d) => acc + (d.honestyFlags ?? []).filter((f) => !!f.resolved).length,
    0,
  );
  const areas = Array.from(new Set(store.goals.map((g) => g.area)));

  const [selectedAreas, setSelectedAreas] = useState<string[]>(areas.slice(0, 4));
  const week = lastNDays(14);
  const evolution = useMemo(
    () =>
      selectedAreas.map((area) => {
        const ids = new Set(store.goals.filter((g) => g.area === area).map((g) => g.id));
        return {
          name: area,
          color: areaColor(area),
          points: week.map((date) => {
            const day = store.days.find((d) => d.date === date);
            if (!day) return null;
            const tasks = day.tasks.filter((t) => ids.has(t.goalId));
            if (!tasks.length) return null;
            return (tasks.filter((t) => t.done).length / tasks.length) * 10;
          }),
        };
      }),
    [selectedAreas, week, store.days, store.goals],
  );

  const correlation = areaCorrelation(store);
  const consistency = areaConsistency(store, lastNDays(7));
  const radarData = consistency.map((c) => ({ label: c.area.slice(0, 9), value: c.score, color: areaColor(c.area) }));

  const openNewRule = () => {
    setEditing(null);
    setTrigger('');
    setAction('');
    setReason('');
    setRuleSheet(true);
  };

  const saveRule = () => {
    const rule: Rule = {
      id: editing?.id ?? newId('rule'),
      trigger: trigger.trim(),
      action: action.trim(),
      reason: reason.trim(),
      active: editing?.active ?? true,
      timesActivated: editing?.timesActivated ?? 0,
      successRate: editing?.successRate ?? 0,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    store.upsertRule(rule);
    haptic('success');
    setRuleSheet(false);
  };

  const weekActivated = store.rules.filter((r) => r.timesActivated > 0).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <View>
          <Txt variant="h1">Seu Cérebro de Dados</Txt>
          <Muted style={{ marginTop: 2 }}>
            {closed.length} dia(s) registrados · padrões só aparecem a partir de 7
          </Muted>
        </View>

        {/* 1 · ZONA DE PERIGO */}
        <SectionTitle right={<Badge label="tempo real" color={alerts.length ? colors.red : colors.green} />}>
          Zona de Perigo
        </SectionTitle>
        {alerts.length === 0 ? (
          <Card>
            <Txt variant="caption" color={colors.green}>Nenhum alerta ativo.</Txt>
            <Muted style={{ marginTop: 4 }}>
              Monitorando: 2+ dias com score &lt; 5 · 3+ dias sem prioridade alta · queda de 30% · mesma desculpa 3x.
            </Muted>
          </Card>
        ) : (
          alerts.map((a) => (
            <Card key={a.id} accent={a.level === 'red' ? colors.red : colors.yellow} pulse={a.level === 'red'}>
              <Txt variant="h3" color={a.level === 'red' ? colors.red : colors.yellow}>
                {a.level === 'red' ? '⚠️' : a.level === 'yellow' ? '⚠️' : a.level === 'trend' ? '📉' : '🔁'} {a.title}
              </Txt>
              <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 6 }}>{a.detail}</Txt>
              <Muted style={{ marginTop: 6 }}>Ação mínima para hoje: {a.action}</Muted>
              <SecondaryButton
                label="Ativar Modo Recuperação"
                style={{ marginTop: spacing.md, height: 44 }}
                onPress={() => {
                  store.ensureDay(todayKey());
                  store.setMode(todayKey(), 'recovery');
                  haptic('warning');
                }}
              />
            </Card>
          ))
        )}

        {/* 2 · PADRÕES */}
        <SectionTitle>Detecção de padrões</SectionTitle>
        {!fHour.ready || !excuse.ready ? (
          <Card>
            <Txt variant="caption" color={colors.yellow}>{fHour.label || excuse.label}</Txt>
            <Muted style={{ marginTop: 4 }}>
              Regra do sistema: nenhum padrão é exibido antes de 7 dias de registro. O que não tem base vira chute — e chute não corrige comportamento.
            </Muted>
          </Card>
        ) : null}

        <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Horário de falha</Txt>
            {fHour.value ? (
              <>
                <Txt variant="h2" color={colors.red}>{fHour.value.bucket}</Txt>
                <Muted>{fHour.value.pct}% das falhas ({fHour.value.count})</Muted>
              </>
            ) : (
              <NoData />
            )}
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Pico de execução</Txt>
            {pHour.value ? (
              <>
                <Txt variant="h2" color={colors.green}>{pHour.value.bucket}</Txt>
                <Muted>{pHour.value.count} tarefas concluídas</Muted>
              </>
            ) : (
              <NoData />
            )}
          </Card>
        </Row>

        <Card>
          <Txt variant="micro" color={colors.textSecondary}>Desculpa mais usada</Txt>
          {excuse.value ? (
            <>
              <Txt variant="h3" color={colors.yellow} style={{ marginTop: 4 }}>
                {excuse.value.type} / {excuse.value.legitimacy}
              </Txt>
              <Muted>{excuse.value.pct}% das vezes ({excuse.value.count} registros)</Muted>
            </>
          ) : (
            <NoData />
          )}
        </Card>

        <Card>
          <Txt variant="micro" color={colors.textSecondary}>Áreas que caem juntas</Txt>
          {correlation.value ? (
            <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 6, lineHeight: 20 }}>
              Quando {correlation.value.a} falha, {correlation.value.b} falha {correlation.value.pct}% das vezes
              ({correlation.value.samples} dia(s) com falha em {correlation.value.a}).
            </Txt>
          ) : (
            <NoData label={correlation.label || 'Sem correlação com dados suficientes'} />
          )}
          {failureMap(store).ready ? (
            failures.sequences.length ? (
              failures.sequences.map((s) => (
                <Txt key={s.label} variant="caption" color={colors.textPrimary} style={{ marginTop: 6 }}>
                  • {s.label} — {s.count}x
                </Txt>
              ))
            ) : (
              <NoData label="Sem sequência de falha registrada" />
            )
          ) : (
            <NoData />
          )}
          {failures.weekendDrop != null ? (
            <Muted style={{ marginTop: 8 }}>
              Fim de semana: {failures.weekendAvg} vs semana {failures.weekdayAvg}
              {failures.weekendDrop > 0 ? ` (queda de ${failures.weekendDrop}%)` : ''}
            </Muted>
          ) : null}
        </Card>

        {/* 3 · HONESTIDADE */}
        <SectionTitle>Checagem de honestidade</SectionTitle>
        {honest.length === 0 ? (
          <Card>
            {resolvedHonesty > 0 ? (
              // Sem elogio vazio: quando houve resposta, o texto reconhece o gesto sem afirmar que "está tudo certo".
              <Muted>
                {resolvedHonesty} checagem(ns) já respondida(s). Nenhuma inconsistência em aberto — os números
                refletem o que você confirmou ou ajustou.
              </Muted>
            ) : (
              <NoData label="Sem dado suficiente para checar honestidade" />
            )}
          </Card>
        ) : (
          honest.map((h) => {
            const goal = store.goals.find((g) => g.id === h.goalId);
            return (
              <Card key={`${h.goalId}-${h.date}`} accent={colors.yellow + '55'}>
                <Txt variant="caption" color={colors.yellow}>🤔 Os dados sugerem que esta execução pode não ter sido completa.</Txt>
                <Txt variant="body" style={{ marginTop: 6 }}>{goal?.name ?? 'Tarefa'} · {h.date}</Txt>
                <Muted style={{ marginTop: 2 }}>{h.detail}</Muted>
                <Muted style={{ marginTop: 6 }}>O que realmente aconteceu?</Muted>
                <Row gap={spacing.sm} style={{ marginTop: spacing.md }}>
                  <SecondaryButton
                    label="Confirmar como feito"
                    style={{ flex: 1, height: 44 }}
                    onPress={() => store.resolveHonestyFlag(h.date, h.goalId, 'confirmed')}
                  />
                  <SecondaryButton
                    label="Ajustar registro"
                    color={colors.yellow}
                    style={{ flex: 1, height: 44 }}
                    onPress={() => store.resolveHonestyFlag(h.date, h.goalId, 'adjusted')}
                  />
                </Row>
              </Card>
            );
          })
        )}

        {divergences.length ? (
          <>
            <SectionTitle>Diário vs checklist</SectionTitle>
            {divergences.map((d) => (
              <Card key={`${d.kind}-${d.date}`} accent={colors.cyan + '44'}>
                <Txt variant="caption" color={colors.cyan}>
                  {shortDate(d.date)} · o diário e o checklist contam histórias diferentes
                </Txt>
                <Muted style={{ marginTop: 2 }}>{d.detail}</Muted>
                <Muted style={{ marginTop: 4 }}>Sem acusação: só vale conferir qual dos dois você quer manter.</Muted>
              </Card>
            ))}
          </>
        ) : null}

        {/* 4 · MAPAS */}
        <SectionTitle>Mapas de longo prazo</SectionTitle>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Mapa de gatilhos</Txt>
          {triggers.length ? (
            triggers.map((t, i) => (
              <Row key={t.label} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Txt variant="caption" color={colors.textPrimary}>
                  {i + 1}. {t.label}
                </Txt>
                <Badge label={`${t.count}x`} color={colors.orange} />
              </Row>
            ))
          ) : (
            <NoData label="Sem gatilhos registrados" />
          )}
          <Muted style={{ marginTop: 6 }}>Extraído dos campos distração/gatilho do diário.</Muted>
        </Card>

        <Card>
          <Txt variant="h3">Evolução por área (14 dias)</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: spacing.sm }}>
            {areas.map((a) => (
              <Chip
                key={a}
                label={a}
                color={areaColor(a)}
                selected={selectedAreas.includes(a)}
                onPress={() =>
                  setSelectedAreas((prev) =>
                    prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
                  )
                }
              />
            ))}
          </View>
          {closed.length >= 3 ? (
            <LineChart
              labels={week.map((d) => d.slice(8, 10))}
              series={evolution}
              goal={store.settings.targetDailyScore}
            />
          ) : (
            <NoData label="Gráficos a partir de 3 pontos de dado" />
          )}
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Equilíbrio entre áreas (7 dias)</Txt>
          {radarData.filter((r) => r.value != null).length >= 3 ? (
            <RadarChart data={radarData} />
          ) : (
            <NoData label="Dados insuficientes para radar" />
          )}
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Sono x performance</Txt>
          {sleep ? (
            <Txt variant="caption" color={colors.textPrimary}>
              Nos dias com menos de 6h de sono, seu score cai {Math.abs(sleep.diff)} pontos (média {sleep.lowAvg} vs {sleep.okAvg}).
            </Txt>
          ) : (
            <NoData label="Sem dado suficiente (precisa registrar horas de sono)" />
          )}
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Mapa de emoções</Txt>
          {emotions.length ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {emotions.map((e) => (
                  <Badge key={e.label} label={`${e.label} ${e.count}`} color={colors.pink} />
                ))}
              </View>
              {emotions.slice(0, 3).map((e) => {
                const corr = emotionCorrelation(store, e.label);
                if (!corr) return null;
                return (
                  <Muted key={`c-${e.label}`} style={{ marginTop: 6 }}>
                    Nos dias “{corr.emotion}”, a energia do dia seguinte cai {Math.abs(corr.drop)}% (amostra {corr.sample}).
                  </Muted>
                );
              })}
            </>
          ) : (
            <NoData label="Sem emoções registradas" />
          )}
        </Card>

        {/* 5 · REGRAS SE-ENTÃO */}
        <SectionTitle right={<Badge label={`${weekActivated}/${store.rules.length} na semana`} color={colors.cyan} />}>
          Regras SE-ENTÃO
        </SectionTitle>
        <Card>
          <Muted style={{ marginBottom: spacing.md }}>
            Implementation intentions: o gatilho escolhe o comportamento, não a sua vontade.
          </Muted>
          {store.rules.length === 0 ? (
            <NoData label="Nenhuma regra criada ainda" />
          ) : (
            store.rules.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  setEditing(r);
                  setTrigger(r.trigger);
                  setAction(r.action);
                  setReason(r.reason);
                  setRuleSheet(true);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: r.active ? colors.cyan + '55' : colors.border,
                  borderRadius: 12,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  gap: 2,
                  opacity: r.active ? 1 : 0.5,
                }}
              >
                <Txt variant="caption" color={colors.cyan}>SE {r.trigger}</Txt>
                <Txt variant="caption" color={colors.textPrimary}>ENTÃO {r.action}</Txt>
                {r.reason ? <Muted>PORQUE {r.reason}</Muted> : null}
                <Row gap={spacing.md} style={{ marginTop: 6 }}>
                  <Badge label={`${r.timesActivated} ativações`} color={colors.textSecondary} />
                  <Badge label={`eficácia ${r.successRate}%`} color={r.successRate >= 60 ? colors.green : colors.yellow} />
                  <Txt variant="micro" color={r.active ? colors.green : colors.textMuted} onPress={() => store.toggleRule(r.id)}>
                    {r.active ? 'desativar' : 'ativar'}
                  </Txt>
                  <Txt variant="micro" color={colors.cyan} onPress={() => store.markRuleActivated(r.id, true)}>
                    +1 usada
                  </Txt>
                  <Txt variant="micro" color={colors.red} onPress={() => store.deleteRule(r.id)}>
                    excluir
                  </Txt>
                </Row>
              </Pressable>
            ))
          )}
          <SecondaryButton label="+ Nova Regra" onPress={openNewRule} />
        </Card>

        <Card>
          <Txt variant="caption" color={colors.textSecondary}>Sugestões prontas</Txt>
          {RULE_SUGGESTIONS.map((s) => (
            <Pressable
              key={s.trigger}
              onPress={() => {
                setEditing(null);
                setTrigger(s.trigger);
                setAction(s.action);
                setReason(s.reason);
                setRuleSheet(true);
              }}
              style={{ marginTop: 8 }}
            >
              <Txt variant="micro" color={colors.textSecondary} style={{ textTransform: 'none', letterSpacing: 0 }}>
                SE {s.trigger} → ENTÃO {s.action}
              </Txt>
            </Pressable>
          ))}
        </Card>
      </ScrollView>

      <Sheet
        visible={ruleSheet}
        onClose={() => setRuleSheet(false)}
        title={editing ? 'Editar regra' : 'Nova regra SE-ENTÃO'}
        footer={<PrimaryButton label="Salvar regra" disabled={!trigger.trim() || !action.trim()} onPress={saveRule} />}
      >
        <Field label="SE (gatilho/contexto)" value={trigger} onChangeText={setTrigger} placeholder="eu chegar em casa cansado" />
        <Field label="ENTÃO eu vou (ação)" value={action} onChangeText={setAction} placeholder="fazer 15min de treino mínimo" />
        <Field label="PORQUE (motivo, opcional)" value={reason} onChangeText={setReason} placeholder="reduzir a resistência inicial" />
        <Muted>Gatilhos conhecidos: {triggers.slice(0, 3).map((t) => t.label).join(', ') || 'sem dado ainda'}</Muted>
        <SecondaryButton
          label="Usar semana atual para rastrear"
          onPress={() => {
            store.setWeeklyFocus(weekStart(todayKey()), [action.trim()]);
            haptic('light');
          }}
        />
      </Sheet>
    </SafeAreaView>
  );
}
