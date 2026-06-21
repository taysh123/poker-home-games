/**
 * StateView branch resolver — PURE (no RN imports), unit-testable. StateView.tsx renders from this.
 * Precedence: error → loading → empty → content.
 */
export type StateBranch = 'error' | 'loading' | 'empty' | 'content';

export function resolveStateBranch(s: { loading: boolean; error?: boolean | object; isEmpty: boolean }): StateBranch {
  if (s.error) return 'error';
  if (s.loading) return 'loading';
  if (s.isEmpty) return 'empty';
  return 'content';
}
