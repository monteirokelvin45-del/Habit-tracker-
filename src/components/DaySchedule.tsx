import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { Txt } from './ui';
import { areaColor, radius, spacing, useTheme } from '../theme';
import type { ScheduleSlot } from '../lib/schedule';

/**
 * Cronograma do dia.
 *
 * Os blocos são sugestão por área (ver `lib/schedule.ts`), nunca registro
 * inventado: bloco "feito" só quando a tarefa daquela área foi marcada.
 */
export function DaySchedule({
  slots,
  now,
  onSyncCalendar,
  onAlarm,
  syncEnabled,
  syncing,
}: {
  slots: ScheduleSlot[];
  now: string;
  onSyncCalendar?: () => void;
  onAlarm?: (slot: ScheduleSlot) => void;
  syncEnabled: boolean;
  syncing?: boolean;
}) {
  const t = useTheme();
  const nextOpen = slots.find((s) => s.status === 'open' && s.start >= now) ?? slots.find((s) => s.status === 'open');

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
          <Icon name="relogio" size={14} color={t.textSecondary} />
          <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 2 }}>
            Cronograma
          </Txt>
        </View>
        <Txt variant="micro" color={t.textMuted} style={{ letterSpacing: 0 }}>
          agora {now}
        </Txt>
      </View>

      {slots.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.green }} />
          <Txt variant="micro" color={t.green} style={{ letterSpacing: 0.5 }}>
            {now}
          </Txt>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
        </View>
      ) : null}

      {slots.length === 0 ? (
        <Txt variant="caption" color={t.textMuted}>
          Sem dado — nenhuma área ativa com meta para hoje.
        </Txt>
      ) : null}

      {slots.map((slot) => {
        const color = areaColor(slot.area);
        const isNext = nextOpen?.key === slot.key;
        const doneState = slot.status === 'done';
        return (
          <View
            key={slot.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: 6,
              borderLeftWidth: 2,
              borderLeftColor: doneState ? color : isNext ? t.green : t.border,
              paddingLeft: spacing.sm,
            }}
          >
            <View style={{ width: 46 }}>
              <Txt variant="caption" color={doneState ? t.textMuted : t.textPrimary} style={{ fontWeight: '700' }}>
                {slot.start}
              </Txt>
              <Txt variant="micro" color={t.textFaint} style={{ letterSpacing: 0 }}>
                {slot.end}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt
                variant="caption"
                color={doneState ? t.textMuted : t.textPrimary}
                numberOfLines={1}
                style={{ textDecorationLine: doneState ? 'line-through' : 'none' }}
              >
                {slot.title}
              </Txt>
              <Txt variant="micro" color={t.textSecondary} style={{ letterSpacing: 0.4 }}>
                {slot.area}
                {isNext ? ' · próxima' : ''}
                {slot.high && !doneState ? ' · alta' : ''}
              </Txt>
            </View>
            {doneState ? (
              <Icon name="tarefas" size={15} color={color} />
            ) : onAlarm ? (
              <Pressable
                onPress={() => onAlarm(slot)}
                accessibilityRole="button"
                accessibilityLabel={`Criar alarme para ${slot.title} às ${slot.start}`}
                hitSlop={8}
              >
                <Icon name="alarme" size={15} color={t.textMuted} />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {onSyncCalendar ? (
        <Pressable
          onPress={onSyncCalendar}
          disabled={syncing}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: t.borderAccent,
            backgroundColor: t.bgElevated,
            paddingVertical: 10,
            opacity: pressed || syncing ? 0.7 : 1,
          })}
        >
          <Icon name="calendário" size={14} color={t.green} />
          <Txt variant="micro" color={t.green} style={{ letterSpacing: 1 }}>
            {syncing ? 'sincronizando…' : syncEnabled ? 'Sincronizar com agenda' : 'Ativar agenda do celular'}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
