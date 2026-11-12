import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { areaColor, colors, scoreColor, spacing } from '../../src/theme';
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
import { BarChart, Heatmap, LineChart, RadarChart } from '../../src/components/charts';
import { ConstancyHeatmap } from '../../src/components/Heatmap';
import { CategoryDonut, MonthlyGauge, WaffleChart } from '../../src/components/StatsCharts';
import { categoryDistribution, monthlyGauge, waffle } from '../../src/lib/stats';
import { useStore } from '../../src/lib/store';
import { addDays, daysInMonth, monthLabel, quarterOf, shortDate, todayKey, weekKeys, weekStart, weekdayShort, MONTHS } from '../../src/lib/date';
import { areaConsistency, closedDays, excuseRanking, failureMap, sleepCorrelation, topExcuse, triggerMap } from '../../src/lib/insights';
import { avg, goalForTask, round1 } from '../../src/lib/score';
import { haptic } from '../../src/lib/haptics';

type Tab = 'semanal' | 'mensal' | 'trimestral' | 'anual';
const TABS: { key: Tab; label: string }[] = [
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensal', label: 'Mensal' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'anual', label: 'Anual' },
];

export default function ReviewsScreen() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('semanal');
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusDraft, setFocusDraft] = useState<string[]>(['', '']);
  const [editingRoute, setEditingRoute] = useState(false);
  const [routeDraft, setRouteDraft] = useState<string[]>(['', '']);

  const today = todayKey();
  const thisWeekStart = weekStart(today);
  const week = weekKeys(thisWeekStart);
  const closed = closedDays(store.days);

  const weekFocus = store.weeklyFocus[thisWeekStart] ?? [];
  const monthK = today.slice(0, 7);
  const route = store.routeAdjustments[monthK] ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <Txt variant="h1">Revisões</Txt>
        <Row gap={6}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => {
                haptic('select');
                setTab(t.key);
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: tab === t.key ? colors.green : colors.border,
                backgroundColor: tab === t.key ? colors.green + '18' : colors.bgCard,
              }}
            >
              <Txt variant="caption" color={tab === t.key ? colors.green : colors.textSecondary} style={{ fontWeight: '600' }}>
                {t.label}
              </Txt>
            </Pressable>
          ))}
        </Row>

        {tab === 'semanal' ? (
          <WeeklyReview
            week={week}
            weekStartKey={thisWeekStart}
            weekFocus={weekFocus}
            onEditFocus={() => {
              setFocusDraft([weekFocus[0] ?? '', weekFocus[1] ?? '']);
              setEditingFocus(true);
            }}
          />
        ) : null}

        {tab === 'mensal' ? (
          <MonthlyReview
            route={route}
            onEditRoute={() => {
              setRouteDraft([route[0] ?? '', route[1] ?? '']);
              setEditingRoute(true);
            }}
          />
        ) : null}

        {tab === 'trimestral' ? <QuarterlyReview /> : null}
        {tab === 'anual' ? <AnnualReview /> : null}

        {closed.length === 0 ? (
          <Card>
            <Muted>
              Nenhum dia encerrado ainda. As revisões só mostram o que os registros provam — sem dado, sem conclusão.
            </Muted>
          </Card>
        ) : null}
      </ScrollView>

      <Sheet
        visible={editingFocus}
        onClose={() => setEditingFocus(false)}
        title="Foco da próxima semana"
        footer={
          <PrimaryButton
            label="Salvar foco"
            disabled={!focusDraft.some((f) => f.trim())}
            onPress={() => {
              store.setWeeklyFocus(thisWeekStart, focusDraft.map((f) => f.trim()).filter(Boolean).slice(0, 2));
              setEditingFocus(false);
              haptic('success');
            }}
          />
        }
      >
        <Muted>Máximo 2 itens. Foco é subtração: o que não entra aqui é ruído.</Muted>
        {[0, 1].map((i) => (
          <Field
            key={i}
            label={`Foco ${i + 1}`}
            value={focusDraft[i] ?? ''}
            onChangeText={(t) => setFocusDraft((d) => d.map((x, idx) => (idx === i ? t : x)))}
            placeholder={i === 0 ? 'ex: treinar 3x no mínimo' : 'ex: dormir antes de 23h'}
          />
        ))}
      </Sheet>

      <Sheet
        visible={editingRoute}
        onClose={() => setEditingRoute(false)}
        title="Ajuste de rota do mês"
        footer={
          <PrimaryButton
            label="Salvar ajuste"
            disabled={!routeDraft.some((f) => f.trim())}
            onPress={() => {
              store.setRouteAdjustment(monthK, routeDraft.map((f) => f.trim()).filter(Boolean).slice(0, 2));
              setEditingRoute(false);
              haptic('success');
            }}
          />
        }
      >
        <Muted>1 a 2 mudanças concretas. Preferencialmente cortar, não adicionar.</Muted>
        {[0, 1].map((i) => (
          <Field
            key={i}
            label={`Mudança ${i + 1}`}
            value={routeDraft[i] ?? ''}
            onChangeText={(t) => setRouteDraft((d) => d.map((x, idx) => (idx === i ? t : x)))}
          />
        ))}
      </Sheet>
    </SafeAreaView>
  );
}

