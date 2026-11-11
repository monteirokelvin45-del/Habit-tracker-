import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { areaColor, colors, MODES, spacing } from '../theme';
import { Badge, Card, Checkbox, EmptyState, Muted, Row, Txt } from './ui';
import { PRIORITY_META, type Day, type DayMode, type Goal } from '../lib/types';
import { buildChecklist, type ChecklistItem } from '../lib/score';
import { haptic } from '../lib/haptics';

export function ChecklistCard({
  day,
  goals,
  onToggle,
  onLongFail,
  onNote,
  readOnly = false,
}: {
  day: Day;
  goals: Goal[];
  onToggle: (goalId: string, done: boolean) => void;
  onLongFail: (goalId: string) => void;
  onNote: (goalId: string, note: string) => void;
  /** Dia encerrado: o registro está fechado; nada muda sem reabrir. */
  readOnly?: boolean;
}) {
  const items = useMemo(() => buildChecklist(goals, day.mode), [goals, day.mode]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const doneCount = day.tasks.filter((t) => t.done).length;
  const total = Math.max(items.length, day.tasks.length);
  const allDone = items.length > 0 && items.every((i) => day.tasks.find((t) => t.goalId === keyOf(i))?.done);

  if (!goals.filter((g) => g.active && !g.archived).length) {
    return (
      <EmptyState
        emoji="🎯"
        title="Nenhuma meta ativa"
        hint="Crie metas na aba Metas. O checklist do dia é gerado a partir delas."
      />
    );
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Txt variant="h3">Hoje</Txt>
        <Row gap={spacing.sm}>
          <Badge label={MODES[day.mode].label} color={MODES[day.mode].color} />
          <Txt variant="caption" color={allDone ? colors.green : colors.textSecondary} style={{ fontWeight: '600' }}>
            {doneCount}/{total} feitas
          </Txt>
        </Row>
      </Row>

      {items.length === 0 ? (
        <Muted>Nada entra neste modo. Mude o modo ou crie uma meta de prioridade alta.</Muted>
      ) : null}

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {items.map((item) => {
          const key = keyOf(item);
          const task = day.tasks.find((t) => t.goalId === key);
          const done = !!task?.done;
          const color = areaColor(item.goal.area);
          const isOpen = expanded === key;
          return (
            <View
              key={key}
              style={{
                borderWidth: 1,
                borderColor: done ? colors.green + '55' : colors.border,
                backgroundColor: done ? colors.green + '0C' : colors.bgPrimary,
                borderRadius: 14,
                padding: spacing.md,
                gap: 6,
              }}
            >
              <Row gap={spacing.md} style={{ alignItems: 'flex-start' }}>
                <View style={{ paddingTop: 2 }}>
                  <Checkbox
                    checked={done}
                    onPress={() => {
                      if (readOnly) return;
                      haptic(done ? 'light' : 'success');
                      onToggle(key, !done);
                    }}
                    onLongPress={() => {
                      if (readOnly) return;
                      haptic('warning');
                      onLongFail(key);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Txt
                      variant="body"
                      style={{
                        textDecorationLine: done ? 'line-through' : 'none',
                        color: done ? colors.textSecondary : colors.textPrimary,
                        flexShrink: 1,
                      }}
                    >
                      {item.goal.name}
                      {item.extra ? ' ✦' : ''}
                    </Txt>
                  </Row>
                  <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
                    <Badge label={item.goal.area} color={color} />
                    <Badge
                      label={`${PRIORITY_META[item.goal.priority].emoji} ${PRIORITY_META[item.goal.priority].label}`}
                      color={PRIORITY_META[item.goal.priority].color}
                    />
                    <Badge label={`${item.level === 'min' ? 'mín' : item.level === 'ideal' ? 'ideal' : 'exc'} · ${item.target}`} color={colors.textSecondary} />
                  </Row>
                  <Txt variant="micro" color={colors.textMuted} style={{ marginTop: 6, textTransform: 'none', letterSpacing: 0 }}>
                    mín: {item.goal.min} → ideal: {item.goal.ideal} → exc: {item.goal.excellent}
                  </Txt>
                </View>
                <Pressable onPress={() => setExpanded(isOpen ? null : key)} hitSlop={10} accessibilityRole="button">
                  <Txt color={colors.textMuted}>{isOpen ? '▴' : '▾'}</Txt>
                </Pressable>
              </Row>

              {isOpen ? (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <TextInput
                    value={task?.note ?? ''}
                    onChangeText={(t) => onNote(key, t)}
                    placeholder="Nota rápida (opcional)"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      backgroundColor: colors.bgInput,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      padding: 10,
                      color: colors.textPrimary,
                      fontSize: 14,
                    }}
                  />
                  {!done && !readOnly ? (
                    <Pressable onPress={() => onLongFail(key)} style={{ paddingVertical: 6 }}>
                      <Txt variant="caption" color={colors.red}>
                        ✗ Registrar falha (motivo + custo + plano)
                      </Txt>
                    </Pressable>
                  ) : null}
                  {task?.excuse ? (
                    <View style={{ gap: 2 }}>
                      <Muted>
                        Falha: {task.excuse.type} · {task.excuse.legitimacy}
                      </Muted>
                      {task.cost ? <Muted>Custo: {task.cost}</Muted> : null}
                      {task.recoveryPlan ? <Muted>Plano: {task.recoveryPlan}</Muted> : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Muted style={{ marginTop: spacing.md }}>
        Toque para marcar. Toque longo (ou ✗) para registrar a falha com honestidade.
      </Muted>
    </Card>
  );
}

function keyOf(item: ChecklistItem): string {
  return item.extraKey ?? item.goal.id;
}

export function modeHint(mode: DayMode): string {
  switch (mode) {
    case 'minimal':
      return 'Modo mínimo: só o essencial, prioridade baixa escondida.';
    case 'attack':
      return 'Modo ataque: padrão excelente + tarefas extras.';
    case 'recovery':
      return 'Modo recuperação: apenas prioridade alta no mínimo + plano de retorno.';
    default:
      return 'Modo normal: todas as metas no padrão ideal.';
  }
}
