import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { areaColor, colors, spacing } from '../../src/theme';
import { Card, Chip, Muted, NoData, Row, Txt } from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { ConstancyHeatmap, heatColor } from '../../src/components/Heatmap';
import { useStore } from '../../src/lib/store';
import { buildHeatmap, buildMonthGrid, HEAT_LEGEND, type HeatLevel } from '../../src/lib/heatmap';
import { addDays, monthLabel, todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';

type Scope = 'ano' | 'mes' | 'area';

export default function ConstancyScreen() {
  const store = useStore();
  const [scope, setScope] = useState<Scope>('ano');
  const [areaFilter, setAreaFilter] = useState<string>('');
  const today = todayKey();

  const areas = useMemo(
    () => Array.from(new Set(store.goals.filter((g) => !g.archived).map((g) => g.area))),
    [store.goals],
  );

  // Filtro por área: reconstrói os dias considerando só as tarefas daquela área.
  const days = useMemo(() => {
    if (!areaFilter) return store.days;
    const ids = new Set(store.goals.filter((g) => g.area === areaFilter).map((g) => g.id));
    return store.days.map((d) => {
      const tasks = d.tasks.filter((t) => ids.has(t.goalId));
      if (!tasks.length) return { ...d, tasks: [], score: undefined };
      const ratio = tasks.filter((t) => t.done).length / tasks.length;
      return {
        ...d,
        tasks,
        score: d.score ? { ...d.score, total: Math.round(ratio * 100) / 10, regularity: Math.round(ratio * 100) / 10 } : undefined,
      };
    });
  }, [store.days, store.goals, areaFilter]);

  const model = useMemo(() => buildHeatmap(days, { weeks: 53 }), [days]);
  const now = new Date();

  // Últimos 5 meses lado a lado (visão mês)
  const months = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1, 12);
      return { year: d.getFullYear(), month: d.getMonth(), weeks: buildMonthGrid(days, d.getFullYear(), d.getMonth()) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const currentStreak = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    let cursor = today;
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const day = byDate.get(cursor);
      if (!day) {
        if (i === 0) {
          cursor = addDays(cursor, -1);
          continue;
        }
        break;
      }
      if ((day.score?.total ?? 0) >= 6) streak += 1;
      else break;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }, [days, today]);

  const longestStreak = useMemo(() => {
    const scored = days.filter((d) => d.score).sort((a, b) => (a.date < b.date ? -1 : 1));
    let best = 0;
    let run = 0;
    let prev: string | null = null;
    for (const d of scored) {
      const ok = (d.score?.total ?? 0) >= 6;
      if (ok && prev && addDays(prev, 1) === d.date) run += 1;
      else if (ok) run = 1;
      else run = 0;
      best = Math.max(best, run);
      prev = ok ? d.date : null;
    }
    return best;
  }, [days]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader
        title="🟩 Mural de constância"
        subtitle="Cada quadrado é um dia. Cumprido acende; sem registro fica apagado."
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        {/* resumo */}
        <Row gap={spacing.sm}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Streak atual</Txt>
            <Txt variant="h2" color={colors.green}>🔥 {currentStreak}</Txt>
            <Muted>dias com score ≥ 6</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Melhor sequência</Txt>
            <Txt variant="h2" color={colors.greenNeon}>{longestStreak}</Txt>
            <Muted>dias consecutivos</Muted>
          </Card>
        </Row>

        <Row gap={spacing.sm}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Dias cumpridos</Txt>
            <Txt variant="h3">{model.stats.fulfilled}</Txt>
            <Muted>de {model.stats.recorded} registrados</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Dias em nível máximo</Txt>
            <Txt variant="h3" color={colors.greenNeon}>{model.stats.perfect}</Txt>
            <Muted>score ≥ 8</Muted>
          </Card>
        </Row>

        {/* escopo */}
        <Row gap={6}>
          {(['ano', 'mes', 'area'] as Scope[]).map((s) => (
            <Chip
              key={s}
              label={s === 'ano' ? 'Último ano' : s === 'mes' ? 'Meses' : 'Por área'}
              selected={scope === s}
              onPress={() => {
                haptic('select');
                setScope(s);
              }}
            />
          ))}
        </Row>

        {scope === 'ano' ? (
          <>
            <ConstancyHeatmap days={store.days} goals={store.goals} weeks={53} />
            <Card>
              <Muted>
                Nível = score do dia: 0 sem registro · 1 abaixo de 4 · 2 entre 4 e 5,9 · 3 entre 6 e 7,9 · 4 acima de 8.
                Toque em um dia para ver tarefas feitas, falhas e o motivo.
              </Muted>
            </Card>
          </>
        ) : null}

        {scope === 'mes' ? (
          <Card style={{ gap: spacing.md }}>
            <Txt variant="h3">Últimos 5 meses</Txt>
            {months.map((m) => (
              <View key={`${m.year}-${m.month}`} style={{ gap: 4 }}>
                <Muted>{monthLabel(`${m.year}-${String(m.month + 1).padStart(2, '0')}-01`)}</Muted>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {m.weeks.map((w) => (
                    <View key={w.index} style={{ gap: 4 }}>
                      {w.cells.map((c) => (
                        <View
                          key={c.date}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            backgroundColor: heatColor(c.level),
                            opacity: c.isFuture ? 0.25 : 1,
                            borderWidth: c.isToday ? 1 : 0,
                            borderColor: colors.textPrimary,
                          }}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {scope === 'area' ? (
          <>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Chip label="Todas" selected={!areaFilter} onPress={() => setAreaFilter('')} />
              {areas.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  color={areaColor(a)}
                  selected={areaFilter === a}
                  onPress={() => setAreaFilter(areaFilter === a ? '' : a)}
                />
              ))}
            </Row>
            {areas.length === 0 ? <NoData label="Sem áreas com metas ativas" /> : null}
            <ConstancyHeatmap days={days} goals={store.goals} weeks={26} />
            {areaFilter ? (
              <Card>
                <Muted>
                  Visão de {areaFilter}: considera apenas as metas dessa área, então um dia acende mesmo que outras
                  áreas tenham falhado.
                </Muted>
              </Card>
            ) : null}
          </>
        ) : null}

        {/* legenda */}
        <Card>
          <Txt variant="micro" color={colors.textMuted}>LEGENDA</Txt>
          {HEAT_LEGEND.map((l) => (
            <Row key={l.level} gap={spacing.sm} style={{ marginTop: 4 }}>
              <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: heatColor(l.level as HeatLevel) }} />
              <Muted>{l.label}</Muted>
            </Row>
          ))}
        </Card>

        <Muted>
          O mural não inventa: dia sem registro fica apagado, mesmo que você tenha feito coisas fora do app.
        </Muted>
      </ScrollView>
    </View>
  );
}
