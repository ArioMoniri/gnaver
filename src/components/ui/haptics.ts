/**
 * Thin, crash-safe wrapper around expo-haptics. Haptics are a no-op on web and
 * on simulators without a Taptic engine — we swallow any rejection so a missing
 * engine never bubbles into the UI.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tick for selection changes (chips, toggles, list rows). */
export function hapticSelection(): void {
  if (!enabled) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Medium impact for primary, committing actions. */
export function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
): void {
  if (!enabled) return;
  Haptics.impactAsync(style).catch(() => {});
}

/** Success / warning / error notification cues. */
export function hapticNotify(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
): void {
  if (!enabled) return;
  Haptics.notificationAsync(type).catch(() => {});
}

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
