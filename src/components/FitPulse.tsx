/**
 * FITPULSE — peças do Módulo de Treino e Fitness.
 *
 * Preto puro + cards grafite + verde lima neon, no estilo Bento Box da referência.
 * Como a Home, este módulo SEGUE o tema ativo (o tema `fitPulse` existe para
 * vestir exatamente este desenho); as cores aqui vêm de `useTheme()`, e o lima é
 * `accent()` — nos outros temas o módulo continua coerente, só não é lima.
 *
 * Regras que valem em todas as peças:
 *  - `null` escreve "Sem dado" (ou desenha o trilho vazio). Zero é um registro;
 *    ausência de registro não é zero.
 *  - Nada de imagem de banco de imagens: as "capas" dos treinos são geradas aqui
 *    com formas e as cores da área. Foto de outra pessoa não é dado do usuário.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { accent, areaColor, radius, spacing, useTheme } from '../theme';
import { Txt } from './ui';

/* ───────────────────────────── card Bento ───────────────────────────── */

/** Card grafite com borda fina (border-white/10) e raio 24. */
export function FitCard({
  children,
  style,
  accentBorder,
  padding = spacing.lg,
  dense,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Borda no acento: o card "ativo" do bento. */
  accentBorder?: boolean;
  padding?: number;
  dense?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 24,
          padding: dense ? spacing.md : padding,
          backgroundColor: t.bgCard,
          borderWidth: 1,
          borderColor: accentBorder ? t.borderAccent : t.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Rótulo de card (micro, cinza) — o "Total Workouts" da referência. */
export function FitLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<{ color?: string }> }) {
  const t = useTheme();
  return (
    <Txt
      variant="micro"
      upper={false}
      color={t.textSecondary}
      style={[{ fontSize: 10.5, letterSpacing: 0.2 }, style as never]}
    >
      {children}
    </Txt>
  );
}

/** Número grande do card (o "128" de Total Workouts). */
export function FitMetric({
  value,
  unit,
  size = 26,
}: {
  value: string;
  unit?: string;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Txt variant="h1" upper={false} color={t.textPrimary} style={{ fontSize: size, letterSpacing: -1, lineHeight: size * 1.15 }}>
        {value}
      </Txt>
      {unit ? (
        <Txt variant="micro" upper={false} color={t.textSecondary} style={{ fontSize: 10 }}>
          {unit}
        </Txt>
      ) : null}
    </View>
  );
}

/** Selo de variação (+12%, PR +5kg). `null` = sem base de comparação. */
export function FitBadge({
  label,
  tone = 'accent',
  small,
}: {
  label: string;
  tone?: 'accent' | 'muted' | 'down';
  small?: boolean;
}) {
  const t = useTheme();
  const on = t.onNeon ?? t.black;
  const bg = tone === 'accent' ? accentOf() : tone === 'down' ? `${t.red}22` : t.bgSubtle;
  const fg = tone === 'accent' ? on : tone === 'down' ? t.red : t.textMuted;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: small ? 6 : 8,
        paddingVertical: small ? 1 : 2,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      <Txt variant="micro" upper={false} color={fg} style={{ fontSize: small ? 8.5 : 9.5, fontWeight: '700' }}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * Acento do tema (lima no tema fitPulse). Lê o objeto mutável de `theme` no
 * momento do render — por isso é função, e não constante de módulo.
 */
export function accentOf(): string {
  return accent();
}

/* ───────────────────────── barra de progresso ───────────────────────── */

/**
 * Barra fina com preenchimento no acento. `ratio == null` fica oca e escreve
 * "—": barra cheia sem base sugeriria meta batida que não existe.
 */
export function FitBar({
  ratio,
  color,
  height = 6,
  label,
}: {
  ratio: number | null;
  color?: string;
  height?: number;
  label?: string;
}) {
  const t = useTheme();
  const pct = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: ratio == null ? undefined : Math.round(pct * 100) }}
      style={{ height, borderRadius: height, backgroundColor: t.track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color ?? accentOf() }} />
    </View>
  );
}

/* ───────────────────────── gráfico de barras (volume) ───────────────────────── */

export interface VolumeBar {
  label: string;
  /** Volume de força em kg; `null` = dia sem treino de força. */
  strength: number | null;
  /** Minutos de cardio; `null` = dia sem cardio. */
  cardio: number | null;
}

