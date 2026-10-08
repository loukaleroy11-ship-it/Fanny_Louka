/** Starter decks a learner can install. Membership = global Vocabulary entries tagged `deck:<key>`. */
export interface CatalogDeck {
  key: string;
  name: string;
  description: string;
  auto?: boolean; // installed automatically at sign-up
}

export const CATALOG: CatalogDeck[] = [
  { key: "common500", name: "500 Most Common Words", description: "Les 500 mots les plus fréquents de l'anglais parlé (OpenSubtitles 2018), classés par fréquence.", auto: true },
  { key: "irregular-verbs", name: "Irregular Verbs", description: "Les verbes irréguliers les plus utiles avec prétérit et participe passé." },
  { key: "phrasal", name: "Phrasal Verbs", description: "Les verbes à particule indispensables au quotidien." },
  { key: "expressions", name: "Daily Expressions", description: "Expressions et phrases toutes faites pour parler naturellement." },
  { key: "travel", name: "Travel", description: "Aéroport, hôtel, restaurant, orientation : tout pour voyager." },
  { key: "work", name: "Work", description: "Vocabulaire professionnel : réunions, entretien, collègues." },
  { key: "b1", name: "B1 Vocabulary", description: "Connecteurs, verbes et adjectifs du niveau intermédiaire." },
];

export const SYSTEM_DECK_NAMES = { words: "My Words", mistakes: "My Mistakes" } as const;
