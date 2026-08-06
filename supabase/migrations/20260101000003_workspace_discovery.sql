-- Omix workspace discovery (stitch 20)
-- servers gain privacy/description/icon/member_count so the discovery screen can
-- show "Create a New Workspace" (with privacy level) and "Browse Public Boardrooms".

ALTER TABLE public.servers
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS privacy varchar(20) NOT NULL DEFAULT 'private',
    ADD COLUMN IF NOT EXISTS icon text,
    ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_servers_privacy ON public.servers (privacy);

-- Any signed-in user may create a workspace from the client. Mirrors the
-- permissive policies used across the rest of this community app.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'servers' AND policyname = 'servers_anyone_insert'
    ) THEN
        CREATE POLICY servers_anyone_insert ON public.servers
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;
