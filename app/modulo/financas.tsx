/**
 * Finanças — Bento Grid "Dark Neon Blue".
 *
 * Regras que valem em toda esta tela:
 *  1. Nenhum número é inventado. Sem lançamento, o card escreve "Sem dado"
 *     (não R$ 0, não uma barra de exemplo).
 *  2. O app NÃO guarda dado de cartão: o número mascarado no cartão de saldo é
 *     decorativo e fixo — não vem de lugar nenhum.
 *  3. Mês sem dado não vira zero: na linha e nas barras o ponto fica `null`,
 *     o que quebra a linha e deixa a barra oca.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { accent, onAccent, radius, spacing, useTheme } from '../../src/theme';
import {
  Chip,
  Field,
  Muted,
  NoData,
  PrimaryButton,
  Row,
  SecondaryButton,
  Sheet,
  Txt,
  ToggleRow,
} from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import {
  ActivityRow,
  BalanceCard,
  BalanceRings,
  Bento,
  Glow,
  IncomeBars,
  IncomeOutcomeChart,
  type LineSeries,
  RingsLegend,
  ThinBar,
  WeekStrip,
  type WeekDay,
} from '../../src/components/BentoFinance';
import { useStore, newId } from '../../src/lib/store';
import { addDays, formatBRL, monthLabel, MONTHS_SHORT, todayKey, WEEKDAYS_SHORT } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { FINANCE_CATEGORIES } from '../../src/lib/types';
import {
  BUCKETS,
  DEFAULT_SPLIT,
  bucketOf,
  bucketTargets,
  expenseOf,
  incomeOf,
  daysUntilFirstWant,
  impulseCostInFutureDays,
  paydayCheck,
} from '../../src/lib/finance';

/**
 * Valor monetário seguro. Um backup antigo/editado pode trazer `null` (o que
 * `JSON.stringify(NaN)` grava) ou número em texto: sem isto, `.toFixed` derruba
 * a tela inteira. Registro ilegível não vira R$ 0 — a tela avisa e ignora.
 */
function money(value: unknown): number {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.').trim()) : Number.NaN;
  return Number.isFinite(n) ? n : 0;
}

function isBrokenMoney(value: unknown): boolean {
  return !Number.isFinite(typeof value === 'number' ? value : Number(String(value).replace(',', '.')));
}

