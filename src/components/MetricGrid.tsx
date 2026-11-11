import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Txt } from './ui';
import { radius, spacing, useTheme } from '../theme';

/**
 * Grid de métricas do topo do dashboard.
 *
 * Cada célula mostra um número real, o rótulo de referência (meta/média/recorde)
 * e "Sem dado" quando não há base — regra 1 do sistema, sem inventar.
 */
export interface MetricCell {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  /** 0–1: barra de progresso fina embaixo do número. `null` esconde a barra. */
  progress: number | null;
  onPress?: () => void;
  /** Cor de destaque (score usa a escala). */
  color?: string;
}

export function MetricGrid({ cells }: { cells: MetricCell[] }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {cells.map((cell) => {
        const accent = cell.color ?? t.green;
        return (
          <Pressable
            key={cell.label}
            onPress={cell.onPress}
            disabled={!cell.onPress}
            accessibilityRole={cell.onPress ? 'button' : undefined}
            style={({ pressed }) => ({
              flexBasis: '47%',
              flexGrow: 1,
              minWidth: 150,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.bgCard,
              padding: spacing.md,
              gap: 6,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={cell.icon} size={13} color={t.textMuted} />
              <Txt variant="micro" color={t.textMuted} style={{ letterSpacing: 1.4 }}>
                {cell.label}
              </Txt>
            </View>
            <Txt variant="h2" color={accent} numberOfLines={1} style={{ letterSpacing: -0.5 }}>
              {cell.value}
            </Txt>
            <Txt variant="micro" color={t.textSecondary} numberOfLines={1} style={{ letterSpacing: 0 }}>
              {cell.hint}
            </Txt>
            {cell.progress != null ? (
              <View style={{ height: 3, borderRadius: 2, backgroundColor: t.track, overflow: 'hidden' }}>
                <View
                  style={{
                    height: 3,
                    width: `${Math.max(0, Math.min(1, cell.progress)) * 100}%`,
                    backgroundColor: accent,
                  }}
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
