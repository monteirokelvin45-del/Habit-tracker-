import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Txt } from './ui';

export interface SwipeAction {
  label: string;
  color: string;
  onPress: () => void;
}

/**
 * Swipe-left com ações (Editar | Arquivar | Excluir).
 * Implementado com PanResponder + Animated do RN — sem dependências extras.
 */
export function SwipeableRow({
  children,
  actions,
  actionWidth = 78,
}: {
  children: React.ReactNode;
  actions: SwipeAction[];
  actionWidth?: number;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const totalWidth = actions.length * actionWidth;

  const snap = (to: number) => {
    Animated.spring(translateX, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start();
    setOpen(to !== 0);
  };

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const base = open ? -totalWidth : 0;
        const next = Math.max(-totalWidth, Math.min(0, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const dragged = (open ? -totalWidth : 0) + g.dx;
        snap(dragged < -totalWidth / 2.5 ? -totalWidth : 0);
      },
      onPanResponderTerminate: () => snap(open ? -totalWidth : 0),
    }),
  ).current;

  return (
    <View style={{ borderRadius: 12, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => {
              snap(0);
              a.onPress();
            }}
            style={{
              width: actionWidth,
              backgroundColor: a.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Txt variant="micro" color={colors.black} style={{ fontWeight: '800' }}>
              {a.label}
            </Txt>
          </Pressable>
        ))}
      </View>
      <Animated.View style={{ transform: [{ translateX }], backgroundColor: colors.bgPrimary }} {...responder.panHandlers}>
        {children}
        {/* Fechar ao toque quando aberto */}
        {open ? (
          <Pressable
            onPress={() => snap(0)}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            accessibilityLabel="Fechar ações"
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

export const SWIPE_HINT = spacing.sm;
