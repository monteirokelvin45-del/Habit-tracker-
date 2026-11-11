import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { areaColor, colors, MODES, spacing } from '../../src/theme';
import {
  Accordion,
  Badge,
  Card,
  Chip,
  Field,
  Muted,
  NoData,
  OptionPicker,
  PrimaryButton,
  Row,
  SecondaryButton,
  SectionTitle,
  Sheet,
  Txt,
} from '../../src/components/ui';
import { useStore, newId } from '../../src/lib/store';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { AREA_EMOJI, LIFE_AREAS, PRIORITY_META, type Goal, type Priority } from '../../src/lib/types';
import { goalStreak } from '../../src/lib/score';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';

const MODULES = [
  { href: '/modulo/leitura', emoji: '📚', label: 'Leitura', area: 'Leitura', sub: 'Livros, páginas e progresso' },
  { href: '/modulo/financas', emoji: '💰', label: 'Finanças', area: 'Finanças', sub: 'Receitas, despesas e impulsos' },
  { href: '/modulo/peso', emoji: '⚖️', label: 'Peso e medidas', area: 'Saúde', sub: 'Peso, médias e fotos' },
  { href: '/modulo/ayanokoji', emoji: '🎭', label: 'Protocolo Ayanokoji', area: 'Ayanokoji', sub: '24 semanas · 4 eixos' },
  { href: '/modulo/sono', emoji: '😴', label: 'Sono avançado', area: 'Sono', sub: 'Horários, qualidade e correlação' },
  { href: '/modulo/pomodoro', emoji: '⏱️', label: 'Pomodoro', area: 'Foco', sub: '25/5, 50/10 ou 90/20' },
];

