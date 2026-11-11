import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { Txt } from './ui';
import { areaColor, radius, spacing, useTheme } from '../theme';
import type { ChecklistItem } from '../lib/score';

/**
 * Top 3 prioridades do dia.
 *
 * Fonte: checklist real do modo do dia (não uma lista paralela). Prioridade alta
 * primeiro, depois a ordem do checklist. Clique abre o detalhamento da área.
 */
export function TopPriorities({
  items,
  doneOf,
  onToggle,
  onOpenArea,
  readOnly,
}: {
  items: ChecklistItem[];
  doneOf: (key: string) => boolean;
  onToggle: (key: string, next: boolean) => void;
  onOpenArea: (goalId: string, area: string) => void;
  readOnly?: boolean;
}) {
  const t = useTheme();
  const ordered = [...items].sort((a, b) => {
    const w = (p: string) => (p === 'high' ? 0 : p === 'normal' ? 1 : 2);
    return w(a.goal.priority) - w(b.goal.priority);
  });
  const top = ordered.slice(0, 3);
  const done = top.filter((i) => doneOf(i.extraKey ?? i.goal.id)).length;

  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.borderAccent,
        backgroundColor: t.bgCard,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="metas" size={14} color={t.green} />
          <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 2 }}>
            Top 3 prioridades
          </Txt>
        </View>
        <Txt variant="micro" color={top.length ? t.green : t.textMuted}>
          {top.length ? `${done}/${top.length}` : 'Sem dado'}
        </Txt>
      </View>

      {top.length === 0 ? (
        <Txt variant="caption" color={t.textMuted}>
          Nenhuma meta ativa. Crie uma meta para o checklist de hoje existir.
        </Txt>
      ) : null}

      {top.map((item, index) => {
        const key = item.extraKey ?? item.goal.id;
        const isDone = doneOf(key);
        const color = areaColor(item.goal.area);
        return (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Txt variant="h3" color={t.textFaint} style={{ width: 18 }}>
              {index + 1}
            </Txt>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone, disabled: !!readOnly }}
              disabled={readOnly}
              onPress={() => onToggle(key, !isDone)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: isDone ? color : t.borderAccent,
                backgroundColor: isDone ? color : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isDone ? <Icon name="tarefas" size={16} color={t.bgPrimary} strokeWidth={3} /> : null}
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => onOpenArea(item.goal.id, item.goal.area)}>
              <Txt
                variant="body"
                color={isDone ? t.textMuted : t.textPrimary}
                numberOfLines={1}
                style={{ textDecorationLine: isDone ? 'line-through' : 'none' }}
              >
                {item.goal.name}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 0.4 }}>
                  {item.goal.area} · {item.level === 'min' ? 'mín' : item.level === 'ideal' ? 'ideal' : 'exc'} {item.target}
                </Txt>
                {item.goal.priority === 'high' ? (
                  <Txt variant="micro" color={t.red} style={{ letterSpacing: 0.4 }}>
                    · alta
                  </Txt>
                ) : null}
              </View>
            </Pressable>
            <Icon name="chevronDireita" size={16} color={t.textFaint} />
          </View>
        );
      })}
    </View>
  );
}
