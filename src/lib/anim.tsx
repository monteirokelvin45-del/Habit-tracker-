import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import * as SvgModule from 'react-native-svg';

const LottieView = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('lottie-react-native').default as React.ComponentType<any>;
  } catch {
    return null;
  }
})();

/** Confetti local (Lottie). Não repete, 2s. No web vira fallback estático. */
export function Confetti({ visible, onDone }: { visible: boolean; onDone?: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }
    opacity.setValue(1);
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDone?.());
    }, 2000);
    return () => clearTimeout(t);
  }, [visible, opacity, onDone]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity, zIndex: 999 }]}>
      {LottieView && Platform.OS !== 'web' ? (
        <LottieView
          source={require('../../assets/lottie/confetti.json')}
          autoPlay
          loop={false}
          speed={1}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: 'rgba(0,255,136,0.05)' }} />
      )}
    </Animated.View>
  );
}

/** Anel de progresso animado (0–10) para o score do dia. */
export function ScoreRing({
  score,
  size = 180,
  color,
  animated = true,
}: {
  score: number;
  size?: number;
  color: string;
  animated?: boolean;
}) {
  const [progress, setProgress] = React.useState(0);
  const anim = useRef(new Animated.Value(animated ? 0 : score / 10)).current;
  const [label, setLabel] = React.useState(animated ? 0 : score);

  useEffect(() => {
    if (!animated) return;
    anim.setValue(0);
    const sub = anim.addListener(({ value }) => setProgress(value));
    const id = anim.addListener(() => {});
    Animated.timing(anim, {
      toValue: score / 10,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setLabel(score);
    });
    // contador sincronizado
    const count = setInterval(() => {
      setProgress((p) => {
        const next = p + 0.02;
        return next >= score / 10 ? score / 10 : next;
      });
    }, 16);
    const clear = setTimeout(() => clearInterval(count), 820);
    return () => {
      anim.removeListener(sub);
      anim.removeListener(id);
      clearInterval(count);
      clearTimeout(clear);
    };
  }, [score, animated, anim]);

  useEffect(() => {
    setLabel(Math.round(progress * 100) / 10);
  }, [progress]);

  const pct = animated ? progress : score / 10;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const Svg = SvgModule.default as React.ComponentType<any>;
  const Circle = SvgModule.Circle as React.ComponentType<any>;
  const G = SvgModule.G as React.ComponentType<any>;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#2A2A2A" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, pct)))}
            fill="none"
          />
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.Text
          style={{
            color,
            fontSize: size / 4,
            fontWeight: '800',
          }}
        >
          {animated ? label.toFixed(1) : score.toFixed(1)}
        </Animated.Text>
        <Animated.Text style={{ color: '#888888', fontSize: 11, letterSpacing: 1 }}>SCORE</Animated.Text>
      </View>
    </View>
  );
}
