-- The analytics tables used `time` as their primary key, so two events in the
-- same millisecond (e.g. a raid's member joins) failed with a unique-constraint
-- error and the second row was lost. Give each table a surrogate SERIAL id as
-- the primary key and keep `time` indexed for the retention sweep.
--
-- Written for tables that already hold data: adding a SERIAL column backfills
-- every existing row from the new sequence. The existing primary key is found
-- by lookup rather than by name, because 0_init was introspected from a live
-- database and the constraint names are not uniform ("_pkey" vs "_pk").

DO $$
DECLARE
  t TEXT;
  pk TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['MemberAnalytics', 'MessageAnalytics', 'CommandAnalytics'] LOOP
    SELECT conname INTO pk
      FROM pg_constraint
     WHERE conrelid = format('%I', t)::regclass AND contype = 'p';
    IF pk IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, pk);
    END IF;
  END LOOP;
END $$;

-- MemberAnalytics
ALTER TABLE "MemberAnalytics" ADD COLUMN "id" SERIAL NOT NULL;
ALTER TABLE "MemberAnalytics" ADD CONSTRAINT "MemberAnalytics_pkey" PRIMARY KEY ("id");
CREATE INDEX "MemberAnalytics_time_idx" ON "MemberAnalytics"("time");

-- MessageAnalytics
ALTER TABLE "MessageAnalytics" ADD COLUMN "id" SERIAL NOT NULL;
ALTER TABLE "MessageAnalytics" ADD CONSTRAINT "MessageAnalytics_pkey" PRIMARY KEY ("id");
CREATE INDEX "MessageAnalytics_time_idx" ON "MessageAnalytics"("time");

-- CommandAnalytics
ALTER TABLE "CommandAnalytics" ADD COLUMN "id" SERIAL NOT NULL;
ALTER TABLE "CommandAnalytics" ADD CONSTRAINT "CommandAnalytics_pkey" PRIMARY KEY ("id");
CREATE INDEX "CommandAnalytics_time_idx" ON "CommandAnalytics"("time");