/* ─────────────────────────────── SEMANAL ─────────────────────────────── */

function WeeklyReview({
  week,
  weekStartKey,
  weekFocus,
  onEditFocus,
}: {
  week: string[];
  weekStartKey: string;
  weekFocus: string[];
  onEditFocus: () => void;
}) {
  const store = useStore();
  const router = useRouter();
  const today = todayKey();
  // Dias da semana que já aconteceram: denominador honesto do "N/7".
  const elapsed = Math.min(7, week.filter((d) => d <= today).length);
  const weekDays = store.days.filter((d) => week.includes(d.date));
  const weekClosed = weekDays.filter((d) => d.score);
  const consistency = areaConsistency(store, week);
  const weekScore = avg(weekClosed.map((d) => d.score?.total ?? 0));
  const prevWeek = week.map((d) => addDays(d, -7));
  const prevConsistency = areaConsistency(store, prevWeek);
  const excuse = topExcuse(store);
  const triggers = triggerMap(store, 3);
  const sleep = sleepCorrelation(store);

  const biggestWin = weekClosed
    .flatMap((d) => d.tasks.filter((t) => t.done).map((t) => ({ day: d, task: t })))
    .sort((a, b) => (b.task.note?.length ?? 0) - (a.task.note?.length ?? 0))[0];
  const biggestFail = weekClosed
    .flatMap((d) => d.tasks.filter((t) => !t.done && t.excuse).map((t) => ({ day: d, task: t })))
    .sort((a, b) => (a.task.excuse?.type ?? '').localeCompare(b.task.excuse?.type ?? ''))[0];

  const activeGoals = store.goals.filter((g) => g.active && !g.archived);
  const rulesActivated = store.rules.filter((r) => r.timesActivated > 0);
  const totalRules = store.rules.filter((r) => r.active).length;

  const patternLabel = excuse.value
    ? `${excuse.value.type} / ${excuse.value.legitimacy} apareceu em ${excuse.value.pct}% das falhas registradas`
    : 'Sem dado';

  return (
    <>
      <Card accent={colors.green + '44'}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="micro" color={colors.textSecondary}>Score da semana</Txt>
            <Txt variant="h1" color={weekScore != null ? scoreColor(weekScore) : colors.textMuted}>
              {weekScore != null ? round1(weekScore).toFixed(1) : '—'}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Muted>{shortDate(week[0] ?? weekStartKey)} → {shortDate(week[6] ?? '')}</Muted>
            {/* Denominador = dias da semana que JÁ ACONTECERAM. Com "N/7" no meio
                da semana, um domingo futuro aparecia como dia perdido. */}
            <Muted>
              {elapsed === 0
                ? 'Semana futura — nada a encerrar ainda'
                : `${weekClosed.length}/${elapsed} dias encerrados${elapsed < 7 ? ' · dias futuros não contam' : ''}`}
            </Muted>
          </View>
        </Row>
      </Card>

      {activeGoals.length > 8 ? (
        <Card accent={colors.yellow + '66'}>
          <Txt variant="caption" color={colors.yellow}>
            ⚠️ Volume alto ({activeGoals.length} metas). Risco de abandono. Considere reduzir.
          </Txt>
        </Card>
      ) : null}

      <SectionTitle>Consistência por área</SectionTitle>
      <Card style={{ gap: 8 }}>
        {consistency.length === 0 ? <NoData /> : null}
        {consistency.map((c) => (
          <View key={c.area} style={{ gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="caption" color={areaColor(c.area)}>{c.area}</Txt>
              <Txt variant="caption" color={colors.textSecondary}>
                {c.score != null ? `${c.score.toFixed(1)}/10` : 'Sem dado'} · {c.done}/{c.total}
              </Txt>
            </Row>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.track }}>
              <View
                style={{
                  width: `${((c.score ?? 0) / 10) * 100}%`,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: areaColor(c.area),
                }}
              />
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Score por dia</SectionTitle>
      <Card>
        {weekClosed.length >= 3 ? (
          <BarChart
            data={week.map((date) => ({
              label: weekdayShort(date),
              value: store.days.find((d) => d.date === date)?.score?.total ?? null,
            }))}
            colorFor={(v) => scoreColor(v)}
          />
        ) : (
          <>
            <NoData label="Gráficos a partir de 3 pontos de dado" />
            {week.map((date) => {
              const d = store.days.find((x) => x.date === date);
              return (
                <Row key={date} style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <Txt variant="micro" color={colors.textSecondary}>{weekdayShort(date)} {shortDate(date)}</Txt>
                  <Txt variant="micro" color={d?.score ? scoreColor(d.score.total) : colors.textMuted}>
                    {d?.score ? d.score.total.toFixed(1) : 'Sem dado'}
                  </Txt>
                </Row>
              );
            })}
          </>
        )}
      </Card>

      <Pressable onPress={() => router.push('/modulo/graficos')}>
        <Card style={{ gap: 2, borderColor: colors.cyan + '55' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h3">📈 Central de gráficos</Txt>
            {/* Contagem real: antes dizia "21 gráficos" e a tela tinha 19. */}
            <Txt variant="caption" color={colors.cyan}>19 gráficos ›</Txt>
          </Row>
          <Muted>Calendário, streak, média móvel, tendência, hora do dia, radar e mais</Muted>
        </Card>
      </Pressable>

      <SectionTitle>Mural de constância (12 semanas)</SectionTitle>
      <ConstancyHeatmap days={store.days} goals={store.goals} weeks={12} cellSize={13} />

      <SectionTitle>Calendário da semana</SectionTitle>
      <Card>
        <Heatmap
          data={week.map((date) => ({
            date,
            score: store.days.find((d) => d.date === date)?.score?.total ?? null,
          }))}
          cell={34}
        />
      </Card>

      <SectionTitle>Padrões da semana</SectionTitle>
      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="caption" color={colors.textSecondary}>Padrão identificado</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ flex: 1, textAlign: 'right' }}>
            {patternLabel}
          </Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="caption" color={colors.textSecondary}>Gatilho mais frequente</Txt>
          <Txt variant="caption" color={colors.textPrimary}>{triggers[0]?.label ?? 'Sem dado'}</Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="caption" color={colors.textSecondary}>Regras SE-ENTÃO ativadas</Txt>
          <Txt variant="caption" color={rulesActivated.length ? colors.green : colors.textMuted}>
            {totalRules ? `${rulesActivated.length}/${totalRules} (${Math.round((rulesActivated.length / totalRules) * 100)}%)` : 'Sem regras'}
          </Txt>
        </Row>
        {sleep ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption" color={colors.textSecondary}>Sono &lt; 6h</Txt>
            <Txt variant="caption" color={colors.textPrimary}>score cai {Math.abs(sleep.diff)} pts</Txt>
          </Row>
        ) : null}
      </Card>

      <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.green}>Maior vitória</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 4 }}>
            {biggestWin
              ? `${store.goals.find((g) => g.id === biggestWin.task.goalId)?.name ?? 'Tarefa'} em ${shortDate(biggestWin.day.date)}`
              : 'Sem dado'}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.red}>Maior falha</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 4 }}>
            {biggestFail
              ? `${store.goals.find((g) => g.id === biggestFail.task.goalId)?.name ?? 'Tarefa'} (${biggestFail.task.excuse?.type})`
              : 'Sem dado'}
          </Txt>
        </Card>
      </Row>

      <SectionTitle>Foco da próxima semana</SectionTitle>
      <Card>
        {weekFocus.length ? (
          weekFocus.map((f, i) => (
            <Txt key={i} variant="caption" color={colors.textPrimary} style={{ marginBottom: 4 }}>
              {i + 1}. {f}
            </Txt>
          ))
        ) : (
          <NoData label="Nenhum foco definido" />
        )}
        <SecondaryButton label={weekFocus.length ? 'Editar foco' : 'Definir foco'} style={{ marginTop: spacing.sm, height: 44 }} onPress={onEditFocus} />
      </Card>

      <Card>
        <Txt variant="caption" color={colors.textSecondary}>
          Comparação com semana anterior:{' '}
          {avg(prevConsistency.map((p) => p.score ?? 0)) != null && weekScore != null
            ? `${round1(avg(prevConsistency.map((p) => p.score ?? 0)) ?? 0)} → ${round1(weekScore)}`
            : 'Sem dado'}
        </Txt>
      </Card>
    </>
  );
}

