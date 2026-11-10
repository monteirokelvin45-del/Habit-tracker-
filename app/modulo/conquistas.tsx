import React from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import { Card, Muted, Row, Txt } from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { BADGES } from '../../src/lib/badges';
import { useStore } from '../../src/lib/store';

export default function AchievementsScreen() {
  const badges = useStore((s) => s.badges);
  const unlockedCount = badges.filter((b) => b.unlockedAt).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="Conquistas" subtitle={`${unlockedCount} de ${BADGES.length} desbloqueadas`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.sm }}>
        {BADGES.map((badge) => {
          const state = badges.find((b) => b.id === badge.id);
          const unlocked = !!state?.unlockedAt;
          return (
            <Card
              key={badge.id}
              accent={unlocked ? colors.green + '55' : undefined}
              style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', opacity: unlocked ? 1 : 0.75 }}
            >
              <Txt style={{ fontSize: 30 }}>{unlocked ? badge.emoji : '🔒'}</Txt>
              <View style={{ flex: 1 }}>
                <Txt variant="h3" color={unlocked ? colors.green : colors.textSecondary}>
                  {badge.name}
                </Txt>
                <Muted>{badge.criteria}</Muted>
                {unlocked && state?.unlockedAt ? (
                  <Muted style={{ color: colors.textMuted }}>
                    Em {new Date(state.unlockedAt).toLocaleDateString('pt-BR')}
                  </Muted>
                ) : (
                  <Muted style={{ color: colors.textMuted }}>Critério para desbloquear acima</Muted>
                )}
              </View>
            </Card>
          );
        })}
        <Card>
          <Row gap={spacing.sm}>
            <Txt variant="caption" color={colors.textSecondary}>
              Conquistas são calculadas a partir dos seus registros reais — não existe botão para desbloquear.
            </Txt>
          </Row>
        </Card>
      </ScrollView>
    </View>
  );
}
