// Haptics: navigator.vibrate where available; on iOS (no vibrate) a hidden switch toggle gives one tick.
export let hapticsOn = true;
export function setHapticsOn(v: boolean): void {
  hapticsOn = v;
}

let label: HTMLLabelElement | null = null;
function iosTick(): void {
  if (!label) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.id = 'fichas-haptic';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    label = document.createElement('label');
    label.htmlFor = input.id;
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0';
    label.append(input);
    document.body.append(label);
  }
  label.click();
}

/** n short ticks (8 ms each, 70 ms apart). Call synchronously inside the tap handler. */
export function tick(n = 1): void {
  if (!hapticsOn) return;
  if (typeof navigator.vibrate === 'function') {
    const pattern: number[] = [];
    for (let i = 0; i < Math.min(n, 10); i++) pattern.push(8, 62);
    navigator.vibrate(pattern);
  } else iosTick();
}