export default function GoalsScreen() {
  const router = useRouter();
  const store = useStore();
  const today = todayKey();

  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [area, setArea] = useState<string>(store.user.areas[0] ?? 'Treino');
  const [priority, setPriority] = useState<Priority>('normal');
  const [min, setMin] = useState('');
  const [ideal, setIdeal] = useState('');
  const [excellent, setExcellent] = useState('');
  const [active, setActive] = useState(true);

  const areas = useMemo(
    () => Array.from(new Set([...store.user.areas, ...store.goals.map((g) => g.area), ...LIFE_AREAS])),
    [store.user.areas, store.goals],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Goal[]>();
    for (const g of store.goals.filter((x) => !x.archived)) {
      const list = map.get(g.area) ?? [];
      list.push(g);
      map.set(g.area, list);
    }
    return Array.from(map.entries());
  }, [store.goals]);

  const archived = store.goals.filter((g) => g.archived);
  const activeCount = store.goals.filter((g) => g.active && !g.archived).length;

  const openNew = () => {
    setEditing(null);
    setName('');
    setArea(store.user.areas[0] ?? 'Treino');
    setPriority('normal');
    setMin('');
    setIdeal('');
    setExcellent('');
    setActive(true);
    setSheet(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setName(goal.name);
    setArea(goal.area);
    setPriority(goal.priority);
    setMin(goal.min);
    setIdeal(goal.ideal);
    setExcellent(goal.excellent);
    setActive(goal.active);
    setSheet(true);
  };

  const save = () => {
    const trimmed = name.trim();
    // Antes, salvar com o nome vazio criava uma meta sem nome no checklist.
    if (!trimmed) return;
    const goal: Goal = {
      id: editing?.id ?? newId('goal'),
      name: trimmed,
      area,
      priority,
      min: min.trim() || '15min',
      ideal: ideal.trim() || '30min',
      excellent: excellent.trim() || '1h',
      active,
      archived: editing?.archived,
      // originId liga a meta ao histórico importado: editar não pode quebrar o vínculo.
      originId: editing?.originId,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    store.upsertGoal(goal);
    haptic('success');
    setSheet(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="h1">Suas Metas</Txt>
            <Muted style={{ marginTop: 2 }}>{activeCount} ativa(s)</Muted>
          </View>
          <Pressable onPress={openNew} accessibilityRole="button">
            <Card style={{ paddingVertical: 10, paddingHorizontal: 16, borderColor: colors.green + '66' }}>
              <Txt color={colors.green} style={{ fontWeight: '700' }}>+ Nova</Txt>
            </Card>
          </Pressable>
        </Row>

        {activeCount > 8 ? (
          <Card accent={colors.yellow + '66'}>
            <Txt variant="caption" color={colors.yellow}>
              ⚠️ Volume alto ({activeCount} metas). Risco de abandono. Considere reduzir.
            </Txt>
          </Card>
        ) : null}

        {grouped.length === 0 ? (
          <Card>
            <Txt variant="h3">Nenhuma meta ainda</Txt>
            <Muted style={{ marginTop: 4 }}>Cada meta vira uma linha do checklist diário com 3 níveis: mín / ideal / excelente.</Muted>
            <PrimaryButton label="Criar primeira meta" style={{ marginTop: spacing.md }} onPress={openNew} />
          </Card>
        ) : null}

        {grouped.map(([groupArea, goals]) => (
          <Accordion
            key={groupArea}
            defaultOpen
            title={`${AREA_EMOJI[groupArea] ?? '•'} ${groupArea}`}
            subtitle={`${goals.length} meta(s)`}
            right={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: areaColor(groupArea) }} />}
          >
            {goals.map((goal) => {
              const streak = goalStreak(store.days, goal.id, today);
              const open = expandedGoal === goal.id;
              return (
                <SwipeableRow
                  key={goal.id}
                  actions={[
                    { label: 'EDITAR', color: colors.green, onPress: () => openEdit(goal) },
                    { label: goal.archived ? 'ATIVAR' : 'ARQUIVAR', color: colors.yellow, onPress: () => store.archiveGoal(goal.id) },
                    { label: 'EXCLUIR', color: colors.red, onPress: () => store.deleteGoal(goal.id) },
                  ]}
                >
                  <Pressable
                    onPress={() => setExpandedGoal(open ? null : goal.id)}
                    onLongPress={() => openEdit(goal)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: spacing.md,
                      gap: 6,
                      backgroundColor: colors.bgPrimary,
                    }}
                  >
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Row gap={6} style={{ flex: 1 }}>
                        <Txt variant="caption">{PRIORITY_META[goal.priority].emoji}</Txt>
                        <Txt variant="body" style={{ flexShrink: 1 }}>{goal.name}</Txt>
                      </Row>
                      <Badge label={goal.active ? '✅ ativa' : 'inativa'} color={goal.active ? colors.green : colors.textMuted} />
                    </Row>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <Badge label={`mín ${goal.min}`} color={colors.textSecondary} />
                      <Badge label={`ideal ${goal.ideal}`} color={colors.textSecondary} />
                      <Badge label={`exc ${goal.excellent}`} color={colors.textSecondary} />
                      {streak > 0 ? <Badge label={`🔥 ${streak}d`} color={colors.orange} /> : null}
                    </Row>
                    {open ? (
                      <Row gap={spacing.lg} style={{ marginTop: 4, flexWrap: 'wrap' }}>
                        <Txt variant="micro" color={colors.green} onPress={() => openEdit(goal)}>Editar</Txt>
                        <Txt variant="micro" color={colors.yellow} onPress={() => store.archiveGoal(goal.id)}>Arquivar</Txt>
                        <Txt variant="micro" color={colors.red} onPress={() => store.deleteGoal(goal.id)}>Excluir</Txt>
                      </Row>
                    ) : (
                      <Muted style={{ fontSize: 11 }}>Deslize para a esquerda: editar · arquivar · excluir</Muted>
                    )}
                  </Pressable>
                </SwipeableRow>
              );
            })}
            <SecondaryButton label="+ Nova meta nesta área" onPress={() => { setArea(groupArea); openNew(); }} />
          </Accordion>
        ))}

        <SectionTitle>Módulos</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {MODULES.map((m) => (
            <Pressable key={m.href} style={{ width: '48%' }} onPress={() => router.push(m.href as never)}>
              <Card style={{ gap: 2, minHeight: 92 }}>
                <Txt variant="h3" color={areaColor(m.area)}>{m.emoji} {m.label}</Txt>
                <Muted>{m.sub}</Muted>
              </Card>
            </Pressable>
          ))}
        </View>

        <Accordion title="Metas Arquivadas" subtitle={`${archived.length} meta(s)`}>
          {archived.length === 0 ? (
            <NoData label="Nenhuma meta arquivada" />
          ) : (
            archived.map((goal) => (
              <Row key={goal.id} style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" color={colors.textSecondary}>{goal.name} · {goal.area}</Txt>
                <Row gap={spacing.md}>
                  <Txt variant="micro" color={colors.green} onPress={() => store.archiveGoal(goal.id)}>Reativar</Txt>
                  <Txt variant="micro" color={colors.red} onPress={() => store.deleteGoal(goal.id)}>Excluir</Txt>
                </Row>
              </Row>
            ))
          )}
        </Accordion>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Modo do dia altera o checklist</Txt>
          {(Object.keys(MODES) as (keyof typeof MODES)[]).map((m) => (
            <Txt key={m} variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
              {MODES[m].emoji} {MODES[m].label}:{' '}
              {m === 'normal'
                ? 'todas no ideal'
                : m === 'minimal'
                  ? 'só mínimo, prioridade baixa escondida'
                  : m === 'attack'
                    ? 'excelente + extras'
                    : 'prioridade alta no mínimo + plano de retorno'}
            </Txt>
          ))}
        </Card>
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={editing ? 'Editar meta' : 'Nova Meta'}
        footer={<PrimaryButton label={editing ? 'Salvar alterações' : 'Criar meta'} disabled={!name.trim()} onPress={save} />}
      >
        <OptionPicker label="Área" value={area} options={areas} onSelect={setArea} />
        <Field label="Nome da meta" value={name} onChangeText={setName} placeholder="ex: Treinar 5x por semana" />
        <Txt variant="caption" color={colors.textSecondary}>Prioridade</Txt>
        <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
          {(['high', 'normal', 'low'] as Priority[]).map((p) => (
            <Chip
              key={p}
              label={`${PRIORITY_META[p].emoji} ${PRIORITY_META[p].label}`}
              color={PRIORITY_META[p].color}
              selected={priority === p}
              onPress={() => setPriority(p)}
            />
          ))}
        </Row>
        <Row gap={spacing.sm}>
          <Field label="Mín" value={min} onChangeText={setMin} placeholder="3x / 15min" style={{ flex: 1 }} />
          <Field label="Ideal" value={ideal} onChangeText={setIdeal} placeholder="5x / 1h" style={{ flex: 1 }} />
          <Field label="Excelente" value={excellent} onChangeText={setExcellent} placeholder="6x / 2h" style={{ flex: 1 }} />
        </Row>
        <Chip label={active ? '✅ Meta ativa' : '⛔ Meta inativa'} color={colors.green} selected={active} onPress={() => setActive((a) => !a)} />
      </Sheet>
    </SafeAreaView>
  );
}
