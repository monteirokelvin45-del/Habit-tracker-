/**
 * AI Copilot / LIX AI — peças visuais.
 *
 * Identidade própria, como Estudos (iDraft) e Finanças (Bento): esta tela NÃO
 * segue a paleta do tema ativo. O briefing pede "dark futurista, minimalista,
 * premium, com luz azul-turquesa embaixo" — isso é um desenho, não uma paleta
 * de tema. O tema `copilot` (Perfil → Aparência) existe para quem quiser o resto
 * do app nessa mesma atmosfera.
 *
 * Regras que valem aqui:
 *  - nada de imagem de banco de imagens: o orbe é desenhado (formas + brilho);
 *  - `null` escreve "Sem dado";
 *  - texto secundário é medido para passar AA sobre o fundo (#0A0E16), não
 *    escolhido no olho.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Txt } from './ui';

/** Paleta do módulo — fixa, monocromática escura com acento turquesa. */
export const LIX = {
  bg: '#070A10',
  /**
   * Fundo do card de vidro. NÃO é `rgba`: no React Native uma cor com alfa
   * compõe com o que está atrás (a luz ambiente do rodapé pode passar por baixo
   * e derrubar o contraste). Cor sólida aqui + brilho por cima dão a mesma
   * leitura de vidro com contraste previsível — e o teste de contraste consegue
   * medir o par de verdade.
   */
  glass: '#111926',
  glassSolid: '#111722',
  glassStrong: '#161F2E',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(120,190,255,0.34)',
  ink: '#FFFFFF',
  /** 8.9:1 sobre o card. */
  body: '#C2CBD8',
  /** 6.1:1 sobre o card — acima do mínimo AA para texto pequeno. */
  muted: '#93A0B2',
  /** Só para texto NÃO essencial (rodapé legal, placeholder). 3.5:1 no card. */
  faint: '#6F7C8E',
  accent: '#38BDF8',
  accentDeep: '#0EA5E9',
  teal: '#2DD4BF',
  violet: '#8B5CF6',
  gold: '#FBBF24',
  danger: '#F87171',
  ok: '#34D399',
} as const;

/* ───────────────────────────── orbe ───────────────────────────── */

/**
 * Orbe 3D fluido: camadas translúcidas em degradê azul → violeta → dourado com
 * brilho turquesa por trás. Feito com Views (sem PNG, sem blur nativo, que não
 * existe no RN puro): a "fluidez" vem das camadas sobrepostas em opacidade
 * decrescente, e o `pulse` é controlado pela tela (Animated), então o orbe em si
 * fica sem estado e renderiza igual em qualquer cenário de teste.
 */
export function LixOrb({
  size = 136,
  glow = true,
  pulse,
}: {
  size?: number;
  glow?: boolean;
  /** 0..1 — intensidade do brilho (a tela anima de 0.6 a 1). */
  pulse?: number;
}) {
  const k = size / 136;
  const ring = Math.round(3 * k);
  const intensity = pulse == null ? 1 : Math.max(0.35, Math.min(1, pulse));
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Orbe do assistente LIX AI"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {glow ? (
        <View
          style={{
            position: 'absolute',
            width: size * 1.22,
            height: size * 1.22,
            borderRadius: (size * 1.22) / 2,
            backgroundColor: LIX.teal,
            opacity: 0.1 * intensity,
          }}
        />
      ) : null}
      {/* corpo do orbe */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: '#0B1220',
          borderWidth: ring,
          borderColor: 'rgba(120,190,255,0.22)',
        }}
      >
        {/* azul (base) */}
        <View style={{ position: 'absolute', left: -size * 0.1, top: -size * 0.05, width: size * 0.9, height: size * 0.9, borderRadius: size * 0.45, backgroundColor: '#1D4ED8', opacity: 0.62 }} />
        {/* violeta (meio) */}
        <View style={{ position: 'absolute', left: size * 0.22, top: size * 0.02, width: size * 0.72, height: size * 0.72, borderRadius: size * 0.36, backgroundColor: LIX.violet, opacity: 0.5 }} />
        {/* dourado (luz quente) */}
        <View style={{ position: 'absolute', left: size * 0.3, top: size * 0.42, width: size * 0.52, height: size * 0.52, borderRadius: size * 0.26, backgroundColor: LIX.gold, opacity: 0.44 }} />
        {/* turquesa (reflexo) */}
        <View style={{ position: 'absolute', left: size * 0.06, top: size * 0.5, width: size * 0.5, height: size * 0.45, borderRadius: size * 0.25, backgroundColor: LIX.teal, opacity: 0.36 }} />
        {/* vinco escuro: dá a leitura de esfera, não de bolha chapada */}
        <View style={{ position: 'absolute', left: size * 0.16, top: size * 0.2, width: size * 0.3, height: size * 0.62, borderRadius: size * 0.2, backgroundColor: '#050914', opacity: 0.34, transform: [{ rotate: '24deg' }] }} />
        {/* brilho especular */}
        <View style={{ position: 'absolute', left: size * 0.22, top: size * 0.12, width: size * 0.26, height: size * 0.18, borderRadius: size * 0.13, backgroundColor: '#FFFFFF', opacity: 0.28 }} />
      </View>
    </View>
  );
}

