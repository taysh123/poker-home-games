/**
 * StateView — collapses the `error ? : loading ? : empty ? : content` ladder every list re-implements into one
 * place, so loading/error/empty rendering is identical across surfaces.
 *
 * Precedence: error → loading → empty → children (matches existing screens, which test `error` first).
 * Default skeleton = 4 SkeletonRow. Error branch renders the shared ErrorState.
 */
import React from 'react';
import SkeletonRow from './SkeletonRow';
import ErrorState from './ErrorState';
import { resolveStateBranch } from './stateBranch';

export type { StateBranch } from './stateBranch';

interface StateViewProps {
  loading: boolean;
  /** boolean, or a { title, message } for a richer error message. */
  error?: boolean | { title?: string; message?: string };
  isEmpty: boolean;
  /** Override the default 4-row skeleton. */
  skeleton?: React.ReactNode;
  /** Rendered when not loading/error and isEmpty (usually an <EmptyState>). */
  empty: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}

const defaultSkeleton = (
  <>{[0, 1, 2, 3].map(i => <SkeletonRow key={i} isFirst={i === 0} />)}</>
);

export default function StateView({ loading, error, isEmpty, skeleton, empty, onRetry, children }: StateViewProps) {
  switch (resolveStateBranch({ loading, error, isEmpty })) {
    case 'error': {
      const e = typeof error === 'object' ? error : undefined;
      return <ErrorState title={e?.title} message={e?.message} onRetry={onRetry} />;
    }
    case 'loading': return <>{skeleton ?? defaultSkeleton}</>;
    case 'empty': return <>{empty}</>;
    default: return <>{children}</>;
  }
}
