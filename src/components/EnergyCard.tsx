import React, { useState } from 'react';
import { View } from 'react-native';
import { colors, MODES, spacing, useTheme } from '../theme';
import { Badge, Card, Muted, PrimaryButton, Row, Slider, Txt } from './ui';
import type { Day, DayMode } from '../lib/types';
import { suggestMode } from '../lib/score';
import { haptic } from '../lib/haptics';

const MODE_ORDER: DayMode[] = ['normal', 'minimal', 'attack', 'recovery'];

export function EnergyCard({
  day,
  yesterdayScore,
  onEnergy,
  onMode,
  collapsedByDefault = false,
}: {
  day: Day;
  yesterdayScore?: number;
  onEnergy: (energy: Day['energy']) => void;
  onMode: (mode: DayMode) => void;
  /** Já preenchido: o dashboard mostra a linha resumida e só expande a pedido. */
  collapsedByDefault?: boolean;
}) {
  useTheme();
  // Energia "não mexida" = 5/5/5 (o padrão). Se o usuário já definiu, começa recolhido.
  const touched = day.energy.physical !== 5 || day.energy.mental !== 5 || day.energy.stress !== 5;
  const [collapsed, setCollapsed] = useState(!!day.closedAt || (collapsedByDefault && touched));
  const suggestion = suggestMode({ physical: day.energy.physical, mental: day.energy.mental }, yesterdayScore);
  const modeMeta = MODES[day.mode];

  if (collapsed) {
    return (
      <Card accent={colors.green + '55'}>
        <Row gap={spacing.md} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Muted>Check-in de energia</Muted>
            <Txt variant="body" style={{ marginTop: 4 }}>
              ⚡{day.energy.physical} 🧠{day.energy.mental} 😰{day.energy.stress} → {modeMeta.emoji} {modeMeta.label}
            </Txt>
          </View>
          <Txt color={colors.green} onPress={() => setCollapsed(false)} style={{ fontWeight: '700' }}>
            Ajustar
          </Txt>
        </Row>
      </Card>
    );
  }

  return (
    <Card accent={colors.green + '55'}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Txt variant="h3">Como você está?</Txt>
        <Badge label="check-in" color={colors.green} />
      </Row>

      <View style={{ gap: spacing.xs }}>
        <SliderRow
          icon="⚡"
          label="Energia Física"
          value={day.energy.physical}
          onChange={(v) => onEnergy({ ...day.energy, physical: v })}
          color={colors.green}
        />
        <SliderRow
          icon="🧠"
          label="Energia Mental"
          value={day.energy.mental}
          onChange={(v) => onEnergy({ ...day.energy, mental: v })}
          color={colors.blue}
        />
        <SliderRow
          icon="😰"
          label="Estresse"
          value={day.energy.stress}
          onChange={(v) => onEnergy({ ...day.energy, stress: v })}
          color={colors.red}
        />
      </View>

      <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.border }}>
        <Txt variant="caption" color={MODES[suggestion.mode].color}>
          Sugestão: Modo {MODES[suggestion.mode].label} ({suggestion.reason})
        </Txt>
      </View>

      <Row style={{ flexWrap: 'wrap', marginTop: spacing.md }} gap={spacing.sm}>
        {MODE_ORDER.map((m) => {
          const meta = MODES[m];
          const active = day.mode === m;
          return (
            <Txt
              key={m}
              onPress={() => {
                haptic('select');
                onMode(m);
              }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: active ? meta.color : colors.border,
                backgroundColor: active ? meta.color + '22' : 'transparent',
                color: active ? meta.color : colors.textSecondary,
                fontSize: 12,
                overflow: 'hidden',
              }}
            >
              {meta.emoji} {meta.label}
            </Txt>
          );
        })}
      </Row>

      <PrimaryButton
        label="Definir Modo"
        style={{ marginTop: spacing.md, height: 46 }}
        onPress={() => {
          haptic('medium');
          onMode(suggestion.mode);
          setCollapsed(true);
        }}
      />
      <Muted style={{ marginTop: 6 }}>
        O modo define o que entra no checklist: mínimo esconde, ataque expande.
      </Muted>
    </Card>
  );
}

function SliderRow({
  icon,
  label,
  value,
  onChange,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="caption" color={colors.textSecondary}>
          {icon} {label}
        </Txt>
        <Txt variant="caption" color={color} style={{ fontWeight: '700' }}>
          {value}
        </Txt>
      </Row>
      <Slider value={value} onChange={onChange} color={color} />
    </View>
  );
}
