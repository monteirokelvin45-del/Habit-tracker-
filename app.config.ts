import type { ConfigContext, ExpoConfig } from 'expo/config';
import type { WithAndroidWidgetsParams } from 'react-native-android-widget';

/**
 * Config dinâmica: precisamos do config plugin do react-native-android-widget,
 * que exige tipagem (app.json não aceita o objeto tipado com previewImage etc.
 * de forma segura).
 */
const widgetConfig: WithAndroidWidgetsParams = {
  widgets: [
    {
      name: 'Prime',
      label: 'MY PRIME',
      description: 'Streak, modo do dia, progresso e próxima tarefa',
      minWidth: '250dp',
      minHeight: '110dp',
      targetCellWidth: 4,
      targetCellHeight: 2,
      resizeMode: 'horizontal|vertical',
      // Atualização automática do launcher: 3h (mínimo permitido é 30 min).
      updatePeriodMillis: 3 * 60 * 60 * 1000,
      previewImage: './assets/widget-preview/prime.png',
    },
    {
      name: 'Constancia',
      label: 'MY PRIME · Mural',
      description: 'Mural de constância: os dias cumpridos em sequência',
      minWidth: '250dp',
      minHeight: '150dp',
      targetCellWidth: 4,
      targetCellHeight: 3,
      resizeMode: 'horizontal|vertical',
      updatePeriodMillis: 3 * 60 * 60 * 1000,
      previewImage: './assets/widget-preview/constancia.png',
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  return {
    ...base,
    name: 'MY PRIME',
    slug: 'my-prime',
    // `versionCode` precisa subir a cada build: sem isso o Android trata duas
    // versões diferentes como a mesma e a atualização pode ser recusada.
    version: '1.6.1',
    android: { ...base.android, versionCode: 11 },
    plugins: [
      ...(base.plugins ?? []),
      ['react-native-android-widget', widgetConfig],
    ],
  };
};
