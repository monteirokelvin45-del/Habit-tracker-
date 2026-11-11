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
} from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { BarChart } from '../../src/components/charts';
import { Icon } from '../../src/components/Icon';
import { useStore } from '../../src/lib/store';
import { lastNDays, todayKey, weekdayShort } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import {
  MEAL_KINDS,
  MEAL_TRIGGERS,
  WATER_GOAL_CUPS,
  dayDiet,
  dietTrend,
  missingMeals,
  serializeMeals,
  waterProgress,
} from '../../src/lib/diet';
import type { Meal, MealKind } from '../../src/lib/diet';

/**
 * Detalhamento da área DIETA.
 *
 * Registro de refeições (com gatilho quando sai do plano) e água. Nada aqui
 * estima caloria: o app registra o que a pessoa informou e aponta o padrão.
 */
export default function DietScreen() {
  const store = useStore();
  const today = todayKey();
  const day = store.days.find((d) => d.date === today);
  const info = dayDiet(day);
  const trend = dietTrend(store.days, 14);

  const [sheet, setSheet] = useState(false);
  const [kind, setKind] = useState<MealKind>('Almoço');
  const [what, setWhat] = useState('');
  const [onPlan, setOnPlan] = useState(true);
  const [trigger, setTrigger] = useState<string>('');
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const save = (meals: Meal[]) => {
    // Refeições vivem em diary.food; dia fechado não aceita escrita (regra do store).
    store.patchDiary(today, { food: serializeMeals(meals) });
  };

  const chart = useMemo(
    () => lastNDays(14).map((date) => {
      const d = store.days.find((x) => x.date === date);
      const i = dayDiet(d);
      return { label: weekdayShort(date), value: i.total === 0 ? null : i.offPlan };
    }),
    [store.days],
  );

  const hours = new Date().getHours();
  const missing = missingMeals(info.meals, hours);
  const water = waterProgress(day?.diary.waterCups);
  const cups = day?.diary.waterCups;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader
        title="Dieta"
        subtitle={info.total === 0 ? 'Nenhuma refeição registrada hoje' : `${info.onPlan}/${info.total} dentro do plano`}
        onAdd={() => setSheet(true)}
        addLabel="+ Refeição"
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Row gap={spacing.sm}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Dentro do plano hoje</Txt>
            <Txt variant="h2" color={info.planRatio == null ? colors.textMuted : info.planRatio >= 0.8 ? colors.green : colors.yellow}>
              {info.planRatio == null ? 'Sem dado' : `${Math.round(info.planRatio * 100)}%`}
            </Txt>
            <Muted>{info.total === 0 ? 'Registre a primeira refeição' : `${info.offPlan} fora do plano`}</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Gatilho dominante</Txt>
            <Txt variant="h3" color={colors.textPrimary}>
              {info.topTrigger ? info.topTrigger.label : 'Sem dado'}
            </Txt>
            <Muted>{info.topTrigger ? `${info.topTrigger.count}x hoje` : 'Nada fora do plano hoje'}</Muted>
          </Card>
        </Row>

        {missing.length ? (
          <Card accent={colors.yellow + '33'}>
            <Row gap={6} style={{ alignItems: 'center' }}>
              <Icon name="alerta" size={14} color={colors.yellow} />
              <Txt variant="caption" color={colors.yellow}>
                Sem registro de {missing.join(' e ')} e já passou do horário.
              </Txt>
            </Row>
          </Card>
        ) : null}

        <Txt variant="h3">Refeições de hoje</Txt>
        {info.meals.length === 0 ? (
          <NoData label="Sem dado — nenhuma refeição registrada hoje" />
        ) : (
          info.meals.map((m, i) => (
            <Card key={`${m.time}-${i}`} style={{ padding: spacing.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="caption" color={colors.textPrimary}>
                    {m.kind}{m.time ? ` · ${m.time}` : ''}
                  </Txt>
                  <Muted>
                    {m.what}
                    {m.onPlan ? '' : m.trigger ? ` · gatilho: ${m.trigger}` : ' · sem gatilho declarado'}
                  </Muted>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Chip label={m.onPlan ? 'no plano' : 'fora'} color={m.onPlan ? colors.green : colors.red} selected />
                  <Txt
                    variant="micro"
                    color={colors.textMuted}
                    onPress={() => save(info.meals.filter((_, idx) => idx !== i))}
                  >
                    excluir
                  </Txt>
                </View>
              </Row>
            </Card>
          ))
        )}

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h3">Água</Txt>
            <Txt variant="caption" color={water == null ? colors.textMuted : water >= 1 ? colors.green : colors.cyan}>
              {cups == null ? 'Sem dado' : `${cups}/${WATER_GOAL_CUPS} copos`}
            </Txt>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bgElevated, overflow: 'hidden', marginTop: spacing.sm }}>
            <View
              style={{
                height: 8,
                width: `${Math.min(100, Math.round((water ?? 0) * 100))}%`,
                backgroundColor: water != null && water >= 1 ? colors.green : colors.cyan,
              }}
            />
          </View>
          <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
            <SecondaryButton
              label="+ 1 copo (250 ml)"
              style={{ flex: 1, height: 44 }}
              onPress={() => {
                store.patchDiary(today, { waterCups: (cups ?? 0) + 1 });
                haptic('select');
              }}
            />
            <SecondaryButton
              label="−"
              style={{ width: 56, height: 44 }}
              onPress={() => store.patchDiary(today, { waterCups: Math.max(0, (cups ?? 0) - 1) })}
            />
          </Row>
          <Muted>
            {cups == null
              ? 'Sem registro de água hoje — o anel fica vazio, não em 0%.'
              : water != null && water >= 1
                ? 'Meta de hidratação batida.'
                : `Faltam ${Math.max(0, WATER_GOAL_CUPS - cups)} copo(s) para a meta.`}
          </Muted>
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Refeições fora do plano (14 dias)</Txt>
          {trend.loggedDays >= 3 ? (
            <>
              <BarChart data={chart} max={5} colorFor={(v) => (v === 0 ? colors.green : v <= 1 ? colors.yellow : colors.red)} />
              <Muted style={{ marginTop: 6 }}>
                {trend.offPlanPerDay == null
                  ? 'Sem dado'
                  : `${trend.offPlanPerDay.toFixed(1)} refeição(ões) fora do plano por dia registrado`}
                {trend.topTrigger ? ` · gatilho dominante: ${trend.topTrigger.label} (${trend.topTrigger.count}x)` : ''}
              </Muted>
            </>
          ) : (
            <NoData label="Gráficos a partir de 3 dias com refeição registrada" />
          )}
        </Card>

        <Card>
          <Txt variant="h3">Leitura honesta</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ marginTop: 4 }}>
            {trend.topTrigger
              ? `A maior parte das saídas do plano vem de "${trend.topTrigger.label}". A escolha é o gatilho, não a pessoa.`
              : 'Sem dado suficiente para apontar gatilho. Registre o que estava acontecendo quando sair do plano.'}
          </Txt>
        </Card>
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Registrar refeição"
        footer={
          <PrimaryButton
            label="Registrar"
            disabled={!what.trim() || (!onPlan && !trigger)}
            onPress={() => {
              save([...info.meals, { time, kind, what: what.trim(), onPlan, trigger: onPlan ? '' : trigger }]);
              setWhat('');
              setOnPlan(true);
              setTrigger('');
              setSheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Txt variant="caption" color={colors.textSecondary}>Tipo</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {MEAL_KINDS.map((k) => (
            <Chip key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <Field label="O que comeu" value={what} onChangeText={setWhat} placeholder="Ex.: arroz, feijão e frango" />
        <Field label="Horário (HH:MM)" value={time} onChangeText={setTime} placeholder="12:30" />
        <Row gap={spacing.sm}>
          <Chip label="Dentro do plano" color={colors.green} selected={onPlan} onPress={() => setOnPlan(true)} />
          <Chip label="Fora do plano" color={colors.red} selected={!onPlan} onPress={() => setOnPlan(false)} />
        </Row>
        {!onPlan ? (
          <>
            <Txt variant="caption" color={colors.textSecondary}>O que estava por trás (obrigatório)</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MEAL_TRIGGERS.filter((t) => !t.startsWith('Nada')).map((t) => (
                <Chip key={t} label={t} color={colors.yellow} selected={trigger === t} onPress={() => setTrigger(t)} />
              ))}
            </View>
            <Muted>Sem gatilho o registro não salva: refeição fora do plano sem causa vira dado inútil.</Muted>
          </>
        ) : null}
        <SecondaryButton label="Fechar" onPress={() => setSheet(false)} />
      </Sheet>
    </View>
  );
}
