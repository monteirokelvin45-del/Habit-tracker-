import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors, spacing } from '../theme';
import { Chip, Field, Muted, PrimaryButton, Sheet, Txt } from './ui';
import { EXCUSE_TYPES, LEGITIMACY, type Goal } from '../lib/types';
import { haptic } from '../lib/haptics';

export interface FailurePayload {
  type: string;
  legitimacy: string;
  cost: string;
  recoveryPlan: string;
}

/**
 * Regra 7: toda desculpa é classificada em DOIS eixos (tipo + legitimidade).
 * Regra 11: tom de questionamento, nunca de acusação.
 */
export function FailureSheet({
  visible,
  goal,
  onClose,
  onSave,
}: {
  visible: boolean;
  goal?: Goal;
  onClose: () => void;
  onSave: (payload: FailurePayload) => void;
}) {
  const [type, setType] = useState<string>('');
  const [legitimacy, setLegitimacy] = useState<string>('');
  const [cost, setCost] = useState('');
  const [plan, setPlan] = useState('');

  useEffect(() => {
    if (visible) {
      setType('');
      setLegitimacy('');
      setCost('');
      setPlan('');
    }
  }, [visible]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="O que aconteceu?"
      footer={
        <PrimaryButton
          label="Salvar registro"
          disabled={!type || !legitimacy}
          onPress={() => {
            haptic('medium');
            onSave({ type, legitimacy, cost: cost.trim(), recoveryPlan: plan.trim() });
            onClose();
          }}
        />
      }
    >
      {goal ? (
        <View style={{ gap: 2 }}>
          <Muted>Meta não cumprida</Muted>
          <Txt variant="h3">{goal.name}</Txt>
          <Muted>Não existe desculpa errada de registrar. Existe desculpa não registrada.</Muted>
        </View>
      ) : null}

      <Txt variant="caption" color={colors.textSecondary}>Tipo</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {EXCUSE_TYPES.map((t) => (
          <Chip key={t} label={t} selected={type === t} onPress={() => setType(t)} color={colors.red} />
        ))}
      </View>

      <Txt variant="caption" color={colors.textSecondary}>Legitimidade</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {LEGITIMACY.map((l) => (
          <Chip key={l} label={l} selected={legitimacy === l} onPress={() => setLegitimacy(l)} color={colors.yellow} />
        ))}
      </View>

      <Field
        label="Custo de oportunidade"
        value={cost}
        onChangeText={setCost}
        placeholder="ex: perdi 1h de estudo"
      />
      <Field
        label="Plano de recuperação"
        value={plan}
        onChangeText={setPlan}
        placeholder="ex: amanhã faço antes do almoço"
      />
      <Muted>Prioridade alta vem com cobrança direta. As outras vêm com ajuste.</Muted>
      <Muted style={{ color: colors.textMuted }}>
        Desmarcar uma tarefa exige o registro: é isso que separa falha de esquecimento.
        Se você fechar sem salvar, a tarefa continua como está — nada é desmarcado pela metade.
      </Muted>
    </Sheet>
  );
}
