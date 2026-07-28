/**
 * Review-prompt host. Owns the counters and the decision. Screens only report that something
 * good happened; this decides whether — and when — to ask the OS for its review dialog.
 *
 * There is NO sheet of our own (owner decision 2026-07-29, superseding master-plan 4a). The
 * qualifying moments ARE the sentiment filter, so we call `requestNativeReview()` directly at a
 * terminal moment. That deleted the occlusion-geometry subsystem along with both of its blockers,
 * and removed Guideline 1.1.7 exposure. See logic/reviewPromptLogic.ts for the full note.
 *
 * STALE-CLOSURE DISCIPLINE: the pending-request tick runs on an interval, so everything it reads
 * lives in a ref that a companion effect keeps current. Nothing mutable is captured in the
 * interval's closure — that bug class has bitten this repo before.
 */
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { isFeatureEnabled } from '../../../config/features';
import { track } from '../../../utils/analytics';
import { useEngagement } from '../../engagement/state/EngagementContext';
import {
  DWELL_MS,
  canPresentNow,
  crossedStreakMilestone,
  evaluateReviewPrompt,
  type ReviewMomentKind,
  type ReviewPromptState,
} from '../logic/reviewPromptLogic';
import {
  defaultReviewPromptState,
  loadReviewPromptState,
  saveReviewPromptState,
} from '../data/reviewPromptStore';
import { requestNativeReview } from '../nativeReview';

interface ReviewPromptContextType {
  /**
   * Records a qualifying moment and arms a pending review request.
   * @param dedupeKey optional stable id (e.g. a game id) so re-entering a screen cannot count the
   *   same moment twice. Without it, a 60s "just ended" window let one game count repeatedly.
   */
  recordMoment: (kind: ReviewMomentKind, dedupeKey?: string) => void;
  /** Study-day streak only. Counts once per MILESTONE (7/30/100), never once per day. */
  recordStreakMilestone: (studyStreak: number) => void;
}

const NOOP: ReviewPromptContextType = {
  recordMoment: () => {},
  recordStreakMilestone: () => {},
};

const Ctx = createContext<ReviewPromptContextType | null>(null);

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const TICK_MS = 500;
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

interface Pending { kind: ReviewMomentKind; armedAt: number }

export function ReviewPromptProvider({ children }: { children: React.ReactNode }) {
  // Web never asks: there is no store review to request there.
  const enabled = isFeatureEnabled('reviews') && isNative;
  const { isCelebrating } = useEngagement();

  const [state, setState] = useState<ReviewPromptState>(() => defaultReviewPromptState(Date.now()));
  const [loaded, setLoaded] = useState(false);

  // ── Refs read by the interval tick (never captured values) ──
  const stateRef = useRef(state);
  const celebratingRef = useRef(isCelebrating);
  const pendingRef = useRef<Pending | null>(null);
  /** At most one request per app session, independent of the persisted rules. */
  const askedThisSessionRef = useRef(false);
  /** Moments recorded before the store finished loading — flushed on load, never dropped. */
  const preloadQueueRef = useRef<Array<{ kind: ReviewMomentKind; dedupeKey?: string }>>([]);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { celebratingRef.current = isCelebrating; }, [isCelebrating]);

  const persist = useCallback((next: ReviewPromptState) => {
    stateRef.current = next;
    setState(next);
    void saveReviewPromptState(next);
  }, []);

  /** Applies one moment to the state. Assumes the store is loaded. */
  const applyMoment = useCallback((kind: ReviewMomentKind, dedupeKey?: string) => {
    const prev = stateRef.current;
    if (dedupeKey && prev.countedKeys.includes(dedupeKey)) return;
    pendingRef.current = { kind, armedAt: Date.now() };
    persist({
      ...prev,
      moments: prev.moments + 1,
      countedKeys: dedupeKey ? [...prev.countedKeys, dedupeKey] : prev.countedKeys,
    });
  }, [persist]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadReviewPromptState(Date.now()).then(s => {
      if (!alive) return;
      stateRef.current = s;
      setState(s);
      setLoaded(true);
      // Flush anything recorded while the read was in flight. Previously these were silently
      // dropped, and the call sites latched a "already recorded" ref before calling, so the
      // moment was lost permanently rather than retried.
      const queued = preloadQueueRef.current;
      preloadQueueRef.current = [];
      for (const m of queued) applyMoment(m.kind, m.dedupeKey);
    });
    return () => { alive = false; };
  }, [enabled, applyMoment]);

  const recordMoment = useCallback((kind: ReviewMomentKind, dedupeKey?: string) => {
    if (!enabled) return;
    if (!loaded) { preloadQueueRef.current.push({ kind, dedupeKey }); return; }
    applyMoment(kind, dedupeKey);
  }, [enabled, loaded, applyMoment]);

  const recordStreakMilestone = useCallback((studyStreak: number) => {
    if (!enabled || !loaded) return;
    const prev = stateRef.current;
    const milestone = crossedStreakMilestone(studyStreak, prev.streakMilestoneHigh);
    if (milestone === null) return;
    pendingRef.current = { kind: 'streak_milestone', armedAt: Date.now() };
    persist({ ...prev, streakMilestoneHigh: milestone, moments: prev.moments + 1 });
  }, [enabled, loaded, persist]);

  // Polled rather than reactive: dwell is time-based. Deps deliberately exclude `state` /
  // `isCelebrating` — those are read from refs.
  useEffect(() => {
    if (!enabled || !loaded || askedThisSessionRef.current) return;
    // Once this version has been asked, the tick can never succeed — don't run a 2Hz timer for
    // the rest of the session.
    if (evaluateReviewPrompt(stateRef.current, { nowMs: Date.now(), appVersion: APP_VERSION }).reason
        === 'already_this_version') return;

    const id = setInterval(() => {
      if (askedThisSessionRef.current) return;
      const pending = pendingRef.current;
      if (!pending) return;

      const now = Date.now();
      const current = stateRef.current;
      if (!evaluateReviewPrompt(current, { nowMs: now, appVersion: APP_VERSION }).eligible) return;

      if (!canPresentNow({
        dwellElapsedMs: now - pending.armedAt,
        requiredDwellMs: DWELL_MS[pending.kind],
        isCelebrating: celebratingRef.current,
      })) return;

      askedThisSessionRef.current = true;
      pendingRef.current = null;
      // Asking consumes the allowance. iOS may silently decline to show anything, so we must
      // rate-limit the ASK; we can never observe the outcome.
      persist({
        ...current,
        lastPromptedAt: now,
        promptedVersions: [...current.promptedVersions, APP_VERSION],
      });
      void requestNativeReview().then(requested => {
        // `requested` means "we issued the call", NOT "the dialog appeared" — iOS caps the modal
        // at ~3/year. Naming it `available` invited exactly the wrong reading in the warehouse.
        track('review_native_requested', {
          moment_kind: pending.kind,
          moments: current.moments,
          requested,
        });
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, loaded, persist]);

  const value = useMemo<ReviewPromptContextType>(
    () => ({ recordMoment, recordStreakMilestone }),
    [recordMoment, recordStreakMilestone],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReviewPrompt(): ReviewPromptContextType {
  const ctx = useContext(Ctx);
  if (!ctx && __DEV__) {
    // Fail loudly in dev: a silent NOOP is how a provider moved out of the navigator becomes a
    // feature that records nothing, shows nothing, and reports nothing.
    console.warn('[reviews] useReviewPrompt() used outside ReviewPromptProvider — moments are being discarded.');
  }
  return ctx ?? NOOP;
}
