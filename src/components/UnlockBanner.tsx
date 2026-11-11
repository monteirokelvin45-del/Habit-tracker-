import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Txt } from './ui';
import { useStore } from '../lib/store';
import { unlockMessage } from '../lib/achievements';
import { haptic } from '../lib/haptics';
import { Confetti } from '../lib/anim';

/**
 * Faixa de conquista desbloqueada.
 *
 * Fica no topo da aba Hoje (e não num modal) de propósito: recompensa que
 * interrompe o fluxo vira estorvo. Aparece uma vez por desbloqueio — o
 * `freshUnlocks` do store é alimentado pela comparação antes/depois em
 * `evaluateBadges`, então nada é anunciado duas vezes.
 */
export function UnlockBanner() {
  const freshUnlocks = useStore((s) => s.freshUnlocks);
  const dismiss = useStore((s) => s.dismissUnlocks);
  const [confetti, setConfetti] = useState(false);
  const unlock = freshUnlocks[0] ?? null;

  useEffect(() => {
    if (!unlock) return;
    setConfetti(true);
    haptic('success');
  }, [unlock]);

  if (!unlock) return null;

  return (
    <>
      <Confetti visible={confetti} onDone={() => setConfetti(false)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Conquista desbloqueada: ${unlock.name}. Toque para dispensar.`}
        onPress={() => {
          haptic('light');
          dismiss();
        }}
        style={{
          borderWidth: 1,
          borderColor: colors.yellow + '77',
          backgroundColor: colors.bgCard,
          borderRadius: radius.lg,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Txt style={{ fontSize: 26 }}>{unlock.emoji}</Txt>
        <View style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.yellow}>CONQUISTA DESBLOQUEADA</Txt>
          <Txt variant="body" style={{ fontWeight: '700' }}>{unlock.name}</Txt>
          <Txt variant="caption" color={colors.textSecondary}>{unlockMessage(unlock)}</Txt>
        </View>
        {freshUnlocks.length > 1 ? (
          <Txt variant="caption" color={colors.textMuted}>+{freshUnlocks.length - 1}</Txt>
        ) : (
          <Txt variant="caption" color={colors.textMuted}>tocar para fechar</Txt>
        )}
      </Pressable>
    </>
  );
}
