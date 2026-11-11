import React from 'react';
import Animated, { FadeIn as RFadeIn, FadeInDown as RFadeInDown, SlideInRight } from 'react-native-reanimated';

/**
 * Entradas animadas usando react-native-reanimated (requisito de stack).
 * Reanimated 4 roda no Reanimated 4/New Architecture — aqui só usamos layout
 * animations declarativas, sem worklets manuais.
 */
export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View entering={RFadeIn.duration(220).delay(delay)}>
      {children}
    </Animated.View>
  );
}

export function FadeInDown({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return <Animated.View entering={RFadeInDown.duration(260).delay(delay).springify().damping(18)}>{children}</Animated.View>;
}

export function SlideIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return <Animated.View entering={SlideInRight.duration(250).delay(delay)}>{children}</Animated.View>;
}
