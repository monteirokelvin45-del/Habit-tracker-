import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { colors, onAccent, radius, spacing, type, useTheme } from '../theme';
import type { TextStyle } from 'react-native';
import { haptic } from '../lib/haptics';

/* ─────────────────────────────── Text ─────────────────────────────── */

type TextVariant = 'h1' | 'h2' | 'h3' | 'metric' | 'body' | 'caption' | 'micro';

export function Txt({
  variant = 'body',
  color = colors.textPrimary,
  style,
  children,
  numberOfLines,
  onPress,
  upper,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<any>;
  children?: React.ReactNode;
  numberOfLines?: number;
  onPress?: () => void;
  /**
   * `false` desliga o CAIXA ALTA de `micro`/`label`. Necessário para rótulo que
   * é conteúdo (mês abreviado, sigla de dia, unidade) — "OUT" e "QUI" viram
   * palavras erradas quando o texto é dado, não decoração.
   */
  upper?: boolean;
}) {
  useTheme(); // re-render na troca de tema
  return (
    <Text
      onPress={onPress}
      numberOfLines={numberOfLines}
      style={[
        // `type` é `as const`: o estilo tipográfico já é um TextStyle válido, sem cast.
        type[variant] as TextStyle,
        { color },
        variant === 'micro' && upper !== false && { textTransform: 'uppercase', letterSpacing: 0.6 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Muted({ children, style }: { children?: React.ReactNode; style?: StyleProp<any> }) {
  return (
    <Txt variant="caption" color={colors.textSecondary} style={style}>
      {children}
    </Txt>
  );
}

/** "Sem dado" — regra absoluta 1: nunca inventar. */
export function NoData({ label = 'Sem dado' }: { label?: string }) {
  useTheme();

  return (
    <Txt variant="caption" color={colors.textMuted}>
      {label}
    </Txt>
  );
}

/* ─────────────────────────────── Card ─────────────────────────────── */

export function Card({
  children,
  style,
  accent,
  pulse,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
  pulse?: boolean;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, anim]);

  const t = useTheme();
  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: t.bgCard, borderColor: t.border },
        accent ? { borderColor: accent } : null,
        pulse ? { opacity: anim, borderColor: accent ?? colors.red } : null,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ─────────────────────────────── Badge / Chip ─────────────────────────────── */

export function Badge({ label, color = colors.textSecondary }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { borderColor: color + '66', backgroundColor: color + '18' }]}>
      <Txt variant="micro" color={color}>
        {label}
      </Txt>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.green,
  emoji,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  emoji?: string;
}) {
  useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={[
        styles.chip,
        {
          borderColor: selected ? color : colors.border,
          backgroundColor: selected ? color + '22' : colors.bgCard,
        },
      ]}
    >
      <Txt variant="caption" color={selected ? color : colors.textSecondary} style={{ fontWeight: selected ? '600' : '400' }}>
        {emoji ? `${emoji} ` : ''}
        {label}
      </Txt>
    </Pressable>
  );
}

