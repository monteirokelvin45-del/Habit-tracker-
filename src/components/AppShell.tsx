import React, { useEffect } from 'react';
import { View } from 'react-native';
import { colors } from '../theme';
import { Txt } from './ui';
import { useStore } from '../lib/store';

/**
 * Enquanto o AsyncStorage não terminou de carregar, nada de tela vazia:
 * mostramos a marca. Evita flash de "sem dado" antes dos dados existirem.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const status = useStore((s) => s.status);
  const booted = useStore((s) => s.booted);
  const setBooted = useStore((s) => s.setBooted);

  useEffect(() => {
    if (status === 'ready') setBooted();
  }, [status, setBooted]);

  if (status !== 'ready' || !booted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Txt style={{ fontSize: 28, fontWeight: '900', letterSpacing: 3, color: colors.green }}>MY PRIME</Txt>
        <Txt variant="micro" color={colors.textMuted}>carregando seus registros</Txt>
      </View>
    );
  }
  return <>{children}</>;
}