/* ───────────────────────────── card vidro ───────────────────────────── */

/** Card translúcido escuro com borda fina (o "vidro" da referência). */
export function LixCard({
  children,
  style,
  strong,
  accentBorder,
  padding = 16,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  accentBorder?: boolean;
  padding?: number;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 22,
          padding,
          backgroundColor: strong ? LIX.glassStrong : LIX.glass,
          borderWidth: 1,
          borderColor: accentBorder ? LIX.borderStrong : LIX.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Rótulo micro de seção. */
export function LixLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <Txt variant="micro" upper={false} color={color ?? LIX.muted} style={{ fontSize: 10, letterSpacing: 1.1, fontWeight: '700' }}>
      {children}
    </Txt>
  );
}

/** Pílula de status/atalho. */
export function LixChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'warn';
}) {
  const bg = tone === 'accent' ? 'rgba(56,189,248,0.16)' : tone === 'warn' ? 'rgba(251,191,36,0.16)' : 'rgba(255,255,255,0.07)';
  const fg = tone === 'accent' ? '#7DD3FC' : tone === 'warn' ? '#FCD34D' : LIX.body;
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: bg }}>
      <Txt variant="micro" upper={false} color={fg} style={{ fontSize: 9.5, fontWeight: '700' }}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * Bolha de mensagem do chat.
 * `role: 'user'` fica alinhada à direita com fundo no acento; o assistente fica
 * à esquerda com o vidro. Papel visível também para leitor de tela.
 */
export function LixBubble({
  role,
  children,
}: {
  role: 'user' | 'assistant';
  children: React.ReactNode;
}) {
  const mine = role === 'user';
  return (
    <View
      accessibilityLabel={mine ? 'Você' : 'LIX AI'}
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '92%',
        borderRadius: 18,
        borderTopRightRadius: mine ? 6 : 18,
        borderTopLeftRadius: mine ? 18 : 6,
        paddingHorizontal: 14,
        paddingVertical: 11,
        gap: 5,
        backgroundColor: mine ? 'rgba(56,189,248,0.20)' : LIX.glass,
        borderWidth: 1,
        borderColor: mine ? 'rgba(56,189,248,0.42)' : LIX.border,
      }}
    >
      <Txt variant="micro" upper={false} color={mine ? '#7DD3FC' : LIX.muted} style={{ fontSize: 8.5, letterSpacing: 1, fontWeight: '800' }}>
        {mine ? 'VOCÊ' : 'LIX AI'}
      </Txt>
      {children}
    </View>
  );
}

/** Linha de dado (rótulo à esquerda, valor à direita). */
export function LixRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <Txt variant="caption" upper={false} color={LIX.muted} style={{ fontSize: 11.5 }}>
        {label}
      </Txt>
      <Txt variant="caption" upper={false} color={LIX.ink} style={{ fontSize: 11.5, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}

/**
 * Barra de progresso fina. `ratio == null` = trilho vazio + "Sem dado"
 * (nunca uma barra cheia sem base).
 */
export function LixBar({ ratio, color = LIX.accent }: { ratio: number | null; color?: string }) {
  const pct = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ height: 5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: 5, borderRadius: 5, backgroundColor: color }} />
    </View>
  );
}
