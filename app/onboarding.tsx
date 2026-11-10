import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../src/theme';
import {
  PrimaryButton,
  SecondaryButton,
  Chip,
  Field,
  Sheet,
  Txt,
  Muted,
  TimeField,
  ToggleRow,
} from '../src/components/ui';
import { LIFE_AREAS, type Goal, type Priority } from '../src/lib/types';
import { AREA_EMOJI } from '../src/lib/types';
import { newId, useStore } from '../src/lib/store';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import { areaColor } from '../src/theme';
import { haptic } from '../src/lib/haptics';
import { todayKey } from '../src/lib/date';

interface DraftGoal {
  id: string;
  area: string;
  name: string;
  priority: Priority;
  min: string;
  ideal: string;
  excellent: string;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: '🔴 Prioridade' },
  { value: 'normal', label: '🟡 Normal' },
  { value: 'low', label: '⚪ Baixa' },
];

export default function Onboarding() {
  const router = useRouter();
  const finishOnboarding = useStore((s) => s.finishOnboarding);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [identity, setIdentity] = useState('');
  const [noMore, setNoMore] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [customArea, setCustomArea] = useState('');
  const [customAreas, setCustomAreas] = useState<string[]>([]);
  const [areaSheet, setAreaSheet] = useState(false);
  const [goals, setGoals] = useState<DraftGoal[]>([]);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [morning, setMorning] = useState('07:00');
  const [night, setNight] = useState('21:00');
  const [midday, setMidday] = useState(true);
  const [middayTime, setMiddayTime] = useState('13:00');
  const [streakNotif, setStreakNotif] = useState(true);

  const slide = useRef(new Animated.Value(0)).current;

  const allAreaOptions = useMemo(
    () => Array.from(new Set([...LIFE_AREAS, ...customAreas])),
    [customAreas],
  );

  const goTo = (next: number) => {
    haptic('light');
    setStep(next);
    slide.setValue(30);
    Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const canAdvance =
    step === 0
      ? name.trim().length > 0 && identity.trim().length >= 20 && noMore.trim().length >= 20
      : step === 1
        ? areas.length >= 3
        : true;

  const addGoalFor = (area: string) => {
    setGoals((g) => [
      ...g,
      { id: newId('goal'), area, name: '', priority: 'normal', min: '', ideal: '', excellent: '' },
    ]);
    setExpandedArea(area);
  };

  const submit = async () => {
    haptic('heavy');
    const finalGoals: Goal[] = goals
      .filter((g) => g.name.trim().length > 0)
      .map((g) => ({
        id: g.id,
        name: g.name.trim(),
        area: g.area,
        priority: g.priority,
        min: g.min.trim() || '15min',
        ideal: g.ideal.trim() || '30min',
        excellent: g.excellent.trim() || '1h',
        active: true,
        createdAt: new Date().toISOString(),
      }));

    await finishOnboarding({
      user: {
        name: name.trim(),
        identity: identity.trim(),
        noMore: noMore.trim(),
        areas,
        createdAt: todayKey(),
      },
      areas,
      goals: finalGoals,
      settings: {
        ...DEFAULT_SETTINGS,
        morningReminder: morning,
        nightReminder: night,
        middayCheckin: midday,
        middayTime,
        streakNotification: streakNotif,
      },
    });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top', 'bottom']}>
      {/* Progresso */}
      <View style={{ flexDirection: 'row', gap: 6, padding: spacing.lg }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= step ? colors.green : colors.border,
            }}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateX: slide }], opacity: slide.interpolate({ inputRange: [0, 30], outputRange: [1, 0.4] }), gap: spacing.lg }}>
          {step === 0 ? (
            <>
              <Txt variant="h2">Quem é você?</Txt>
              <Muted>A disciplina começa quando você nomeia a direção. Seja específico — o app vai te cobrar por isso.</Muted>
              <Field label="Seu nome" value={name} onChangeText={setName} placeholder="Como devo te chamar" autoFocus />
              <Field
                label="O que você quer da sua vida?"
                value={identity}
                onChangeText={setIdentity}
                placeholder="Ex: quero ser alguém que treina mesmo sem vontade e termina o que começa"
                multiline
                hint={`${identity.trim().length}/20 caracteres mínimos`}
              />
              <Field
                label="O que você NÃO aceita mais?"
                value={noMore}
                onChangeText={setNoMore}
                placeholder="Ex: não aceito mais prometer e não cumprir comigo"
                multiline
                hint={`${noMore.trim().length}/20 caracteres mínimos`}
              />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Txt variant="h2">Quais áreas importam?</Txt>
              <Muted>Escolha no mínimo 3. Área demais é sinal de foco de menos — comece enxuto.</Muted>
              <View style={styles.wrap}>
                {allAreaOptions.map((area) => {
                  const selected = areas.includes(area);
                  return (
                    <Chip
                      key={area}
                      label={area}
                      emoji={AREA_EMOJI[area]}
                      selected={selected}
                      color={areaColor(area)}
                      onPress={() =>
                        setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]))
                      }
                    />
                  );
                })}
              </View>
              <SecondaryButton label="+ Criar área" onPress={() => setAreaSheet(true)} />
              <Muted>{areas.length} selecionada(s) · mínimo 3</Muted>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Txt variant="h2">Defina suas metas</Txt>
              <Muted>Mín, Ideal e Excelente são os três níveis que o app usa para mudar o checklist conforme seu modo do dia.</Muted>
              {areas.map((area) => {
                const areaGoals = goals.filter((g) => g.area === area);
                const open = expandedArea === area || areaGoals.length === 0;
                return (
                  <View key={area} style={styles.areaCard}>
                    <Pressable
                      onPress={() => setExpandedArea(expandedArea === area ? null : area)}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Txt variant="h3" color={areaColor(area)}>
                        {AREA_EMOJI[area] ?? '•'} {area}
                      </Txt>
                      <Muted>{areaGoals.length} meta(s)</Muted>
                    </Pressable>
                    {open ? (
                      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                        {areaGoals.map((g) => (
                          <View key={g.id} style={{ gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
                            <Field
                              value={g.name}
                              onChangeText={(t) => setGoals((prev) => prev.map((x) => (x.id === g.id ? { ...x, name: t } : x)))}
                              placeholder={`Nome da meta (ex: ${area === 'Treino' ? 'Treinar 5x por semana' : 'Estudar 2h por dia'})`}
                            />
                            <View style={styles.wrap}>
                              {PRIORITIES.map((p) => (
                                <Chip
                                  key={p.value}
                                  label={p.label}
                                  selected={g.priority === p.value}
                                  color={p.value === 'high' ? colors.red : p.value === 'normal' ? colors.yellow : colors.textSecondary}
                                  onPress={() =>
                                    setGoals((prev) => prev.map((x) => (x.id === g.id ? { ...x, priority: p.value } : x)))
                                  }
                                />
                              ))}
                            </View>
                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                              {(['min', 'ideal', 'excellent'] as const).map((key) => (
                                <View key={key} style={{ flex: 1 }}>
                                  <Field
                                    label={key === 'min' ? 'Mín' : key === 'ideal' ? 'Ideal' : 'Excelente'}
                                    value={g[key]}
                                    onChangeText={(t) =>
                                      setGoals((prev) => prev.map((x) => (x.id === g.id ? { ...x, [key]: t } : x)))
                                    }
                                    placeholder={key === 'min' ? '15min' : key === 'ideal' ? '1h' : '2h'}
                                  />
                                </View>
                              ))}
                            </View>
                          </View>
                        ))}
                        <SecondaryButton label="+ Adicionar meta" onPress={() => addGoalFor(area)} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Txt variant="h2">Últimos ajustes</Txt>
              <Muted>Lembretes são o que mantém o loop girando quando a motivação não aparece.</Muted>
              <TimeField label="Lembrete matinal" value={morning} onChange={setMorning} />
              <TimeField label="Lembrete noturno" value={night} onChange={setNight} />
              <ToggleRow
                label="Check-in de meio do dia"
                value={midday}
                onChange={setMidday}
                sub={midday ? `Notificação às ${middayTime}` : 'Desativado'}
              />
              {midday ? (
                <TimeField label="Horário do check-in" value={middayTime} onChange={setMiddayTime} />
              ) : null}
              <ToggleRow
                label="Notificação de streak"
                value={streakNotif}
                onChange={setStreakNotif}
                sub="Aviso diário quando sua sequência está viva"
              />
            </>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={{ padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: spacing.md }}>
        {step > 0 ? (
          <SecondaryButton label="Voltar" onPress={() => goTo(step - 1)} style={{ flex: 1 }} />
        ) : null}
        <PrimaryButton
          label={step === 3 ? 'COMEÇAR' : 'Próximo'}
          disabled={!canAdvance}
          onPress={() => (step === 3 ? void submit() : goTo(step + 1))}
          style={{ flex: 2 }}
        />
      </View>

      <Sheet
        visible={areaSheet}
        onClose={() => setAreaSheet(false)}
        title="Criar área"
        footer={
          <PrimaryButton
            label="Adicionar"
            disabled={customArea.trim().length < 2}
            onPress={() => {
              const clean = customArea.trim();
              if (!clean) return;
              setCustomAreas((prev) => Array.from(new Set([...prev, clean])));
              setAreas((prev) => Array.from(new Set([...prev, clean])));
              setCustomArea('');
              setAreaSheet(false);
            }}
          />
        }
      >
        <Field label="Nome da área" value={customArea} onChangeText={setCustomArea} placeholder="Ex: Música" autoFocus />
        <Muted>Áreas novas recebem cor automática e aparecem nas revisões.</Muted>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  areaCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
