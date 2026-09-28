-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberAnalyticsEvent" AS ENUM ('join', 'leave');

-- CreateTable
CREATE TABLE "MemberAnalytics" (
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" "MemberAnalyticsEvent" NOT NULL,
    "memberId" VARCHAR NOT NULL,

    CONSTRAINT "MemberAnalytics_pkey" PRIMARY KEY ("time")
);

-- CreateTable
CREATE TABLE "MessageAnalytics" (
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" VARCHAR,
    "channelId" VARCHAR,

    CONSTRAINT "MessageAnalytics_pk" PRIMARY KEY ("time")
);

-- CreateTable
CREATE TABLE "CommandAnalytics" (
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "command" VARCHAR,

    CONSTRAINT "CommandAnalytics_pk" PRIMARY KEY ("time")
);

-- CreateTable
CREATE TABLE "SpamSignature" (
    "signature" VARCHAR NOT NULL,
    "kind" VARCHAR NOT NULL DEFAULT 'meta',
    "addedBy" VARCHAR NOT NULL,
    "reason" VARCHAR,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpamSignature_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderatorId" VARCHAR NOT NULL,
    "targetId" VARCHAR NOT NULL,
    "action" VARCHAR NOT NULL,
    "reason" VARCHAR,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

