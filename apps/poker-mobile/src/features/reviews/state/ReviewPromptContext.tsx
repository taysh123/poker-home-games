/**
 * Review-prompt host. Owns the counters and the decision; screens only report what happened and
 * where their protected content is.
 *
 * Why ONE host instead of per-screen state: three screens produce qualifying moments and three can
 * present the sheet. Duplicating the rate limiting is how "once per 90 days" quietly becomes
 * "three times per 90 days".
 *
 * STALE-CLOSURE DISCIPLINE: the presentation tick runs on an interval, so everything it reads
 * lives in a ref that a companion effect keeps current. Nothing mutable is captured in the
 * interval's closure — that bug class has bitten this repo before.
 */
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { isFeatureEnabled } from '../../../config/features';
import { supportMailto } from '../../../config/support';
import { track } from '../../../utils/analytics';
import { useEngagement } from '../../engagement/state/EngagementContext';
import {
  DWELL_MS,
  SHEET_OCCLUSION_H,
  canPresentNow,
  evaluateReviewPrompt,
  regionState,
  type DwellSurface,
  type ReviewMomentKind,
  type ReviewPromptState,
} from '../logic/reviewPromptLogic';
import {
  defaultReviewPromptState,
  loadReviewPromptState,
  saveReviewPromptState,
} from '../data/reviewPromptStore';
import { requestNativeReview } from '../nativeReview';
import SentimentSheet from '../ui/SentimentSheet';

export interface ProtectedRect {
  /** Viewport-space Y of the protected block's top edge. */
  top: number;
  bottom: number;
  viewportH: number;
}

interface ReviewPromptContextType {
  recordMoment: (kind: ReviewMomentKind) => void;
  /** Streak milestones are a STATE, not an event — a high-water mark stops re-counting. */
  recordStreakMilestone: (studyStreak: number) => void;
  armSurface: (surface: DwellSurface | null) => void;
  setProtectedRect: (rect: ProtectedRect | null) => void;
}

const NOOP: ReviewPromptContextType = {
  recordMoment: () => {},
  recordStreakMilestone: () => {},
  armSurface: () => {},
  setProtectedRect: () => {},
};

