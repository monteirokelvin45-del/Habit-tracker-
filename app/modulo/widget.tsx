import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import { Card, Muted, NoData, Row, SecondaryButton, Txt } from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { useStore } from '../../src/lib/store';
import { useWidgetSync } from '../../src/widget/sync';
import { CONSTANCY_WIDGET_NAME, MURAL_COLORS, WIDGET_NAME, muralData, widgetData } from '../../src/widget/data';
import { haptic } from '../../src/lib/haptics';

// Carregamento sob demanda: o módulo nativo não existe no web/Expo Go.
function getWidgetApi() {
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-android-widget') as typeof import('react-native-android-widget');
  } catch {
    return null;
  }
}

export default function WidgetScreen() {
  const store = useStore();
  useWidgetSync();
  const [status, setStatus] = useState<string | null>(null);
  const api = getWidgetApi();
  const preview = widgetData(store);
  const mural = muralData(store, { width: 300, cell: 9 });

  const refresh = async () => {
    haptic('medium');
    try {
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { PrimeWidget } = await import('../../src/widget/PrimeWidget');
      const { ConstancyWidget } = await import('../../src/widget/ConstancyWidget');
      // requestWidgetUpdate resolve `void`: o único sinal de "não achei widget" é o
      // callback widgetNotFound, disparado por widget ausente na tela inicial.
      let missing = 0;
      const data = useStore.getState();
      await requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: (info) => <PrimeWidget data={data} width={info.width} />,
        widgetNotFound: () => (missing += 1),
      });
      await requestWidgetUpdate({
        widgetName: CONSTANCY_WIDGET_NAME,
        renderWidget: (info) => <ConstancyWidget data={data} width={info.width} />,
        widgetNotFound: () => (missing += 1),
      });
      setStatus(
        missing === 2
          ? 'Nenhum widget do MY PRIME na tela inicial ainda. Adicione pelo launcher do Android.'
          : missing === 1
            ? 'Um dos widgets foi atualizado. O outro ainda não está na tela inicial.'
            : 'Widgets atualizados com os dados de agora.',
      );
      // Widget já estava na tela mas aparecia vazio: o redesenho acima costuma
      // resolver. Se continuar vazio, remover e adicionar de novo força um
      // WIDGET_ADDED novo (o launcher reaproveita RemoteViews antigo).
    } catch {
      setStatus('Widget disponível apenas no app Android instalado (fora do Expo Go).');
    }
  };

  const pin = async (widgetName: string) => {
    haptic('medium');
    try {
      const { requestPinWidget } = await import('react-native-android-widget');
      const opened = await requestPinWidget({ widgetName });
      setStatus(
        opened
          ? 'Pedido enviado ao launcher. Confirme na tela inicial.'
          : 'Seu launcher não suporta fixar widget automaticamente. Adicione manualmente.',
      );
    } catch {
      setStatus('Não foi possível abrir o pedido de widget neste dispositivo.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="📱 Widget da tela inicial" subtitle="Streak + tarefa e mural de constância, direto na tela inicial" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Card style={{ gap: 6 }}>
          <Txt variant="micro" color={colors.textSecondary}>PRÉVIA</Txt>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h3" color={colors.green}>MY PRIME</Txt>
            <Txt variant="caption" color={colors.yellow}>🔥 {preview.streak}</Txt>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h2" color={preview.modeColor}>{preview.modeEmoji} {preview.modeLabel}</Txt>
            <Txt variant="caption" color={preview.ratio >= 1 ? colors.green : colors.textSecondary}>
              {preview.done}/{preview.total}
            </Txt>
          </Row>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track }}>
            <View
              style={{
                width: `${Math.round(preview.ratio * 100)}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: preview.ratio >= 1 ? colors.green : preview.modeColor,
              }}
            />
          </View>
          {preview.nextTask ? (
            <>
              <Txt variant="caption" color={colors.textPrimary}>
                {preview.nextTask.priority} {preview.nextTask.label}
              </Txt>
              <Muted>{preview.nextTask.area} · {preview.nextTask.target}</Muted>
            </>
          ) : (
            <NoData label={preview.hasGoals ? 'Nada em aberto neste modo' : 'Sem dado'} />
          )}
        </Card>

        <Card style={{ gap: 8 }}>
          <Txt variant="micro" color={colors.textSecondary}>MURAL DE CONSTÂNCIA · PRÉVIA</Txt>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h3" color={colors.green}>MY PRIME</Txt>
            <Txt variant="caption" color={colors.yellow}>🔥 {mural.streak}</Txt>
          </Row>
          <Row style={{ gap: 2, alignItems: 'flex-start' }}>
            <View style={{ width: 16, justifyContent: 'space-between' }}>
              {['S', '', 'Q', '', 'S', '', ''].map((d, i) => (
                <View key={`d${i}`} style={{ height: 11, justifyContent: 'center' }}>
                  <Txt variant="micro" color={colors.textMuted}>{d}</Txt>
                </View>
              ))}
            </View>
            {mural.columns.map((col) => (
              <View key={`c${col.index}`} style={{ gap: 2 }}>
                {col.cells.map((c) => (
                  <View
                    key={c.date}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2,
                      backgroundColor: c.isFuture ? '#141414' : c.color,
                      borderWidth: c.isToday ? 1 : 0,
                      borderColor: colors.textPrimary,
                    }}
                  />
                ))}
              </View>
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Muted>{mural.fulfilled} dia(s) cumprido(s) · {mural.weeks} semanas</Muted>
            <Row style={{ gap: 3, alignItems: 'center' }}>
              <Txt variant="micro" color={colors.textMuted}>menos</Txt>
              {([MURAL_COLORS[0], MURAL_COLORS[1], MURAL_COLORS[2], MURAL_COLORS[3], MURAL_COLORS[4]] as const).map((c) => (
                <View key={c} style={{ width: 7, height: 7, borderRadius: 1, backgroundColor: c }} />
              ))}
              <Txt variant="micro" color={colors.textMuted}>mais</Txt>
            </Row>
          </Row>
        </Card>

        {!api ? (
          <Card accent={colors.yellow + '55'}>
            <Txt variant="caption" color={colors.yellow}>
              O widget é nativo do Android. Neste ambiente (web/Expo Go) ele não renderiza — teste no APK.
            </Txt>
          </Card>
        ) : (
          <Card style={{ gap: spacing.sm }}>
            <SecondaryButton label="Fixar widget principal (streak + tarefa)" onPress={() => pin(WIDGET_NAME)} />
            <SecondaryButton label="Fixar widget do mural" onPress={() => pin(CONSTANCY_WIDGET_NAME)} />
            <SecondaryButton color={colors.cyan} label="Atualizar widget agora" onPress={refresh} />
          </Card>
        )}

        {status ? (
          <Card>
            <Muted>{status}</Muted>
          </Card>
        ) : null}

        <Card style={{ gap: 6 }}>
          <Txt variant="h3">Como funciona</Txt>
          <Muted>• O widget mostra: streak geral, modo do dia, progresso do checklist e a próxima tarefa.</Muted>
          <Muted>• Botão "✓ Feito" marca a próxima tarefa direto do widget, com horário registrado.</Muted>
          <Muted>• Toque no resto do widget abre o app.</Muted>
          <Muted>• Os dois widgets atualizam a cada 3h pelo launcher e imediatamente após cada check-in no app.</Muted>
          <Muted>• Sem registro do dia, aparece "Sem dado" — o widget nunca inventa número.</Muted>
        </Card>

        <Card style={{ gap: 6 }}>
          <Txt variant="h3">Widget do mural</Txt>
          <Muted>• Cada quadrado é um dia; a cor é o score daquele dia (mesma escala do mural do app).</Muted>
          <Muted>• Dia sem registro fica apagado — não existe interpolação nem média chutada.</Muted>
          <Muted>• O dia de hoje ganha borda branca; dias futuros ficam em preto.</Muted>
          <Muted>• O número de semanas se ajusta ao tamanho do widget na tela inicial.</Muted>
        </Card>

      </ScrollView>
    </View>
  );
}
