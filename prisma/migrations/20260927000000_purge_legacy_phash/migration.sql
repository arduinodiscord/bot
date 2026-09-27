-- The pre-2026-09-27 pHash thresholded on a mean that included the DC term, so
-- most hashes were near-all-zero and matched unrelated images. Those stored
-- fingerprints are meaningless under the fixed algorithm (and dangerous: a
-- near-zero "scam" hash would auto-ban posters of ordinary screenshots).
-- Exact metadata signatures ("meta") are unaffected and kept.
DELETE FROM "SpamSignature" WHERE "kind" = 'phash';
DELETE FROM "AllowSignature" WHERE "kind" = 'phash';
