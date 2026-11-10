import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { areaColor, colors, spacing } from '../../src/theme';
import {
  Badge,
  Card,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  SecondaryButton,
  Sheet,
  Txt,
} from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { Heatmap, LineChart } from '../../src/components/charts';
import { useStore, newId } from '../../src/lib/store';
import { todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import type { Book } from '../../src/lib/types';

export default function ReadingScreen() {
  const store = useStore();
  const [sheet, setSheet] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [currentPage, setCurrentPage] = useState('');

  const books = store.books;
  const current = books.find((b) => !b.finished);
  const allLogs = books.flatMap((b) => b.log ?? []);
  const pagesThisYear = allLogs.filter((l) => l.date.startsWith(todayKey().slice(0, 4))).reduce((a, b) => a + b.pages, 0);

  const daysWithReading = Array.from(new Set(allLogs.map((l) => l.date))).sort();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const heat = last14.map((date) => ({
    date,
    score: daysWithReading.includes(date) ? 8 : null,
  }));

  const avgDaily = (() => {
    if (!allLogs.length) return 0;
    const byDate = new Map<string, number>();
    for (const l of allLogs) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.pages);
    return Array.from(byDate.values()).reduce((a, b) => a + b, 0) / byDate.size;
  })();

  const remainingPages = current ? Math.max(0, current.totalPages - current.currentPage) : 0;
  const daysToFinish = avgDaily > 0 ? Math.ceil(remainingPages / avgDaily) : null;

  const registerPages = (book: Book, pages: number) => {
    if (!book || pages <= 0) return;
    const nextPage = Math.min(book.totalPages, book.currentPage + pages);
    const updated: Book = {
      ...book,
      currentPage: nextPage,
      finished: nextPage >= book.totalPages,
      log: [...(book.log ?? []), { date: todayKey(), pages }],
    };
    store.updateBook(updated);
    haptic('success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="📚 Leitura" subtitle={`${pagesThisYear} páginas neste ano`} onAdd={() => setSheet(true)} addLabel="+ Livro" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        {current ? (
          <Card accent={areaColor('Leitura') + '55'} style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt variant="h3">{current.title}</Txt>
                <Muted>{current.author || 'Autor não informado'}</Muted>
              </View>
              <Badge label={`${current.currentPage}/${current.totalPages}p`} color={areaColor('Leitura')} />
            </Row>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track }}>
              <View
                style={{
                  width: `${Math.min(100, (current.currentPage / Math.max(1, current.totalPages)) * 100)}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: areaColor('Leitura'),
                }}
              />
            </View>
            <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
              {[5, 10, 20, 30].map((p) => (
                <SecondaryButton
                  key={p}
                  label={`+${p}p`}
                  style={{ height: 40, minWidth: 72 }}
                  color={areaColor('Leitura')}
                  onPress={() => registerPages(current, p)}
                />
              ))}
            </Row>
            <Muted>
              Meta diária: {current.dailyGoal.min} / {current.dailyGoal.ideal} / {current.dailyGoal.excellent} páginas
            </Muted>
            <Muted>
              {daysToFinish != null
                ? `No ritmo atual (${avgDaily.toFixed(1)} p/dia), termina em ~${daysToFinish} dia(s).`
                : 'Sem média diária suficiente para estimar.'}
            </Muted>
            <Row gap={spacing.md}>
              <Txt variant="micro" color={colors.yellow} onPress={() => store.updateBook({ ...current, finished: true, currentPage: current.totalPages })}>
                marcar concluído
              </Txt>
              <Txt variant="micro" color={colors.red} onPress={() => store.deleteBook(current.id)}>excluir</Txt>
            </Row>
          </Card>
        ) : (
          <Card>
            <Txt variant="h3">Nenhum livro em andamento</Txt>
            <Muted style={{ marginTop: 4 }}>Adicione um livro para acompanhar páginas, ritmo e previsão de término.</Muted>
            <PrimaryButton label="Adicionar livro" style={{ marginTop: spacing.md }} onPress={() => setSheet(true)} />
          </Card>
        )}

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Páginas acumuladas</Txt>
          {allLogs.length >= 3 ? (
            <LineChart
              labels={Array.from(new Set(allLogs.map((l) => l.date))).sort().map((d) => d.slice(8, 10))}
              series={[
                {
                  name: 'Páginas/dia',
                  color: areaColor('Leitura'),
                  points: Array.from(new Set(allLogs.map((l) => l.date)))
                    .sort()
                    .map((date) => allLogs.filter((l) => l.date === date).reduce((a, b) => a + b.pages, 0)),
                },
              ]}
              max={Math.max(10, ...allLogs.map((l) => l.pages))}
            />
          ) : (
            <NoData label="Gráficos a partir de 3 pontos de dado" />
          )}
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Heatmap de leitura (14 dias)</Txt>
          <Heatmap data={heat} cell={28} />
        </Card>

        <Txt variant="h3">Biblioteca</Txt>
        {books.length === 0 ? <NoData label="Sem livros cadastrados" /> : null}
        {books.map((b) => (
          <Card key={b.id} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="caption" color={colors.textPrimary}>{b.title}</Txt>
              <Badge label={b.finished ? 'concluído' : `${Math.round((b.currentPage / Math.max(1, b.totalPages)) * 100)}%`} color={b.finished ? colors.green : colors.textSecondary} />
            </Row>
            <Muted>{b.author || '—'} · {b.totalPages}p · lido até {b.currentPage}</Muted>
            {!b.finished ? (
              <Row gap={spacing.md}>
                <Txt variant="micro" color={areaColor('Leitura')} onPress={() => registerPages(b, 10)}>+10 páginas</Txt>
                <Txt variant="micro" color={colors.red} onPress={() => store.deleteBook(b.id)}>excluir</Txt>
              </Row>
            ) : null}
          </Card>
        ))}
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Novo livro"
        footer={
          <PrimaryButton
            label="Adicionar"
            disabled={!title.trim() || !Number(totalPages)}
            onPress={() => {
              store.addBook({
                id: newId('book'),
                title: title.trim(),
                author: author.trim(),
                totalPages: Number(totalPages) || 0,
                currentPage: Number(currentPage) || 0,
                dailyGoal: { min: 10, ideal: 20, excellent: 30 },
                finished: false,
                log: [],
              });
              setTitle('');
              setAuthor('');
              setTotalPages('');
              setCurrentPage('');
              setSheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Field label="Título" value={title} onChangeText={setTitle} />
        <Field label="Autor" value={author} onChangeText={setAuthor} />
        <Row gap={spacing.sm}>
          <Field label="Páginas totais" value={totalPages} onChangeText={setTotalPages} keyboardType="number-pad" style={{ flex: 1 }} />
          <Field label="Página atual" value={currentPage} onChangeText={setCurrentPage} keyboardType="number-pad" style={{ flex: 1 }} />
        </Row>
      </Sheet>
    </View>
  );
}
