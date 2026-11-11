import React, { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { areaColor, colors, spacing } from '../src/theme';
import {
  Badge,
  Card,
  Muted,
  PrimaryButton,
  Row,
  SecondaryButton,
  SectionTitle,
  Sheet,
  Txt,
} from '../src/components/ui';
import { ModalHeader } from '../src/components/ModalHeader';
import { useStore } from '../src/lib/store';
import { readPlan, PLAN_TEMPLATE, type ImportSummary, type PendingItem } from '../src/lib/importer';
import { haptic } from '../src/lib/haptics';

const SEVERITY_META = {
  blocker: { label: 'essencial', color: colors.red },
  important: { label: 'importante', color: colors.yellow },
  optional: { label: 'opcional', color: colors.textSecondary },
} as const;

export default function ImportScreen() {
  const router = useRouter();
  const store = useStore();
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pastedOpen, setPastedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const analyze = (content: string, name: string) => {
    setImportError(null);
    const result = readPlan(content, name, store);
    setSummary(result);
    setFilename(name);
    haptic(result.pending.some((p) => p.severity === 'blocker') ? 'warning' : 'success');
  };

  const pickFile = async () => {
    // O picker pode falhar com "Already reading" se tocado duas vezes: trava a entrada.
    if (busy) return;
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/json', 'text/markdown', 'text/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if ((asset.name ?? '').toLowerCase().endsWith('.pdf')) {
        haptic('error');
        setImportError('PDF é binário e não é lido. Abra o arquivo, copie o texto e use "Colar o plano".');
        return;
      }
      const content = new File(asset.uri).textSync();
      analyze(content, asset.name ?? 'plano');
    } catch (e) {
      console.warn('[MY PRIME] importar', e);
      haptic('error');
      setImportError('Não consegui ler este arquivo. Use .md, .txt ou .json exportado pelo MY PRIME.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!summary) return;
    setBusy(true);
    await store.applyImport(summary);
    setBusy(false);
    haptic('success');
    // Sem identidade escrita, cai no onboarding (com as metas já importadas preservadas).
    const needsIdentity = !(summary.user.identity ?? store.user.identity ?? '').trim();
    router.replace(!summary.full && needsIdentity ? '/onboarding' : '/(tabs)');
  };

  const open = summary?.pending.filter((p) => p.severity !== 'optional') ?? [];
  const optional = summary?.pending.filter((p) => p.severity === 'optional') ?? [];

  const groupedGoals = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of summary?.goals ?? []) {
      map.set(g.area, [...(map.get(g.area) ?? []), g.name]);
    }
    return Array.from(map.entries());
  }, [summary]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader
        title="📥 Enviar planos e dados"
        subtitle="O app organiza o que der e lista o que só você pode escrever"
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80, gap: spacing.md }}>
        {!summary ? (
          <>
            <Card accent={colors.green + '44'}>
              <Txt variant="caption" color={colors.green}>
                Manda o arquivo (ou cola o texto). Ele vira metas por área, regras SE-ENTÃO, recompensas,
                livros e identidade — e o que não puder ser deduzido aparece como tarefa manual, item por item.
              </Txt>
            </Card>

            <PrimaryButton
              label={busy ? 'Lendo arquivo...' : '📎 Escolher arquivo (.md, .txt, .json)'}
              disabled={busy}
              onPress={pickFile}
            />
            {importError ? (
              <Card accent={colors.red + '44'}>
                <Txt variant="caption" color={colors.red}>{importError}</Txt>
              </Card>
            ) : null}
            <SecondaryButton label="📋 Colar o plano" onPress={() => setPastedOpen(true)} />
            <SecondaryButton color={colors.cyan} label="📄 Ver modelo de arquivo" onPress={() => setTemplateOpen(true)} />

            <Card style={{ gap: 6 }}>
              <Txt variant="h3">O que ele entende</Txt>
              <Muted>• Seções por área: <Txt variant="micro" color={colors.textPrimary}>## Treino</Txt>, <Txt variant="micro" color={colors.textPrimary}>## Estudo</Txt>…</Muted>
              <Muted>• Níveis na mesma linha: <Txt variant="micro" color={colors.textPrimary}>Treinar 5x | mín 3x | ideal 5x | excelente 6x | prioridade</Txt></Muted>
              <Muted>• Regras: <Txt variant="micro" color={colors.textPrimary}>SE … ENTÃO … PORQUE …</Txt></Muted>
              <Muted>• Recompensas: <Txt variant="micro" color={colors.textPrimary}>Delivery → 7 dias seguidos com score ≥ 7</Txt></Muted>
              <Muted>• Livros: <Txt variant="micro" color={colors.textPrimary}>Sapiens — Harari — 443 páginas — até página 120</Txt></Muted>
              <Muted>• Identidade, sono, finanças, peso e Ayanokoji</Muted>
              <Muted>• Backup do próprio app (JSON) restaura tudo, inclusive histórico</Muted>
            </Card>

            <Card style={{ gap: 4 }}>
              <Txt variant="micro" color={colors.textMuted}>O QUE ELE NÃO FAZ</Txt>
              <Muted>• Não lê PDF (binário): converta em .txt primeiro.</Muted>
              <Muted>• Não inventa identidade: "Quem sou" e "Não aceito mais" só saem de você.</Muted>
              <Muted>• Não duplica meta que já existe — ele avisa o que ignorou.</Muted>
            </Card>
          </>
        ) : (
          <>
            <Card accent={colors.green + '55'} style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Badge
                  label={
                    summary.source === 'backup'
                      ? 'backup completo'
                      : summary.source === 'plan-json'
                        ? 'plano json'
                        : 'plano em texto'
                  }
                  color={colors.green}
                />
                <Txt variant="micro" color={colors.textMuted}>{filename}</Txt>
              </Row>
              <Txt variant="h3">
                Encontrei {summary.goals.length} meta(s) em {summary.areas.length} área(s)
              </Txt>
              <Muted>
                {summary.rules.length} regra(s) · {summary.rewards.length} recompensa(s) · {summary.books.length} livro(s)
                {summary.counts.days ? ` · ${summary.counts.days} dia(s) de histórico` : ''}
                {summary.counts.finances ? ` · ${summary.counts.finances} lançamento(s)` : ''}
              </Muted>
            </Card>

            {summary.source === 'backup' ? (
              <Card accent={colors.red + '44'}>
                <Txt variant="caption" color={colors.red}>
                  Backup completo: confirmar substitui TODOS os dados atuais (inclusive histórico de hoje).
                </Txt>
              </Card>
            ) : null}

            {groupedGoals.length ? (
              <>
                <SectionTitle>Metas organizadas</SectionTitle>
                <Card style={{ gap: 8 }}>
                  {groupedGoals.map(([area, names]) => (
                    <View key={area} style={{ gap: 2 }}>
                      <Txt variant="caption" color={areaColor(area)}>{area}</Txt>
                      {names.map((n) => (
                        <Txt key={n} variant="micro" color={colors.textPrimary} style={{ textTransform: 'none', letterSpacing: 0 }}>
                          • {n}
                        </Txt>
                      ))}
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {summary.rules.length ? (
              <>
                <SectionTitle>Regras SE-ENTÃO</SectionTitle>
                <Card style={{ gap: 4 }}>
                  {summary.rules.map((r) => (
                    <Muted key={r.id}>• SE {r.trigger} → ENTÃO {r.action}{r.reason ? ` (porque ${r.reason})` : ''}</Muted>
                  ))}
                </Card>
              </>
            ) : null}

            {summary.rewards.length ? (
              <>
                <SectionTitle>Recompensas</SectionTitle>
                <Card style={{ gap: 4 }}>
                  {summary.rewards.map((r) => (
                    <Muted key={r.id}>• {r.name} — {r.criteria} ({r.target})</Muted>
                  ))}
                </Card>
              </>
            ) : null}

            {summary.books.length ? (
              <>
                <SectionTitle>Leitura</SectionTitle>
                <Card style={{ gap: 4 }}>
                  {summary.books.map((b) => (
                    <Muted key={b.id}>• {b.title}{b.author ? ` — ${b.author}` : ''}{b.totalPages ? ` · ${b.totalPages}p` : ''}</Muted>
                  ))}
                </Card>
              </>
            ) : null}

            {/* ── A LISTA TINTIM POR TINTIM ── */}
            <SectionTitle right={<Badge label={`${open.length + optional.length} pendente(s)`} color={colors.yellow} />}>
              Ainda falta você escrever
            </SectionTitle>
            {open.length === 0 && optional.length === 0 ? (
              <Card>
                <Txt variant="caption" color={colors.green}>Nada pendente: o arquivo trouxe tudo o que o app precisa.</Txt>
              </Card>
            ) : null}
            {open.map((p) => (
              <PendingCard key={p.id} item={p} />
            ))}
            {optional.length ? <Muted>Opcionais ({optional.length})</Muted> : null}
            {optional.map((p) => (
              <PendingCard key={p.id} item={p} />
            ))}

            {summary.skippedDuplicates.length ? (
              <Card>
                <Txt variant="micro" color={colors.textMuted}>JÁ EXISTIAM (NÃO DUPLIQUEI)</Txt>
                {summary.skippedDuplicates.map((s) => (
                  <Muted key={s}>• {s}</Muted>
                ))}
              </Card>
            ) : null}

            {summary.unknownSections.length ? (
              <Card>
                <Txt variant="micro" color={colors.textMuted}>SEÇÕES NÃO RECONHECIDAS</Txt>
                {summary.unknownSections.map((s) => (
                  <Muted key={s}>• {s} — renomeie para uma área conhecida se for uma meta</Muted>
                ))}
              </Card>
            ) : null}

            <PrimaryButton
              label={summary.source === 'backup' ? 'Restaurar backup completo' : 'Confirmar importação'}
              loading={busy}
              onPress={confirm}
            />
            <SecondaryButton
              label="Escolher outro arquivo"
              onPress={() => {
                setSummary(null);
                setText('');
              }}
            />
          </>
        )}
      </ScrollView>

      {/* Modelo */}
      <Sheet
        visible={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Modelo de arquivo"
        footer={
          <PrimaryButton
            label="Usar este modelo"
            onPress={() => {
              setTemplateOpen(false);
              analyze(PLAN_TEMPLATE, 'modelo.md');
            }}
          />
        }
      >
        <Muted>Copie, edite no seu editor e envie — ou use direto e ajuste depois no app.</Muted>
        <TextInput
          value={PLAN_TEMPLATE}
          editable={false}
          multiline
          style={{
            backgroundColor: colors.bgInput,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            color: colors.textSecondary,
            fontSize: 11,
            fontFamily: 'monospace',
            minHeight: 280,
            textAlignVertical: 'top',
          }}
        />
      </Sheet>

      {/* Colar texto */}
      <Sheet
        visible={pastedOpen}
        onClose={() => setPastedOpen(false)}
        title="Colar plano"
        footer={
          <PrimaryButton
            label="Analisar texto"
            disabled={text.trim().length < 10}
            onPress={() => {
              setPastedOpen(false);
              analyze(text, 'plano-colado.txt');
            }}
          />
        }
      >
        <Muted>Cole o plano inteiro. Ele divide por seções automaticamente.</Muted>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder={'# METAS\n## Treino\n- Treinar 5x | mín 3x | ideal 5x | excelente 6x | prioridade\n\n# REGRAS SE-ENTÃO\n- SE ... → ENTÃO ...'}
          placeholderTextColor={colors.textMuted}
          style={{
            backgroundColor: colors.bgInput,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            color: colors.textPrimary,
            minHeight: 220,
            textAlignVertical: 'top',
          }}
        />
      </Sheet>
    </View>
  );
}

function PendingCard({ item }: { item: PendingItem }) {
  const meta = SEVERITY_META[item.severity];
  return (
    <Card style={{ gap: 4, borderColor: meta.color + '55' }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="caption" color={colors.textPrimary} style={{ flex: 1, fontWeight: '600' }}>
          {item.title}
        </Txt>
        <Badge label={meta.label} color={meta.color} />
      </Row>
      <Muted>{item.why}</Muted>
      <Txt variant="micro" color={colors.green}>ONDE: {item.where}</Txt>
      {item.example ? <Muted style={{ color: colors.textMuted }}>ex: {item.example}</Muted> : null}
    </Card>
  );
}
