import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from './Icon';
import { useTheme } from '../theme';

/**
 * Alça de arrastar para reordenar itens.
 *
 * Reanimated 4 + Gesture Handler (stack obrigatória do briefing). O arrasto só
 * decide "para cima" ou "para baixo": quem reordena é a lista, porque o índice
 * final precisa sobreviver ao re-render. Nada de mover itens por milímetros —
 * a lista é vertical e o item anda de um em um.
 *
 * Acessibilidade: o gesto não é o único caminho. A alça é um botão com rótulo
 * ("Mover para cima"), então teclado e leitor de tela reordenam também.
 */

export function DragHandle({
  label,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}: {
  /** Nome do item — entra no rótulo de acessibilidade. */
  label: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const t = useTheme();
  const offset = useSharedValue(0);
  const lift = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }, { scale: lift.value }],
  }));

  useEffect(() => () => {
    offset.value = 0;
    lift.value = 0;
  }, [offset, lift]);

  const STEP = 26;

  const gesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      lift.value = withSpring(1.08);
    })
    .onUpdate((e) => {
      // Resistência nas pontas: não dá a impressão de que vai mover quando não vai.
      const raw = e.translationY;
      if ((raw < 0 && !canMoveUp) || (raw > 0 && !canMoveDown)) offset.value = raw / 4;
      else offset.value = raw;
    })
    .onEnd((e) => {
      const moved = e.translationY;
      offset.value = withTiming(0, { duration: 120 });
      lift.value = withSpring(1);
      if (moved <= -STEP && canMoveUp) runOnJS(onMoveUp)();
      else if (moved >= STEP && canMoveDown) runOnJS(onMoveDown)();
    })
    .onFinalize(() => {
      lift.value = withSpring(1);
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style} accessibilityRole="adjustable" accessibilityLabel={`Reordenar ${label}`}>
        <Pressable
          onPress={canMoveDown ? onMoveDown : onMoveUp}
          accessibilityRole="button"
          accessibilityLabel={`Mover ${label} ${canMoveDown ? 'para baixo' : 'para cima'}`}
          hitSlop={10}
          style={{ padding: 6 }}
        >
          <Icon name="fila" size={16} color={t.textMuted} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
