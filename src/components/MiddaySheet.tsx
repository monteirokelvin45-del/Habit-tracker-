import React, { useState } from 'react';
import { View } from 'react-native';
import { colors, spacing } from '../theme';
import { Card, Chip, Field, Muted, PrimaryButton, Row, SecondaryButton, Sheet, Slider, Txt } from './ui';
import { haptic } from '../lib/haptics';

export interface MiddayPayload {
  priorityDone: boolean;
  energy: number;
  note: string;
  /** Resposta "parcial": registrada como tal, sem virar "não feita". */
  partial?: boolean;
}

/** Check-in de 30 segundos do meio do dia. */
export function MiddaySheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: MiddayPayload) => void;
}) {
  const [answer, setAnswer] = useState<'yes' | 'no' | 'partial' | null>(null);
  const [energy, setEnergy] = useState(6);
  const [note, setNote] = useState('');

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Como está a metade do dia?"
      footer={
        <PrimaryButton
          label="Registrar check-in"
          disabled={answer === null}
          onPress={() => {
            haptic('medium');
            onSave({
              // Antes só "parcial" ficava sem registro: "sim" virava `true` e "não"
              // virava `false` (mesmo efeito), e o parcial era lido como "não feita".
              priorityDone: answer === 'yes',
              partial: answer === 'partial',
              energy,
              note: note.trim(),
            });
            setAnswer(null);
            setNote('');
          }}
        />
      }
    >
      <Txt variant="caption" color={colors.textSecondary}>Já fez a prioridade?</Txt>
      <Row gap={spacing.sm}>
        <Chip label="Sim" color={colors.green} selected={answer === 'yes'} onPress={() => setAnswer('yes')} />
        <Chip label="Parcial" color={colors.yellow} selected={answer === 'partial'} onPress={() => setAnswer('partial')} />
        <Chip label="Não" color={colors.red} selected={answer === 'no'} onPress={() => setAnswer('no')} />
      </Row>

      <View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="caption" color={colors.textSecondary}>Energia agora</Txt>
          <Txt variant="caption" color={colors.green}>{energy}/10</Txt>
        </Row>
        <Slider value={energy} onChange={setEnergy} color={colors.green} />
      </View>

      <Field label="Algo mudou? (opcional)" value={note} onChangeText={setNote} multiline placeholder="Reunião estourou, dormi mal, imprevisto..." />

      {answer === 'no' ? (
        <Card accent={colors.yellow + '66'}>
          <Txt variant="caption" color={colors.yellow}>Ainda dá. Faça 15min agora — o dia não está perdido, só está em risco.</Txt>
          <SecondaryButton label="Fechar e fazer 15min" style={{ marginTop: spacing.sm, height: 44 }} onPress={onClose} />
        </Card>
      ) : null}
      <Muted>Este check-in aparece na revisão do dia como "ponto de virada".</Muted>
    </Sheet>
  );
}
