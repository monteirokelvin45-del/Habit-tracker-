import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import { Card, Muted, NoData, PrimaryButton, Row, SecondaryButton, Txt } from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { useStore } from '../../src/lib/store';
import { useWidgetSync } from '../../src/widget/sync';
import { widgetData } from '../../src/widget/data';
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

  const refresh = async () => {
    haptic('medium');
    try {
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { PrimeWidget } = await import('../../src/widget/PrimeWidget');
      await requestWidgetUpdate({
        widgetName: 'Prime',
        renderWidget: (info) => <PrimeWidget data={useStore.getState()} width={info.width} />,
        widgetNotFound: () =>
          setStatus('Nenhum widget do MY PRIME na tela inicial ainda. Adicione pelo launcher do Android.'),
      });
      setStatus('Widget atualizado com os dados de agora.');
    } catch {
      setStatus('Widget disponível apenas no app Android instalado (fora do Expo Go).');
    }
  };

  const pin = async () => {
    haptic('medium');
    try {
      const { requestPinWidget } = await import('react-native-android-widget');
      const opened = await requestPinWidget({ widgetName: 'Prime' });
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
      <ModalHeader title="📱 Widget da tela inicial" subtitle="Streak, modo e próxima tarefa sem abrir o app" />
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

        {!api ? (
          <Card accent={colors.yellow + '55'}>
            <Txt variant="caption" color={colors.yellow}>
              O widget é nativo do Android. Neste ambiente (web/Expo Go) ele não renderiza — teste no APK.
            </Txt>
          </Card>
        ) : (
          <Card style={{ gap: spacing.sm }}>
            <SecondaryButton label="Adicionar widget à tela inicial" onPress={pin} />
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
          <Muted>• Atualiza a cada 3h pelo launcher e imediatamente após cada check-in no app.</Muted>
          <Muted>• Sem registro do dia, aparece "Sem dado" — o widget nunca inventa número.</Muted>
        </Card>

      </ScrollView>
    </View>
  );
}
