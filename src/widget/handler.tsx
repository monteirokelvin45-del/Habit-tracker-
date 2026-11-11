import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { PrimeWidget } from './PrimeWidget';
import { WIDGET_NAME, completeNextTask, widgetData } from './data';
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

  if (widgetInfo.widgetName !== WIDGET_NAME) return;

  const render = (data: AppData) =>
    renderWidget(<PrimeWidget data={data} date={todayKey()} width={widgetInfo.width} />);

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await loadAll();
      render(data);
      return;
    }

    case 'WIDGET_CLICK': {
      const data = await loadAll();
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
