import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { muralData } from './data';
import type { AppData } from '../lib/types';
import { todayKey } from '../lib/date';

const DAY_LABELS = ['Seg', '', 'Qua', '', 'Sex', '', ''];

/**
 * Widget do mural de constância: as últimas semanas de dias cumpridos,
 * com o mesmo código de cor do app. Sem registro = quadrado apagado.
 */
export function ConstancyWidget({
  data,
  date = todayKey(),
  width = 320,
  cell = 9,
}: {
  data: AppData;
  date?: string;
  width?: number;
  cell?: number;
}) {
  const gap = 2;
  const mural = muralData(data, { width, cell, gap, labelWidth: 16, end: date });

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#051F20',
        borderRadius: 20,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* cabeçalho */}
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="MURAL DE CONSTÂNCIA" style={{ fontSize: 10, color: '#DAF1DE', fontWeight: '700', letterSpacing: 1.2 }} />
        <TextWidget text={`🔥 ${mural.streak}`} style={{ fontSize: 12, color: '#E8A838', fontWeight: '700' }} />
      </FlexWidget>

      {/* grade */}
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 6 }}>
        {/* rótulos dos dias */}
        <FlexWidget style={{ flexDirection: 'column', width: 16, justifyContent: 'space-between' }}>
          {DAY_LABELS.map((label, i) => (
            <FlexWidget key={`dl-${i}`} style={{ height: cell + gap, marginTop: gap, justifyContent: 'center' }}>
              <TextWidget text={label} style={{ fontSize: 7, color: '#5A7A6E' }} />
            </FlexWidget>
          ))}
        </FlexWidget>

        {/* semanas */}
        {mural.columns.map((col) => (
          <FlexWidget key={`col-${col.index}`} style={{ flexDirection: 'column', marginLeft: gap }}>
            {col.cells.map((c) => (
              <FlexWidget
                key={c.date}
                style={{
                  width: cell,
                  height: cell,
                  marginTop: gap,
                  borderRadius: 2,
                  backgroundColor: c.color,
                  borderWidth: c.isToday ? 1 : 0,
                  borderColor: '#FFFFFF',
                }}
              />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* rodapé: legenda + números */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 6,
        }}
      >
        <TextWidget
          text={`${mural.fulfilled} dia(s) cumprido(s) · ${mural.weeks} sem`}
          style={{ fontSize: 9, color: '#8EB69B' }}
          maxLines={1}
          truncate="END"
        />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text="menos" style={{ fontSize: 7, color: '#5A7A6E', marginRight: 3 }} />
          {(['#1F1F1F', '#B32B2B', '#A87300', '#00A85A', '#39FF14'] as const).map((color) => (
            <FlexWidget
              key={color}
              style={{ width: 7, height: 7, borderRadius: 1, backgroundColor: color, marginLeft: 2 }}
            />
          ))}
          <TextWidget text="mais" style={{ fontSize: 7, color: '#5A7A6E', marginLeft: 3 }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
