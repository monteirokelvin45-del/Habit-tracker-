/**
 * AI Copilot / LIX AI — a tela central de assistência do app.
 *
 * O desenho segue a referência: coluna de navegação à esquerda, orbe no topo,
 * saudação → título → subtítulo, caixa de entrada de vidro com anexar/ferramentas
 * e enviar, e três cards de ação rápida embaixo.
 *
 * O que esta tela NÃO faz — de propósito:
 *  - não chama nenhum servidor. Não existe API de IA no app, e mandar os
 *    registros da pessoa para fora sem ela saber seria o oposto da promessa do
 *    MY PRIME. O motor é local (`lib/copilot.ts`) e recebe só o que está no
 *    aparelho + o texto que a pessoa escrever.
 *  - não inventa número. Toda linha de resposta vem de `AppData`; quando falta
 *    dado, a tela mostra o que perguntar, não um valor de exemplo.
 *  - não grava nada sem confirmação: o plano aparece em cartão com "Aplicar".
 *
 * O chat fica na sessão (não em AsyncStorage): conversa não é registro de vida,
 * e guardar histórico de conversa no aparelho sem pedir seria efeito colateral.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon, type IconName } from '../../src/components/Icon';
import { Txt } from '../../src/components/ui';
import { LIX, LixBar, LixBubble, LixCard, LixChip, LixLabel, LixOrb, LixRow } from '../../src/components/Lix';
import { useStore } from '../../src/lib/store';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { WATER_CUP_ML } from '../../src/lib/diet';
import {
  QUICK_ACTIONS,
  dailySuggestions,
  daySummary,
  respond,
  waterCupsFor,
  type CopilotReply,
} from '../../src/lib/copilot';
import { applyCopilot } from '../../src/lib/copilotApply';

/* ───────────────────────── navegação da coluna ───────────────────────── */

/** As 5 abas + o botão do Copilot. A pílula é a tela atual, como na referência. */
const NAV: { key: string; icon: IconName; route: string; label: string }[] = [
  { key: 'hoje', icon: 'hoje', route: '/(tabs)', label: 'Hoje' },
  { key: 'revisoes', icon: 'revisoes', route: '/(tabs)/revisoes', label: 'Revisões' },
  { key: 'metas', icon: 'metas', route: '/(tabs)/metas', label: 'Metas' },
  { key: 'copilot', icon: 'cerebro', route: '/(tabs)/copilot', label: 'AI Copilot' },
  { key: 'perfil', icon: 'perfil', route: '/(tabs)/perfil', label: 'Perfil' },
];

