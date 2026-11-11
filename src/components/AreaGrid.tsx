import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, areaIcon } from './Icon';
import { Txt } from './ui';
import { areaColor, radius, spacing, useTheme } from '../theme';

/**
 * Cards das áreas ativas hoje (2 por linha).
 *
 * Cada card mostra o que a área entrega hoje e o progresso REAL (tarefas do
 * dia). Área sem tarefa no dia aparece como "Sem dado", nunca com número
 * inventado.
 */
export interface AreaCardData {
  area: string;
  headline: string;
  progressLabel: string;
  progress: number | null;
  extra?: string;
  onPress: () => void;
}

export function AreaGrid({ areas }: { areas: AreaCardData[] }) {
  const t = useTheme();
  if (!areas.length) {
    return (
      <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, backgroundColor: t.bgCard, padding: spacing.lg }}>
        <Txt variant="caption" color={t.textMuted}>
          Sem dado — nenhuma área ativa com meta.
        </Txt>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {areas.map((item) => {
        const color = areaColor(item.area);
        return (
          <Pressable
            key={item.area}
            onPress={item.onPress}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexBasis: '47%',
              flexGrow: 1,
              minWidth: 150,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.bgCard,
              padding: spacing.md,
              gap: 5,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name={areaIcon(item.area)} size={13} color={color} />
                <Txt variant="micro" color={color} style={{ letterSpacing: 1.4 }}>
                  {item.area}
                </Txt>
              </View>
              <Icon name="chevronDireita" size={13} color={t.textFaint} />
            </View>
            <Txt variant="caption" color={t.textPrimary} numberOfLines={1}>
              {item.headline}
            </Txt>
            <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 0 }}>
              {item.progressLabel}
              {item.extra ? ` · ${item.extra}` : ''}
            </Txt>
            {item.progress != null ? (
              <View style={{ height: 3, borderRadius: 2, backgroundColor: t.track, overflow: 'hidden' }}>
                <View
                  style={{
                    height: 3,
                    width: `${Math.max(0, Math.min(1, item.progress)) * 100}%`,
                    backgroundColor: color,
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
