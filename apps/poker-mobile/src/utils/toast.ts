type Variant = 'success' | 'error' | 'info';

type Listener = (text: string, variant: Variant) => void;

let listener: Listener | null = null;

export function registerToastListener(fn: Listener) {
  listener = fn;
  return () => { listener = null; };
}

export function showToast(text: string, variant: Variant = 'info') {
  listener?.(text, variant);
}
