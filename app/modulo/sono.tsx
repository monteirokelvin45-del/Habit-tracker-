import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import {
  Card,
  Chip,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  SecondaryButton,
  Sheet,
  Txt,
  TimeField,
} from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { BarChart } from '../../src/components/charts';
import { useStore } from '../../src/lib/store';
import { lastNDays, todayKey, weekdayShort } from '../../src/lib/date';
import { sleepCorrelation } from '../../src/lib/insights';
import { SLEEP_BLOCKERS } from '../../src/lib/types';
import { haptic } from '../../src/lib/haptics';
import { evaluateBadges } from '../../src/lib/badges';

function hoursBetween(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  const bedMin = (bh ?? 22) * 60 + (bm ?? 0);
  const wakeMin = (wh ?? 6) * 60 + (wm ?? 0);
  const diff = wakeMin < bedMin ? wakeMin + 24 * 60 - bedMin : wakeMin - bedMin;
  return Math.round((diff / 60) * 10) / 10;
}

export default function SleepScreen() {
  const store = useStore();
  const today = todayKey();
  const day = store.days.find((d) => d.date === today);
  const [sheet, setSheet] = useState(false);
  const [bed, setBed] = useState('22:30');
  const [wake, setWake] = useState('06:30');
  const [quality, setQuality] = useState('7');
  const [blockers, setBlockers] = useState<string[]>([]);

  const last14 = lastNDays(14);
  const data = last14.map((date) => ({
    label: weekdayShort(date),
    value: store.days.find((d) => d.date === date)?.diary.sleep.hours || null,
  }));
  const nights = last14
    .map((date) => ({ date, hours: store.days.find((d) => d.date === date)?.diary.sleep.hours ?? 0 }))
    .filter((n) => n.hours > 0);

  const avgHours = nights.length ? nights.reduce((a, b) => a + b.hours, 0) / nights.length : null;
  const corr = sleepCorrelation(store);
  const blockerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of store.days) for (const b of d.diary.sleep.blockers) map.set(b, (map.get(b) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [store.days]);

  const computed = hoursBetween(bed, wake);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="😴 Sono avançado" subtitle={`Meta: ${store.settings.sleepGoalHours}h por noite`} onAdd={() => setSheet(true)} addLabel="+ Registrar" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Row gap={spacing.sm}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Média 14 noites</Txt>
            <Txt variant="h2" color={colors.blue}>{avgHours ? `${avgHours.toFixed(1)}h` : '—'}</Txt>
            <Muted>{nights.length} noite(s) com registro</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Última noite</Txt>
            <Txt variant="h2" color={colors.blue}>{day?.diary.sleep.hours ? `${day.diary.sleep.hours}h` : '—'}</Txt>
            <Muted>{day?.diary.sleep.quality ? `Qualidade ${day.diary.sleep.quality}/10` : 'Sem dado'}</Muted>
          </Card>
        </Row>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Horas por noite</Txt>
          {nights.length >= 3 ? (
            <BarChart data={data} max={12} colorFor={(v) => (v >= store.settings.sleepGoalHours ? colors.blue : colors.yellow)} />
          ) : (
            <NoData label="Gráficos a partir de 3 pontos de dado" />
          )}
          <Muted style={{ marginTop: spacing.sm }}>Linha de meta: {store.settings.sleepGoalHours}h (barra azul = meta atingida).</Muted>
        </Card>

        <Card>
          <Txt variant="h3">Correlação automática</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 4 }}>
            {corr
              ? `Sono < 6h → score cai ${Math.abs(corr.diff)} pts em média (${corr.lowAvg} vs ${corr.okAvg}).`
              : 'Sem dado suficiente para correlação (mínimo 7 dias com sono registrado).'}
          </Txt>
        </Card>

        <Card>
          <Txt variant="h3">O que atrapalha o sono</Txt>
          {blockerCounts.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {blockerCounts.map(([label, count]) => (
                <Chip key={label} label={`${label} ${count}x`} selected color={colors.red} />
              ))}
            </View>
          ) : (
            <NoData label="Sem registros" />
          )}
        </Card>

        <Card>
          <Txt variant="h3">Meta de sono</Txt>
          <Field
            label="Horas alvo"
            value={String(store.settings.sleepGoalHours)}
            onChangeText={(t) => store.updateSettings({ sleepGoalHours: Number(t.replace(',', '.')) || 7.5 })}
            keyboardType="decimal-pad"
          />
        </Card>
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Registro de sono"
        footer={
          <PrimaryButton
            label={`Salvar (${computed}h)`}
            onPress={() => {
              store.ensureDay(today);
              const current = store.days.find((d) => d.date === today);
              if (current) {
                const days = store.days.map((d) =>
                  d.date === today
                    ? {
                        ...d,
                        diary: {
                          ...d.diary,
                          sleep: { hours: computed, quality: Number(quality) || 0, blockers, bedTime: bed, wakeTime: wake },
                        },
                      }
                    : d,
                );
                useStore.setState({
                  days,
                  badges: evaluateBadges({ ...useStore.getState(), days }),
                });
                void import('../../src/lib/storage').then((m) => m.persist('days', days));
              }
              setSheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Row gap={spacing.sm}>
          <View style={{ flex: 1 }}>
            <TimeField label="Deitou" value={bed} onChange={setBed} />
          </View>
          <View style={{ flex: 1 }}>
            <TimeField label="Acordou" value={wake} onChange={setWake} />
          </View>
        </Row>
        <Muted>Horas calculadas: {computed}h</Muted>
        <Field label="Qualidade percebida (1-10)" value={quality} onChangeText={setQuality} keyboardType="number-pad" />
        <Txt variant="caption" color={colors.textSecondary}>O que atrapalhou</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {SLEEP_BLOCKERS.map((b) => (
            <Chip
              key={b}
              label={b}
              color={colors.red}
              selected={blockers.includes(b)}
              onPress={() => setBlockers((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))}
            />
          ))}
        </View>
        <Muted>Você também pode registrar sono nos campos opcionais do diário noturno.</Muted>
        <SecondaryButton label="Fechar" onPress={() => setSheet(false)} />
      </Sheet>
    </View>
  );
}
