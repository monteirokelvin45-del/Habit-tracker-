import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEMES, areaColor, colors, spacing, useTheme, type ThemeId } from '../../src/theme';
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
import { generalStreak, goalStreak } from '../../src/lib/score';
import { closedDays } from '../../src/lib/insights';
import { todayKey } from '../../src/lib/date';
import { storageHealth } from '../../src/lib/storage';
import { openAppLimits } from '../../src/lib/native';
import { haptic } from '../../src/lib/haptics';
import { LIFE_AREAS } from '../../src/lib/types';

export default function ProfileScreen() {
  useTheme();
  const router = useRouter();
  const store = useStore();
  const [identitySheet, setIdentitySheet] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState(store.user.name);
  const [identity, setIdentity] = useState(store.user.identity);
  const [noMore, setNoMore] = useState(store.user.noMore);


  const [resetStep, setResetStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportInfo, setExportInfo] = useState<string | null>(null);

  const closed = closedDays(store.days);
  const streak = generalStreak(store.days);
  const areas = Array.from(new Set([...store.user.areas, ...store.goals.map((g) => g.area)]));


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        {store.recovery ? (
          <Card accent={colors.yellow + '55'}>
            <Txt variant="h3" color={colors.yellow}>
              Histórico encontrado
            </Txt>
            <Muted style={{ marginTop: 4 }}>
              O app abriu sem dias registrados, mas existe uma cópia automática de{' '}
              {new Date(store.recovery.at).toLocaleDateString('pt-BR')} com {store.recovery.days} dias. Nada foi
              perdido até agora — restaure antes de continuar.
            </Muted>
            <Row gap={spacing.sm} style={{ marginTop: spacing.sm }}>
              <PrimaryButton
                label="Restaurar histórico"
                onPress={async () => {
                  const ok = await store.restoreFromSnapshot();
                  haptic(ok ? 'success' : 'error');
                }}
              />
              <SecondaryButton label="Ignorar" onPress={store.dismissRecovery} />
            </Row>
          </Card>
        ) : null}

        {storageHealth.failedWrites > 0 ? (
          <Card accent={colors.red + '55'}>
            <Txt variant="caption" color={colors.red}>
              ⚠️ A última gravação falhou ({storageHealth.failedWrites}x). Parte dos dados pode não ter sido
              salva no dispositivo — exporte o JSON antes de fechar o app.
            </Txt>
            <Muted style={{ marginTop: 4 }}>Chave com problema: {storageHealth.lastFailedKey ?? 'desconhecida'}</Muted>
          </Card>
        ) : null}
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

        {/* APARÊNCIA */}
        <SectionTitle>Aparência</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Muted>Tema do aplicativo. A troca vale na hora, sem reiniciar.</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 }}>
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const active = (store.settings.theme ?? 'emerald') === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    haptic('light');
                    store.updateSettings({ theme: id });
                  }}
                  style={{
                    flexBasis: '47%',
                    flexGrow: 1,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? colors.green : colors.border,
                    backgroundColor: colors.bgElevated,
                    padding: spacing.md,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[THEMES[id].palette.bgPrimary, THEMES[id].palette.bgElevated, THEMES[id].swatch].map((c) => (
                      <View key={c} style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: c }} />
                    ))}
                  </View>
                  <Txt variant="caption" color={active ? colors.green : colors.textPrimary}>
                    {THEMES[id].label}
                  </Txt>
                  {active ? (
                    <Txt variant="micro" color={colors.green}>
                      em uso
                    </Txt>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* CONFIGURAÇÕES */}
        <SectionTitle>Sistema &amp; dispositivo</SectionTitle>
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
          <ToggleRow
            label="Sincronizar com agenda"
            sub="Cria a agenda MY PRIME e os blocos do dia"
            value={!!store.settings.syncCalendar}
            onChange={(v) => store.updateSettings({ syncCalendar: v })}
          />
          <ToggleRow
            label="Alarmes nativos"
            sub="Abre o Relógio do Android para confirmar"
            value={!!store.settings.nativeAlarms}
            onChange={(v) => store.updateSettings({ nativeAlarms: v })}
          />
          <ToggleRow
            label="Detector de fuga"
            sub="Registra quando você sai do app em sessão de foco"
            value={store.settings.escapeDetector !== false}
            onChange={(v) => store.updateSettings({ escapeDetector: v })}
          />
          <SecondaryButton
            label="Configurar limites de apps (Android)"
            color={colors.textSecondary}
            onPress={() => void openAppLimits().then((r) => setNote(r.message))}
          />
          <Field
            label="Meta de sono (horas)"
            value={String(store.settings.sleepGoalHours)}
            onChangeText={(t) => {
              const v = Number(t.replace(',', '.'));
              store.updateSettings({ sleepGoalHours: Number.isFinite(v) && v > 0 && v <= 16 ? Math.round(v * 10) / 10 : 7.5 });
            }}
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
              const out = await exportJson(store);
              setBusy(null);
              haptic('success');
              setExportInfo(
                out && out.startsWith('{')
                  ? 'Backup gerado, mas este dispositivo não abriu o menu de compartilhar. O conteúdo está na área de transferência.'
                  : out
                    ? 'Backup pronto: escolha onde salvar/enviar.'
                    : 'Não foi possível exportar neste dispositivo.',
              );
            }}
          />
          <SecondaryButton
            color={colors.cyan}
            label={busy === 'pdf' ? 'Gerando PDF...' : 'Exportar relatório (PDF)'}
            onPress={async () => {
              setBusy('pdf');
              const out = await exportPdf(store);
              setBusy(null);
              if (out) haptic('success');
              setExportInfo(out ? 'Relatório gerado: escolha onde salvar/enviar.' : 'Não foi possível gerar o PDF neste dispositivo.');
            }}
          />
          {exportInfo ? <Muted>{exportInfo}</Muted> : null}
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
          <Pressable style={{ flex: 1, minWidth: '45%' }} onPress={() => router.push('/modulo/constancia')}>
            <Card style={{ gap: 2 }}>
              <Txt variant="h3">🟩 Constância</Txt>
              <Muted>Mural de dias cumpridos</Muted>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1, minWidth: '45%' }} onPress={() => router.push('/modulo/graficos')}>
            <Card style={{ gap: 2 }}>
              <Txt variant="h3">📈 Gráficos</Txt>
              <Muted>21 visões do seu histórico</Muted>
            </Card>
          </Pressable>
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
                  <Badge label={`🔥 ${goalStreak(store.days, g.id, todayKey())}d`} color={colors.orange} />
                </Row>
              ))
          )}
        </Accordion>

        {/* SOBRE */}
        {note ? (
          <Card accent={colors.yellow + '44'}>
            <Txt variant="caption" color={colors.yellow} onPress={() => setNote(null)}>
              {note}
            </Txt>
          </Card>
        ) : null}

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

