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
  const barWidth = Math.max(6, Math.round(Math.max(0.02, Math.min(1, w.ratio)) * (width - 28)));

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0A0A0A',
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
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
        <TextWidget text="MY PRIME" style={{ fontSize: 11, color: '#00FF88', fontWeight: '700', letterSpacing: 1.5 }} />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text={`🔥 ${w.streak}`} style={{ fontSize: 13, color: '#FFAA00', fontWeight: '700' }} />
        </FlexWidget>
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
          style={{ fontSize: 20, color: w.modeColor, fontWeight: '800' }}
        />
        <TextWidget
          text={`${w.done}/${w.total}`}
          style={{ fontSize: 14, color: w.ratio >= 1 ? '#00FF88' : '#888888', fontWeight: '700' }}
        />
      </FlexWidget>

      {/* barra de progresso */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 6,
          backgroundColor: '#2A2A2A',
          borderRadius: 3,
          flexDirection: 'row',
          marginTop: 2,
          marginBottom: 2,
        }}
      >
        <FlexWidget
          style={{
            width: barWidth,
            height: 6,
            backgroundColor: w.allDone ? '#00FF88' : w.modeColor,
            borderRadius: 3,
          }}
        />
      </FlexWidget>

      {/* próxima tarefa */}
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        {w.nextTask ? (
          <>
            <TextWidget
              text={`${w.nextTask.priority} ${w.nextTask.label}`}
              style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}
              maxLines={1}
              truncate="END"
            />
            <TextWidget
              text={`${w.nextTask.area} · ${w.nextTask.target}`}
              style={{ fontSize: 11, color: '#888888' }}
              maxLines={1}
              truncate="END"
            />
          </>
        ) : (
          <>
            <TextWidget text={w.hasGoals ? w.hint : 'Sem dado'} style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }} />
            <TextWidget
              text={w.hasGoals ? 'Nada em aberto neste modo' : 'Nenhuma meta ativa'}
              style={{ fontSize: 11, color: '#888888' }}
              maxLines={1}
            />
          </>
        )}
      </FlexWidget>

      {/* rodapé com a ação rápida */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        {w.nextTask ? (
          <FlexWidget
            clickAction="COMPLETE_NEXT"
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: '#00FF88',
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextWidget text="✓ Feito" style={{ fontSize: 12, color: '#000000', fontWeight: '800' }} />
          </FlexWidget>
        ) : (
          <FlexWidget style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1A1A1A', borderRadius: 10 }}>
            <TextWidget text={w.hint} style={{ fontSize: 11, color: '#888888' }} maxLines={1} />
          </FlexWidget>
        )}
        <TextWidget text="ABRIR ›" style={{ fontSize: 10, color: '#555555', fontWeight: '600', letterSpacing: 1 }} />
      </FlexWidget>
    </FlexWidget>
  );
}
