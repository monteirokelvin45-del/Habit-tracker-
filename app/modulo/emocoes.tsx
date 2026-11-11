import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import {
  Badge,
  Card,
  Chip,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  SectionTitle,
  Slider,
  Txt,
} from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { useStore } from '../../src/lib/store';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import {
  EMOTION_MOMENTS,
  MAX_EMOTIONS_PER_DAY,
  effectLine,
  emotionEffect,
  emotionGrid,
  emotionPairs,
  emotionStats,
  emotionStreak,
  entriesOn,
  topEmotion,
  type EmotionMoment,
} from '../../src/lib/emotions';
import { EMOTIONS } from '../../src/lib/types';

const MOMENT_EMOJI: Record<EmotionMoment, string> = { manhã: '🌅', tarde: '☀️', noite: '🌙' };

/**
 * Diário de emoções.
 *
 * Fluxo: registrar é um toque na emoção + opcionalmente intensidade e nota.
 * Ler é o mapa de calor (dia sem registro fica apagado, nunca "neutro"),
 * o ranking da janela e — só com amostra suficiente — o efeito no score do dia
 * seguinte. Nada aqui inventa tendência: sem base, a tela diz quanto falta.
 */
export default function EmotionsScreen() {
  const store = useStore();
  const today = todayKey();
  const [emotion, setEmotion] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState('');
  const [moment, setMoment] = useState<EmotionMoment | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [window, setWindow] = useState<30 | 90>(30);
  const [message, setMessage] = useState<string | null>(null);

  const todayEntries = useMemo(() => entriesOn(store.emotions, today), [store.emotions, today]);
  const full = todayEntries.length >= MAX_EMOTIONS_PER_DAY;
  const grid = useMemo(() => emotionGrid(store.emotions, 12, today), [store.emotions, today]);
  const stats = useMemo(() => emotionStats(store, store.emotions, window), [store, store.emotions, window]);
  const streak = useMemo(() => emotionStreak(store.emotions, today), [store.emotions, today]);
  const top = useMemo(() => topEmotion(store.emotions, window, today), [store.emotions, window, today]);
  const pairs = useMemo(() => emotionPairs(store.emotions), [store.emotions]);
  const effect = useMemo(() => (top ? emotionEffect(store, store.emotions, top) : null), [store, store.emotions, top]);
  const dayDetail = selectedDay ? entriesOn(store.emotions, selectedDay) : [];

  const register = () => {
    if (!emotion) {
      setMessage('Escolha uma emoção antes de salvar.');
      return;
    }
    const result = store.addEmotion({
      emotion,
      intensity,
      ...(moment ? { moment } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    haptic('success');
    setEmotion(null);
    setIntensity(3);
    setNote('');
    setMoment(null);
    setMessage('Registrado. Emoção é dado, não veredito.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="🫀 Diário de emoções" subtitle={`${todayEntries.length}/${MAX_EMOTIONS_PER_DAY} registros hoje`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        {/* resumo do topo */}
        <Row gap={spacing.sm}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Sequência</Txt>
            <Txt variant="h2" color={streak > 0 ? colors.green : colors.textMuted}>
              {streak > 0 ? `${streak}d` : '—'}
            </Txt>
            <Muted>{streak > 0 ? 'dias seguidos com registro' : 'Sem sequência ainda'}</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Mais frequente</Txt>
            <Txt variant="h3" color={top ? colors.pink : colors.textMuted}>{top ?? 'Sem dado'}</Txt>
            <Muted>{top ? `últimos ${window} dias` : 'nada registrado na janela'}</Muted>
          </Card>
        </Row>

        {/* registro */}
        <SectionTitle right={<Badge label={full ? 'limite do dia' : `${MAX_EMOTIONS_PER_DAY - todayEntries.length} restante(s)`} color={full ? colors.orange : colors.green} />}>
          Registrar agora
        </SectionTitle>
        <Card>
          {full ? (
            <Muted>
              Você já registrou {MAX_EMOTIONS_PER_DAY} emoções hoje. Remova uma abaixo se quiser trocar —
              o limite existe para o registro ser leitura, não planilha.
            </Muted>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {EMOTIONS.map((e) => (
                  <Chip
                    key={e}
                    label={e}
                    color={colors.pink}
                    selected={emotion === e}
                    onPress={() => {
                      setEmotion(emotion === e ? null : e);
                      setMessage(null);
                    }}
                  />
                ))}
              </View>

              <Muted style={{ marginTop: spacing.md }}>Momento (opcional — o padrão vem da hora)</Muted>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {EMOTION_MOMENTS.map((m) => (
                  <Chip
                    key={m}
                    label={m}
                    emoji={MOMENT_EMOJI[m]}
                    color={colors.cyan}
                    selected={moment === m}
                    onPress={() => setMoment(moment === m ? null : m)}
                  />
                ))}
              </View>

              <Muted style={{ marginTop: spacing.md }}>Intensidade: {intensity}/5</Muted>
              <Slider value={intensity} min={1} max={5} color={colors.pink} onChange={setIntensity} />

              <Field
                label="O que estava acontecendo (opcional)"
                value={note}
                onChangeText={setNote}
                placeholder="Contexto curto: o que disparou, o que você fez"
                multiline
              />

              {message ? (
                <Muted style={{ marginTop: spacing.sm, color: message.startsWith('Registrado') ? colors.green : colors.orange }}>
                  {message}
                </Muted>
              ) : null}

              <PrimaryButton label="Registrar emoção" onPress={register} style={{ marginTop: spacing.md }} />
            </>
          )}
        </Card>

        {/* registros de hoje */}
        <SectionTitle>Hoje</SectionTitle>
        <Card>
          {todayEntries.length === 0 ? (
            <NoData label="Nenhuma emoção registrada hoje" />
          ) : (
            todayEntries.map((e) => (
              <View key={e.at} style={{ marginBottom: spacing.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="body" style={{ fontWeight: '600' }}>
                    {MOMENT_EMOJI[e.moment]} {e.emotion}
                  </Txt>
                  <Row gap={spacing.sm}>
                    <Badge label={`int ${e.intensity}/5`} color={colors.pink} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${e.emotion}`}
                      onPress={() => {
                        haptic('light');
                        store.removeEmotion(e.at);
                      }}
                    >
                      <Txt variant="caption" color={colors.red}>remover</Txt>
                    </Pressable>
                  </Row>
                </Row>
                {e.note ? <Muted>{e.note}</Muted> : null}
              </View>
            ))
          )}
        </Card>

        {/* mapa de calor */}
        <SectionTitle right={<Badge label="12 semanas" color={colors.cyan} />}>Mapa de emoções</SectionTitle>
        <Card>
          <Muted style={{ marginBottom: spacing.sm }}>
            Cada quadrado é um dia; a cor é a emoção dominante e a opacidade é a média de intensidade.
            Dia sem registro fica apagado — não é “neutro”.
          </Muted>
          {store.emotions.length === 0 ? (
            <NoData label="Sem dado — o mapa acende no primeiro registro" />
          ) : (
            <>
              {grid.map((week, wi) => (
                <View key={`w-${wi}`} style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
                  {week.map((cell) => {
                    const isSelected = selectedDay === cell.date;
                    const alpha = cell.intensity ? 0.25 + (cell.intensity / 5) * 0.75 : 0;
                    return (
                      <Pressable
                        key={cell.date}
                        accessibilityRole="button"
                        accessibilityLabel={
                          cell.emotion
                            ? `${cell.date}: ${cell.emotion} (${cell.count} registro(s))`
                            : `${cell.date}: sem registro`
                        }
                        onPress={() => {
                          haptic('light');
                          setSelectedDay(isSelected ? null : cell.date);
                        }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          borderWidth: isSelected ? 1.5 : 1,
                          borderColor: isSelected ? colors.textPrimary : colors.border,
                          backgroundColor: cell.emotion
                            ? withAlpha(emotionColor(cell.emotion), alpha)
                            : colors.bgSubtle,
                        }}
                      />
                    );
                  })}
                </View>
              ))}
              <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Muted>{grid[0]?.[0]?.date}</Muted>
                <Muted>{today}</Muted>
              </Row>
              {selectedDay ? (
                <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
                  <Txt variant="body" style={{ fontWeight: '600' }}>{selectedDay}</Txt>
                  {dayDetail.length === 0 ? (
                    <NoData label="Sem emoção registrada neste dia" />
                  ) : (
                    dayDetail.map((e) => (
                      <Muted key={e.at}>
                        {MOMENT_EMOJI[e.moment]} {e.emotion} · intensidade {e.intensity}/5{e.note ? ` · ${e.note}` : ''}
                      </Muted>
                    ))
                  )}
                </View>
              ) : null}
            </>
          )}
        </Card>

        {/* ranking + efeito */}
        <SectionTitle right={
          <Row gap={spacing.xs}>
            <Pressable onPress={() => setWindow(30)} accessibilityRole="button">
              <Badge label="30d" color={window === 30 ? colors.green : colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => setWindow(90)} accessibilityRole="button">
              <Badge label="90d" color={window === 90 ? colors.green : colors.textMuted} />
            </Pressable>
          </Row>
        }>
          O que aparece
        </SectionTitle>
        <Card>
          {stats.length === 0 ? (
            <NoData label={`Nenhum registro nos últimos ${window} dias`} />
          ) : (
            stats.map((s) => (
              <View key={s.emotion} style={{ marginBottom: spacing.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="body">{s.emotion}</Txt>
                  <Row gap={spacing.sm}>
                    {s.commonMoment ? <Muted>{MOMENT_EMOJI[s.commonMoment]} {s.commonMoment}</Muted> : null}
                    <Badge label={`${s.count}×`} color={emotionColor(s.emotion)} />
                    <Badge label={`int ${s.intensity}`} color={colors.textMuted} />
                  </Row>
                </Row>
                <Muted>
                  {s.scoreWith == null
                    ? 'Sem dia fechado com essa emoção — sem score para comparar.'
                    : `Score médio dos dias com ela: ${s.scoreWith}/10.`}
                </Muted>
              </View>
            ))
          )}
        </Card>

        {/* efeito no dia seguinte */}
        <SectionTitle right={<Badge label="≥ 4 dias de cada lado" color={colors.purple} />}>Efeito no dia seguinte</SectionTitle>
        <Card>
          {!effect ? (
            <NoData label="Sem emoção frequente o bastante para comparar" />
          ) : (
            <>
              <Txt variant="body" style={{ fontWeight: '600', marginBottom: 4 }}>{effect.emotion}</Txt>
              <Muted>{effectLine(effect)}</Muted>
              {effect.eligible ? (
                <Muted style={{ marginTop: 6 }}>
                  Comparação descritiva, não causal: {effect.sample} dia(s) com a emoção ×{' '}
                  {effect.avgWithout === undefined ? '' : ''}os outros dias com score seguinte registrado.
                </Muted>
              ) : null}
            </>
          )}
        </Card>

        {/* pares */}
        <SectionTitle>Costumam vir juntas</SectionTitle>
        <Card>
          {pairs.length === 0 ? (
            <NoData label="Sem pares registrados ainda" />
          ) : (
            pairs.map((p) => (
              <Row key={p.label} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Txt variant="body">{p.label}</Txt>
                <Badge label={`${p.count} dia(s)`} color={colors.cyan} />
              </Row>
            ))
          )}
          <Muted style={{ marginTop: spacing.sm }}>
            Últimos 60 dias. Contagem simples de dias em que as duas apareceram — não é correlação.
          </Muted>
        </Card>
      </ScrollView>
    </View>
  );
}

/** Cor estável por emoção (mesma emoção = mesma cor no mapa e no ranking). */
const EMOTION_COLORS = [
  colors.pink,
  colors.cyan,
  colors.purple,
  colors.orange,
  colors.green,
  colors.blue,
  colors.yellow,
  colors.red,
];

function emotionColor(emotion: string): string {
  const index = (EMOTIONS as readonly string[]).indexOf(emotion);
  if (index < 0) return colors.textSecondary;
  return EMOTION_COLORS[index % EMOTION_COLORS.length] ?? colors.textSecondary;
}

/** Hex + alpha (o RN não aceita `#rrggbbaa` em todas as versões; usa rgba). */
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}