const Ctx = createContext<ReviewPromptContextType | null>(null);

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const TICK_MS = 500;
const STREAK_MILESTONE = 7;
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export function ReviewPromptProvider({ children }: { children: React.ReactNode }) {
  // Web never presents: there is no store to send anyone to, and Profile already carries the
  // support address for the feedback path.
  const enabled = isFeatureEnabled('reviews') && isNative;
  const { isCelebrating } = useEngagement();

  const [state, setState] = useState<ReviewPromptState>(() => defaultReviewPromptState(Date.now()));
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  // ── Refs read by the interval tick (never captured values) ──
  const stateRef = useRef(state);
  const celebratingRef = useRef(isCelebrating);
  const surfaceRef = useRef<DwellSurface | null>(null);
  const armedAtRef = useRef<number | null>(null);
  const rectRef = useRef<ProtectedRect | null>(null);
  const seenRef = useRef(false);
  const lastKindRef = useRef<ReviewMomentKind | null>(null);
  /** At most one prompt per app session, independent of the persisted rules. */
  const shownThisSessionRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { celebratingRef.current = isCelebrating; }, [isCelebrating]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadReviewPromptState(Date.now()).then(s => {
      if (!alive) return;
      setState(s);
      stateRef.current = s;
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [enabled]);

  const persist = useCallback((next: ReviewPromptState) => {
    stateRef.current = next;
    setState(next);
    void saveReviewPromptState(next);
  }, []);

  const recordMoment = useCallback((kind: ReviewMomentKind) => {
    if (!enabled || !loaded) return;
    lastKindRef.current = kind;
    persist({ ...stateRef.current, moments: stateRef.current.moments + 1 });
  }, [enabled, loaded, persist]);

  const recordStreakMilestone = useCallback((studyStreak: number) => {
    if (!enabled || !loaded) return;
    const prev = stateRef.current;
    if (studyStreak < STREAK_MILESTONE || studyStreak <= prev.streakMilestoneHigh) return;
    lastKindRef.current = 'streak_milestone';
    persist({ ...prev, streakMilestoneHigh: studyStreak, moments: prev.moments + 1 });
  }, [enabled, loaded, persist]);

  const armSurface = useCallback((surface: DwellSurface | null) => {
    surfaceRef.current = surface;
    armedAtRef.current = surface ? Date.now() : null;
    rectRef.current = null;
    seenRef.current = false;
  }, []);

  const setProtectedRect = useCallback((rect: ProtectedRect | null) => {
    rectRef.current = rect;
    if (!rect) return;
    // Sticky: once the block has been fully readable above the sheet, it stays "seen".
    if (regionState({ ...rect, sheetH: SHEET_OCCLUSION_H }).fullyVisibleAboveSheet) {
      seenRef.current = true;
    }
  }, []);

  // Polled rather than reactive: dwell is time-based, and scroll position changes without a
  // re-render. Deps deliberately exclude `state` / `isCelebrating` — those are read from refs.
  useEffect(() => {
    if (!enabled || !loaded || visible) return;
    const id = setInterval(() => {
      if (shownThisSessionRef.current) return;
      const surface = surfaceRef.current;
      const armedAt = armedAtRef.current;
      if (!surface || armedAt === null) return;

      const now = Date.now();
      const current = stateRef.current;
      if (!evaluateReviewPrompt(current, { nowMs: now, appVersion: APP_VERSION }).eligible) return;

      const rect = rectRef.current;
      const rs = rect ? regionState({ ...rect, sheetH: SHEET_OCCLUSION_H }) : null;

      const ok = canPresentNow({
        dwellElapsedMs: now - armedAt,
        requiredDwellMs: DWELL_MS[surface],
        isCelebrating: celebratingRef.current,
        protectedRegion: rs ? { seen: seenRef.current, intersectsSheet: rs.intersectsSheet } : null,
      });
      if (!ok) return;

      shownThisSessionRef.current = true;
      setVisible(true);
      // Showing consumes the allowance — whichever button is pressed, and even if none is. We
      // rate-limit asking, not answering.
      persist({
        ...current,
        lastPromptedAt: now,
        promptedVersions: [...current.promptedVersions, APP_VERSION],
      });
      track('review_prompt_shown', {
        moment_kind: lastKindRef.current ?? 'unknown',
        moments: current.moments,
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, loaded, visible, persist]);

  const onHappy = useCallback(() => {
    setVisible(false);
    persist({ ...stateRef.current, lastSentiment: 'happy' });
    track('review_sentiment', { value: 'happy' });
    // Fire-and-forget. `false` is normal (iOS ~3/year cap, TestFlight) and never surfaced.
    void requestNativeReview().then(requested => {
      track('review_native_requested', { available: requested });
    });
  }, [persist]);

  const onUnhappy = useCallback(() => {
    setVisible(false);
    persist({ ...stateRef.current, lastSentiment: 'unhappy' });
    track('review_sentiment', { value: 'unhappy' });
    track('review_feedback_opened');
    void Linking.openURL(supportMailto('T Poker feedback', 'What could be better?\n\n')).catch(() => {});
  }, [persist]);

  const onDismiss = useCallback(() => {
    setVisible(false);
    track('review_prompt_dismissed');
  }, []);

  return (
    <Ctx.Provider value={{ recordMoment, recordStreakMilestone, armSurface, setProtectedRect }}>
      {children}
      {enabled && (
        <SentimentSheet
          visible={visible}
          onHappy={onHappy}
          onUnhappy={onUnhappy}
          onDismiss={onDismiss}
        />
      )}
    </Ctx.Provider>
  );
}

export function useReviewPrompt(): ReviewPromptContextType {
  return useContext(Ctx) ?? NOOP;
}
