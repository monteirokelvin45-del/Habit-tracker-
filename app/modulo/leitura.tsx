import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '../../src/components/ModalHeader';
import { Icon } from '../../src/components/Icon';
import { Badge, Card, Muted, PrimaryButton, Row, SecondaryButton, Sheet, Txt } from '../../src/components/ui';
import { colors, radius, spacing, useTheme } from '../../src/theme';
import { useStore } from '../../src/lib/store';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import {
  applyPages,
  bookPercent,
  daysToFinish,
  pagesPerDay,
  progressSeries,
  type BookProgress,
} from '../../src/lib/reading';
import { LineChart } from '../../src/components/charts';

/**
 * Detalhamento da área LEITURA.
 *
 * Livro em andamento com progresso real, contador do dia, citação/reflexão e
 * biblioteca (fila + concluídos). Estimativa de conclusão só com velocidade
 * medida — sem dado, diz que não tem.
 */
export default function LeituraScreen() {
  useTheme();
  const store = useStore();
  const today = todayKey();

  const day = store.days.find((d) => d.date === today);
  const diary = (day?.diary ?? {}) as { book?: BookProgress };

  /**
   * Livro em andamento.
   *
   * O padrão é o livro que já existe na biblioteca da pessoa (com o total de
   * páginas DELA). Antes o fallback criava um livro com `totalPages: 350` — um
   * número inventado que aparecia como "pág. 0 de 350" e "0%" para quem nunca
   * cadastrou livro nenhum.
   */
  const firstBook = store.books.find((b) => !b.finished);
  const [book, setBook] = useState<BookProgress>(
    diary.book ?? {
      title: firstBook?.title ?? '',
      author: firstBook?.author ?? '',
      totalPages: firstBook?.totalPages ?? 0,
      currentPage: firstBook?.currentPage ?? 0,
      todayPages: 0,
    },
  );
  const [inputPage, setInputPage] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const [quoteOpen, setQuoteOpen] = useState(false);

  /* histórico real: dias com página registrada */
  const history = useMemo(
    () =>
      store.days
        .map((d) => {
          const b = d.diary.book as BookProgress | undefined;
          return b ? { date: d.date, page: b.currentPage } : null;
        })
        .filter((p): p is { date: string; page: number } => !!p),
    [store.days],
  );

  const speed = pagesPerDay(history);
  const estimate = daysToFinish(book, speed, today);
  const percent = bookPercent(book);

  const commit = (next: BookProgress) => {
    setBook(next);
    store.patchDiary(today, { book: next });
    haptic('light');
  };

  const series = progressSeries(history);
  const queue = store.books.filter((b) => !b.finished);
  const finished = store.books.filter((b) => b.finished);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPrimary }} edges={['top']}>
      <ModalHeader
        title="Leitura"
        subtitle={book.title || 'Livro em andamento'}
        onAdd={() => setQuoteOpen(true)}
        addLabel="Citação"
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        {/* LIVRO */}
        <Card style={{ gap: spacing.md }}>
          <Row gap={spacing.md} style={{ alignItems: 'flex-start' }}>
            <View
              style={{
                width: 58,
                height: 82,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.borderAccent,
                backgroundColor: colors.bgElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="leitura" size={22} color={colors.cyan} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <TextInput
                value={book.title}
                onChangeText={(v) => setBook({ ...book, title: v })}
                placeholder="Título do livro"
                placeholderTextColor={colors.textMuted}
                style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}
              />
              <TextInput
                value={book.author}
                onChangeText={(v) => setBook({ ...book, author: v })}
                placeholder="Autor"
                placeholderTextColor={colors.textMuted}
                style={{ color: colors.textSecondary, fontSize: 13 }}
              />
              <Badge
                label={book.totalPages > 0 ? `pág. ${book.currentPage} de ${book.totalPages}` : 'total de páginas não informado'}
                color={colors.cyan}
              />
            </View>
          </Row>

          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${(percent ?? 0) * 100}%`, backgroundColor: colors.cyan }} />
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption" color={colors.cyan}>
              {percent == null ? 'Sem dado' : `${Math.round(percent * 100)}%`}
            </Txt>
            <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
              {estimate.label}
            </Txt>
          </Row>
        </Card>

        {/* META DO DIA */}
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
                Páginas hoje
              </Txt>
              <Txt variant="h1" color={colors.cyan}>
                {book.todayPages}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                {speed == null ? 'velocidade: sem dado' : `${speed} pág/dia`}
              </Txt>
              <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                {book.totalPages > 0 ? `${Math.max(0, book.totalPages - book.currentPage)} páginas restantes` : 'páginas restantes: sem dado'}
              </Txt>
            </View>
          </Row>

          <Row gap={spacing.sm}>
            <SecondaryButton
              label="−5"
              color={colors.textSecondary}
              style={{ flex: 1 }}
              onPress={() => commit(applyPages(book, -5))}
            />
            <SecondaryButton
              label="+5"
              color={colors.cyan}
              style={{ flex: 1 }}
              onPress={() => commit(applyPages(book, 5))}
            />
            <SecondaryButton
              label="+10"
              color={colors.cyan}
              style={{ flex: 1 }}
              onPress={() => commit(applyPages(book, 10))}
            />
          </Row>
          <Pressable onPress={() => setInputPage((v) => !v)}>
            <Txt variant="caption" color={colors.textSecondary}>
              {inputPage ? 'fechar' : 'digitar página exata'}
            </Txt>
          </Pressable>
          {inputPage ? (
            <Row gap={spacing.sm}>
              <TextInput
                value={pageInput}
                onChangeText={setPageInput}
                keyboardType="number-pad"
                placeholder={`até ${book.totalPages}`}
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
              <PrimaryButton
                label="Ir"
                onPress={() => {
                  const target = Number(pageInput);
                  if (!Number.isFinite(target)) return;
                  commit({ ...book, currentPage: Math.min(book.totalPages, Math.max(0, target)) });
                  setPageInput('');
                  setInputPage(false);
                }}
              />
            </Row>
          ) : null}

          <Row gap={spacing.sm}>
            <View style={{ flex: 1 }}>
              <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                total de páginas
              </Txt>
              <TextInput
                value={String(book.totalPages)}
                onChangeText={(v) => setBook({ ...book, totalPages: Math.max(1, Number(v.replace(/\D/g, '')) || 1) })}
                keyboardType="number-pad"
                style={{
                  backgroundColor: colors.bgInput,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  color: colors.textPrimary,
                }}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                citação marcante
              </Txt>
              <TextInput
                value={book.quote ?? ''}
                onChangeText={(v) => setBook({ ...book, quote: v })}
                placeholder="trecho que vale registrar"
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.bgInput,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  color: colors.textPrimary,
                }}
              />
            </View>
          </Row>
          <TextInput
            value={book.reflection ?? ''}
            onChangeText={(v) => setBook({ ...book, reflection: v })}
            placeholder="Reflexão prática: o que eu faço diferente por causa disso?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              backgroundColor: colors.bgInput,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              color: colors.textPrimary,
              minHeight: 76,
              textAlignVertical: 'top',
              fontSize: 14,
            }}
          />
          <PrimaryButton label="Salvar leitura" onPress={() => commit(book)} />
        </Card>

        {/* HISTÓRICO */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Progresso registrado
          </Txt>
          {series.points.length < 2 ? (
            <Muted>Sem dado — 2 registros de página em dias diferentes liberam o gráfico.</Muted>
          ) : (
            <LineChart
              series={[{ name: 'página', color: colors.cyan, points: series.points }]}
              labels={series.labels}
              max={Math.max(book.totalPages, ...series.points)}
              height={140}
            />
          )}
        </Card>

        {/* BIBLIOTECA */}
        <Card style={{ gap: spacing.sm }}>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Fila de leitura
          </Txt>
          {queue.length === 0 ? (
            <Muted>Sem dado — nenhum livro na fila.</Muted>
          ) : (
            queue.slice(0, 5).map((b) => (
              <Row key={b.id} gap={spacing.sm}>
                <Icon name="fila" size={13} color={colors.textMuted} />
                <Txt variant="caption" color={colors.textPrimary} style={{ flex: 1 }} numberOfLines={1}>
                  {b.title}
                </Txt>
                <Txt variant="micro" color={colors.textMuted} onPress={() => store.updateBook({ ...b, finished: true })}>
                  concluir
                </Txt>
              </Row>
            ))
          )}
          <Txt
            variant="micro"
            color={colors.cyan}
            onPress={() =>
              store.addBook({
                id: `${Date.now()}`,
                title: book.title || 'Novo livro',
                author: book.author,
                totalPages: book.totalPages,
                currentPage: 0,
                dailyGoal: { min: 5, ideal: 20, excellent: 40 },
                finished: false,
              })
            }
          >
            + adicionar à fila
          </Txt>
        </Card>

        <Card>
          <Txt variant="micro" color={colors.textSecondary} style={{ letterSpacing: 2 }}>
            Concluídos
          </Txt>
          {finished.length === 0 ? (
            <Muted style={{ marginTop: 4 }}>Sem dado — nenhum livro concluído.</Muted>
          ) : (
            finished.slice(-5).map((b) => (
              <Row key={b.id} gap={spacing.sm} style={{ marginTop: 4 }}>
                <Icon name="trofeu" size={13} color={colors.green} />
                <Txt variant="caption" color={colors.textPrimary} style={{ flex: 1 }} numberOfLines={1}>
                  {b.title}
                </Txt>
                <Txt variant="micro" color={colors.textMuted} style={{ letterSpacing: 0 }}>
                  {b.log?.length ? b.log[b.log.length - 1]!.date : 'sem data'}
                </Txt>
              </Row>
            ))
          )}
        </Card>
      </ScrollView>

      <Sheet visible={quoteOpen} onClose={() => setQuoteOpen(false)} title="Citação marcante">
        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <TextInput
            value={book.quote ?? ''}
            onChangeText={(v) => setBook({ ...book, quote: v })}
            placeholder="Trecho do livro"
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
            }}
          />
          <PrimaryButton
            label="Salvar citação"
            onPress={() => {
              commit(book);
              setQuoteOpen(false);
            }}
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
