/** Local pillar achievements — pure catalog + evaluation, derived from engagement signals. */
import type { EngagementSignals } from '../types';

export type LocalRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface LocalAchievement {
  key: string;
  name: string;
  desc: string;
  rarity: LocalRarity;
  /** Ionicons name (rendered directly by AchievementUnlock / Achievements screen). */
  ionicon: string;
  eligible: (s: EngagementSignals) => boolean;
}

export const LOCAL_ACHIEVEMENTS: LocalAchievement[] = [
  { key: 'play_first',          name: 'Shuffle Up',           desc: 'Finish your first game.',          rarity: 'Common', ionicon: 'play',                eligible: s => s.localGamesFinished >= 1 },
  { key: 'study_first',         name: 'First Drill',          desc: 'Answer your first study spot.',     rarity: 'Common', ionicon: 'school-outline',      eligible: s => s.spotsAnswered >= 1 },
  { key: 'study_century',       name: 'Century',              desc: 'Answer 100 study spots.',           rarity: 'Rare',   ionicon: 'school',              eligible: s => s.spotsAnswered >= 100 },
  { key: 'study_streak_7',      name: 'Week Strong',          desc: 'Hold a 7-day study streak.',        rarity: 'Rare',   ionicon: 'flame-outline',       eligible: s => s.studyStreak >= 7 },
  { key: 'study_streak_30',     name: 'Unbreakable',          desc: 'Hold a 30-day study streak.',       rarity: 'Epic',   ionicon: 'flame',               eligible: s => s.studyStreak >= 30 },
  { key: 'bankroll_first',      name: 'On the Books',         desc: 'Log your first bankroll session.',  rarity: 'Common', ionicon: 'wallet-outline',      eligible: s => s.bankrollSessions >= 1 },
  { key: 'bankroll_ten',        name: 'Record Keeper',        desc: 'Log 10 bankroll sessions.',         rarity: 'Rare',   ionicon: 'wallet',              eligible: s => s.bankrollSessions >= 10 },
  { key: 'bankroll_green_month', name: 'In Profit',           desc: 'Finish a calendar month up.',       rarity: 'Rare',   ionicon: 'trending-up-outline', eligible: s => s.bankrollPositiveMonth },
  { key: 'coach_first',         name: 'First Read',           desc: 'Run your first AI analysis.',       rarity: 'Common', ionicon: 'sparkles-outline',    eligible: s => s.coachAnalyses >= 1 },
  { key: 'coach_ten',           name: 'Student of the Game',  desc: 'Run 10 AI analyses.',               rarity: 'Epic',   ionicon: 'sparkles',            eligible: s => s.coachAnalyses >= 10 },
];

/** Keys currently eligible given the signals. */
export function eligibleKeys(s: EngagementSignals): string[] {
  return LOCAL_ACHIEVEMENTS.filter(a => a.eligible(s)).map(a => a.key);
}

/** Newly-unlocked keys = eligible but not yet seen. */
export function evaluate(s: EngagementSignals, seen: Record<string, string>): string[] {
  return eligibleKeys(s).filter(k => !(k in seen));
}

export function findAchievement(key: string): LocalAchievement | undefined {
  return LOCAL_ACHIEVEMENTS.find(a => a.key === key);
}
