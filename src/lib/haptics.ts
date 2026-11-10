import * as Haptics from 'expo-haptics';
import { useStore } from './store';

type Kind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'select';

/**
 * Haptic central: respeita o toggle "Vibração/haptic" das configurações.
 * Importado por toda a UI — nunca chame expo-haptics direto nas telas.
 */
export function haptic(kind: Kind = 'light'): void {
  const enabled = useStore.getState().settings.haptics;
  if (!enabled) return;
  try {
    switch (kind) {
      case 'light':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'select':
        void Haptics.selectionAsync();
        break;
    }
  } catch {
    // haptics indisponível (web/emulador) — silencioso por design
  }
}
