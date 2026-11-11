import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../../src/components/ModalHeader';
import { Icon } from '../../src/components/Icon';
import { Badge, Card, Muted, PrimaryButton, Row, Txt } from '../../src/components/ui';
import { colors, radius, spacing, useTheme } from '../../src/theme';
import { useStore } from '../../src/lib/store';
import { addDays, todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { deadlineLabel } from '../../src/lib/schedule';
import { deadlineRisk, nextMilestone, overdueMilestones, projectProgress, type Milestone, type Project } from '../../src/lib/projects';

/**
 * Detalhamento da área PROJETO PESSOAL: marcos, prazo e anotações.
 */
export default function ProjetoScreen() {
  useTheme();
  const store = useStore();
  const today = todayKey();
  const saved = store.days.find((d) => d.date === today)?.diary.project as Project | undefined;

  const [project, setProject] = useState<Project>(
    saved ?? {
      id: 'projeto',
      name: 'Projeto pessoal',
      deadline: addDays(today, 30),
      milestones: [],
      notes: '',
    },
  );
  const [draft, setDraft] = useState('');

  const progress = projectProgress(project);
  const risk = useMemo(() => deadlineRisk(project, addDays(today, -30), today), [project, today]);
  const next = nextMilestone(project);
  const late = overdueMilestones(project, today);

  const persist = () => {
    store.patchDiary(today, { project });
    haptic('light');
  };

  const toggle = (id: string) => {
    setProject((p) => ({
      ...p,
      milestones: p.milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m)),
    }));
    haptic('light');
  };

  const addMilestone = () => {
    const title = draft.trim();
    if (!title) return;
    const milestone: Milestone = { id: `${Date.now()}`, title, done: false };
    setProject((p) => ({ ...p, milestones: [...p.milestones, milestone] }));
    setDraft('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ModalHeader title="Projeto pessoal" subtitle={project.name} onAdd={persist} addLabel="Salvar" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={project.name}
            onChangeText={(v) => setProject({ ...project, name: v })}
            placeholder="Nome do projeto"
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}
          />
          <Row style={{ justifyContent: 'space-between' }}>
            <Badge
              label={risk.label}
              color={risk.status === 'atrasado' ? colors.red : risk.status === 'atencao' ? colors.yellow : colors.green}
            />
            <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
              {project.deadline ? `prazo ${deadlineLabel(project.deadline, today)}` : 'sem prazo'}
            </Txt>
          </Row>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}>
            <View
              style={{
                height: 6,
                width: `${(progress.ratio ?? 0) * 100}%`,
                backgroundColor: risk.status === 'atrasado' ? colors.red : colors.green,
              }}
            />
          </View>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 0 }}>
            {progress.total ? `${progress.done}/${progress.total} marcos` : 'Sem dado — nenhum marco criado'}
            {next ? ` · próximo: ${next.title}` : ''}
          </Txt>
        </Card>

        {late.length ? (
          <Card accent={colors.red + '55'}>
            <Txt variant="caption" color={colors.red} style={{ fontWeight: '700' }}>
              {late.length} marco(s) com prazo vencido
            </Txt>
            {late.slice(0, 3).map((m) => (
              <Muted key={m.id} style={{ marginTop: 2 }}>
                • {m.title} — venceu em {m.due}
              </Muted>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Marcos
          </Txt>
          {project.milestones.length === 0 ? <Muted>Sem dado — adicione o primeiro marco abaixo.</Muted> : null}
          {project.milestones.map((m) => (
            <Row key={m.id} gap={spacing.sm}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: m.done }}
                onPress={() => toggle(m.id)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: m.done ? colors.green : colors.borderAccent,
                  backgroundColor: m.done ? colors.green : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {m.done ? <Icon name="tarefas" size={13} color={colors.bgPrimary} strokeWidth={3} /> : null}
              </Pressable>
              <Txt
                variant="caption"
                color={m.done ? colors.textMuted : colors.textPrimary}
                style={{ flex: 1, textDecorationLine: m.done ? 'line-through' : 'none' }}
              >
                {m.title}
              </Txt>
              <Txt variant="micro" color={m.due && m.due < today && !m.done ? colors.red : colors.textMuted} style={{ letterSpacing: 0 }}>
                {m.due ?? '—'}
              </Txt>
            </Row>
          ))}
          <Row gap={spacing.sm}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addMilestone}
              placeholder="Novo marco"
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                backgroundColor: colors.bgInput,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.textPrimary,
              }}
            />
            <PrimaryButton label="+ Adicionar" onPress={addMilestone} />
          </Row>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Anotações
          </Txt>
          <TextInput
            value={project.notes ?? ''}
            onChangeText={(v) => setProject({ ...project, notes: v })}
            placeholder="O que está travando? Qual o próximo passo concreto?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              backgroundColor: colors.bgInput,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.textPrimary,
              minHeight: 100,
              textAlignVertical: 'top',
              fontSize: 14,
            }}
          />
        </Card>

        <PrimaryButton label="Salvar projeto" onPress={persist} />
      </ScrollView>
    </SafeAreaView>
  );
}
