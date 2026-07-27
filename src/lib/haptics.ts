import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const native = () => Capacitor.isNativePlatform();

export const haptic = {
  light:   () => { if (native()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); },
  medium:  () => { if (native()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); },
  heavy:   () => { if (native()) Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); },
  success: () => { if (native()) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); },
  error:   () => { if (native()) Haptics.notification({ type: NotificationType.Error }).catch(() => {}); },
};
