import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { widgetData } from './data';
import type { AppData } from '../lib/types';
import { todayKey } from '../lib/date';

/**
 * Widget de home screen do MY PRIME.
 * Mostra: streak geral, modo do dia, progresso do checklist e a próxima tarefa.
 * Regra 1 do produto: sem dado => "Sem dado", nunca placeholder inventado.
 */
export function PrimeWidget({ data, date = todayKey(), width = 320 }: { data: AppData; date?: string; width?: number }) {
  const w = widgetData(data, date);
  // A barra de progresso é desenhada em dp (widgets Android não aceitam %).
  const barWidth = Math.max(6, Math.round(Math.max(0.02, Math.min(1, w.ratio)) * (width - 20)));

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#051F20',
        borderRadius: 20,
        // Compacto de propósito: 4×2 células dão ~124dp de altura útil e o
        // conteúdo anterior pedia ~142dp — o excedente era cortado e o widget
        // parecia vazio. `flexGap` no lugar de `space-between` mantém tudo
        // ancorado no topo, sem esticar para fora da área segura do launcher.
        padding: 9,
        flexDirection: 'column',
        flexGap: 4,
      }}
    >
      {/* linha 1: marca + streak */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget text="MY PRIME" style={{ fontSize: 10, color: '#DAF1DE', fontWeight: '700', letterSpacing: 1.5 }} />
        <TextWidget text={`🔥 ${w.streak}`} style={{ fontSize: 12, color: '#E8A838', fontWeight: '700' }} />
      </FlexWidget>

      {/* linha 2: modo do dia */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TextWidget
          text={`${w.modeEmoji} ${w.modeLabel}`}
          style={{ fontSize: 15, color: w.modeColor, fontWeight: '800' }}
          maxLines={1}
          truncate="END"
        />
        <TextWidget
          text={`${w.done}/${w.total}`}
          style={{ fontSize: 13, color: w.ratio >= 1 ? '#DAF1DE' : '#8EB69B', fontWeight: '700' }}
        />
      </FlexWidget>

      {/* barra de progresso */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 5,
          backgroundColor: '#163832',
          borderRadius: 3,
          flexDirection: 'row',
        }}
      >
        <FlexWidget
          style={{
            width: barWidth,
            height: 5,
            backgroundColor: w.allDone ? '#DAF1DE' : w.modeColor,
            borderRadius: 3,
          }}
        />
      </FlexWidget>

      {/* próxima tarefa */}
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        {w.nextTask ? (
          // Sem Fragment: `buildWidgetTree` do react-native-android-widget NÃO
          // entende `<>...</>` (tenta chamar `jsxTree.type()` e estoura com
          // "jsxTree.type is not a function"). Cada filho é um TextWidget direto.
          [
            <TextWidget
              key="task-label"
              text={`${w.nextTask.priority} ${w.nextTask.label}`}
              style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '600' }}
              maxLines={1}
              truncate="END"
            />,
            <TextWidget
              key="task-meta"
              text={`${w.nextTask.area} · ${w.nextTask.target}`}
              style={{ fontSize: 10, color: '#8EB69B' }}
              maxLines={1}
              truncate="END"
            />,
          ]
        ) : (
          [
            <TextWidget
              key="hint"
              text={w.hasGoals ? w.hint : 'Sem dado'}
              style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '600' }}
              maxLines={1}
            />,
            <TextWidget
              key="hint-sub"
              text={w.hasGoals ? 'Nada em aberto neste modo' : 'Nenhuma meta ativa'}
              style={{ fontSize: 10, color: '#8EB69B' }}
              maxLines={1}
            />,
          ]
        )}
      </FlexWidget>

      {/* rodapé com a ação rápida */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {w.nextTask ? (
          <FlexWidget
            clickAction="COMPLETE_NEXT"
            style={{
              paddingHorizontal: 9,
              paddingVertical: 4,
              backgroundColor: '#DAF1DE',
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextWidget text="✓ Feito" style={{ fontSize: 11, color: '#000000', fontWeight: '800' }} />
          </FlexWidget>
        ) : (
          <FlexWidget style={{ paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#0B2B26', borderRadius: 10 }}>
            <TextWidget text={w.hint} style={{ fontSize: 10, color: '#8EB69B' }} maxLines={1} />
          </FlexWidget>
        )}
        <TextWidget text="ABRIR ›" style={{ fontSize: 10, color: '#5A7A6E', fontWeight: '600', letterSpacing: 1 }} />
      </FlexWidget>
    </FlexWidget>
  );
}
