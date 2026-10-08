# Lingua — plateforme adaptative d'apprentissage de l'anglais

Anki (répétition espacée) + Duolingo (progression, gamification) + professeur particulier IA (conversation, corrections) + cours de grammaire.
L'application apprend ce que vous savez, vos erreurs et votre niveau, puis décide chaque jour **de ce que vous devez travailler**.

> **Transparence — ce qui est réel, ce qui est un mode démo**
>
> | Fonctionnalité | État |
> |---|---|
> | Base PostgreSQL, auth, flashcards, FSRS, filtres, decks, stats, import/export, grammaire, plan du jour, test de niveau | **Réel**, sans service externe |
> | Professeur IA (conversation, corrections, génération de cartes, rapport, explication de mots) | **Réel avec une clé `ANTHROPIC_API_KEY`**. Sans clé → **mode démo** explicitement signalé dans l'interface : questions préparées par scénario + ~35 règles de correction (passé simple, `-s` à la 3ᵉ personne, prépositions, faux amis de structure…). Ce n'est **pas** de l'IA. |
> | Synthèse vocale (TTS) et micro (STT) | **Réel via l'API Web Speech du navigateur** (gratuit, pas de clé). Voix et accents UK/US dépendent de l'appareil. Reconnaissance vocale : Chrome / Edge / Safari (pas Firefox). Dans Chrome, l'audio est traité par les serveurs de Google. |
> | Évaluation de la **prononciation** | **Partielle** : le navigateur ne note pas la prononciation. Le rapport signale seulement les messages oraux reconnus avec une faible confiance. |
> | E-mail « mot de passe oublié » | **Réel avec `RESEND_API_KEY`**. Sans clé, le lien est affiché dans les logs serveur et (hors production) dans l'interface. |
> | Rate limiting | En mémoire, **par instance** (suffisant pour 1 serveur ; remplacer par Redis/Upstash en multi-instances). L'IP est lue dans `X-Forwarded-For` : à déployer derrière un reverse-proxy de confiance qui écrase cet en-tête. |

## Objectif : l'oral

Lingua est pensé pour **comprendre l'anglais parlé et le parler** :

* **AI Conversation** — le professeur rebondit sur *ce que vous dites* (détails, fil de la discussion), vous corrige discrètement, et **reprend les affirmations fausses** (« Paris is the capital of Italy »). Micro, voix, vitesse 0.75–1.5×. **Mode écoute** (icône oreille) : le texte du professeur est masqué, vous ne faites que l'écouter (relecture normale ou lente, texte à la demande).
* **Oral** (`/oral`) — *Écoute & écris* (dictée : compréhension orale) et *Écoute & répète* (vous répétez à voix haute, le micro transcrit, vous voyez mot par mot ce qui est passé). Ces exercices alimentent les niveaux **Listening** et **Speaking**, et le plan du jour contient « N phrases à l'oral ».
* Les flashcards ont leur bouton 🔊 (mot et phrase, US/UK) et l'option de lecture automatique.

> Limites : la répétition est notée par la reconnaissance vocale du navigateur (elle mesure l'intelligibilité, pas la qualité exacte de l'accent). En mode démo (sans clé IA), « rebondir sur ce que vous dites » et le contrôle des faits se limitent à des règles simples ; la vraie conversation nécessite `ANTHROPIC_API_KEY`.

## Mode une seule personne

