import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { Muted, Row, Txt } from './ui';

/** Header padrão de telas de módulo (push stack, sem tab bar). */
export function ModalHeader({
  title,
  subtitle,
  onAdd,
  addLabel = '+ Novo',
}: {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bgPrimary }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
            <Txt variant="h3" color={colors.textSecondary}>←</Txt>
          </Pressable>
          {onAdd ? (
            <Pressable onPress={onAdd} accessibilityRole="button">
              <Txt variant="caption" color={colors.green} style={{ fontWeight: '700' }}>{addLabel}</Txt>
            </Pressable>
          ) : null}
        </Row>
        <View>
          <Txt variant="h2">{title}</Txt>
          {subtitle ? <Muted style={{ marginTop: 2 }}>{subtitle}</Muted> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