/* ─────────────────────────────── Buttons ─────────────────────────────── */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  color = colors.green,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        haptic('medium');
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: disabled ? colors.track : color, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onAccent()} />
      ) : (
        <Txt variant="body" color={disabled ? colors.textMuted : onAccent()} style={{ fontWeight: '800' }}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  color = colors.green,
  style,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.secondaryBtn,
        { borderColor: disabled ? colors.border : color, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Txt variant="body" color={disabled ? colors.textMuted : color} style={{ fontWeight: '600' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function IconButton({
  label,
  onPress,
  color = colors.textSecondary,
  size = 18,
}: {
  label: string;
  onPress?: () => void;
  color?: string;
  size?: number;
}) {
  useTheme();
  return (
    <Pressable hitSlop={12} onPress={() => { haptic('light'); onPress?.(); }} accessibilityRole="button">
      <Text style={{ color, fontSize: size, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/* ─────────────────────────────── Inputs ─────────────────────────────── */

export function Field({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  style,
  maxLength,
  autoFocus,
}: {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  style?: StyleProp<ViewStyle>;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Txt variant="caption" color={colors.textSecondary}>{label}</Txt> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoFocus={autoFocus}
        style={[
          styles.input,
          { backgroundColor: t.bgInput, borderColor: t.borderAccent, color: t.textPrimary },
          multiline && { minHeight: 92, textAlignVertical: 'top' },
        ]}
      />
      {hint ? <Txt variant="micro" color={colors.textMuted}>{hint}</Txt> : null}
    </View>
  );
}

/* ─────────────────────────────── Checkbox ─────────────────────────────── */

export function Checkbox({
  checked,
  onPress,
  onLongPress,
  color = colors.green,
}: {
  checked: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  color?: string;
}) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const handle = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };
  return (
    <Pressable onPress={handle} onLongPress={onLongPress} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Animated.View
        style={[
          styles.checkbox,
          { borderColor: checked ? color : t.borderAccent, backgroundColor: checked ? color : 'transparent' },
          { transform: [{ scale }] },
          checked && { backgroundColor: color, borderColor: color },
        ]}
      >
        {checked ? <Text style={{ color: colors.black, fontWeight: '900', fontSize: 15 }}>✓</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

/* ─────────────────────────────── Slider ─────────────────────────────── */

export function Slider({
  value,
  onChange,
  min = 0,
  max = 10,
  color = colors.green,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  color?: string;
}) {
  useTheme();
  const [width, setWidth] = useState(0);
  const steps = max - min;
  const pick = (x: number) => {
    if (width <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    const next = Math.round(min + ratio * steps);
    if (next !== value) {
      haptic('light');
      onChange(next);
    }
  };
  return (
    <View style={{ height: 40, justifyContent: 'center' }}>
      <View
        style={styles.sliderTrack}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}>
          <View
            style={{
              width: `${((value - min) / steps) * 100}%`,
              height: '100%',
              backgroundColor: color,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${((value - min) / steps) * 100}%`,
            marginLeft: -11,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: color,
            borderWidth: 3,
            borderColor: colors.bgCard,
          }}
        />
      </View>
    </View>
  );
}

/* ─────────────────────────────── Bottom Sheet ─────────────────────────────── */

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: t.track }]} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
              <Txt variant="h3">{title}</Txt>
              <IconButton label="✕" onPress={onClose} />
            </View>
          ) : null}
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, paddingBottom: 40 }}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}>{children}</View>
          )}
          {footer ? <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/* ─────────────────────────────── Picker (lista) ─────────────────────────────── */

export function OptionPicker({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Selecionar',
}: {
  label?: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  placeholder?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt variant="caption" color={colors.textSecondary}>{label}</Txt> : null}
      <Pressable style={[styles.input, { justifyContent: 'center' }]} onPress={() => setOpen(true)} accessibilityRole="button">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt color={value ? colors.textPrimary : colors.textMuted}>{value || placeholder}</Txt>
          <Txt color={colors.textMuted}>▾</Txt>
        </View>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? 'Escolher'}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => {
              haptic('light');
              onSelect(opt);
              setOpen(false);
            }}
            style={[
              styles.optionRow,
              { backgroundColor: t.bgCard, borderColor: value === opt ? t.green : t.border },
            ]}
          >
            <Txt variant="body" color={value === opt ? colors.green : colors.textPrimary}>
              {opt}
            </Txt>
            {value === opt ? <Txt color={colors.green}>✓</Txt> : null}
          </Pressable>
        ))}
        {!options.length ? <NoData label="Nenhuma opção disponível" /> : null}
      </Sheet>
    </View>
  );
}

/* ─────────────────────────────── Time picker ─────────────────────────────── */

export function TimeField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  useTheme();
  const [open, setOpen] = useState(false);
  const [h, m] = (value || '07:00').split(':');
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];
  const [ph, setPh] = useState(h ?? '07');
  const [pm, setPm] = useState(m ?? '00');
  void [ph, pm];

  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt variant="caption" color={colors.textSecondary}>{label}</Txt> : null}
      <Pressable style={[styles.input, { justifyContent: 'center' }]} onPress={() => setOpen(true)} accessibilityRole="button">
        <Txt color={colors.textPrimary} style={{ fontWeight: '600' }}>{value || '--:--'}</Txt>
      </Pressable>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label ?? 'Horário'}
        footer={
          <PrimaryButton
            label="Confirmar"
            onPress={() => {
              onChange(`${ph}:${pm}`);
              setOpen(false);
            }}
          />
        }
      >
        <View style={{ gap: 8 }}>
          <Muted>Hora</Muted>
          <View style={styles.wrap}>
            {hours.map((hh) => (
              <Chip key={hh} label={hh} selected={ph === hh} onPress={() => setPh(hh)} />
            ))}
          </View>
          <Muted>Minutos</Muted>
          <View style={styles.wrap}>
            {minutes.map((mm) => (
              <Chip key={mm} label={mm} selected={pm === mm} onPress={() => setPm(mm)} />
            ))}
          </View>
        </View>
      </Sheet>
    </View>
  );
}

export function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic('light');
        onChange(!value);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgCard,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="body">{label}</Txt>
        {sub ? <Muted style={{ marginTop: 2 }}>{sub}</Muted> : null}
      </View>
      <View
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          backgroundColor: value ? colors.green : colors.track,
          padding: 3,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? colors.black : colors.textSecondary }} />
      </View>
    </Pressable>
  );
}

/* ─────────────────────────────── Layout helpers ─────────────────────────────── */

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
      <Txt variant="h3">{children}</Txt>
      {right}
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.border, marginVertical: spacing.sm }} />;
}

export function Row({ children, gap = spacing.sm, style }: { children?: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Accordion({
  title,
  subtitle,
  children,
  defaultOpen = false,
  right,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
}) {
  useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={() => {
          haptic('light');
          setOpen((o) => !o);
        }}
        style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={{ flex: 1 }}>
          <Txt variant="h3">{title}</Txt>
          {subtitle ? <Muted style={{ marginTop: 2 }}>{subtitle}</Muted> : null}
        </View>
        <Row gap={spacing.md}>
          {right}
          <Txt color={colors.textSecondary}>{open ? '▾' : '▸'}</Txt>
        </Row>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>{children}</View> : null}
    </Card>
  );
}

export function EmptyState({ emoji, title, hint }: { emoji: string; title: string; hint?: string }) {
  return (
    <Card style={{ alignItems: 'center', gap: 6, paddingVertical: spacing.xl }}>
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
      <Txt variant="h3">{title}</Txt>
      {hint ? <Muted style={{ textAlign: 'center' }}>{hint}</Muted> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Só geometria aqui. Cor vem de `useTheme()` no componente: `StyleSheet` congela
  // o valor no import do módulo e a troca de tema não refletiria.
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 15,
    minHeight: 50,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 40,
    justifyContent: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
