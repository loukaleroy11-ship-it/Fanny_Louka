-- CreateEnum
CREATE TYPE "Level" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "Accent" AS ENUM ('US', 'UK');

-- CreateEnum
CREATE TYPE "PartOfSpeech" AS ENUM ('NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PRONOUN', 'PREPOSITION', 'CONJUNCTION', 'DETERMINER', 'AUXILIARY', 'MODAL', 'PHRASAL_VERB', 'EXPRESSION', 'INTERJECTION');

-- CreateEnum
CREATE TYPE "CardOrigin" AS ENUM ('COMMON500', 'CATALOG', 'USER', 'AI', 'MISTAKE', 'IMPORT');

-- CreateEnum
CREATE TYPE "DeckKind" AS ENUM ('COMMON500', 'MISTAKES', 'CUSTOM', 'CATALOG');

-- CreateEnum
CREATE TYPE "SkillArea" AS ENUM ('VOCABULARY', 'GRAMMAR', 'READING', 'LISTENING', 'WRITING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "MistakeCategory" AS ENUM ('GRAMMAR', 'VOCABULARY', 'PREPOSITION', 'SPELLING', 'PRONUNCIATION', 'WORD_ORDER', 'OTHER');

-- CreateEnum
CREATE TYPE "MistakeSource" AS ENUM ('CONVERSATION', 'EXERCISE', 'PLACEMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('REVIEW', 'CONVERSATION', 'GRAMMAR', 'PLACEMENT');

-- CreateEnum
CREATE TYPE "CognateKind" AS ENUM ('COGNATE', 'FALSE_FRIEND');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "Level" NOT NULL DEFAULT 'A1',
    "goal" TEXT NOT NULL DEFAULT 'Parler anglais au quotidien',
    "dailyMinutes" INTEGER NOT NULL DEFAULT 15,
    "dailyNewCards" INTEGER NOT NULL DEFAULT 5,
    "dailyReviewCards" INTEGER NOT NULL DEFAULT 20,
    "dailyConversations" INTEGER NOT NULL DEFAULT 1,
    "placementDone" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "accent" "Accent" NOT NULL DEFAULT 'US',
    "voiceGender" TEXT NOT NULL DEFAULT 'female',
    "speechRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "englishOnly" BOOLEAN NOT NULL DEFAULT false,
    "autoAddMistakes" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "desiredRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vocabulary" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "ownerId" TEXT,
    "lemmaId" TEXT,
    "pos" "PartOfSpeech" NOT NULL,
    "category" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "translation" TEXT NOT NULL,
    "ipa" TEXT,
    "pronunciation" TEXT,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "definition" TEXT,
    "synonyms" TEXT[],
    "antonyms" TEXT[],
    "collocations" TEXT[],
    "related" TEXT[],
    "tags" TEXT[],
    "pastSimple" TEXT,
    "pastParticiple" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyFrequency" (
    "id" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "VocabularyFrequency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cognate" (
    "id" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "french" TEXT NOT NULL,
    "kind" "CognateKind" NOT NULL,
    "meaning" TEXT NOT NULL,
    "note" TEXT,
    "example" TEXT,
    "level" "Level" NOT NULL DEFAULT 'A2',

    CONSTRAINT "Cognate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "DeckKind" NOT NULL DEFAULT 'CUSTOM',
    "catalogKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "origin" "CardOrigin" NOT NULL,
    "tags" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),
    "suspended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "deckId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("deckId","flashcardId")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "sessionId" TEXT,
    "rating" INTEGER NOT NULL,
    "stateBefore" INTEGER NOT NULL,
    "stateAfter" INTEGER NOT NULL,
    "stabilityAfter" DOUBLE PRECISION NOT NULL,
    "difficultyAfter" DOUBLE PRECISION NOT NULL,
    "scheduledDays" INTEGER NOT NULL,
    "elapsedDays" INTEGER NOT NULL,
    "dueAfter" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "englishOnly" BOOLEAN NOT NULL DEFAULT false,
    "mock" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "wordsSpoken" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "viaVoice" BOOLEAN NOT NULL DEFAULT false,
    "correction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mistake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "MistakeCategory" NOT NULL,
    "skillId" TEXT,
    "original" TEXT NOT NULL,
    "corrected" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "source" "MistakeSource" NOT NULL,
    "conversationId" TEXT,
    "flashcardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarSkill" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "lessonSlug" TEXT,

    CONSTRAINT "GrammarSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEstimate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "SkillArea" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "targetMinutes" INTEGER NOT NULL,
    "targetCards" INTEGER NOT NULL,
    "targetNewWords" INTEGER NOT NULL,
    "targetConversations" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "cardsReviewed" INTEGER NOT NULL DEFAULT 0,
    "newWords" INTEGER NOT NULL DEFAULT 0,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "exercises" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "items" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonSlug" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answer" TEXT NOT NULL,
    "skillSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "Vocabulary_normalized_idx" ON "Vocabulary"("normalized");

-- CreateIndex
CREATE INDEX "Vocabulary_ownerId_idx" ON "Vocabulary"("ownerId");

-- CreateIndex
CREATE INDEX "Vocabulary_lemmaId_idx" ON "Vocabulary"("lemmaId");

-- CreateIndex
CREATE UNIQUE INDEX "Vocabulary_normalized_pos_ownerId_key" ON "Vocabulary"("normalized", "pos", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyFrequency_vocabularyId_key" ON "VocabularyFrequency"("vocabularyId");

-- CreateIndex
CREATE INDEX "VocabularyFrequency_rank_idx" ON "VocabularyFrequency"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "Cognate_english_kind_key" ON "Cognate"("english", "kind");

-- CreateIndex
CREATE INDEX "Deck_userId_kind_idx" ON "Deck"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Deck_userId_name_key" ON "Deck"("userId", "name");

-- CreateIndex
CREATE INDEX "Flashcard_userId_state_due_idx" ON "Flashcard"("userId", "state", "due");

-- CreateIndex
CREATE INDEX "Flashcard_userId_origin_idx" ON "Flashcard"("userId", "origin");

-- CreateIndex
CREATE UNIQUE INDEX "Flashcard_userId_vocabularyId_key" ON "Flashcard"("userId", "vocabularyId");

-- CreateIndex
CREATE INDEX "DeckCard_flashcardId_idx" ON "DeckCard"("flashcardId");

-- CreateIndex
CREATE INDEX "Review_userId_reviewedAt_idx" ON "Review"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "Review_flashcardId_reviewedAt_idx" ON "Review"("flashcardId", "reviewedAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_startedAt_idx" ON "Conversation"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Mistake_userId_createdAt_idx" ON "Mistake"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Mistake_userId_skillId_idx" ON "Mistake"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "GrammarSkill_slug_key" ON "GrammarSkill"("slug");

-- CreateIndex
CREATE INDEX "UserSkill_userId_priority_idx" ON "UserSkill"("userId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_skillId_key" ON "UserSkill"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEstimate_userId_area_key" ON "SkillEstimate"("userId", "area");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGoal_userId_date_key" ON "DailyGoal"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_code_key" ON "Achievement"("userId", "code");

-- CreateIndex
CREATE INDEX "LearningSession_userId_startedAt_idx" ON "LearningSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ExerciseResult_userId_lessonSlug_idx" ON "ExerciseResult"("userId", "lessonSlug");

-- CreateIndex
CREATE INDEX "ExerciseResult_userId_createdAt_idx" ON "ExerciseResult"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vocabulary" ADD CONSTRAINT "Vocabulary_lemmaId_fkey" FOREIGN KEY ("lemmaId") REFERENCES "Vocabulary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyFrequency" ADD CONSTRAINT "VocabularyFrequency_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "Vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "GrammarSkill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "GrammarSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEstimate" ADD CONSTRAINT "SkillEstimate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseResult" ADD CONSTRAINT "ExerciseResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Global (ownerId IS NULL) entries must be unique per (normalized, pos); NULLs are distinct in a
-- plain unique index, so enforce it with a partial index.
CREATE UNIQUE INDEX "Vocabulary_global_unique" ON "Vocabulary"("normalized", "pos") WHERE "ownerId" IS NULL;
