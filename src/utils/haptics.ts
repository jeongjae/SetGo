/**
 * Triggers a short vibration matching the iOS selection tick (15ms).
 */
export function triggerSelectionHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(15);
    } catch (e) {
      // Ignore security/permission blocks in iframe
    }
  }
}
