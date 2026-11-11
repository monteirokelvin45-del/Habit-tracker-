import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from './Icon';
import { Txt } from './ui';
import { radius, scoreColor, spacing, useTheme } from '../theme';

/**
 * Anel de constância do mês: um segmento por dia, colorido pela escala de score.
 *
 * Dia sem registro fica com a cor do "sem dado" (tom 0 da escala), então o anel
 * nunca mente: 30 segmentos sempre, mas só os registrados têm cor de score.
 */
export function MonthRing({
  days,
  monthLabel,
  average,
  streak,
  onPress,
  size = 208,
}: {
  days: { date: string; score: number | null; isFuture: boolean }[];
  monthLabel: string;
  average: number | null;
  streak: number | null;
  onPress?: () => void;
  size?: number;
}) {
  const t = useTheme();
  const stroke = 9;
  const r = (size - stroke * 2) / 2;
  const center = size / 2;
  const gap = 0.035;

  const arc = (index: number) => {
    const per = (Math.PI * 2) / Math.max(1, days.length);
    const start = -Math.PI / 2 + index * per + gap;
    const end = -Math.PI / 2 + (index + 1) * per - gap;
    const x1 = center + r * Math.cos(start);
    const y1 = center + r * Math.sin(start);
    const x2 = center + r * Math.cos(end);
    const y2 = center + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Constância de ${monthLabel}`}
      style={({ pressed }) => ({
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bgCard,
        padding: spacing.lg,
        alignItems: 'center',
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="semanas" size={14} color={t.textSecondary} />
          <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 2 }}>
            Constância do mês
          </Txt>
        </View>
        <Icon name="chevronDireita" size={15} color={t.textFaint} />
      </View>

      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {days.map((day, i) => (
            <Path
              key={day.date}
              d={arc(i)}
              stroke={day.isFuture ? t.textFaint : scoreColor(day.score)}
              strokeWidth={stroke}
              strokeLinecap="butt"
              fill="none"
              opacity={day.isFuture ? 0.35 : 1}
            />
          ))}
          <Circle cx={center} cy={center} r={r - stroke * 1.6} stroke={t.border} strokeWidth={1} fill="none" />
        </Svg>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 2 }}>
            {monthLabel}
          </Txt>
          <Txt variant="metric" color={t.green} style={{ fontSize: 34 }}>
            {average == null ? '—' : average.toFixed(1)}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="streak" size={11} color={t.textMuted} />
            <Txt variant="micro" color={t.textMuted} style={{ letterSpacing: 0.5 }}>
              {streak == null ? 'sem dado' : `${streak} dias`}
            </Txt>
          </View>
        </View>
      </View>

      <Txt variant="micro" color={t.textMuted} style={{ letterSpacing: 0 }}>
        {average == null ? 'Sem dado para o mês' : 'média do mês · toque para revisão mensal'}
      </Txt>
    </Pressable>
  );
}
