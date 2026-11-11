import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

/**
 * Widget de emergência.
 *
 * Se a montagem do widget de verdade estourar dentro da tarefa headless
 * (contexto do launcher, sem devtools), o Android mantém o RemoteViews antigo —
 * que na primeira vez é um retângulo vazio. Em vez de mostrar nada, renderizamos
 * este cartão mínimo: é honesto ("não consegui carregar") e continua clicável.
 *
 * Só usa FlexWidget/TextWidget: nada de Fragment, nada de View do React Native.
 */
export function FallbackWidget({ widgetName }: { widgetName?: string }) {
  // O nome só serve de rótulo de acessibilidade; o texto é o mesmo para os dois widgets.
  void widgetName;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#051F20',
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <TextWidget text="MY PRIME" style={{ fontSize: 11, color: '#DAF1DE', fontWeight: '700', letterSpacing: 1.5 }} />
      <TextWidget text="Não consegui carregar os dados" style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '600' }} maxLines={2} />
      <TextWidget text="Abra o app uma vez" style={{ fontSize: 11, color: '#8EB69B' }} maxLines={1} />
      <TextWidget text="ABRIR ›" style={{ fontSize: 10, color: '#5A7A6E', fontWeight: '600', letterSpacing: 1 }} />
    </FlexWidget>
  );
}
