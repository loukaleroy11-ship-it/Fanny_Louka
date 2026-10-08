import type { CurrentUser } from "./auth";
import { getEstimates } from "./skills";
import { levelLabel } from "./levels";
import { liveStreak } from "./progress";
import { playerLevel } from "./achievements";

/** Shape sent to the browser (no secrets). */
export async function toClientUser(user: CurrentUser) {
  const est = await getEstimates(user.id);
  return {
    id: user.id, name: user.name, email: user.email, level: user.level, levelLabel: levelLabel(est.overall), goal: user.goal,
    dailyMinutes: user.dailyMinutes, dailyNewCards: user.dailyNewCards, dailyReviewCards: user.dailyReviewCards,
    dailyConversations: user.dailyConversations, accent: user.accent, voiceGender: user.voiceGender as "female" | "male",
    speechRate: user.speechRate, englishOnly: user.englishOnly, autoAddMistakes: user.autoAddMistakes,
    theme: user.theme as "system" | "light" | "dark", desiredRetention: user.desiredRetention, streak: liveStreak(user), xp: user.xp, placementDone: user.placementDone,
    player: playerLevel(user.xp),
  };
}
