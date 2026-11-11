import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { PrimeWidget } from './PrimeWidget';
import { ConstancyWidget } from './ConstancyWidget';
import { FallbackWidget } from './FallbackWidget';
import { CONSTANCY_WIDGET_NAME, WIDGET_NAME, completeNextTask, widgetData } from './data';
import { loadAll } from '../lib/storage';
import { persistMany } from '../lib/storage';
import { evaluateBadges } from '../lib/badges';
import { evaluateRewards } from '../lib/rewards';
import { computeScore } from '../lib/score';
import { todayKey } from '../lib/date';
import type { AppData } from '../lib/types';

/**
 * Handler do widget. Roda em contexto separado do app: sempre lemos do
 * AsyncStorage na hora — nunca de estado em memória.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, widgetInfo, renderWidget, clickAction } = props;

  const known = [WIDGET_NAME, CONSTANCY_WIDGET_NAME];
  if (!known.includes(widgetInfo.widgetName)) return;

  /**
   * Renderiza com rede de proteção: se o widget de verdade falhar na conversão
   * (contexto headless, sem devtools), cai no cartão mínimo em vez de deixar o
   * launcher com o retângulo vazio da primeira renderização.
   */
  const render = (data: AppData) => {
    const isMural = widgetInfo.widgetName === CONSTANCY_WIDGET_NAME;
    try {
      renderWidget(
        isMural ? (
          <ConstancyWidget data={data} date={todayKey()} width={widgetInfo.width} />
        ) : (
          <PrimeWidget data={data} date={todayKey()} width={widgetInfo.width} />
        ),
      );
    } catch (error) {
      console.warn('widget: falha ao montar, usando cartão de emergência', error);
      try {
        renderWidget(<FallbackWidget widgetName={widgetInfo.widgetName} />);
      } catch {
        // Nem o fallback montou: não há o que fazer dentro do launcher.
      }
    }
  };

  // `loadAll` pode falhar (storage limpo pelo sistema, backup corrompido). Sem
  // isso, a exceção subia e o widget ficava com a última imagem ou em branco.
  const safeLoad = async (): Promise<AppData | null> => {
    try {
      return await loadAll();
    } catch (error) {
      console.warn('widget: loadAll falhou', error);
      return null;
    }
  };

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await safeLoad();
      if (!data) {
        renderWidget(<FallbackWidget widgetName={widgetInfo.widgetName} />);
        return;
      }
      render(data);
      return;
    }

    case 'WIDGET_CLICK': {
      const data = await safeLoad();
      if (!data) {
        renderWidget(<FallbackWidget widgetName={widgetInfo.widgetName} />);
        return;
      }
      if (clickAction === 'COMPLETE_NEXT') {
        const result = completeNextTask(data, todayKey());
        if (result.completed) {
          const today = todayKey();
          // Recalcula o score do dia (se já estava fechado, não mexe) e reavalia metas/badges.
          const days = result.data.days.map((d) => {
            if (d.date !== today || !d.score) return d;
            return {
              ...d,
              score: computeScore({
                day: d,
                goals: result.data.goals,
                previousDays: result.data.days.filter((x) => x.date < today),
              }),
            };
          });
          const next: AppData = { ...result.data, days };
          const rewards = evaluateRewards(next);
          const badges = evaluateBadges({ ...next, rewards });
          await persistMany([
            ['days', days],
            ['rewards', rewards],
            ['badges', badges],
          ]);
          render({ ...next, rewards, badges });
          return;
        }
      }
      render(data);
      return;
    }

    case 'WIDGET_DELETED':
    default:
      return;
  }
}

export { widgetData };