/* ─────────────────────────────── MENSAL ─────────────────────────────── */

function MonthlyReview({ route, onEditRoute }: { route: string[]; onEditRoute: () => void }) {
  const store = useStore();
  const now = new Date();
  const monthDates = daysInMonth(now.getFullYear(), now.getMonth());
  const monthDays = store.days.filter((d) => monthDates.includes(d.date) && d.score);
  const monthScore = avg(monthDays.map((d) => d.score?.total ?? 0));
  const consistency = areaConsistency(store, monthDates);
  const sleep = sleepCorrelation(store);
  const failures = failureMap(store);
  const topExcuseData = topExcuse(store);

  const opportunityCost = monthDays.reduce((acc, d) => acc + (d.diary.impulseCost || 0), 0);

  const goalsStatus = useMemo(() => {
    return store.goals
      .filter((g) => g.active || g.archived)
      .map((goal) => {
        let done = 0;
        let total = 0;
        for (const d of monthDays) {
          const t = d.tasks.find((x) => x.goalId === goal.id);
          if (!t) continue;
          total += 1;
          if (t.done) done += 1;
        }
        if (!total) return { goal, status: 'Sem dado', pct: 0 };
        const pct = (done / total) * 100;
        const status = pct >= 85 ? '🏆 excelente' : pct >= 60 ? '⭐ ideal' : pct >= 30 ? '✅ mínimo' : '❌ não atingido';
        return { goal, status, pct: Math.round(pct) };
      });
  }, [store.goals, monthDays]);

  const toCut = goalsStatus
    .filter((g) => g.pct < 30 && g.goal.priority !== 'high' && g.goal.active)
    .map((g) => g.goal.name);
  const toPrioritize = goalsStatus
    .filter((g) => g.goal.priority === 'high' && g.pct >= 60)
    .map((g) => g.goal.name);

  const radarData = consistency
    .filter((c) => c.score != null)
    .slice(0, 8)
    .map((c) => ({ label: c.area.slice(0, 9), value: c.score, color: areaColor(c.area) }));

  const gauge = useMemo(() => monthlyGauge(store, todayKey()), [store]);
  const waffleData = useMemo(() => waffle(store.days, 100, todayKey()), [store.days]);
  const categories = useMemo(() => categoryDistribution(store, 30, todayKey()), [store]);

  return (
    <>
      <Card accent={colors.cyan + '44'}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="micro" color={colors.textSecondary}>{monthLabel(todayKey())}</Txt>
            <Txt variant="h1" color={monthScore != null ? scoreColor(monthScore) : colors.textMuted}>
              {monthScore != null ? round1(monthScore).toFixed(1) : '—'}
            </Txt>
          </View>
          <Muted>{monthDays.length}/{monthDates.length} dias</Muted>
        </Row>
      </Card>

      <SectionTitle>Score diário do mês</SectionTitle>
      <Card>
        {monthDays.length >= 3 ? (
          <LineChart
            labels={monthDates.map((d) => d.slice(8, 10))}
            series={[
              {
                name: 'Score',
                color: colors.green,
                points: monthDates.map((d) => store.days.find((x) => x.date === d)?.score?.total ?? null),
              },
            ]}
            goal={store.settings.targetDailyScore}
          />
        ) : (
          <NoData label="Gráficos a partir de 3 pontos de dado" />
        )}
      </Card>

      <SectionTitle>Meta do mês</SectionTitle>
      <Card style={{ alignItems: 'center' }}>
        <MonthlyGauge info={gauge} size={170} />
        <Muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
          Alvo = todos os dias do mês com score ≥ {store.settings.targetDailyScore}. Dias sem registro
          continuam contando como não cumpridos — meta não se completa sozinha.
        </Muted>
      </Card>

      <SectionTitle>Últimos 100 dias</SectionTitle>
      <Card>
        <WaffleChart cells={waffleData.cells} done={waffleData.done} partial={waffleData.partial} />
      </Card>

      <SectionTitle>Equilíbrio entre áreas</SectionTitle>
      <Card>
        {radarData.length >= 3 ? <RadarChart data={radarData} /> : <NoData label="Dados insuficientes" />}
      </Card>

      <SectionTitle>Distribuição por área (30 dias)</SectionTitle>
      <Card>
        <CategoryDonut data={categories} centerLabel="tarefas feitas" unit=" tarefas" />
      </Card>

      <SectionTitle>Status das metas</SectionTitle>
      <Card style={{ gap: 8 }}>
        {goalsStatus.length === 0 ? <NoData /> : null}
        {goalsStatus.map(({ goal, status, pct }) => (
          <Row key={goal.id} style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption" color={colors.textPrimary} style={{ flex: 1 }}>{goal.name}</Txt>
            <Txt variant="micro" color={colors.textSecondary}>{pct}%</Txt>
            <Txt variant="micro" color={status.includes('❌') ? colors.red : colors.green}>{status}</Txt>
          </Row>
        ))}
      </Card>

      <SectionTitle>Top padrões de falha</SectionTitle>
      <Card>
        {excuseRanking(store, 3).length ? (
          excuseRanking(store, 3).map((e) => (
            <Txt key={`${e.type}-${e.legitimacy}`} variant="caption" color={colors.textPrimary} style={{ marginBottom: 4 }}>
              • {e.type} / {e.legitimacy} — {e.count}x ({e.pct}%)
            </Txt>
          ))
        ) : (
          <NoData label="Sem desculpas registradas" />
        )}
        {failures.ready && failures.sequences.length ? (
          <>
            <Muted style={{ marginTop: spacing.sm }}>Sequências:</Muted>
            {failures.sequences.slice(0, 3).map((s) => (
              <Muted key={s.label}>• {s.label} — {s.count}x</Muted>
            ))}
          </>
        ) : null}
      </Card>

      <Row gap={spacing.sm} style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.textSecondary}>Custo de oportunidade</Txt>
          <Txt variant="h3" style={{ marginTop: 4 }}>
            {monthDays.some((d) => d.tasks.some((t) => t.cost))
              ? monthDays.flatMap((d) => d.tasks.map((t) => t.cost).filter(Boolean)).slice(0, 3).join(' · ')
              : 'Sem dado'}
          </Txt>
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.textSecondary}>Gastos por impulso</Txt>
          <Txt variant="h3" color={colors.red} style={{ marginTop: 4 }}>
            {opportunityCost > 0 ? `R$ ${opportunityCost.toFixed(0)}` : 'Sem dado'}
          </Txt>
        </Card>
      </Row>

      <Card>
        <Txt variant="h3" style={{ marginBottom: 6 }}>Metas a cortar ou reduzir</Txt>
        {toCut.length ? toCut.map((n) => <Muted key={n}>• {n} (abaixo de 30% de execução)</Muted>) : <NoData label="Nenhuma sugestão com base nos dados" />}
      </Card>
      <Card>
        <Txt variant="h3" style={{ marginBottom: 6 }}>Metas a priorizar</Txt>
        {toPrioritize.length ? toPrioritize.map((n) => <Muted key={n}>• {n} (prioridade alta e &gt; 60%)</Muted>) : <NoData label="Nenhuma sugestão com base nos dados" />}
      </Card>

      <Card>
        <Txt variant="h3">Desculpa dominante</Txt>
        <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 4 }}>
          {topExcuseData.value ? `${topExcuseData.value.type} / ${topExcuseData.value.legitimacy} (${topExcuseData.value.pct}%)` : 'Sem dado'}
        </Txt>
      </Card>

      <Card>
        <Txt variant="h3">Sono x performance</Txt>
        <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 4 }}>
          {sleep ? `Nos dias com < 6h de sono, seu score cai ${Math.abs(sleep.diff)} pontos.` : 'Sem dado'}
        </Txt>
      </Card>

      <SectionTitle>Ajuste de rota</SectionTitle>
      <Card>
        {route.length ? route.map((r, i) => <Txt key={i} variant="caption" color={colors.textPrimary} style={{ marginBottom: 4 }}>{i + 1}. {r}</Txt>) : <NoData label="Nenhum ajuste definido" />}
        <SecondaryButton label={route.length ? 'Editar ajuste' : 'Definir ajuste'} style={{ marginTop: spacing.sm, height: 44 }} onPress={onEditRoute} />
      </Card>
    </>
  );
}

