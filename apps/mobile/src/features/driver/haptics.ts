import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Success / warning haptic on native; no-op on web. */
export function hapticNotify(kind: 'success' | 'warning' | 'error' = 'success'): void {
  if (Platform.OS === 'web') return;
  const type =
    kind === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : kind === 'warning'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;
  void Haptics.notificationAsync(type);
}

/** Light tap haptic on native; no-op on web. */
export function hapticTap(): void {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync();
}
