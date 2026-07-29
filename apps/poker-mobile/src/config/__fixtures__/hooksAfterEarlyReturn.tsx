/**
 * LINT FIXTURE — intentionally violates react-hooks/rules-of-hooks.
 *
 * Not application code and never imported. It reproduces the exact Q1.4 defect shape (hooks
 * appended BELOW a conditional return) so `eslintRules.test.ts` can assert the linter actually
 * REPORTS it, rather than only that the config table lists the rule.
 *
 * That distinction is load-bearing: a config-table assertion cannot tell you a file is going
 * unlinted, which is exactly how this slice nearly shipped with App.tsx uncovered.
 *
 * Excluded from normal lint runs via `ignores` in eslint.config.js; the test uses --no-ignore.
 */
import React from 'react';
import { Text } from 'react-native';

export default function HooksAfterEarlyReturn({ item }: { item?: { id: string } }) {
  const first = React.useRef(0);

  if (!item) {
    return <Text>nothing</Text>;
  }

  const second = React.useRef(0); // ← violation
  React.useEffect(() => { void second; }, []); // ← violation

  return <Text>{item.id}{first.current}</Text>;
}
