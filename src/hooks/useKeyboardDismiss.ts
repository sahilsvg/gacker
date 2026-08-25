import { useEffect } from 'react';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Is this element something that raises the keyboard?
 */
export const isTextField = (el: Element | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'image'].includes(type);
  }
  return false;
};

/** Blur whatever is focused and put the keyboard away. */
export const dismissKeyboard = () => {
  const active = document.activeElement;
  if (isTextField(active)) (active as HTMLElement).blur();
  Keyboard.hide().catch(() => {});
};

/**
 * Enter/Done handler for single-line inputs: runs an optional action, then
 * dismisses. Not for textareas, where Enter should insert a newline.
 */
export const dismissOnEnter =
  (action?: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    action?.();
    e.currentTarget.blur();
    Keyboard.hide().catch(() => {});
  };

/**
 * App-wide safety net: the keyboard goes away when you tap outside a text
 * field or scroll. Mounted once, so no field can trap the keyboard open —
 * including any added later that forgets to handle this itself.
 *
 * Controls that must not steal focus mid-typing (a send button, a mention
 * suggestion) opt out with `data-keep-keyboard`.
 */
export function useKeyboardDismiss() {
  useEffect(() => {
    let focusedAt = 0;

    const onFocusIn = (e: FocusEvent) => {
      if (isTextField(e.target as Element)) focusedAt = Date.now();
    };

    const onPointerDown = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (isTextField(target)) return;
      if (target.closest?.('[data-keep-keyboard]')) return;
      if (!isTextField(document.activeElement)) return;
      dismissKeyboard();
    };

    const onScroll = () => {
      // iOS scrolls a field into view as it gains focus; that scroll must not
      // immediately close the keyboard it just opened.
      if (Date.now() - focusedAt < 500) return;
      if (!isTextField(document.activeElement)) return;
      dismissKeyboard();
    };

    document.addEventListener('focusin', onFocusIn);
    // Capture, because scroll does not bubble and many taps stopPropagation.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);
}
