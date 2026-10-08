export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "placement", name: "Level found", description: "Passer le test de niveau", icon: "🎯", xp: 20 },
  { code: "first-review", name: "First card", description: "Réviser votre première carte", icon: "🃏", xp: 10 },
  { code: "streak-3", name: "3 days streak", description: "3 jours d'affilée", icon: "🔥", xp: 20 },
  { code: "streak-7", name: "7 days streak", description: "7 jours d'affilée", icon: "🔥", xp: 50 },
  { code: "streak-30", name: "30 days streak", description: "30 jours d'affilée", icon: "🏅", xp: 200 },
  { code: "words-100", name: "100 words", description: "Apprendre 100 mots", icon: "📚", xp: 50 },
  { code: "words-500", name: "500 words", description: "Apprendre 500 mots", icon: "📖", xp: 200 },
  { code: "reviews-100", name: "100 reviews", description: "100 révisions", icon: "✅", xp: 30 },
  { code: "reviews-1000", name: "1000 reviews", description: "1000 révisions", icon: "🏆", xp: 150 },
  { code: "first-conversation", name: "First conversation", description: "Terminer une conversation avec l'IA", icon: "🎤", xp: 30 },
  { code: "conversations-10", name: "10 conversations", description: "10 conversations terminées", icon: "💬", xp: 100 },
  { code: "mistake-hunter", name: "Mistake hunter", description: "Transformer 10 erreurs en cartes", icon: "🎯", xp: 40 },
  { code: "perfect-lesson", name: "Perfect lesson", description: "100 % à un exercice de grammaire", icon: "✨", xp: 30 },
];

export const achievementByCode = (code: string) => ACHIEVEMENTS.find((a) => a.code === code);

/** Player level from XP: 50 · (n-1)² XP needed for level n. */
export function playerLevel(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const floor = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, floor, next, progress: (xp - floor) / (next - floor) };
}
