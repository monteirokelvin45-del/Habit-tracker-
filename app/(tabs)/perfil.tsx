import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { areaColor, colors, spacing } from '../../src/theme';
import {
  Accordion,
  Badge,
  Card,
  Chip,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  SecondaryButton,
  SectionTitle,
  Sheet,
  ToggleRow,
  Txt,
  TimeField,
} from '../../src/components/ui';
import { useStore } from '../../src/lib/store';
import { BADGES } from '../../src/lib/badges';
import { exportJson, exportPdf } from '../../src/lib/export';
import { generalStreak } from '../../src/lib/score';
import { closedDays } from '../../src/lib/insights';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { LIFE_AREAS } from '../../src/lib/types';

export default function ProfileScreen() {
  const router = useRouter();
  const store = useStore();
  const [identitySheet, setIdentitySheet] = useState(false);
  const [name, setName] = useState(store.user.name);
  const [identity, setIdentity] = useState(store.user.identity);
  const [noMore, setNoMore] = useState(store.user.noMore);


  const [resetStep, setResetStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const closed = closedDays(store.days);
  const streak = generalStreak(store.days);
  const areas = Array.from(new Set([...store.user.areas, ...store.goals.map((g) => g.area)]));


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        {/* HEADER */}
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="h1">{store.user.name || 'Seu perfil'}</Txt>
            <Muted style={{ marginTop: 2 }}>
              Desde {store.user.createdAt ? new Date(store.user.createdAt).toLocaleDateString('pt-BR') : '—'} · {closed.length} dias registrados
            </Muted>
          </View>
          <Badge label={`🔥 ${streak}`} color={colors.orange} />
        </Row>

        {/* IDENTIDADE */}
        <SectionTitle right={<Txt variant="micro" color={colors.green} onPress={() => setIdentitySheet(true)}>editar</Txt>}>
          Identidade
        </SectionTitle>
        <Card style={{ gap: 8 }}>
          <Txt variant="micro" color={colors.textSecondary}>QUEM SOU</Txt>
          <Txt variant="caption" color={colors.textPrimary} style={{ lineHeight: 20 }}>
            {store.user.identity || 'Sem dado'}
          </Txt>
          <Txt variant="micro" color={colors.textSecondary} style={{ marginTop: 6 }}>NÃO ACEITO MAIS</Txt>
          <Txt variant="caption" color={colors.red} style={{ lineHeight: 20 }}>
            {store.user.noMore || 'Sem dado'}
          </Txt>
          <Txt variant="micro" color={colors.textSecondary} style={{ marginTop: 6 }}>ÁREAS DA VIDA</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {areas.length ? areas.map((a) => <Badge key={a} label={a} color={areaColor(a)} />) : <NoData />}
          </View>
        </Card>

        {/* CONFIGURAÇÕES */}
        <SectionTitle>Configurações</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <TimeField label="Lembrete matinal" value={store.settings.morningReminder} onChange={(v) => store.updateSettings({ morningReminder: v })} />
          <TimeField label="Lembrete noturno" value={store.settings.nightReminder} onChange={(v) => store.updateSettings({ nightReminder: v })} />
          <ToggleRow
            label="Check-in de meio do dia"
            sub={`Notificação às ${store.settings.middayTime}`}
            value={store.settings.middayCheckin}
            onChange={(v) => store.updateSettings({ middayCheckin: v })}
          />
          {store.settings.middayCheckin ? (
            <TimeField label="Horário do meio do dia" value={store.settings.middayTime} onChange={(v) => store.updateSettings({ middayTime: v })} />
          ) : null}
          <ToggleRow
            label="Notificação de streak"
            value={store.settings.streakNotification}
            onChange={(v) => store.updateSettings({ streakNotification: v })}
          />
          <ToggleRow label="Vibração / haptic" value={store.settings.haptics} onChange={(v) => store.updateSettings({ haptics: v })} />
          <Field
            label="Meta de sono (horas)"
            value={String(store.settings.sleepGoalHours)}
            onChangeText={(t) => store.updateSettings({ sleepGoalHours: Number(t.replace(',', '.')) || 7.5 })}
            keyboardType="decimal-pad"
          />
        </Card>

        {/* DADOS */}
        <SectionTitle>Dados</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <SecondaryButton
            label={busy === 'json' ? 'Exportando...' : 'Exportar dados (JSON)'}
            onPress={async () => {
              setBusy('json');
              await exportJson(store);
              setBusy(null);
              haptic('success');
            }}
          />
          <SecondaryButton
            color={colors.cyan}
            label={busy === 'pdf' ? 'Gerando PDF...' : 'Exportar relatório (PDF)'}
            onPress={async () => {
              setBusy('pdf');
              await exportPdf(store);
              setBusy(null);
              haptic('success');
            }}
          />
          <SecondaryButton color={colors.purple} label="Enviar meus planos e dados" onPress={() => router.push('/importar')} />
          <Muted>
            Organiza metas, regras SE-ENTÃO, recompensas, leitura, finanças e identidade — e lista o que ainda
            falta você escrever. Também restaura backup do app (.json).
          </Muted>
          <SecondaryButton
            color={colors.textSecondary}
            label={busy === 'template' ? 'Preparando...' : 'Baixar modelo de arquivo'}
            onPress={async () => {
              setBusy('template');
              const { sharePlanTemplate } = await import('../../src/lib/export');
              await sharePlanTemplate();
              setBusy(null);
              haptic('success');
            }}
          />
          <SecondaryButton
            color={colors.red}
            label="Resetar tudo"
            onPress={() => {
              haptic('warning');
              setResetStep(1);
            }}
          />
        </Card>

        {/* RECOMPENSAS / CONQUISTAS */}
        <SectionTitle>Gamificação</SectionTitle>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          <Pressable style={{ flex: 1, minWidth: '45%' }} onPress={() => router.push('/modulo/widget')}>
            <Card style={{ gap: 2 }}>
              <Txt variant="h3">📱 Widget</Txt>
              <Muted>Tela inicial do Android</Muted>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1, minWidth: '45%' }} onPress={() => router.push('/modulo/recompensas')}>
            <Card style={{ gap: 2 }}>
              <Txt variant="h3">🎁 Recompensas</Txt>
              <Muted>{store.rewards.filter((r) => !r.unlocked).length} pendente(s)</Muted>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1, minWidth: '45%' }} onPress={() => router.push('/modulo/conquistas')}>
            <Card style={{ gap: 2 }}>
              <Txt variant="h3">🏅 Conquistas</Txt>
              <Muted>{store.badges.filter((b) => b.unlockedAt).length}/{BADGES.length}</Muted>
            </Card>
          </Pressable>
        </Row>

        <Accordion title="Streaks por área" subtitle="Dias consecutivos de execução">
          {store.goals.filter((g) => g.active).length === 0 ? (
            <NoData />
          ) : (
            store.goals
              .filter((g) => g.active)
              .map((g) => (
                <Row key={g.id} style={{ justifyContent: 'space-between' }}>
                  <Txt variant="caption" color={colors.textSecondary}>{g.name}</Txt>
                  <Badge label={`🔥 ${store.days.length ? goalStreakLabel(store.days, g.id) : 0}d`} color={colors.orange} />
                </Row>
              ))
          )}
        </Accordion>

        {/* SOBRE */}
        <SectionTitle>Sobre</SectionTitle>
        <Card style={{ gap: 4 }}>
          <Txt variant="h3" color={colors.green}>MY PRIME v1.0</Txt>
          <Muted>Sistema de Autorregulação Comportamental</Muted>
          <Muted>Loop: intenção → execução → registro → análise → correção → recompensa</Muted>
          <Muted style={{ marginTop: 6 }}>Dados 100% locais no dispositivo (AsyncStorage). Nada é enviado para servidores.</Muted>
        </Card>
      </ScrollView>

      {/* EDITAR IDENTIDADE */}
      <Sheet
        visible={identitySheet}
        onClose={() => setIdentitySheet(false)}
        title="Identidade"
        footer={
          <PrimaryButton
            label="Salvar identidade"
            onPress={() => {
              store.updateUser({ name: name.trim(), identity: identity.trim(), noMore: noMore.trim() });
              setIdentitySheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Field label="Nome" value={name} onChangeText={setName} />
        <Field label="Quem sou" value={identity} onChangeText={setIdentity} multiline />
        <Field label="Não aceito mais" value={noMore} onChangeText={setNoMore} multiline />
        <Txt variant="caption" color={colors.textSecondary}>Áreas da vida</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Array.from(new Set([...LIFE_AREAS, ...areas])).map((a) => (
            <Chip
              key={a}
              label={a}
              color={areaColor(a)}
              selected={store.user.areas.includes(a)}
              onPress={() =>
                store.updateUser({
                  areas: store.user.areas.includes(a)
                    ? store.user.areas.filter((x) => x !== a)
                    : [...store.user.areas, a],
                })
              }
            />
          ))}
        </View>
      </Sheet>

      {/* RESET COM DUPLA CONFIRMAÇÃO */}
      <Sheet
        visible={resetStep > 0}
        onClose={() => setResetStep(0)}
        title={resetStep === 1 ? 'Tem certeza?' : 'ISSO É IRREVERSÍVEL'}
        footer={
          resetStep === 1 ? (
            <PrimaryButton label="Continuar" color={colors.yellow} onPress={() => setResetStep(2)} />
          ) : (
            <PrimaryButton
              label="Apagar tudo definitivamente"
              color={colors.red}
              onPress={async () => {
                await store.hardReset();
                setResetStep(0);
                router.replace('/onboarding');
              }}
            />
          )
        }
      >
        {resetStep === 1 ? (
          <Muted>Todos os registros, metas, diários e conquistas serão apagados deste dispositivo.</Muted>
        ) : (
          <Txt variant="caption" color={colors.red}>
            Sem backup não há volta. Se quiser guardar, exporte o JSON antes.
          </Txt>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

function goalStreakLabel(days: ReturnType<typeof closedDays>, goalId: string): number {
  let streak = 0;
  const map = new Map(days.map((d) => [d.date, d]));
  let cursor: string | null = todayKey();
  for (let i = 0; i < 400 && cursor; i++) {
    const day = map.get(cursor);
    const task = day?.tasks.find((t) => t.goalId === goalId);
    if (!day || !task) break;
    if (!task.done) break;
    streak += 1;
    const d: Date = new Date(cursor);
    d.setDate(d.getDate() - 1);
    cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return streak;
}
