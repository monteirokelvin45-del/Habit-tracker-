// Entry point próprio (Expo Router + widget nativo).
// Necessário para registrar o WidgetTaskHandler fora do contexto do app.
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/handler';

registerWidgetTaskHandler(widgetTaskHandler);
