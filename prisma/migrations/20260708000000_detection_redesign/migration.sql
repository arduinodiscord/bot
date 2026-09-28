ALTER TABLE "SpamSignature" ADD COLUMN "severity" VARCHAR NOT NULL DEFAULT 'spam';

CREATE TABLE "AllowSignature" (
  "id" SERIAL NOT NULL,
  "signature" VARCHAR NOT NULL,
  "kind" VARCHAR NOT NULL,
  "addedBy" VARCHAR NOT NULL,
  "reason" VARCHAR,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AllowSignature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AllowSignature_signature_key" ON "AllowSignature"("signature");

CREATE TABLE "ScamKeyword" (
  "keyword" VARCHAR NOT NULL,
  "hits" INTEGER NOT NULL DEFAULT 1,
  "addedBy" VARCHAR NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ScamKeyword_pkey" PRIMARY KEY ("keyword")
);
