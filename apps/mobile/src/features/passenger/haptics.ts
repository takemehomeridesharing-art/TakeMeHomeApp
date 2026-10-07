import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';

/** Success buzz (request accepted, payment confirmed, rating sent). No-op on web. */
export function hapticSuccess(): void {
  if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning buzz (SOS, failures). No-op on web. */
export function hapticWarning(): void {
  if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Selection tick (stop picked, chip toggled). No-op on web. */
export function hapticSelect(): void {
  if (native) void Haptics.selectionAsync();
}
