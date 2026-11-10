import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import {
  Badge,
  Card,
  Chip,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  Sheet,
  Txt,
} from '../../src/components/ui';
import { Confetti } from '../../src/lib/anim';
import { newId, useStore } from '../../src/lib/store';
import { daysToUnlock, rewardProgress } from '../../src/lib/rewards';
import type { Reward } from '../../src/lib/types';
import { haptic } from '../../src/lib/haptics';
import { ModalHeader } from '../../src/components/ModalHeader';

const CRITERIA = [
  { key: 'streak' as const, label: 'Streak de dias (score > 5)', unit: 'dias' },
  { key: 'score' as const, label: 'Dias seguidos com score ≥ alvo', unit: 'dias' },
  { key: 'consistency' as const, label: 'Consistência (%) em N dias', unit: '%' },
];

export default function RewardsScreen() {
  const store = useStore();
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState('');
  const [criteriaType, setCriteriaType] = useState<Reward['criteriaType']>('score');
  const [target, setTarget] = useState('7');
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    store.refreshRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = store.rewards.filter((r) => !r.unlocked);
  const unlocked = store.rewards.filter((r) => r.unlocked);

  const save = () => {
    const value = Number(target) || 0;
    const selected = CRITERIA.find((c) => c.key === criteriaType);
    store.addReward({
      id: newId('reward'),
      name: name.trim(),
      criteria: `${selected?.label ?? ''} — ${value}${selected?.unit ?? ''}`,
      criteriaType,
      target: value,
      current: 0,
      unlocked: false,
    });
    haptic('success');
    setSheet(false);
    setName('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <Confetti visible={confetti} onDone={() => setConfetti(false)} />
      <ModalHeader title="Minhas Recompensas" subtitle="Só o comportamento compra — não a vontade" onAdd={() => setSheet(true)} addLabel="+ Nova" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Card accent={colors.green + '44'}>
          <Txt variant="caption" color={colors.green}>
            Recompensa real só desbloqueia com critério verificável. É isso que transforma prazer em consequência.
          </Txt>
        </Card>

        {store.rewards.length === 0 ? (
          <NoData label="Nenhuma recompensa criada" />
        ) : null}

        {pending.map((r) => (
          <Card key={r.id} style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="h3">🔒 {r.name}</Txt>
              <Txt variant="caption" color={colors.yellow}>
                {r.current}/{r.target} {r.criteriaType === 'consistency' ? '%' : 'dias'}
              </Txt>
            </Row>
            <Muted>{r.criteria}</Muted>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track }}>
              <View
                style={{
                  width: `${rewardProgress(r) * 100}%`,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: colors.yellow,
                }}
              />
            </View>
            <Row style={{ justifyContent: 'space-between' }}>
              <Muted>
                {daysToUnlock(r) != null ? `Faltam ${daysToUnlock(r)} ${r.criteriaType === 'consistency' ? '%' : 'dia(s)'}` : ''}
              </Muted>
              <Txt variant="micro" color={colors.red} onPress={() => store.deleteReward(r.id)}>excluir</Txt>
            </Row>
          </Card>
        ))}

        {unlocked.length ? (
          <>
            <Txt variant="h3" style={{ marginTop: spacing.md }}>Desbloqueadas</Txt>
            {unlocked.map((r) => (
              <Card key={r.id} accent={colors.green + '55'} style={{ gap: 4 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="h3" color={colors.green}>🎉 {r.name}</Txt>
                  <Badge label="desbloqueada" color={colors.green} />
                </Row>
                <Muted>{r.criteria}</Muted>
                {r.unlockedAt ? <Muted>Em {new Date(r.unlockedAt).toLocaleDateString('pt-BR')}</Muted> : null}
                <Row gap={spacing.md}>
                  <Txt variant="micro" color={colors.green} onPress={() => setConfetti(true)}>celebrar</Txt>
                  <Txt variant="micro" color={colors.red} onPress={() => store.deleteReward(r.id)}>excluir</Txt>
                </Row>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Nova recompensa"
        footer={<PrimaryButton label="Criar recompensa" disabled={!name.trim() || !Number(target)} onPress={save} />}
      >
        <Field label="Nome" value={name} onChangeText={setName} placeholder="ex: Pedir delivery" />
        <Txt variant="caption" color={colors.textSecondary}>Critério de desbloqueio</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {CRITERIA.map((c) => (
            <Chip key={c.key} label={c.label} selected={criteriaType === c.key} onPress={() => setCriteriaType(c.key)} />
          ))}
        </View>
        <Field
          label={`Alvo (${CRITERIA.find((c) => c.key === criteriaType)?.unit ?? ''})`}
          value={target}
          onChangeText={setTarget}
          keyboardType="number-pad"
          placeholder="7"
        />
        <Muted>
          Para "score ≥ alvo", o alvo é a nota mínima exigida em cada dia. Para consistência, o alvo é a porcentagem.
        </Muted>
      </Sheet>
    </View>
  );
}