La création de compte est **fermée par défaut**. Créez votre compte une fois :
```bash
npm run user:create -- "vous@exemple.com" "votre-mot-de-passe" "Votre prénom"
```
(`ALLOW_REGISTRATION="true"` dans `.env` rouvre la page d'inscription.) À chaque connexion, les decks système et les 500 cartes sont réparés automatiquement s'ils manquent.

## Sommaire

1. [Choix techniques](#1-choix-techniques)
2. [Démarrage rapide](#2-démarrage-rapide)
3. [Variables d'environnement](#3-variables-denvironnement)
4. [Base de données, migrations, seed](#4-base-de-données-migrations-seed)
5. [Obtenir et configurer la clé IA](#5-obtenir-et-configurer-la-clé-ia)
6. [Tests](#6-tests)
7. [Architecture et structure des fichiers](#7-architecture-et-structure-des-fichiers)
8. [Modèle de données](#8-modèle-de-données)
9. [API](#9-api)
10. [Algorithmes](#10-algorithmes)
11. [Données : les 500 mots et leur source](#11-données--les-500-mots-et-leur-source)
12. [Déploiement](#12-déploiement)
13. [Sécurité, performance, accessibilité](#13-sécurité-performance-accessibilité)
14. [Limites connues, risques, pistes](#14-limites-connues-risques-pistes)

---

## 1. Choix techniques

| Choix | Pourquoi |
|---|---|
| **Next.js 15 (App Router) + React 19 + TypeScript** | Un seul projet front + API, pages serveur (peu de JS envoyé), déploiement trivial (Vercel, Docker, Node). |
| **Tailwind CSS 4** + variables CSS | Design system léger, mode clair/sombre sans bibliothèque UI (bundle réduit). Graphiques en SVG maison. |
| **PostgreSQL + Prisma 6** | Relations strictes, migrations versionnées, types générés. Les index partiels (unicité des mots globaux) sont possibles. |
| **FSRS via `ts-fsrs`** | Algorithme de répétition espacée moderne (successeur de SM-2, utilisé par Anki ≥ 23.10), plus précis qu'un SM-2 maison. |
| **Auth maison : bcrypt + JWT (jose) en cookie HttpOnly** | Pas de dépendance à un fournisseur, 100 % contrôlable, middleware compatible Edge. |
| **LLM Anthropic via `fetch` côté serveur** | Clé jamais exposée au navigateur ; couche `AIService` unique, remplaçable (un seul fichier `llm.ts` à changer pour un autre fournisseur). |
| **Web Speech API** pour TTS/STT | Gratuit, sans clé, temps réel. Limite : dépend du navigateur (voir tableau ci-dessus). |
| **Zod** | Validation de toutes les entrées API **et** des sorties JSON du LLM. |
| **Vitest + scripts e2e (API + Playwright)** | Tests unitaires rapides + parcours réels contre la vraie base. |

## 2. Démarrage rapide

Prérequis : Node ≥ 20, PostgreSQL ≥ 14 (ou Docker).

```bash
cd lingua
npm install
cp .env.example .env          # puis éditez AUTH_SECRET et DATABASE_URL
# Base locale (exemple Linux) :
#   sudo -u postgres psql -c "CREATE USER lingua WITH PASSWORD 'lingua' CREATEDB;" -c "CREATE DATABASE lingua OWNER lingua;"
npx prisma migrate deploy      # applique les migrations
npm run db:seed                # charge les 500 mots, verbes, decks, mots apparentés, compétences
npm run dev                    # http://localhost:3000
```

Avec Docker (base + app en une commande) :

```bash
AUTH_SECRET=$(openssl rand -base64 48) docker compose up --build
```

> Le `Dockerfile` et le `docker-compose.yml` n'ont pas pu être exécutés dans l'environnement de développement de ce projet (pas de démon Docker) : ils suivent un schéma standard mais n'ont **pas** été testés.

Premier lancement : créez un compte → test de niveau → dashboard. Sans clé IA, la conversation fonctionne en mode démo.

## 3. Variables d'environnement

Voir `.env.example` (toutes documentées).

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `AUTH_SECRET` | oui | Signature des cookies de session (≥ 32 caractères : `openssl rand -base64 48`) |
| `APP_URL` | non | URL publique (liens de réinitialisation) |
| `ANTHROPIC_API_KEY` | non | Active le vrai professeur IA. Vide ⇒ mode démo |
| `ANTHROPIC_MODEL` | non | Modèle (défaut `claude-sonnet-5-5`) |
| `ANTHROPIC_BASE_URL` | non | Proxy / passerelle |
| `AI_FORCE_MOCK` | non | `true` force le mode démo même avec une clé |
| `RESEND_API_KEY`, `EMAIL_FROM` | non | Envoi des e-mails de réinitialisation |
| `RATE_LIMIT_AI_PER_MIN`, `RATE_LIMIT_AUTH_PER_MIN` | non | Limites (défaut 20 / 10 par minute) |

Aucune clé n'est codée en dur ni envoyée au client (`grep -r ANTHROPIC src/components src/app/**/page.tsx` ne renvoie rien d'utile : seules des routes serveur lisent `process.env`).

## 4. Base de données, migrations, seed

```bash
npx prisma migrate dev --name ma_migration   # développement : crée + applique
npx prisma migrate deploy                    # production : applique l'existant
npm run db:seed                              # idempotent, peut être relancé
npm run db:reset                             # ⚠️ efface tout, rejoue migrations
SEED_DEMO=true npm run db:seed               # crée aussi demo@lingua.app / demo12345 (jamais en production)
npx prisma studio                            # explorer la base
```

Le seed charge : **666 entrées de vocabulaire globales** (dont exactement 500 classées par fréquence), 104 verbes, 142 mots apparentés / faux amis, 15 compétences grammaticales. À l'inscription, l'utilisateur reçoit ses 500 cartes (état « jamais vue »), « My Words » et « My Mistakes ».

## 5. Obtenir et configurer la clé IA

1. Créez un compte sur <https://console.anthropic.com/> et générez une clé API (menu *API keys*).
2. Dans `.env` : `ANTHROPIC_API_KEY="sk-ant-…"` (et éventuellement `ANTHROPIC_MODEL`).
3. Redémarrez. Le bandeau « Mode démo » disparaît de la page *AI Conversation*, et le badge « Demo mode » du chat aussi.
4. Surveillez les coûts : chaque message de conversation = 1 appel (≈ 500 tokens de sortie max). Le rate limiting (20/min/utilisateur) limite les abus.

Pour utiliser un autre fournisseur : modifiez uniquement `src/lib/ai/llm.ts` (fonction `complete`).

## 6. Tests

```bash
npm test                 # 86 tests unitaires (FSRS, filtres, normalisation, CSV, correcteur démo, chemin LLM sur API simulée, intégrité des données…)
npm run typecheck        # tsc --noEmit
npm run build            # build de production
# Parcours complets (serveur lancé et seedé : npm run dev, ou npm run build && npm start)
# (le serveur doit tourner avec ALLOW_REGISTRATION=true : les tests créent leurs comptes)
npm run e2e              # 198 vérifications API contre la vraie base (184 sur un build de production : le lien de reset n'y est volontairement pas exposé)
CHROMIUM_PATH=/chemin/vers/chrome npm run e2e:ui   # 116 vérifications dans un vrai navigateur (Playwright), mobile compris
```

> **Limite à connaître** : sans clé, le chemin « vraie IA » n'a été testé que contre une **API Anthropic simulée** (`tests/llm-live-path.test.ts` : forme de la requête, normalisation des messages, validation du JSON, repli en mode démo). Le comportement réel du modèle n'a **pas** été vérifié ici.

`e2e` couvre : inscription/connexion/reset, test de niveau, 500 mots (plages de rang, fonctions, tris), détection de doublons, CRUD cartes, FSRS (Again < Hard < Good < Easy, historique, cartes difficiles), filtres combinés, conversation + corrections + erreurs récurrentes + plan, cartes générées, grammaire, verbes, recherche, decks, import/export, statistiques, sécurité (CSRF, rate limit, isolation entre utilisateurs).
`e2e:ui` couvre : le parcours d'inscription réel, le test de niveau au clavier, la détection de doublon dans la modale, la session de révision (retournement, notation, prononciation US/UK), le **micro** et la **synthèse vocale** (API Web Speech **remplacées par des stubs déterministes** car le Chromium headless n'a ni micro ni voix), le rapport de conversation, le mobile 390 px (pas de scroll horizontal, cibles tactiles, labels).

## 7. Architecture et structure des fichiers

```
lingua/
├── prisma/            schema.prisma, migrations/, seed.ts
├── data/              common500.base.json (rang + comptes), common500.enrich.txt, verbs.json, extra.txt, cognates.txt, SOURCES.md
├── scripts/           build-common500.py, build-verbs.py (régénèrent les données), e2e.ts, e2e-ui.ts, shots.ts
├── src/
│   ├── app/
│   │   ├── (auth)/    login, register, forgot/reset password
│   │   ├── (app)/     dashboard, cards, decks, conversation, grammar, verbs, vocabulary, cognates, mistakes, stats, progress, profile, settings, search
│   │   ├── (focus)/   placement (test de niveau), review (session de révision plein écran)
│   │   └── api/       routes REST (voir §9)
│   ├── components/    ui.tsx (design system), shell.tsx, flashcard.tsx, card-editor.tsx, card-browser.tsx, charts.tsx, providers.tsx, speak.tsx
│   ├── content/       grammar.ts (5 leçons + exercices), placement.ts, scenarios.ts (16 scénarios)
│   └── lib/
│       ├── ai/        service.ts (AIService), prompts.ts, llm.ts, mock.ts, schemas.ts, context.ts
│       ├── fsrs.ts  filters.ts  cards.ts  review.ts  plan.ts  progress.ts  skills.ts  mistakes.ts  stats.ts  exchange.ts …
└── tests/             Vitest
```

**Séparation des responsabilités** : routes = validation + autorisation ; `src/lib` = logique métier pure/testable ; `AIService` = seul point d'accès au LLM (aucun prompt dans les composants) ; les réponses des exercices ne quittent jamais le serveur.

### Écrans

| Route | Écran |
|---|---|
| `/` · `/login` · `/register` · `/forgot-password` · `/reset-password` | Accueil, inscription, connexion, mot de passe oublié |
| `/placement` | Test de niveau (vocabulaire, grammaire, conjugaison, compréhension) → *Estimated level* + programme |
| `/dashboard` | Bonjour, streak, progression du jour, plan du jour, niveau A2 → B1, faiblesses, badges |
| `/review` | Réglages de révision (nombre, source, statut, difficulté, rang, fonction, niveau, ordre) puis session plein écran |
| `/cards` · `/decks` · `/decks/:id` | My Cards (créer/modifier/supprimer/rechercher/filtrer/trier, import/export), decks et leur progression |
| `/conversation` · `/conversation/:id` | Scénarios (16 + Surprise me), chat texte + micro, corrections discrètes, clic sur un mot, rapport |
| `/vocabulary` · `/verbs` · `/cognates` · `/search` | Vocabulaire par fonction, Most Common Verbs, mots apparentés + faux amis, recherche globale |
| `/grammar` · `/grammar/:slug` | 5 leçons + exercices (QCM, compléter, traduire, corriger, créer, dictée) |
| `/mistakes` · `/progress` · `/stats` | Erreurs récurrentes, niveau par compétence + lacunes, statistiques et graphiques |
| `/profile` · `/settings` | Profil/objectifs/badges, thème, accent, voix, vitesse, English Only, mot de passe |

## 8. Modèle de données

`User`, `Deck`, `DeckCard`, `Flashcard`, `Review`, `Vocabulary`, `VocabularyFrequency`, `Cognate`, `Conversation`, `ConversationMessage`, `Mistake`, `GrammarSkill`, `UserSkill`, `SkillEstimate`, `DailyGoal`, `Achievement`, `LearningSession`, `ExerciseResult`, `PasswordReset`.

* **`Vocabulary` ≠ `Flashcard`** : un mot global (`house`, rang 192) existe une fois, indépendamment des utilisateurs ; `Flashcard` est la carte d'un utilisateur pour ce mot (état FSRS). Unicité `(userId, vocabularyId)` : un mot présent dans plusieurs decks (`DeckCard`) n'est révisé qu'une fois. Les mots saisis par un utilisateur sont des `Vocabulary` **privés** (`ownerId`).
* **Doublons** : clé `normalized` (minuscules, espaces, ponctuation) + index unique partiel pour les mots globaux.
* **Lemmes** : `lemmaId` relie `went → go`, `years → year` sans fusionner les entrées. `run` et `running` restent deux entrées distinctes ; la détection de doublon propose les formes liées sans bloquer.
* **Niveau** : `SkillEstimate` (6 compétences, échelle continue 0–6) → `User.level`. Les erreurs récurrentes vivent dans `UserSkill.priority`.

## 9. API

Toutes les routes (sauf auth) exigent une session. Entrées validées par Zod ; erreurs `{ "error": "…" }` avec codes 400/401/403/404/409/429.

| Domaine | Routes |
|---|---|
| Auth | `POST /api/auth/{register,login,logout,forgot-password,reset-password}` · `GET /api/auth/me` |
| Profil | `PATCH/DELETE /api/profile` · `POST /api/profile/password` |
| Test de niveau | `GET/POST /api/placement` |
| Cartes | `GET/POST /api/cards` (filtres, tri, pagination ; 409 si doublon) · `PATCH/DELETE /api/cards/:id` · `POST /api/cards/from-vocabulary` · `GET /api/cards/export?format=csv\|anki-tsv` · `POST /api/cards/import` |
| Doublons / recherche | `GET /api/vocabulary/check?word=` · `GET /api/search?q=` · `GET /api/vocabulary?fn=` |
| Decks | `GET/POST /api/decks` · `GET/PATCH/DELETE /api/decks/:id` · `POST /api/decks/install` |
| Révision | `POST /api/review/{preview,queue,answer,finish}` |
| Conversation | `GET/POST /api/conversation` · `GET/DELETE /api/conversation/:id` · `POST …/:id/message` · `POST …/:id/end` |
| IA | `POST /api/ai/{flashcard,example,explain-word,grammar}` |
| Erreurs | `GET /api/mistakes` · `POST /api/mistakes/:id/card` · `POST /api/mistakes/cards` |
| Grammaire | `POST /api/grammar/check` |
| Contenu | `GET /api/verbs?top=` · `GET /api/cognates?kind=` |
| Suivi | `GET /api/stats` · `GET /api/plan` · `GET /api/progress` |

Le filtre de révision (`CardFilter`) : `scope` (`mine`/`mistakes`/`common500`), `status` (`due`/`new`/`learning`/`mastered`), `difficulty`, `functions`, `levels`, `rankMin`/`rankMax`, `deckId`, `ids`, `q`, `tag`. **Règle** : OU à l'intérieur d'un groupe, ET entre groupes (ex. `verbs` + `rank 1–200` + `difficiles` = verbes classés 1–200 que vous ratez).

## 10. Algorithmes

* **Répétition espacée** — FSRS-5 (`ts-fsrs`), rétention visée 90 % (réglable 85–97 %), *fuzz* activé. Étapes d'apprentissage 1 min / 10 min : les cartes en (ré)apprentissage reviennent dans la même session (comme Anki). Chaque réponse crée une ligne `Review` (note, états avant/après, stabilité, difficulté, intervalle, durée).
* **Carte « difficile »** : ≥ 2 oublis (*lapses*) **ou** difficulté FSRS ≥ 7. **« Maîtrisée »** : état Review et stabilité ≥ 21 jours. **« À revoir »** : échéance avant la fin de la journée locale de l'utilisateur.
* **Sélection d'une session** : cartes dues (plus anciennes d'abord) → nouvelles (par rang de fréquence) → autres cartes éligibles (entraînement anticipé).
* **Niveau** — échelle continue 0 (début A1) → 6 (fin C2) par compétence. Test de niveau : estimation MAP (modèle logistique 3PL, a priori faible). En continu : mise à jour de type Elo après chaque révision (Vocabulary), exercice (Grammar, Listening) ; les conversations ajustent Speaking/Writing vers le niveau estimé. Niveau global = moyenne pondérée → `A2+`, `B1`… et mise à jour automatique de `User.level`. Reading ne provient que du test de niveau (limite connue).
* **Erreurs récurrentes** : `UserSkill.priority` +1 par erreur, −0,35 par réussite ; trie le plan du jour et le contexte envoyé au professeur IA.
* **Plan du jour** (`lib/plan.ts`, déterministe, recalculé à chaque chargement) : budget de temps → conversation, révisions dues, mots difficiles, exercices sur la compétence prioritaire, erreurs à revoir, nouveaux mots. S'adapte : moins de mots neufs si l'arriéré dépasse 2× l'objectif ou si la réussite < 70 % ; +2 si > 92 %.

## 11. Données : les 500 mots et leur source

Voir `data/SOURCES.md`. Résumé : liste de fréquence **OpenSubtitles 2018** (anglais conversationnel, CC-BY-SA 4.0, Hermit Dave/FrequencyWords), filtrée (fragments de contractions, interjections, noms propres, vulgarités) → rang = position dans la liste filtrée, compte brut conservé. Les traductions, exemples, IPA et niveaux CECRL ont été rédigés pour le projet : **les niveaux CECRL sont des estimations éditoriales, pas une classification officielle**, et l'IPA est de type britannique. Le fait que ce soit une liste de *formes* (et non de lemmes) est assumé et documenté (les formes sont reliées par `lemmaId`).

## 12. Déploiement

**Vercel + Neon/Supabase** : créez la base, renseignez `DATABASE_URL` (+ `?sslmode=require`), `AUTH_SECRET`, `APP_URL`, `ANTHROPIC_API_KEY`. Commande de build : `npm run build` ; avant le premier déploiement lancez une fois `npx prisma migrate deploy && npm run db:seed` (depuis votre machine avec la `DATABASE_URL` de production). Le rate limiting étant en mémoire, il est par fonction serverless : branchez Upstash/Redis si l'abus est une préoccupation.

**VPS / Docker** : `docker compose up --build -d` (voir §2) derrière un reverse-proxy HTTPS (les cookies sont `Secure` en production).

**Node direct** : `npm run build && npx prisma migrate deploy && npm run db:seed && npm start`.

## 13. Sécurité, performance, accessibilité

* **Sécurité** : mots de passe bcrypt (coût 11) ; session JWT HS256 en cookie `HttpOnly; SameSite=Lax; Secure` (prod) ; vérification d'origine sur toutes les requêtes mutantes (anti-CSRF) ; réponses d'authentification génériques (pas d'énumération de comptes) ; jetons de réinitialisation à usage unique, hachés, 1 h ; validation Zod partout ; contrôle de propriété sur chaque ressource (404 pour les ressources d'autrui) ; rate limiting (auth + IA) ; en-têtes de sécurité ; clés IA uniquement côté serveur ; échappement CSV anti-injection de formules ; réponses d'exercices vérifiées côté serveur ; texte utilisateur passé en rôle `user` au LLM (jamais dans le prompt système). Le CSP complet n'est pas activé (styles inline de Next) — piste d'amélioration.
* **Performance** : pages serveur, JS minimal (pas de lib de charts/UI), cache client avec dédoublonnage des requêtes (`useApi`), index SQL sur les accès chauds, compteurs de decks en une requête SQL, ranges/filtres exécutés en base, pagination, contenu statique mis en cache.
* **Accessibilité** : navigation clavier complète (révision : Espace / 1-4), lien d'évitement, labels et `aria-*`, focus visibles, contrastes AA, cibles tactiles ≥ 44 px, états de chargement/erreur/vide, `prefers-reduced-motion`, `aria-live` pour les retours.

## 14. Limites connues, risques, pistes

* **Mode démo ≠ IA** (voir en tête). La qualité du professeur dépend du modèle et du prompt (`src/lib/ai/prompts.ts`).
* Le texte de conversation est envoyé au fournisseur LLM : à mentionner dans votre politique de confidentialité (RGPD).
* Voix/accents : dépendent des voix installées ; certains appareils n'ont qu'une voix anglaise. Pas de TTS serveur (piste : un service TTS derrière une route avec cache).
* Évaluation de la prononciation réelle : non implémentée (nécessite un service dédié, ex. Azure Pronunciation Assessment).
* Contenu éditorial (traductions, niveaux, 5 leçons de grammaire, exercices) limité : extensible via `data/*.txt` et `src/content/*`. Les phrases d'exemple ont été relues mais restent du contenu rédigé à la main.
* Import/export Anki : export texte compatible (Front/Back/Tags) fourni ; l'import/export `.apkg` n'est pas implémenté, mais l'architecture (`lib/exchange.ts`, registre `FORMATS`) est prête.
* Pas de PWA hors-ligne, pas d'application native.
* Rate limiting par instance ; pas de journal d'audit ; pas d'e-mail de vérification à l'inscription.
