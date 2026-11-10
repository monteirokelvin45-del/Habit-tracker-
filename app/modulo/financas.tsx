import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import {
  Card,
  Chip,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  Sheet,
  Txt,
  ToggleRow,
} from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { DonutChart, GroupedBars, LineChart } from '../../src/components/charts';
import { useStore, newId } from '../../src/lib/store';
import { todayKey, monthLabel, MONTHS_SHORT } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { FINANCE_CATEGORIES } from '../../src/lib/types';

const CATEGORY_COLORS = ['#FF6B35', '#4488FF', '#FF66AA', '#FF4444', '#888888', '#00FF88', '#AA66FF'];

export default function FinanceScreen() {
  const store = useStore();
  const [sheet, setSheet] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Alimentação');
  const [isImpulse, setIsImpulse] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());

  const monthK = todayKey().slice(0, 7);
  const monthEntries = store.finances.filter((f) => f.date.startsWith(monthK));

  const byMonth = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const f of store.finances) {
      const key = f.date.slice(0, 7);
      const item = map.get(key) ?? { income: 0, expense: 0 };
      if (f.type === 'income') item.income += f.amount;
      else item.expense += f.amount;
      map.set(key, item);
    }
    return Array.from(map.entries()).sort().slice(-6);
  }, [store.finances]);

  const balanceSeries = useMemo(() => {
    let acc = 0;
    return store.finances
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((f) => {
        acc += f.type === 'income' ? f.amount : -f.amount;
        return { date: f.date, value: acc };
      });
  }, [store.finances]);

  const expenseByCategory = FINANCE_CATEGORIES.map((cat, i) => ({
    label: cat,
    value: monthEntries.filter((f) => f.type === 'expense' && f.category === cat).reduce((a, b) => a + b.amount, 0),
    color: CATEGORY_COLORS[i] ?? colors.textSecondary,
  })).filter((c) => c.value > 0);

  const impulseWeek = store.finances
    .filter((f) => f.isImpulse && f.date >= addDaysKey(todayKey(), -6))
    .reduce((a, b) => a + b.amount, 0);

  // "Y dias de [meta]": compara o impulso com o custo médio diário declarado no diário.
  const dailyCostRef = (() => {
    const costs = store.days
      .flatMap((d) => d.tasks.map((t) => t.cost ?? ''))
      .map((c) => /R\$?\s*(\d+(?:[.,]\d+)?)/.exec(c)?.[1])
      .map((v) => (v ? Number(v.replace(',', '.')) : 0))
      .filter((v) => v > 0);
    if (!costs.length) return null;
    return costs.reduce((a, b) => a + b, 0) / costs.length;
  })();
  const impulseDaysEquivalent =
    impulseWeek > 0 && dailyCostRef
      ? `≈ ${Math.max(1, Math.round(impulseWeek / dailyCostRef))} custo(s) de oportunidade registrado(s)`
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="💰 Finanças" subtitle={`${monthLabel(todayKey())} · ${monthEntries.length} lançamentos`} onAdd={() => setSheet(true)} addLabel="+ Lançamento" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Row gap={spacing.sm}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Receitas do mês</Txt>
            <Txt variant="h3" color={colors.green}>
              R$ {monthEntries.filter((f) => f.type === 'income').reduce((a, b) => a + b.amount, 0).toFixed(0)}
            </Txt>
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Despesas do mês</Txt>
            <Txt variant="h3" color={colors.red}>
              R$ {monthEntries.filter((f) => f.type === 'expense').reduce((a, b) => a + b.amount, 0).toFixed(0)}
            </Txt>
          </Card>
        </Row>

        <Card accent={colors.red + '33'}>
          <Txt variant="caption" color={colors.red}>
            Gastos por impulso esta semana: R$ {impulseWeek.toFixed(0)}
            {impulseDaysEquivalent ? ` (${impulseDaysEquivalent})` : ''}
          </Txt>
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Receita vs despesa (6 meses)</Txt>
          {byMonth.length ? (
            <GroupedBars
              data={byMonth.map(([key, v]) => ({ label: MONTHS_SHORT[Number(key.slice(5, 7)) - 1] ?? key, a: v.income, b: v.expense }))}
            />
          ) : (
            <NoData label="Sem lançamentos" />
          )}
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Despesas por categoria (mês)</Txt>
          <DonutChart data={expenseByCategory} />
        </Card>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Saldo acumulado</Txt>
          {balanceSeries.length >= 3 ? (
            <LineChart
              labels={balanceSeries.map((b) => b.date.slice(8, 10))}
              series={[{ name: 'Saldo', color: colors.cyan, points: balanceSeries.map((b) => b.value) }]}
              max={Math.max(100, ...balanceSeries.map((b) => b.value))}
            />
          ) : (
            <NoData label="Gráficos a partir de 3 pontos de dado" />
          )}
        </Card>

        <Txt variant="h3">Lançamentos recentes</Txt>
        {store.finances.length === 0 ? <NoData label="Nenhum lançamento" /> : null}
        {store.finances
          .slice()
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .slice(0, 12)
          .map((f) => (
            <Card key={f.id} style={{ padding: spacing.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="caption" color={colors.textPrimary}>
                    {f.category} {f.isImpulse ? '⚡' : ''}
                  </Txt>
                  <Muted>{f.date} {f.note ? `· ${f.note}` : ''}</Muted>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="caption" color={f.type === 'income' ? colors.green : colors.red}>
                    {f.type === 'income' ? '+' : '-'} R$ {f.amount.toFixed(2)}
                  </Txt>
                  <Txt variant="micro" color={colors.textMuted} onPress={() => store.deleteFinance(f.id)}>excluir</Txt>
                </View>
              </Row>
            </Card>
          ))}
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Novo lançamento"
        footer={
          <PrimaryButton
            label="Registrar"
            disabled={!Number(amount)}
            onPress={() => {
              store.addFinance({
                id: newId('fin'),
                date,
                type,
                amount: Number(amount) || 0,
                category,
                isImpulse,
                note: note.trim(),
              });
              setAmount('');
              setNote('');
              setIsImpulse(false);
              setSheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Row gap={spacing.sm}>
          <Chip label="Despesa" color={colors.red} selected={type === 'expense'} onPress={() => setType('expense')} />
          <Chip label="Receita" color={colors.green} selected={type === 'income'} onPress={() => setType('income')} />
        </Row>
        <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
        <Txt variant="caption" color={colors.textSecondary}>Categoria</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FINANCE_CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <ToggleRow label="Gasto por impulso" sub="Marca para o cálculo de custo real" value={isImpulse} onChange={setIsImpulse} />
        <Field label="Nota" value={note} onChangeText={setNote} placeholder="opcional" />
        <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} />
      </Sheet>
    </View>
  );
}

function addDaysKey(key: string, n: number): string {
  const d = new Date(key);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