/* ─────────────────────────────── TRIMESTRAL ─────────────────────────────── */

function QuarterlyReview() {
  const store = useStore();
  const q = quarterOf(todayKey());
  const [identityEdit, setIdentityEdit] = useState<string | null>(null);

  const quarterDates = useMemo(() => {
    const startMonth = (q.quarter - 1) * 3;
    return [0, 1, 2].flatMap((offset) => daysInMonth(q.year, startMonth + offset));
  }, [q.year, q.quarter]);

  const prevQuarterDates = useMemo(() => {
    const prev = q.quarter === 1 ? { year: q.year - 1, quarter: 4 } : { year: q.year, quarter: q.quarter - 1 };
    const startMonth = (prev.quarter - 1) * 3;
    return [0, 1, 2].flatMap((offset) => daysInMonth(prev.year, startMonth + offset));
  }, [q.year, q.quarter]);

  const current = areaConsistency(store, quarterDates);
  const previous = areaConsistency(store, prevQuarterDates);
  const triggers = triggerMap(store, 6);
  const failures = failureMap(store);

  const areas = Array.from(new Set([...current.map((c) => c.area)]));
  const series = [
    {
      name: 'Trimestre atual',
      color: colors.green,
      points: areas.map((a) => current.find((c) => c.area === a)?.score ?? null),
    },
    {
      name: 'Trimestre anterior',
      color: colors.textMuted,
      points: areas.map((a) => previous.find((c) => c.area === a)?.score ?? null),
    },
  ];

  return (
    <>
      <Card accent={colors.purple + '44'}>
        <Txt variant="micro" color={colors.textSecondary}>Trimestre</Txt>
        <Txt variant="h2">{q.quarter}º tri / {q.year}</Txt>
      </Card>

      <SectionTitle>Revisão de identidade</SectionTitle>
      <Card>
        <Txt variant="micro" color={colors.textSecondary}>Você escreveu no onboarding:</Txt>
        <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 6, lineHeight: 20 }}>
          “{store.user.identity || 'Sem dado'}”
        </Txt>
        <Muted style={{ marginTop: 6 }}>Não aceito mais: {store.user.noMore || 'Sem dado'}</Muted>
        <Txt variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
          Sua identidade ainda bate com a direção atual?
        </Txt>
        <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
          <SecondaryButton label="Sim, manter" style={{ flex: 1, height: 44 }} onPress={() => setIdentityEdit(null)} />
          <SecondaryButton label="Quero ajustar" color={colors.purple} style={{ flex: 1, height: 44 }} onPress={() => setIdentityEdit(store.user.identity)} />
        </Row>
        {identityEdit != null ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <TextInput
              value={identityEdit}
              onChangeText={setIdentityEdit}
              multiline
              style={{
                backgroundColor: colors.bgInput,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                color: colors.textPrimary,
                minHeight: 90,
                textAlignVertical: 'top',
              }}
            />
            <PrimaryButton
              label="Salvar identidade"
              onPress={() => {
                store.updateUser({ identity: identityEdit });
                setIdentityEdit(null);
                haptic('success');
              }}
            />
          </View>
        ) : null}
      </Card>

      <SectionTitle>Áreas da vida</SectionTitle>
      <Card>
        <Muted>Alguma área entra ou sai neste trimestre?</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
          {Array.from(new Set([...store.user.areas, ...store.goals.map((g) => g.area)])).map((a) => (
            <Chip
              key={a}
              label={a}
              color={areaColor(a)}
              selected={store.user.areas.includes(a)}
              onPress={() => {
                const next = store.user.areas.includes(a)
                  ? store.user.areas.filter((x) => x !== a)
                  : [...store.user.areas, a];
                store.updateUser({ areas: next });
              }}
            />
          ))}
        </View>
      </Card>

      <SectionTitle>Comparativo por área</SectionTitle>
      <Card>
        {areas.length >= 3 ? <LineChart labels={areas.map((a) => a.slice(0, 4))} series={series} /> : <NoData label="Gráficos a partir de 3 pontos de dado" />}
      </Card>

      <SectionTitle>Mapa de gatilhos atualizado</SectionTitle>
      <Card>
        {triggers.length ? (
          triggers.map((t) => (
            <Row key={t.label} style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Txt variant="caption" color={colors.textPrimary}>{t.label}</Txt>
              <Badge label={`${t.count}x`} color={colors.orange} />
            </Row>
          ))
        ) : (
          <NoData label="Sem gatilhos registrados" />
        )}
      </Card>

      <SectionTitle>Padrões de falha</SectionTitle>
      <Card>
        {failures.sequences.length ? (
          failures.sequences.map((s) => (
            <Txt key={s.label} variant="caption" color={colors.textPrimary} style={{ marginBottom: 4 }}>
              • {s.label} — {s.count}x
            </Txt>
          ))
        ) : (
          <NoData label="Sem dado" />
        )}
        {failures.weekendDrop != null ? (
          <Muted style={{ marginTop: 6 }}>
            Fim de semana cai {failures.weekendDrop}% vs dias úteis.
          </Muted>
        ) : null}
      </Card>

      <SectionTitle>Redefinição de prioridades</SectionTitle>
      <Card>
        {store.goals.filter((g) => g.active && g.priority === 'high').length ? (
          store.goals
            .filter((g) => g.active && g.priority === 'high')
            .map((g) => (
              <Txt key={g.id} variant="caption" color={colors.textPrimary} style={{ marginBottom: 4 }}>
                🔴 {g.name} · {g.area}
              </Txt>
            ))
        ) : (
          <NoData label="Nenhuma prioridade alta definida" />
        )}
        <Muted style={{ marginTop: 6 }}>
          Regra: no máximo 3 prioridades altas. Se tudo é prioridade, nada é.
        </Muted>
      </Card>
    </>
  );
}

