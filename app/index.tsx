import React, { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { colors as themeColors, spacing } from '../src/theme';
import { colors } from '../src/theme';
import { useStore } from '../src/lib/store';
import { Txt } from '../src/components/ui';

/** Splash: 2s de marca, depois Onboarding (1º acesso) ou Dashboard. */
export default function Splash() {
  const router = useRouter();
  const status = useStore((s) => s.status);
  const onboarded = useStore((s) => s.onboarded);
  const fade = React.useRef(new Animated.Value(0)).current;
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const t = setTimeout(() => setMinTimePassed(true), 2000);
    return () => clearTimeout(t);
  }, [fade]);

  useEffect(() => {
    if (!minTimePassed || status !== 'ready') return;
    router.replace(onboarded ? '/(tabs)' : '/onboarding');
  }, [minTimePassed, status, onboarded, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Animated.View style={{ opacity: fade, alignItems: 'center', gap: 12 }}>
        <Txt style={{ fontSize: 40, fontWeight: '900', letterSpacing: 2, color: colors.green }}>MY PRIME</Txt>
        <Txt variant="caption" color={colors.textSecondary} style={{ letterSpacing: 1 }}>
          Disciplina é sistema, não humor
        </Txt>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 48, alignItems: 'center', gap: spacing.md }}>
        <Txt variant="micro" color={colors.textMuted}>
          intenção → execução → registro → análise → correção → recompensa
        </Txt>
        {status === 'ready' && !onboarded ? (
          <Pressable
            onPress={() => router.push('/importar')}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
            accessibilityRole="button"
          >
            <Txt variant="caption" color={themeColors.green}>Já tenho um plano — importar</Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
