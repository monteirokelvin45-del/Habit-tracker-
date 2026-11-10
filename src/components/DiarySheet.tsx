import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing } from '../theme';
import {
  Accordion,
  Chip,
  Field,
  Muted,
  PrimaryButton,
  Row,
  Sheet,
  Slider,
  Txt,
} from './ui';
import {
  EMOTIONS,
  FOOD_OPTIONS,
  MOODS,
  SLEEP_BLOCKERS,
  emptyDiary,
  type Diary,
  type Goal,
} from '../lib/types';
import { haptic } from '../lib/haptics';
import { nowHHmm } from '../lib/date';

/**
 * Diário do dia: 5 campos SEMPRE obrigatórios (prometido, feito, evitado,
 * atrapalhou, correção) + contexto + opcionais.
 */
export function DiarySheet({
  visible,
  date,
  diary,
  checklistNames,
  goals,
  score,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  date: string;
  diary: Diary;
  checklistNames: string[];
  goals: Goal[];
  score: number;
  onClose: () => void;
  onSubmit: (diary: Diary) => void;
}) {
  const [draft, setDraft] = useState<Diary>(diary ?? emptyDiary());

  useEffect(() => {
    if (!visible) return;
    const base = diary ?? emptyDiary();
    setDraft({
      ...base,
      promised: checklistNames.join('\n'),
      done: base.done || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = <K extends keyof Diary>(key: K, value: Diary[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setCtx = (key: keyof Diary['context'], value: string) =>
    setDraft((d) => ({ ...d, context: { ...d.context, [key]: value } }));

  const missingCorrection = score < 6 && draft.correction.trim().length === 0;
  const blockedRequired = draft.avoided.trim().length === 0 || draft.blocked.trim().length === 0;

  const canSubmit = !missingCorrection && !blockedRequired;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.granted) {
      const res = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (!res.canceled && res.assets[0]) {
        set('photo', res.assets[0].uri);
        haptic('success');
        return;
      }
    }
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.granted) {
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
      if (!res.canceled && res.assets[0]) set('photo', res.assets[0].uri);
    }
  };

  const hourNow = parseInt(nowHHmm().slice(0, 2), 10);
  const unusedGoals = useMemo(() => goals.filter((g) => g.active), [goals]);
  void unusedGoals;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Diário do Dia"
      footer={
        <PrimaryButton
          label="ENCERRAR E GERAR SCORE"
          disabled={!canSubmit}
          onPress={() => {
            haptic('heavy');
            onSubmit(draft);
          }}
        />
      }
    >
      <Muted>{date}</Muted>

      <View style={{ gap: 4 }}>
        <Txt variant="caption" color={colors.green}>1 · O que foi prometido</Txt>
        <View style={{ backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 2 }}>
          {draft.promised
            ? draft.promised.split('\n').map((line, i) => (
                <Txt key={i} variant="caption" color={colors.textSecondary}>
                  • {line}
                </Txt>
              ))
            : <Muted>Sem metas no checklist de hoje.</Muted>}
        </View>
      </View>

      <Field label="2 · O que foi feito" value={draft.done} onChangeText={(t) => set('done', t)} multiline placeholder="O que realmente saiu do papel" />
      <Field label="3 · O que foi evitado" value={draft.avoided} onChangeText={(t) => set('avoided', t)} multiline placeholder="O que você evitou hoje (mesmo que doa admitir)" />
      <Field label="4 · O que atrapalhou" value={draft.blocked} onChangeText={(t) => set('blocked', t)} multiline placeholder="Fato concreto, não julgamento" />

      <Txt variant="caption" color={colors.textSecondary}>5 · Contexto</Txt>
      <Row gap={spacing.sm}>
        <Field label="Onde" value={draft.context.where} onChangeText={(t) => setCtx('where', t)} placeholder="casa / trabalho" style={{ flex: 1 }} />
        <Field label="Horário" value={draft.context.when} onChangeText={(t) => setCtx('when', t)} placeholder="15h" style={{ flex: 1 }} />
      </Row>
      <Row gap={spacing.sm}>
        <Field label="Distração" value={draft.context.distraction} onChangeText={(t) => setCtx('distraction', t)} placeholder="celular" style={{ flex: 1 }} />
        <Field label="Gatilho" value={draft.context.trigger} onChangeText={(t) => setCtx('trigger', t)} placeholder="cansaço" style={{ flex: 1 }} />
      </Row>

      <Field
        label={`Correção para amanhã${missingCorrection ? ' (obrigatório — score < 6)' : ''}`}
        value={draft.correction}
        onChangeText={(t) => set('correction', t)}
        multiline
        placeholder="1 mudança concreta e verificável"
      />

      <Accordion title="Campos opcionais" subtitle="Sono, humor, foco, tentações, foto">
        <Txt variant="caption" color={colors.textSecondary}>Humor</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {MOODS.map((m) => (
            <Chip key={m} label={m} selected={draft.mood === m} onPress={() => set('mood', m)} />
          ))}
        </View>

        <Row gap={spacing.sm}>
          <Field
            label="Horas dormidas"
            value={draft.sleep.hours ? String(draft.sleep.hours) : ''}
            onChangeText={(t) => set('sleep', { ...draft.sleep, hours: Number(t.replace(',', '.')) || 0 })}
            keyboardType="decimal-pad"
            placeholder="7.5"
            style={{ flex: 1 }}
          />
          <Field
            label="Qualidade (1-10)"
            value={draft.sleep.quality ? String(draft.sleep.quality) : ''}
            onChangeText={(t) => set('sleep', { ...draft.sleep, quality: Math.max(0, Math.min(10, Number(t) || 0)) })}
            keyboardType="number-pad"
            placeholder="7"
            style={{ flex: 1 }}
          />
        </Row>

        <Txt variant="caption" color={colors.textSecondary}>Alimentação</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FOOD_OPTIONS.map((f) => (
            <Chip key={f} label={f} selected={draft.food === f} onPress={() => set('food', f)} />
          ))}
        </View>

        <View>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption" color={colors.textSecondary}>Foco</Txt>
            <Txt variant="caption" color={colors.green}>{draft.focus}/10</Txt>
          </Row>
          <Slider value={draft.focus} onChange={(v) => set('focus', v)} color={colors.cyan} />
        </View>

        <Field label="Tentação" value={draft.temptation} onChangeText={(t) => set('temptation', t)} placeholder="qual tentação apareceu?" />
        <Field label="Recaída" value={draft.relapse} onChangeText={(t) => set('relapse', t)} placeholder="houve recaída? em quê?" />
        <Field label="Vitória pequena" value={draft.smallWin} onChangeText={(t) => set('smallWin', t)} placeholder="algo que passaria despercebido" />
        <Field
          label="Custo financeiro por impulso (R$)"
          value={draft.impulseCost ? String(draft.impulseCost) : ''}
          onChangeText={(t) => set('impulseCost', Number(t.replace(',', '.')) || 0)}
          keyboardType="decimal-pad"
          placeholder="0"
        />

        <Txt variant="caption" color={colors.textSecondary}>Emoções do dia (1 a 3)</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {EMOTIONS.map((e) => (
            <Chip
              key={e}
              label={e}
              color={colors.pink}
              selected={draft.emotions.includes(e)}
              onPress={() => {
                haptic('select');
                setDraft((d) => {
                  const has = d.emotions.includes(e);
                  if (has) return { ...d, emotions: d.emotions.filter((x) => x !== e) };
                  if (d.emotions.length >= 3) return d;
                  return { ...d, emotions: [...d.emotions, e] };
                });
              }}
            />
          ))}
        </View>

        <Txt variant="caption" color={colors.textSecondary}>Sono — o que atrapalhou</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SLEEP_BLOCKERS.map((b) => (
            <Chip
              key={b}
              label={b}
              color={colors.blue}
              selected={draft.sleep.blockers.includes(b)}
              onPress={() =>
                set('sleep', {
                  ...draft.sleep,
                  blockers: draft.sleep.blockers.includes(b)
                    ? draft.sleep.blockers.filter((x) => x !== b)
                    : [...draft.sleep.blockers, b],
                })
              }
            />
          ))}
        </View>

        <Row gap={spacing.md}>
          <Pressable onPress={() => void pickPhoto()} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
            <Txt variant="caption" color={colors.textSecondary}>📷 Registro do dia (opcional)</Txt>
          </Pressable>
          {draft.photo ? (
            <Image source={{ uri: draft.photo }} style={{ width: 44, height: 44, borderRadius: 8 }} />
          ) : null}
        </Row>
      </Accordion>

      {!canSubmit ? (
        <Muted>
          {missingCorrection
            ? 'Score abaixo de 6 exige uma correção concreta para amanhã.'
            : 'Evitado e "o que atrapalhou" são obrigatórios para o registro valer.'}
        </Muted>
      ) : null}
      {hourNow < 18 ? <Muted>Fechamento manual antes das 18h registrado.</Muted> : null}
    </Sheet>
  );
}