/** "12 jan" a partir de `YYYY-MM-DD`. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function FinanceScreen() {
  const t = useTheme();
  const store = useStore();
  const [sheet, setSheet] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Alimentação');
  const [impulseWhy, setImpulseWhy] = useState('');
  const [isImpulse, setIsImpulse] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayKey());
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [cardSheet, setCardSheet] = useState(false);
  const [period, setPeriod] = useState<'mes' | 'ano'>('mes');
  const [last4Draft, setLast4Draft] = useState(store.settings.cardLast4 ?? '');

  const monthK = todayKey().slice(0, 7);
  const monthEntries = store.finances.filter((f) => f.date.startsWith(monthK));
  const brokenCount = store.finances.filter((f) => isBrokenMoney(f.amount)).length;

  /* ───────────────────────────── números do mês ───────────────────────────── */

  // Regra de receita/despesa mora na lib (`incomeOf`/`expenseOf`), testada lá.
  // A versão local desta tela somava TUDO no cartão "Renda {ano}".
  const monthIncome = incomeOf(monthEntries);
  const monthExpense = expenseOf(monthEntries);

  // Saldo: só existe se houve algum lançamento no mês. Dois "vazios" não são zero.
  const monthBalance = monthEntries.length === 0 ? null : monthIncome - monthExpense;

  const byMonth = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const f of store.finances) {
      const key = f.date.slice(0, 7);
      const item = map.get(key) ?? { income: 0, expense: 0 };
      if (f.type === 'income') item.income += money(f.amount);
      else item.expense += money(f.amount);
      map.set(key, item);
    }
    return Array.from(map.entries()).sort().slice(-6);
  }, [store.finances]);

  /* ───────────────────────────── seletor semanal ───────────────────────────── */

  const weekDays: WeekDay[] = useMemo(() => {
    const today = todayKey();
    // Semana que termina hoje (7 dias), para o dia atual ser o último selecionável.
    return Array.from({ length: 7 }).map((_, i) => {
      const key = addDays(today, i - 6);
      const dow = new Date(`${key}T12:00:00`).getDay();
      return {
        date: key,
        weekday: WEEKDAYS_SHORT[dow] ?? '',
        day: Number(key.slice(8, 10)),
        hasEntries: store.finances.some((f) => f.date === key),
      };
    });
  }, [store.finances]);

  const dayEntries = dayFilter ? store.finances.filter((f) => f.date === dayFilter) : [];

  /* ───────────────────────────── baldes / pagamento ───────────────────────────── */

  const buckets = bucketTargets(store.finances, monthK, DEFAULT_SPLIT);
  const payday = paydayCheck(store.finances, monthK, DEFAULT_SPLIT);
  const firstWantIn = daysUntilFirstWant(store.finances, monthK);
  const impulseWeek = store.finances
    .filter((f) => f.isImpulse && f.date >= addDays(todayKey(), -6))
    .reduce((a, b) => a + money(b.amount), 0);
  const impulseInFutureDays = impulseCostInFutureDays(store.finances, monthK, DEFAULT_SPLIT);

  /* ───────────────────────────── séries dos gráficos ───────────────────────────── */

  // Linha "renda x despesa": 6 meses. `null` onde não houve lançamento nenhum.
  const lineLabels = byMonth.map(([key]) => MONTHS_SHORT[Number(key.slice(5, 7)) - 1] ?? key);
  const lineSeries: LineSeries[] = [
    {
      key: 'income',
      label: 'Renda',
      color: accent(),
      points: byMonth.map(([, v]) => (v.income > 0 ? v.income : null)),
    },
    {
      key: 'expense',
      label: 'Despesa',
      color: t.green,
      points: byMonth.map(([, v]) => (v.expense > 0 ? v.expense : null)),
    },
  ];

  /**
   * Barras anuais: 12 meses do ano corrente, só de RECEITA.
   *
   * O card se chama "Renda {ano}", então somar receita + despesa (o que a versão
   * anterior fazia, com todos os lançamentos) imprime um número que não é renda.
   * Mês sem lançamento é `null` (barra oca), não R$ 0.
   */
  const yearBars = useMemo(() => {
    const year = todayKey().slice(0, 4);
    return Array.from({ length: 12 }).map((_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`;
      const entries = store.finances.filter((f) => f.date.startsWith(key));
      const income = incomeOf(entries);
      return { month: MONTHS_SHORT[i] ?? key, value: entries.length === 0 || income <= 0 ? null : income, key };
    });
  }, [store.finances]);
  const yearTotal = yearBars.reduce((a, b) => a + (b.value ?? 0), 0);
  const yearLabel = todayKey().slice(0, 4);

  // Variação do mês contra o anterior — só com os dois lados preenchidos.
  const variation = useMemo(() => {
    const prevKey = (() => {
      const d = addDays(`${monthK}-01`, -1);
      return d.slice(0, 7);
    })();
    const prev = store.finances.filter((f) => f.date.startsWith(prevKey));
    if (!monthEntries.length || !prev.length) return null;
    const prevIncome = incomeOf(prev);
    if (prevIncome <= 0) return null;
    return ((monthIncome - prevIncome) / prevIncome) * 100;
  }, [store.finances, monthK]);

  /* ───────────────────────────── lista de atividades ───────────────────────────── */

  const periodPrefix = period === 'mes' ? monthK : todayKey().slice(0, 4);
  const recent = store.finances
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .filter((f) => {
      if (!f.date.startsWith(periodPrefix)) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return `${f.category} ${f.note ?? ''} ${f.date}`.toLowerCase().includes(q);
    })
    .slice(0, 8);

  /* ───────────────────────────── tela ───────────────────────────── */

  return (
    <View style={{ flex: 1, backgroundColor: t.bgPrimary }}>
      <ModalHeader
        title="💠 Finanças"
        subtitle={`${monthLabel(todayKey())} · ${monthEntries.length} lançamento(s)`}
        onAdd={() => setSheet(true)}
        addLabel="+ Lançamento"
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        {brokenCount > 0 ? (
          <Bento tone="danger">
            <Txt variant="caption" color={t.yellow}>
              {brokenCount === 1
                ? '1 lançamento sem valor legível foi ignorado nas somas (o registro continua na lista).'
                : `${brokenCount} lançamentos sem valor legível foram ignorados nas somas (os registros continuam na lista).`}
            </Txt>
            <Muted>Corrija ou exclua esses lançamentos para as somas voltarem a fechar.</Muted>
          </Bento>
        ) : null}

        {/* 1. Saldo + 2. Semana */}
        <View style={{ position: 'relative' }}>
          <Glow color={accent()} size={150} style={{ position: 'absolute', right: -50, top: -50 }} />
          <BalanceCard
            balance={monthBalance}
            label={monthBalance == null ? 'Saldo do mês' : `Saldo de ${monthLabel(todayKey())}`}
            caption={monthBalance == null ? 'Nenhum lançamento no mês' : `${monthEntries.length} lançamento(s)`}
            last4={store.settings.cardLast4 ?? null}
            onEditNumber={() => {
              haptic('light');
              setLast4Draft(store.settings.cardLast4 ?? '');
              setCardSheet(true);
            }}
            onCopy={
              store.settings.cardLast4
                ? async () => {
                    // Sem dependência nova de clipboard: Share é nativo e serve
                    // para mandar os 4 dígitos para onde o usuário quiser.
                    try {
                      await Share.share({ message: `Cartão terminando em ${store.settings.cardLast4}` });
                      haptic('success');
                    } catch {
                      haptic('warning');
                    }
                  }
                : undefined
            }
          />
        </View>

        <Bento>
          <Muted style={{ marginBottom: spacing.sm }}>Últimos 7 dias</Muted>
          <WeekStrip
            days={weekDays}
            selected={dayFilter}
            onSelect={(d) => {
              haptic('light');
              setDayFilter(d);
            }}
            onOpenDay={() => undefined}
          />
          {dayFilter ? (
            <View style={{ marginTop: spacing.md, gap: 6 }}>
              <Txt variant="caption" color={t.textSecondary}>
                {shortDate(dayFilter)} · {dayEntries.length === 0 ? 'nenhum lançamento' : `${dayEntries.length} lançamento(s)`}
              </Txt>
              {dayEntries.length === 0 ? <NoData label="Nada registrado nesse dia" /> : null}
              {dayEntries.map((f) => (
                <Row key={f.id} style={{ justifyContent: 'space-between' }}>
                  <Txt variant="micro" color={t.textMuted}>
                    {f.category}
                  </Txt>
                  <Txt variant="micro" color={f.type === 'income' ? t.green : t.red}>
                    {f.type === 'income' ? '+' : '-'} {isBrokenMoney(f.amount) ? 'valor ilegível' : formatBRL(money(f.amount))}
                  </Txt>
                </Row>
              ))}
            </View>
          ) : null}
        </Bento>

        {/* 3. Anéis concêntricos: uso x alvo dos baldes */}
        <Bento>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Txt variant="h3">Balanço</Txt>
              <Muted>{monthLabel(todayKey())} · uso x alvo por balde</Muted>
            </View>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent() }} />
          </Row>
          <View style={{ marginTop: spacing.md }}>
            {buckets.every((b) => b.target == null) ? (
              <NoData label="Sem renda registrada no mês — não há alvo para medir" />
            ) : (
              (() => {
                const rings = buckets.map((b) => ({
                  key: b.key,
                  label: b.label,
                  ratio: b.ratio,
                  valueText: b.target == null ? 'Sem dado' : `${formatBRL(b.used)} / ${formatBRL(b.target)}`,
                }));
                return (
                  <View style={{ alignItems: 'center', gap: spacing.md }}>
                    {/* Centro livre, com o rótulo dentro: é o que dá o "respiro" da referência. */}
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <BalanceRings rings={rings} size={196} />
                      <View style={{ position: 'absolute', alignItems: 'center', width: 96 }}>
                        <Txt variant="micro" color={t.textMuted} style={{ fontSize: 9 }}>
                          usado
                        </Txt>
                        <Txt variant="h3" color={t.textPrimary}>
                          {monthExpense > 0 && monthIncome > 0
                            ? `${Math.round((monthExpense / monthIncome) * 100)}%`
                            : 'Sem dado'}
                        </Txt>
                        <Txt variant="micro" color={t.textMuted} upper={false} style={{ fontSize: 9, textAlign: 'center' }}>
                          da renda
                        </Txt>
                      </View>
                    </View>
                    <View style={{ alignSelf: 'stretch' }}>
                      <RingsLegend rings={rings} />
                    </View>
                  </View>
                );
              })()
            )}
          </View>
        </Bento>

        {/* 4. Renda x despesa (linha com tooltip) */}
        <Bento>
          <Txt variant="h3">Renda e despesa</Txt>
          <Muted style={{ marginBottom: spacing.sm }}>Últimos 6 meses com lançamento</Muted>
          {byMonth.length >= 2 ? (
            <IncomeOutcomeChart
              labels={lineLabels}
              series={lineSeries}
              formatValue={(v) => formatBRL(v)}
              selectedIndex={tooltipIndex}
              onSelectIndex={setTooltipIndex}
            />
          ) : (
            <NoData label="Gráfico a partir de 2 meses com lançamento" />
          )}
        </Bento>

        {/* 5. Barras do ano + 6. Inbox/impulso */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Bento style={{ flex: 1 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt variant="caption" color={t.textPrimary}>
                Renda {yearLabel}
              </Txt>
              {variation == null ? null : (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: radius.pill,
                    backgroundColor: (variation >= 0 ? t.green : t.red) + '22',
                    borderWidth: 1,
                    borderColor: (variation >= 0 ? t.green : t.red) + '44',
                  }}
                >
                  <Txt variant="micro" color={variation >= 0 ? t.green : t.red} style={{ fontSize: 9 }}>
                    {variation >= 0 ? '+' : ''}
                    {variation.toFixed(0)}% vs mês anterior
                  </Txt>
                </View>
              )}
            </Row>
            <Txt variant="h3" style={{ marginTop: 2 }}>
              {yearTotal > 0 ? formatBRL(yearTotal) : 'Sem dado'}
            </Txt>
            <View style={{ marginTop: spacing.sm }}>
              <IncomeBars
                data={yearBars}
                highlighted={pickedMonth}
                onSelect={(m) => {
                  haptic('light');
                  setPickedMonth((prev) => (prev === m ? null : m));
                }}
              />
            </View>
            {pickedMonth ? (
              <Muted style={{ marginTop: 6 }}>
                {pickedMonth}:{' '}
                {yearBars.find((b) => b.month === pickedMonth)?.value == null
                  ? 'sem lançamento'
                  : formatBRL(yearBars.find((b) => b.month === pickedMonth)?.value ?? 0)}
              </Muted>
            ) : (
              <Muted style={{ marginTop: 6 }}>Toque numa barra para ver o mês.</Muted>
            )}
          </Bento>

          <Bento style={{ width: 128 }} tone={impulseWeek > 0 ? 'danger' : 'plain'}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                backgroundColor: accent() + '22',
                borderWidth: 1,
                borderColor: accent() + '44',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt variant="caption" color={accent()}>
                ⚡
              </Txt>
            </View>
            <Txt variant="caption" color={t.textPrimary} style={{ marginTop: spacing.sm }}>
              Impulso
            </Txt>
            <Muted>7 dias</Muted>
            <Txt variant="caption" color={impulseWeek > 0 ? t.red : t.textSecondary} style={{ marginTop: 2 }}>
              {impulseWeek > 0 ? formatBRL(impulseWeek) : 'Sem dado'}
            </Txt>
          </Bento>
        </View>

        {/* 7. Três baldes (detalhe com barra) */}
        <Bento>
          <Txt variant="h3">Três baldes do mês</Txt>
          <Muted>
            Divisão {BUCKETS.map((b) => `${DEFAULT_SPLIT[b.key]}% ${b.label}`).join(' · ')} da renda do mês. O balde
            Futuro sai no dia do pagamento, não no fim do mês.
          </Muted>
          {buckets.map((b) => (
            <View key={b.key} style={{ marginTop: spacing.md, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" color={t.textPrimary}>
                  {b.label} · {b.percent}%
                </Txt>
                <Txt
                  variant="caption"
                  color={b.ratio == null ? t.textMuted : b.ratio > 1 ? t.red : t.green}
                >
                  {b.target == null ? 'Sem dado' : `${formatBRL(b.used)} / ${formatBRL(b.target)}`}
                </Txt>
              </Row>
              {b.ratio == null ? (
                <Muted>Sem renda registrada no mês — alvo não calculado.</Muted>
              ) : (
                <>
                  <ThinBar ratio={b.ratio} color={b.ratio > 1 ? t.red : accent()} />
                  <Muted>
                    {b.left == null
                      ? 'Sem dado'
                      : b.left >= 0
                        ? `Sobra ${formatBRL(b.left)} no balde`
                        : `Estourou ${formatBRL(Math.abs(b.left))} do balde`}
                  </Muted>
                </>
              )}
            </View>
          ))}
        </Bento>

        {/* 8. Regra do dia de pagamento */}
        <Bento tone={(payday?.gap ?? 0) < 0 ? 'danger' : 'plain'}>
          <Txt variant="h3">Dia de pagamento</Txt>
          {payday == null ? (
            <NoData label="Sem receita registrada neste mês — a regra só mede a partir do dia do pagamento" />
          ) : (
            <>
              <Txt variant="caption" color={t.textPrimary} style={{ marginTop: 4 }}>
                Pagamento em {shortDate(payday.date)} · {formatBRL(money(payday.received))}
              </Txt>
              {payday.expected.map((e) => (
                <Row key={e.key} style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <Txt variant="caption" color={t.textSecondary}>
                    Separar em {e.label}
                  </Txt>
                  <Txt variant="caption" color={t.textPrimary}>
                    {formatBRL(money(e.amount))}
                  </Txt>
                </Row>
              ))}
              <Muted style={{ marginTop: spacing.sm }}>{payday.verdict}</Muted>
              <Muted>
                {firstWantIn == null
                  ? 'Sem dado de gasto de vontade neste mês.'
                  : `Primeiro gasto de vontade: ${firstWantIn} dia(s) depois do pagamento.`}
              </Muted>
              <Muted>
                {impulseInFutureDays == null
                  ? 'Sem dado de reserva para medir o impulso em dias de Futuro.'
                  : impulseInFutureDays === 0
                    ? 'Nenhum impulso no mês: o balde Futuro está intacto.'
                    : `Impulso equivale a ${impulseInFutureDays.toFixed(1)} dia(s) de reserva do Futuro.`}
              </Muted>
            </>
          )}
        </Bento>

        {/* 9. Envelope/sobra por categoria do mês */}
        <Bento>
          <Txt variant="h3">Categorias do mês</Txt>
          {monthEntries.filter((f) => f.type === 'expense').length === 0 ? (
            <NoData label="Sem despesa lançada neste mês" />
          ) : (
            (() => {
              const total = expenseOf(monthEntries);
              // `.filter(Boolean)` no fim: sem ele a lista tem `null` nos
              // lugares das categorias sem despesa, e o React avisa "unique key".
              return FINANCE_CATEGORIES.map((cat) => {
                const value = monthEntries
                  .filter((f) => f.type === 'expense' && f.category === cat)
                  .reduce((a, b) => a + money(b.amount), 0);
                if (value <= 0) return null;
                return (
                  <View key={cat} style={{ marginTop: spacing.sm, gap: 4 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt variant="caption" color={t.textPrimary}>
                        {cat}
                      </Txt>
                      <Txt variant="caption" color={t.textSecondary}>
                        {formatBRL(value)} · {Math.round((value / total) * 100)}%
                      </Txt>
                    </Row>
                    <ThinBar ratio={total > 0 ? value / total : null} color={accent()} />
                  </View>
                );
              }).filter(Boolean);
            })()
          )}
        </Bento>

        {/* 10. Atividades recentes */}
        <Bento>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Txt variant="h3">Atividade recente</Txt>
            <Row gap={6}>
              {(['mes', 'ano'] as const).map((p) => (
                <Txt
                  key={p}
                  variant="micro"
                  color={period === p ? accent() : t.textMuted}
                  onPress={() => {
                    haptic('light');
                    setPeriod(p);
                  }}
                  style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                >
                  {p === 'mes' ? 'mês' : 'ano'}
                </Txt>
              ))}
            </Row>
          </Row>
          {store.finances.length === 0 ? <NoData label="Nenhum lançamento" /> : null}
          {store.finances.length > 0 && recent.length === 0 ? <NoData label="Nada encontrado na busca" /> : null}
          <View style={{ gap: spacing.sm }}>
            {recent.map((f) => (
              <ActivityRow
                key={f.id}
                title={f.category}
                subtitle={`${shortDate(f.date)} · ${bucketOf(f.category)}${f.note ? ` · ${f.note}` : ''}`}
                amountText={
                  isBrokenMoney(f.amount)
                    ? 'valor ilegível'
                    : `${f.type === 'income' ? '+' : '-'} ${formatBRL(money(f.amount))}`
                }
                amountColor={f.type === 'income' ? t.green : t.red}
                badge={f.isImpulse ? 'impulso' : undefined}
                onPress={() => {
                  haptic('light');
                  setDayFilter(f.date);
                }}
                right={
                  <Pressable
                    onPress={() => {
                      haptic('warning');
                      store.deleteFinance(f.id);
                    }}
                    accessibilityLabel={`Excluir lançamento de ${f.category}`}
                    hitSlop={8}
                  >
                    <Txt variant="micro" color={t.textMuted}>
                      excluir
                    </Txt>
                  </Pressable>
                }
              />
            ))}
          </View>
        </Bento>
        {/* Busca no rodapé, como na referência: filtra a lista de atividade. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.bgInput,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: t.border,
            paddingLeft: spacing.lg,
            paddingRight: 4,
            paddingVertical: 4,
            gap: spacing.sm,
          }}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar categoria, nota ou data…"
            placeholderTextColor={t.textMuted}
            style={{ flex: 1, color: t.textPrimary, fontSize: 13, paddingVertical: 8 }}
            accessibilityLabel="Buscar lançamentos"
          />
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: accent(),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt variant="caption" color={onAccent()} style={{ fontWeight: '700' }}>
              ⌕
            </Txt>
          </View>
        </View>
      </ScrollView>

      <Sheet
        visible={cardSheet}
        onClose={() => setCardSheet(false)}
        title="Cartão do saldo"
        footer={
          <PrimaryButton
            label="Salvar"
            onPress={() => {
              const digits = last4Draft.replace(/\D/g, '').slice(0, 4);
              // Só 4 dígitos entram. Vazio = apagar (volta para a máscara neutra).
              store.updateSettings({ cardLast4: digits.length === 4 ? digits : undefined });
              setCardSheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Muted>
          Só os 4 últimos dígitos ficam gravados, no próprio aparelho. O app não guarda o número completo,
          validade nem CVV — e nada disso sai do celular.
        </Muted>
        <Field
          label="4 últimos dígitos"
          value={last4Draft}
          onChangeText={(v) => setLast4Draft(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="0000"
          maxLength={4}
        />
        {store.settings.cardLast4 ? (
          <SecondaryButton
            label="Apagar número"
            onPress={() => {
              store.updateSettings({ cardLast4: undefined });
              setLast4Draft('');
              setCardSheet(false);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Novo lançamento"
        footer={
          <PrimaryButton
            label="Registrar"
            disabled={!Number(amount.replace(',', '.')) || (isImpulse && !impulseWhy.trim())}
            onPress={() => {
              store.addFinance({
                id: newId('fin'),
                date,
                type,
                amount: Number(amount.replace(',', '.')) || 0,
                category,
                isImpulse,
                // Justificativa do impulso entra na nota: é o que permite ver o padrão depois.
                note: [note.trim(), isImpulse && impulseWhy.trim() ? `impulso: ${impulseWhy.trim()}` : '']
                  .filter(Boolean)
                  .join(' · '),
              });
              setAmount('');
              setNote('');
              setImpulseWhy('');
              setIsImpulse(false);
              setSheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Row gap={spacing.sm}>
          <Chip label="Despesa" color={t.red} selected={type === 'expense'} onPress={() => setType('expense')} />
          <Chip label="Receita" color={t.green} selected={type === 'income'} onPress={() => setType('income')} />
        </Row>
        <Field label="Valor (R$)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
        <Txt variant="caption" color={t.textSecondary}>
          Categoria
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FINANCE_CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <ToggleRow
          label="Gasto por impulso"
          sub="Marca para o cálculo de custo real"
          value={isImpulse}
          onChange={setIsImpulse}
        />
        {isImpulse ? (
          <Field
            label="Por que foi impulso?"
            value={impulseWhy}
            onChangeText={setImpulseWhy}
            placeholder="Ex.: abri o app e comprei sem precisar"
          />
        ) : null}
        <Field label="Nota" value={note} onChangeText={setNote} placeholder="opcional" />
        <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} />
      </Sheet>
    </View>
  );
}