function Sidebar({ onOpenModule }: { onOpenModule: () => void }) {
  const router = useRouter();
  return (
    <View
      accessibilityLabel="Navegação do aplicativo"
      style={{
        width: 54,
        paddingVertical: 14,
        paddingHorizontal: 9,
        backgroundColor: 'rgba(9,13,20,0.86)',
        borderRightWidth: 1,
        borderRightColor: LIX.border,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ alignItems: 'center', gap: 18 }}>
        <Txt variant="micro" upper={false} color={LIX.ink} style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>
          LIX
        </Txt>
        {NAV.map((item) => {
          const active = item.key === 'copilot';
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                haptic('light');
                if (item.key !== 'copilot') router.push(item.route as never);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? LIX.accent : 'transparent',
              }}
            >
              <Icon name={item.icon} size={17} color={active ? '#05070C' : LIX.muted} strokeWidth={active ? 2.2 : 1.8} />
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir módulos"
        onPress={onOpenModule}
        style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="fila" size={17} color={LIX.muted} />
      </Pressable>
    </View>
  );
}

/* ───────────────────────── cartão de plano ───────────────────────── */

function PlanCard({
  reply,
  onApplied,
  onNotice,
}: {
  reply: CopilotReply;
  onApplied: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const store = useStore();
  const [result, setResult] = useState<{ applied: string[]; skipped: string[] } | null>(null);
  const action = reply.action;
  if (!action) return null;

  const apply = () => {
    haptic('success');
    const out = applyCopilot(
      action,
      {
        goals: store.goals,
        days: store.days,
        settings: store.settings,
        upsertGoal: store.upsertGoal,
        patchDiary: store.patchDiary,
        addFinance: store.addFinance,
        ensureDay: store.ensureDay,
        user: store.user,
        updateSettings: store.updateSettings,
        setScheduleOverride: store.setScheduleOverride,
      },
      todayKey(),
    );
    setResult(out);
    if (out.applied.length) onApplied(out.applied.join(' · '));
    // Meta de água declarada agora: avisa de onde veio o número, em vez de
    // mudar a configuração da pessoa em silêncio.
    if (out.declared) onNotice(`Meta de água definida em ${action.kind === 'water' ? action.water.cups : ''} copos (você declarou). Ajuste no Perfil se quiser.`);
  };

  return (
    <LixCard accentBorder style={{ gap: 10, marginTop: 8 }}>
      <LixLabel color={LIX.accent}>PLANO PRONTO — CONFIRME ANTES DE APLICAR</LixLabel>
      {reply.lines.slice(0, 8).map((line, i) => (
        <Txt key={`${i}-${line}`} variant="caption" upper={false} color={LIX.body} style={{ fontSize: 12 }}>
          · {line}
        </Txt>
      ))}
      {result ? (
        <View style={{ gap: 4 }}>
          {result.applied.map((a) => (
            <Txt key={a} variant="caption" upper={false} color={LIX.ok} style={{ fontSize: 11.5 }}>
              ✓ {a}
            </Txt>
          ))}
          {result.skipped.map((s) => (
            <Txt key={s} variant="caption" upper={false} color={LIX.gold} style={{ fontSize: 11.5 }}>
              ! {s}
            </Txt>
          ))}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Aplicar plano"
          onPress={apply}
          style={{
            marginTop: 2,
            paddingVertical: 11,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: LIX.accent,
          }}
        >
          <Txt variant="body" upper={false} color="#05070C" style={{ fontSize: 13, fontWeight: '800' }}>
            Aplicar
          </Txt>
        </Pressable>
      )}
    </LixCard>
  );
}

/* ───────────────────────── tela ───────────────────────── */

export default function CopilotScreen() {
  const router = useRouter();
  const store = useStore();
  const today = todayKey();
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<{ id: string; role: 'user' | 'assistant'; reply?: CopilotReply; text?: string }[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Pulso do orbe: sobe e desce devagar (3,2s). `useNativeDriver` não existe no
  // web, então `false` — e o valor fica em 0..1, sem loop de JS pesado.
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const data = useMemo(
    () => ({
      user: store.user,
      goals: store.goals,
      days: store.days,
      rules: store.rules,
      rewards: store.rewards,
      books: store.books,
      finances: store.finances,
      weight: store.weight,
      settings: store.settings,
      badges: store.badges,
      ayanokoji: store.ayanokoji,
      weeklyFocus: store.weeklyFocus,
      routeAdjustments: store.routeAdjustments,
      emotions: store.emotions,
      onboarded: store.onboarded,
    }),
    [store.user, store.goals, store.days, store.rules, store.rewards, store.books, store.finances, store.weight, store.settings, store.badges, store.ayanokoji, store.weeklyFocus, store.routeAdjustments, store.emotions, store.onboarded],
  );

  const suggestions = useMemo(() => dailySuggestions(data, today), [data, today]);
  const summary = useMemo(() => daySummary(data, today), [data, today]);
  const water = useMemo(() => {
    const goal = waterCupsFor(data);
    const cups = store.days.find((d) => d.date === today)?.diary.waterCups;
    return {
      goal,
      cups: typeof cups === 'number' ? cups : null,
      ratio: goal && typeof cups === 'number' ? Math.min(1, cups / goal) : null,
    };
  }, [data, today, store.days]);

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question) return;
      haptic('light');
      const reply = respond(question, { name: store.user.name, data, today });
      setThread((prev) => [
        ...prev,
        { id: `u-${prev.length}`, role: 'user', text: question },
        { id: `a-${prev.length}`, role: 'assistant', reply },
      ]);
      setDraft('');
      setToolsOpen(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    },
    [data, store.user.name, today],
  );

  const firstName = (store.user.name || '').trim().split(/\s+/)[0] ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: LIX.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Sidebar onOpenModule={() => router.push('/modulo/widget' as never)} />

        <View style={{ flex: 1 }}>
          {/* luz ambiente do rodapé (o brilho azul-turquesa da referência) */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -60,
              right: -60,
              bottom: -170,
              height: 300,
              borderRadius: 300,
              backgroundColor: '#0E7490',
              opacity: 0.22,
            }}
          />
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, gap: 14 }}
            showsVerticalScrollIndicator={false}
          >
            {/* cabeçalho: orbe + saudação */}
            <View style={{ alignItems: 'center', gap: 6, paddingTop: 6 }}>
              <Animated.View
                style={{
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] }) }],
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
                }}
              >
                <LixOrb size={132} />
              </Animated.View>
              <Txt variant="caption" upper={false} color={LIX.muted} style={{ fontSize: 12.5 }}>
                {firstName ? `Olá, ${firstName}` : 'Olá'}
              </Txt>
              <Txt variant="h1" upper={false} color={LIX.ink} style={{ fontSize: 25, textAlign: 'center', letterSpacing: -0.6 }}>
                Como posso ajudar hoje?
              </Txt>
              <Txt
                variant="caption"
                upper={false}
                color={LIX.muted}
                style={{ fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 18 }}
              >
                Estou aqui para ajudar — de respostas rápidas a recomendações com base nos seus registros.
              </Txt>
            </View>

            {/* caixa de entrada */}
            <LixCard strong accentBorder style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="brilho" size={12} color={LIX.teal} />
                <LixLabel color={LIX.teal}>Roda no aparelho · seus dados não saem daqui</LixLabel>
              </View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Pergunte qualquer coisa…"
                placeholderTextColor={LIX.faint}
                accessibilityLabel="Campo de mensagem para o LIX AI"
                multiline
                style={{
                  minHeight: 44,
                  maxHeight: 120,
                  color: LIX.ink,
                  fontSize: 14,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Importar arquivo"
                  onPress={() => router.push('/importar' as never)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)' }}
                >
                  <Icon name="enviar" size={12} color={LIX.body} />
                  <Txt variant="micro" upper={false} color={LIX.body} style={{ fontSize: 10 }}>
                    Importar arquivo
                  </Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ferramentas"
                  accessibilityState={{ expanded: toolsOpen }}
                  onPress={() => setToolsOpen((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)' }}
                >
                  <Icon name="sistema" size={12} color={LIX.body} />
                  <Txt variant="micro" upper={false} color={LIX.body} style={{ fontSize: 10 }}>
                    Ferramentas
                  </Txt>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Enviar mensagem"
                  onPress={() => send(draft)}
                  disabled={!draft.trim()}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: draft.trim() ? LIX.accent : 'rgba(56,189,248,0.22)',
                  }}
                >
                  <Txt variant="body" upper={false} color="#05070C" style={{ fontSize: 16, fontWeight: '900' }}>
                    ↑
                  </Txt>
                </Pressable>
              </View>

              {toolsOpen ? (
                <View style={{ gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: LIX.border }}>
                  <LixLabel>FERRAMENTAS</LixLabel>
                  {[
                    { label: 'Resumo do dia', prompt: 'Resumir meu dia' },
                    { label: 'Montar rotina', prompt: 'Acordar 6h, meditar 10min, treinar 19h' },
                    { label: 'Ficha de treino', prompt: 'Montar ficha de treino de pernas' },
                    { label: 'Cronograma de estudo', prompt: 'Organizar estudo: Direito 40min, Português 30min' },
                    { label: 'Categorizar gastos', prompt: 'mercado 320, uber 80, cinema 45' },
                    { label: 'Hidratação e macros', prompt: 'Como está minha hidratação e meus macros?' },
                  ].map((tool) => (
                    <Pressable
                      key={tool.label}
                      accessibilityRole="button"
                      accessibilityLabel={tool.label}
                      onPress={() => send(tool.prompt)}
                      style={{ paddingVertical: 7 }}
                    >
                      <Txt variant="caption" upper={false} color={LIX.body} style={{ fontSize: 12 }}>
                        → {tool.label}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </LixCard>

            {notice ? (
              <LixChip label={notice} tone="accent" />
            ) : null}

            {/* conversa */}
            {thread.length ? (
              <View style={{ gap: 10 }}>
                {thread.map((item) =>
                  item.role === 'user' ? (
                    <LixBubble key={item.id} role="user">
                      <Txt variant="body" upper={false} color={LIX.ink} style={{ fontSize: 13, lineHeight: 19 }}>
                        {item.text}
                      </Txt>
                    </LixBubble>
                  ) : (
                    <LixBubble key={item.id} role="assistant">
                      <Txt variant="body" upper={false} color={LIX.ink} style={{ fontSize: 13, lineHeight: 19 }}>
                        {item.reply?.text}
                      </Txt>
                      {item.reply?.lines.map((line, i) => (
                        <Txt key={`${item.id}-l${i}`} variant="caption" upper={false} color={LIX.body} style={{ fontSize: 12, lineHeight: 17 }}>
                          · {line}
                        </Txt>
                      ))}
                      {item.reply?.notes.map((note, i) => (
                        <Txt key={`${item.id}-n${i}`} variant="caption" upper={false} color={LIX.muted} style={{ fontSize: 11, lineHeight: 16 }}>
                          {note}
                        </Txt>
                      ))}
                      {item.reply?.gaps.map((gap) => (
                        <View key={gap.field + gap.question} style={{ flexDirection: 'row', gap: 6, paddingTop: 2 }}>
                          <Txt variant="caption" upper={false} color={LIX.gold} style={{ fontSize: 11 }}>
                            ?
                          </Txt>
                          <Txt variant="caption" upper={false} color={LIX.gold} style={{ fontSize: 11, flex: 1, lineHeight: 16 }}>
                            {gap.question}
                          </Txt>
                        </View>
                      ))}
                      {item.reply ? <PlanCard
                          reply={item.reply}
                          onApplied={(m) => setNotice(`Aplicado: ${m}`)}
                          onNotice={(m) => setNotice(m)}
                        /> : null}
                    </LixBubble>
                  ),
                )}
              </View>
            ) : null}

            {/* estado do dia — dado real, "Sem dado" quando não há registro */}
            <LixCard style={{ gap: 9 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <LixLabel>SEU DIA AGORA</LixLabel>
                <LixChip label="só registros do app" />
              </View>
              {summary.slice(0, 4).map((line, i) => (
                <Txt key={`s${i}`} variant="caption" upper={false} color={LIX.body} style={{ fontSize: 12, lineHeight: 17 }}>
                  {line}
                </Txt>
              ))}
              <View style={{ gap: 6, paddingTop: 4 }}>
                <LixRow
                  label="Hidratação"
                  value={water.goal == null ? 'Sem dado' : `${water.cups ?? 0} de ${water.goal} copos`}
                />
                <LixBar ratio={water.ratio} color={LIX.teal} />
                {water.goal == null ? (
                  <Txt variant="micro" upper={false} color={LIX.faint} style={{ fontSize: 10 }}>
                    Defina a meta de água no Perfil ({WATER_CUP_ML} ml por copo) — o app não estima sua necessidade.
                  </Txt>
                ) : null}
              </View>
            </LixCard>

            {/* sugestões */}
            <View style={{ gap: 8 }}>
              <LixLabel>SUGESTÕES DE HOJE</LixLabel>
              {suggestions.map((s) => (
                <LixCard key={s.title} padding={13} style={{ gap: 5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Txt variant="body" upper={false} color={LIX.ink} style={{ fontSize: 13, fontWeight: '700', flex: 1 }}>
                      {s.title}
                    </Txt>
                    {s.prompt ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${s.cta ?? 'Abrir'}: ${s.title}`}
                        onPress={() => send(s.prompt!)}
                        style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, backgroundColor: 'rgba(56,189,248,0.16)' }}
                      >
                        <Txt variant="micro" upper={false} color="#7DD3FC" style={{ fontSize: 10, fontWeight: '700' }}>
                          {s.cta ?? 'Abrir'}
                        </Txt>
                      </Pressable>
                    ) : null}
                  </View>
                  <Txt variant="caption" upper={false} color={LIX.muted} style={{ fontSize: 11.5, lineHeight: 16 }}>
                    {s.body}
                  </Txt>
                </LixCard>
              ))}
            </View>

            {/* ações rápidas (os 3 cards da referência) */}
            <View style={{ gap: 8 }}>
              <LixLabel>AÇÕES RÁPIDAS</LixLabel>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {QUICK_ACTIONS.map((qa) => (
                  <Pressable
                    key={qa.key}
                    accessibilityRole="button"
                    accessibilityLabel={qa.label}
                    accessibilityHint={qa.hint}
                    onPress={() => send(qa.prompt)}
                    style={{ flex: 1, borderRadius: 16, padding: 11, gap: 6, backgroundColor: 'rgba(19,26,40,0.72)', borderWidth: 1, borderColor: LIX.border }}
                  >
                    <Icon name={qa.icon === 'rotina' ? 'relogio' : qa.icon === 'treino' ? 'treino' : 'estudo'} size={15} color={LIX.accent} />
                    <Txt variant="caption" upper={false} color={LIX.ink} style={{ fontSize: 11.5, fontWeight: '700' }}>
                      {qa.label}
                    </Txt>
                    <Txt variant="micro" upper={false} color={LIX.muted} style={{ fontSize: 9.5, lineHeight: 13 }}>
                      {qa.hint}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </View>

            <Txt variant="micro" upper={false} color={LIX.faint} style={{ fontSize: 9.5, textAlign: 'center', lineHeight: 14 }}>
              O LIX lê só o que está neste aparelho + o texto que você escreve. Calorias, bpm e composição corporal nunca
              são calculados — só registrados se você informar.
            </Txt>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