/* ─────────────────────────────── ANUAL ─────────────────────────────── */

function AnnualReview() {
  const store = useStore();
  const closed = closedDays(store.days);
  const first = closed[0]?.date;
  const monthsAvailable = new Set(closed.map((d) => d.date.slice(0, 7))).size;

  const monthScores = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const d of closed) {
      const key = d.date.slice(0, 7);
      const list = map.get(key) ?? [];
      if (d.score) list.push(d.score.total);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort()
      .map(([key, values]) => ({ key, value: avg(values) }));
  }, [closed]);

  const yearScore = avg(closed.map((d) => d.score?.total ?? 0));
  const wins = closed
    .filter((d) => (d.score?.total ?? 0) > 7)
    .slice(-5)
    .map((d) => `${shortDate(d.date)} — score ${d.score?.total.toFixed(1)}`);
  const persistent = failureMap(store).sequences.slice(0, 3);
  const areas = Array.from(new Set(store.goals.map((g) => g.area)));

  const seriesByArea = areas.slice(0, 5).map((area) => {
    const ids = new Set(store.goals.filter((g) => g.area === area).map((g) => g.id));
    return {
      name: area,
      color: areaColor(area),
      points: monthScores.map((m) => {
        const days = closed.filter((d) => d.date.slice(0, 7) === m.key);
        let total = 0;
        let done = 0;
        for (const d of days) {
          for (const t of d.tasks) {
            if (!ids.has(t.goalId)) continue;
            total += 1;
            if (t.done) done += 1;
          }
        }
        return total ? (done / total) * 10 : null;
      }),
    };
  });

  return (
    <>
      <Card accent={colors.yellow + '44'}>
        <Txt variant="micro" color={colors.textSecondary}>Ano corrente</Txt>
        <Txt variant="h2">Score médio: {yearScore != null ? round1(yearScore).toFixed(1) : 'Sem dado'}</Txt>
        <Muted>{closed.length} dias registrados · início em {first ? shortDate(first) : '—'}</Muted>
      </Card>

      {monthsAvailable < 6 ? (
        <Card accent={colors.yellow + '55'}>
          <Txt variant="caption" color={colors.yellow}>
            Dados insuficientes para relatório anual. Mostrando maior período disponível ({monthsAvailable} mês(es)).
          </Txt>
        </Card>
      ) : null}

      <SectionTitle>Resumo da jornada</SectionTitle>
      <Card>
        {closed.length >= 3 ? (
          <>
            <Txt variant="caption" color={colors.textPrimary} style={{ lineHeight: 20 }}>
              Você registrou {closed.length} dias de {first ? monthLabel(first) : '—'} até hoje.
            </Txt>
            <Txt variant="caption" color={colors.textPrimary} style={{ lineHeight: 20 }}>
              Score médio de {round1(yearScore ?? 0)} em {monthsAvailable} mês(es) de dados.
            </Txt>
            <Txt variant="caption" color={colors.textPrimary} style={{ lineHeight: 20 }}>
              {wins.length} dia(s) acima de 7 pontos. {store.badges.filter((b) => b.unlockedAt).length} conquista(s) desbloqueada(s).
            </Txt>
            <Txt variant="caption" color={colors.textPrimary} style={{ lineHeight: 20 }}>
              Padrão persistente: {persistent[0]?.label ?? 'sem dado'}.
            </Txt>
          </>
        ) : (
          <NoData label="Sem dado" />
        )}
      </Card>

      <SectionTitle>Evolução por área (12 meses)</SectionTitle>
      <Card>
        {monthScores.length >= 3 ? (
          <LineChart labels={monthScores.map((m) => MONTHS[Number(m.key.slice(5, 7)) - 1]?.slice(0, 3) ?? '')} series={seriesByArea} />
        ) : (
          <NoData label="Gráficos a partir de 3 pontos de dado" />
        )}
      </Card>

      <SectionTitle>Maiores vitórias</SectionTitle>
      <Card>
        {wins.length ? wins.map((w) => <Txt key={w} variant="caption" color={colors.green} style={{ marginBottom: 4 }}>• {w}</Txt>) : <NoData label="Sem dado" />}
      </Card>

      <SectionTitle>Padrões persistentes</SectionTitle>
      <Card>
        {persistent.length ? (
          persistent.map((p) => <Txt key={p.label} variant="caption" color={colors.red} style={{ marginBottom: 4 }}>• {p.label} ({p.count}x)</Txt>)
        ) : (
          <NoData label="Sem dado" />
        )}
      </Card>

      <SectionTitle>Identidade mudou?</SectionTitle>
      <Card>
        <Txt variant="micro" color={colors.textSecondary}>No início:</Txt>
        <Txt variant="caption" color={colors.textSecondary} style={{ marginTop: 4 }}>“{store.user.identity || 'Sem dado'}”</Txt>
        <Txt variant="micro" color={colors.textSecondary} style={{ marginTop: spacing.md }}>Hoje:</Txt>
        <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 4 }}>“{store.user.identity || 'Sem dado'}”</Txt>
        <Muted style={{ marginTop: 6 }}>
          O app não inventa sua evolução de identidade: só compara o que você mesmo escreveu.
        </Muted>
      </Card>

      <SectionTitle>Direção para o próximo ano</SectionTitle>
      <Card>
        <Txt variant="caption" color={colors.textSecondary}>
          {wins.length ? 'Manter o que já funciona' : 'Sem dado'}:{' '}
          {Array.from(new Set(closed.filter((d) => (d.score?.total ?? 0) > 7).flatMap((d) => d.tasks.filter((t) => t.done).map((t) => goalForTask(store.goals, t)?.name ?? '')).filter(Boolean)))
            .slice(0, 3)
            .join(', ') || 'Sem dado'}
        </Txt>
        <Txt variant="caption" color={colors.textSecondary} style={{ marginTop: 6 }}>
          Corrigir: {persistent[0]?.label ?? 'Sem dado'}
        </Txt>
      </Card>
    </>
  );
}
