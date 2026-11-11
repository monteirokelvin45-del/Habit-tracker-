import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { Txt } from './ui';
import { areaColor, radius, spacing, useTheme } from '../theme';
import { addDays, buildSchedule, nextSlot, slotsToSync } from '../lib/schedule';
import { todayKey, weekdayShort } from '../lib/date';
import type { Goal, Day } from '../lib/types';

/**
 * Cronograma da semana.
 *
 * Seta esquerda/direita troca o dia; os 7 dias da semana aparecem como faixa.
 * Bloco é SUGESTÃO por área (ver `lib/schedule.ts`) — o status vem da tarefa
 * real do dia. Dia futuro não tem registro: mostra só o plano sugerido.
 *
 * Nada aqui é dado inventado: dia sem meta ativa diz "Sem dado".
 */

interface Props {
  goals: Goal[];
  days: Day[];
  /** Dia inicial (YYYY-MM-DD). A navegação é local. */
  date: string;
  now: string;
}

const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function weekStartOf(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  const offset = d.getDay(); // 0 = domingo
  return addDays(dateKey, -offset);
}

export function ScheduleView({ goals, days, date: initialDate, now }: Props) {
  const t = useTheme();
  const today = todayKey();
  const [expanded, setExpanded] = useState(false);
  // Navegar pela semana não sai da tela: o dia escolhido é só uma leitura.
  const [date, onChangeDate] = useState(initialDate);

  const day = days.find((d) => d.date === date);
  const slots = useMemo(
    () =>
      buildSchedule({
        date,
        goals: goals.filter((g) => g.active),
        tasks: day?.tasks ?? [],
        overrides: day?.scheduleOverrides ?? {},
      }),
    [date, goals, day],
  );

  const weekStart = weekStartOf(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isFuture = date > today;

  const shift = (delta: number) => onChangeDate(addDays(date, delta));
  const open = slotsToSync(slots);
  const next = nextSlot(slots, now);
  const shown = expanded ? slots : slots.slice(0, 5);
  const done = slots.filter((s) => s.status === 'done').length;

  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bgCard,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="calendário" size={14} color={t.textSecondary} />
          <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 2 }}>
            Semana
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable
            onPress={() => shift(-7)}
            accessibilityRole="button"
            accessibilityLabel="Semana anterior"
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Icon name="chevronEsquerda" size={16} color={t.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => shift(7)}
            accessibilityRole="button"
            accessibilityLabel="Semana seguinte"
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Icon name="chevronDireita" size={16} color={t.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Faixa dos 7 dias */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Dia anterior" hitSlop={8} style={{ padding: 2 }}>
          <Icon name="chevronEsquerda" size={16} color={t.textMuted} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {week.map((d) => {
            const selected = d === date;
            const isToday = d === today;
            const dayData = days.find((x) => x.date === d);
            const total = dayData?.tasks.length ?? 0;
            const ok = dayData?.tasks.filter((x) => x.done).length ?? 0;
            return (
              <Pressable
                key={d}
                onPress={() => onChangeDate(d)}
                accessibilityRole="button"
                accessibilityLabel={`${weekdayShort(d)} ${d.slice(8, 10)}`}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 7,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: selected ? t.green : t.border,
                  backgroundColor: selected ? t.bgElevated : 'transparent',
                  gap: 2,
                }}
              >
                <Txt variant="micro" color={isToday ? t.green : t.textFaint} style={{ letterSpacing: 0 }}>
                  {WEEKDAY_LETTER[new Date(`${d}T12:00:00`).getDay()]}
                </Txt>
                <Txt variant="caption" color={selected ? t.textPrimary : t.textSecondary} style={{ fontWeight: '700' }}>
                  {d.slice(8, 10)}
                </Txt>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: total === 0 ? 'transparent' : ok === total ? t.green : t.border }} />
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Próximo dia" hitSlop={8} style={{ padding: 2 }}>
          <Icon name="chevronDireita" size={16} color={t.textMuted} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt variant="micro" color={t.textMuted} style={{ letterSpacing: 0 }}>
          {isFuture ? 'plano sugerido' : `${done}/${slots.length} blocos com registro`}
        </Txt>
        <Txt variant="micro" color={t.textMuted} style={{ letterSpacing: 0 }}>
          {open.length === 0 ? 'nada em aberto' : `${open.length} em aberto`}
        </Txt>
      </View>

      {slots.length === 0 ? (
        <Txt variant="caption" color={t.textMuted}>
          Sem dado — nenhuma área ativa com meta para este dia.
        </Txt>
      ) : null}

      {shown.map((slot) => {
        const color = areaColor(slot.area);
        const isNext = slot.key === next?.key && !isFuture;
        const isDone = slot.status === 'done';
        return (
          <View
            key={slot.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: 5,
              borderLeftWidth: 2,
              borderLeftColor: isDone ? color : isNext ? t.green : t.border,
              paddingLeft: spacing.sm,
              opacity: isFuture ? 0.75 : 1,
            }}
          >
            <View style={{ width: 44 }}>
              <Txt variant="caption" color={isDone ? t.textMuted : t.textPrimary} style={{ fontWeight: '700' }}>
                {slot.start}
              </Txt>
              <Txt variant="micro" color={t.textFaint} style={{ letterSpacing: 0 }}>
                {slot.end}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt
                variant="caption"
                color={isDone ? t.textMuted : t.textPrimary}
                numberOfLines={1}
                style={{ textDecorationLine: isDone ? 'line-through' : 'none' }}
              >
                {slot.title}
              </Txt>
              <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 0.4 }}>
                {slot.area}
                {isNext ? ' · próxima' : ''}
              </Txt>
            </View>
            {isDone ? <Icon name="tarefas" size={14} color={color} /> : null}
          </View>
        );
      })}

      {slots.length > 5 ? (
        <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" hitSlop={6}>
          <Txt variant="micro" color={t.green} style={{ letterSpacing: 1 }}>
            {expanded ? 'mostrar menos' : `ver os ${slots.length} blocos`}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export { weekStartOf };