/**
 * Barras verticais "força × cardio" da referência, feitas com Views.
 *
 * Dia sem registro fica com a coluna vazia (não 0): a barra oca é a afirmação
 * "não houve registro", e a legenda diz isso.
 */
export function FitVolumeChart({
  bars,
  highlight,
  height = 108,
}: {
  bars: VolumeBar[];
  highlight?: number | null;
  height?: number;
}) {
  const t = useTheme();
  const maxStrenght = Math.max(1, ...bars.map((b) => b.strength ?? 0));
  const maxCardio = Math.max(1, ...bars.map((b) => b.cardio ?? 0));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height }}>
        {bars.map((b, i) => {
          const isHi = highlight === i;
          const strengthH = b.strength == null ? 0 : Math.max(3, (b.strength / maxStrenght) * (height - 12));
          const cardioH = b.cardio == null ? 0 : Math.max(3, (b.cardio / maxCardio) * (height - 12));
          const empty = b.strength == null && b.cardio == null;
          return (
            <View key={`${b.label}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: height - 12 }}>
                {empty ? (
                  <View
                    style={{
                      width: 9,
                      height: 3,
                      borderRadius: 3,
                      backgroundColor: t.track,
                    }}
                  />
                ) : (
                  <>
                    <View
                      style={{
                        width: 9,
                        height: strengthH,
                        borderRadius: 5,
                        backgroundColor: isHi ? accentOf() : `${accentOf()}99`,
                      }}
                    />
                    <View
                      style={{
                        width: 9,
                        height: cardioH,
                        borderRadius: 5,
                        backgroundColor: t.cyan,
                        opacity: isHi ? 1 : 0.65,
                      }}
                    />
                  </>
                )}
              </View>
              <Txt variant="micro" upper={false} color={isHi ? t.textPrimary : t.textMuted} style={{ fontSize: 8 }}>
                {b.label}
              </Txt>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────────────────────── anel de meta ───────────────────────── */

/** Anel de progresso (o "78% Goal Reached"). `null` desenha só o trilho. */
export function FitRing({
  ratio,
  size = 96,
  label,
  caption,
  strokeWidth,
}: {
  ratio: number | null;
  size?: number;
  label?: string;
  caption?: string;
  strokeWidth?: number;
}) {
  const t = useTheme();
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Circle, G } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const sw = strokeWidth ?? Math.max(5, size / 13);
  const r = size / 2 - sw / 2 - 1;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          <Circle cx={c} cy={c} r={r} stroke={t.track} strokeWidth={sw} fill="transparent" />
          {filled > 0 ? (
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={accentOf()}
              strokeWidth={sw}
              fill="transparent"
              strokeDasharray={`${circ}`}
              strokeDashoffset={circ * (1 - filled)}
              strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`}
            />
          ) : null}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Txt variant="h1" upper={false} color={t.textPrimary} style={{ fontSize: size > 80 ? 21 : 13, fontWeight: '800', letterSpacing: -0.5 }}>
          {ratio == null ? '—' : label}
        </Txt>
        {caption ? (
          <Txt variant="micro" upper={false} color={t.textMuted} style={{ fontSize: 7.5, textAlign: 'center' }}>
            {caption}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

/* ───────────────────── mapa de músculos (silhueta) ───────────────────── */

/**
 * Silhueta simples com os grupos do treino de hoje destacados.
 *
 * Não é ilustração anatômica: são blocos posicionados sobre um corpo. O que
 * importa é responder "quais grupos este treino pega" com o dado real dos
 * exercícios — grupo desconhecido fica apagado, nunca aceso por engano.
 */
const BODY_PARTS: { id: string; top: number; left: number; w: number; h: number; radius?: number }[] = [
  { id: 'Ombros', top: 2, left: 30, w: 14, h: 7, radius: 4 },
  { id: 'Ombros', top: 2, left: 56, w: 14, h: 7, radius: 4 },
  { id: 'Peito', top: 10, left: 33, w: 34, h: 13, radius: 5 },
  { id: 'Costas', top: 10, left: 28, w: 5, h: 20, radius: 3 },
  { id: 'Costas', top: 10, left: 67, w: 5, h: 20, radius: 3 },
  { id: 'Bíceps', top: 25, left: 24, w: 7, h: 16, radius: 4 },
  { id: 'Bíceps', top: 25, left: 69, w: 7, h: 16, radius: 4 },
  { id: 'Tríceps', top: 25, left: 19, w: 5, h: 16, radius: 3 },
  { id: 'Tríceps', top: 25, left: 76, w: 5, h: 16, radius: 3 },
  { id: 'Core', top: 24, left: 37, w: 26, h: 16, radius: 4 },
  { id: 'Glúteos', top: 41, left: 35, w: 30, h: 9, radius: 4 },
  { id: 'Quads', top: 51, left: 35, w: 13, h: 22, radius: 5 },
  { id: 'Quads', top: 51, left: 52, w: 13, h: 22, radius: 5 },
  { id: 'Posterior', top: 51, left: 31, w: 4, h: 22, radius: 3 },
  { id: 'Posterior', top: 51, left: 65, w: 4, h: 22, radius: 3 },
  { id: 'Panturrilha', top: 74, left: 36, w: 11, h: 12, radius: 4 },
  { id: 'Panturrilha', top: 74, left: 53, w: 11, h: 12, radius: 4 },
];

export function MuscleMap({ groups, width = 100 }: { groups: string[]; width?: number }) {
  const t = useTheme();
  const active = new Set(groups.map((g) => g.trim().toLowerCase()));
  const scale = width / 100;
  const height = 88 * scale;
  return (
    <View style={{ width, height }} accessibilityLabel={groups.length ? `Grupos do treino: ${groups.join(', ')}` : 'Sem grupo identificado'}>
      {BODY_PARTS.map((p, i) => {
        const on = active.has(p.id.toLowerCase());
        return (
          <View
            key={`${p.id}-${i}`}
            style={{
              position: 'absolute',
              top: p.top * scale,
              left: p.left * scale,
              width: p.w * scale,
              height: p.h * scale,
              borderRadius: (p.radius ?? 3) * scale,
              backgroundColor: on ? accentOf() : t.bgSubtle,
              opacity: on ? 0.92 : 0.9,
            }}
          />
        );
      })}
    </View>
  );
}

/* ───────────────────────── capa de treino (sem foto) ───────────────────────── */

/**
 * "Capa" do card de treino recente, desenhada com formas.
 *
 * A referência usa foto de banco de imagens; aqui isso seria mentira (aquela
 * pessoa não é o usuário, aquela academia não é a dele). No lugar, um gradiente
 * de blocos na cor da área — o card continua legível e honesto.
 */
export function WorkoutCover({ area = 'Treino', height = 84 }: { area?: string; height?: number }) {
  const t = useTheme();
  const c = areaColor(area);
  return (
    <View
      style={{
        height,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: t.bgInput,
        justifyContent: 'flex-end',
        padding: 8,
      }}
    >
      {[
        { l: -10, tp: 8, w: 46, h: 46, o: 0.5 },
        { l: 34, tp: -6, w: 40, h: 40, o: 0.32 },
        { l: 66, tp: 24, w: 54, h: 54, o: 0.22 },
        { l: 6, tp: 46, w: 70, h: 30, o: 0.16 },
      ].map((b, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: b.l,
            top: b.tp,
            width: b.w,
            height: b.h,
            borderRadius: 12,
            backgroundColor: c,
            opacity: b.o,
          }}
        />
      ))}
      <View style={{ position: 'absolute', left: 8, top: 8, width: 18, height: 18, borderRadius: 6, backgroundColor: accentOf() }} />
      <Txt variant="micro" upper={false} color={t.textPrimary} style={{ fontSize: 8.5, letterSpacing: 1.2, fontWeight: '700' }}>
        {area.toUpperCase()}
      </Txt>
    </View>
  );
}

/* ───────────────────────── checkbox de série ───────────────────────── */

/** Checkbox quadrado do exercício (o "☑ Barbell Back Squat"). */
export function FitCheck({
  checked,
  onToggle,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      onStartShouldSetResponder={disabled ? undefined : () => true}
      onResponderRelease={disabled ? undefined : onToggle}
      style={{
        width: 17,
        height: 17,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: checked ? accentOf() : `${t.textMuted}88`,
        backgroundColor: checked ? accentOf() : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {checked ? (
        <Txt variant="micro" upper={false} color={t.onNeon ?? t.black} style={{ fontSize: 9, fontWeight: '900' }}>
          ✓
        </Txt>
      ) : null}
    </View>
  );
}
