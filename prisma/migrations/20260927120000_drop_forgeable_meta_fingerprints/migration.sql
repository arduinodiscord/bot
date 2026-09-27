-- "meta" fingerprints were built from attachment metadata (content type, byte
-- size, dimensions), all chosen by the uploader. A padded scam image could
-- impersonate a popular benign file, so a "Confirm scam" on it would auto-ban
-- the next person to post the real file, and a forged match to a "Not spam"
-- entry skipped all checks. Identity is now the SHA-256 of the image content
-- ("sha"); the old rows are unusable and are removed.
DELETE FROM "SpamSignature" WHERE "kind" = 'meta';
DELETE FROM "AllowSignature" WHERE "kind" = 'meta';
ALTER TABLE "SpamSignature" ALTER COLUMN "kind" SET DEFAULT 'sha';
