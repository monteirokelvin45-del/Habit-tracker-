import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing } from '../../src/theme';
import {
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
import { LineChart } from '../../src/components/charts';
import { useStore } from '../../src/lib/store';
import { shortDate, todayKey } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { newId } from '../../src/lib/store';

export default function WeightScreen() {
  const store = useStore();
  const [sheet, setSheet] = useState(false);
  const [kg, setKg] = useState('');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [shoulder, setShoulder] = useState('');
  const [arm, setArm] = useState('');
  const [thigh, setThigh] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const entries = store.weight.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = entries[entries.length - 1];
  const first = entries[0];
  const delta = last && first ? last.kg - first.kg : null;

  const movingAverage = useMemo(() => {
    return entries.map((_e, i) => {
      const window = entries.slice(Math.max(0, i - 6), i + 1);
      return window.reduce((a, b) => a + b.kg, 0) / window.length;
    });
  }, [entries]);

  const goal = store.settings.weightGoalKg;

  const takePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.4 });
    if (!res.canceled && res.assets[0]) {
      setPhotos((p) => [...p, res.assets[0]!.uri].slice(-2));
      haptic('light');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader title="⚖️ Peso e medidas" subtitle={`${entries.length} registro(s)`} onAdd={() => setSheet(true)} addLabel="+ Registro" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }}>
        <Row gap={spacing.sm}>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Peso atual</Txt>
            <Txt variant="h2">{last ? `${last.kg.toFixed(1)}` : '—'}<Txt variant="caption" color={colors.textSecondary}> kg</Txt></Txt>
            <Muted>{last ? shortDate(last.date) : 'Sem dado'}</Muted>
          </Card>
          <Card style={{ flex: 1 }}>
            <Txt variant="micro" color={colors.textSecondary}>Variação total</Txt>
            <Txt variant="h2" color={delta == null ? colors.textMuted : delta <= 0 ? colors.green : colors.red}>
              {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
            </Txt>
            <Muted>{goal ? `Meta: ${goal} kg` : 'Sem meta definida'}</Muted>
          </Card>
        </Row>

        <Card>
          <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Peso e média móvel (7)</Txt>
          {entries.length >= 3 ? (
            <LineChart
              labels={entries.map((e) => e.date.slice(8, 10))}
              max={Math.max(...entries.map((e) => e.kg), goal ?? 0) + 2}
              goal={goal}
              series={[
                { name: 'Peso', color: colors.blue, points: entries.map((e) => e.kg) },
                { name: 'Média 7d', color: colors.green, points: movingAverage },
              ]}
            />
          ) : (
            <NoData label="Gráficos a partir de 3 pontos de dado" />
          )}
        </Card>

        <Card>
          <Txt variant="h3">Medidas (último registro)</Txt>
          {(() => {
            const withMeasures = entries.filter((e) => e.measurements).slice(-1)[0];
            if (!withMeasures?.measurements) return <NoData label="Sem medidas registradas" />;
            const m = withMeasures.measurements;
            return (
              <View style={{ gap: 4, marginTop: 6 }}>
                {[
                  ['Cintura', m.waist],
                  ['Peito', m.chest],
                  ['Ombro', m.shoulder],
                  ['Braço', m.arm],
                  ['Coxa', m.thigh],
                ].map(([label, value]) => (
                  <Row key={String(label)} style={{ justifyContent: 'space-between' }}>
                    <Muted>{label}</Muted>
                    <Txt variant="caption" color={colors.textPrimary}>{value ? `${value} cm` : 'Sem dado'}</Txt>
                  </Row>
                ))}
                <Muted>Medido em {shortDate(withMeasures.date)}</Muted>
              </View>
            );
          })()}
        </Card>

        <Card>
          <Txt variant="h3">Fotos de progresso</Txt>
          <Muted style={{ marginBottom: spacing.sm }}>Opcional, mensal, só no seu dispositivo. Nunca vigilância automática.</Muted>
          <Row gap={spacing.sm}>
            {photos.map((p) => (
              <Image key={p} source={{ uri: p }} style={{ width: 110, height: 140, borderRadius: 12 }} />
            ))}
            <Pressable
              onPress={() => void takePhoto()}
              style={{ width: 110, height: 140, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Txt variant="caption" color={colors.textSecondary}>+ Foto</Txt>
            </Pressable>
          </Row>
        </Card>

        <Txt variant="h3">Histórico</Txt>
        {entries.length === 0 ? <NoData label="Nenhum registro" /> : null}
        {entries
          .slice()
          .reverse()
          .slice(0, 12)
          .map((e) => (
            <Card key={e.date} style={{ padding: spacing.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" color={colors.textPrimary}>{shortDate(e.date)}</Txt>
                <Row gap={spacing.md}>
                  <Txt variant="caption" color={colors.blue}>{e.kg.toFixed(1)} kg</Txt>
                  <Txt variant="micro" color={colors.textMuted} onPress={() => store.deleteWeight(e.date)}>excluir</Txt>
                </Row>
              </Row>
            </Card>
          ))}
      </ScrollView>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Registro de peso"
        footer={
          <PrimaryButton
            label="Salvar"
            disabled={!Number(kg.replace(',', '.'))}
            onPress={() => {
              store.addWeight({
                id: newId('w'),
                date: todayKey(),
                kg: Number(kg.replace(',', '.')) || 0,
                measurements: {
                  waist: Number(waist.replace(',', '.')) || undefined,
                  chest: Number(chest.replace(',', '.')) || undefined,
                  shoulder: Number(shoulder.replace(',', '.')) || undefined,
                  arm: Number(arm.replace(',', '.')) || undefined,
                  thigh: Number(thigh.replace(',', '.')) || undefined,
                },
              });
              setKg('');
              setWaist('');
              setChest('');
              setShoulder('');
              setArm('');
              setThigh('');
              setSheet(false);
              haptic('success');
            }}
          />
        }
      >
        <Field label="Peso (kg)" value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="80.5" />
        <Muted>Medidas (opcional — mensal é suficiente)</Muted>
        <Row gap={spacing.sm}>
          <Field label="Cintura" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Field label="Peito" value={chest} onChangeText={setChest} keyboardType="decimal-pad" style={{ flex: 1 }} />
        </Row>
        <Row gap={spacing.sm}>
          <Field label="Ombro" value={shoulder} onChangeText={setShoulder} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Field label="Braço" value={arm} onChangeText={setArm} keyboardType="decimal-pad" style={{ flex: 1 }} />
        </Row>
        <Field label="Coxa" value={thigh} onChangeText={setThigh} keyboardType="decimal-pad" />
        <Field
          label="Meta de peso (kg)"
          value={store.settings.weightGoalKg ? String(store.settings.weightGoalKg) : ''}
          onChangeText={(t) => store.updateSettings({ weightGoalKg: Number(t.replace(',', '.')) || undefined })}
          keyboardType="decimal-pad"
          placeholder="75"
        />
        <SecondaryButton label="Salvar meta apenas" onPress={() => setSheet(false)} />
      </Sheet>
    </View>
  );
}
