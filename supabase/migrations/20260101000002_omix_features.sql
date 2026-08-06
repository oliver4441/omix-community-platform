-- Omix features: boardroom posts/votes, richer profiles, notification settings
-- Mirrors migration style of 20260101000000_call_log.sql.

-- ============ Boardroom (board posts + votes) ============
CREATE TABLE IF NOT EXISTS public.board_posts (
    id varchar(255) PRIMARY KEY,
    title varchar(255) NOT NULL,
    body text NOT NULL,
    category varchar(50) NOT NULL DEFAULT 'general',
    author_id varchar(255) NOT NULL,
    author_name varchar(255) NOT NULL DEFAULT '',
    author_avatar varchar(255) NOT NULL DEFAULT '',
    author_color varchar(64) NOT NULL DEFAULT '#a078ff',
    vote_count bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_posts_category ON public.board_posts (category);
CREATE INDEX IF NOT EXISTS idx_board_posts_created ON public.board_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_posts_votes ON public.board_posts (vote_count DESC);

CREATE TABLE IF NOT EXISTS public.board_votes (
    post_id varchar(255) NOT NULL REFERENCES public.board_posts (id) ON DELETE CASCADE,
    session_id varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_board_votes_session ON public.board_votes (session_id);

-- Upvote: upsert vote then bump the post counter in one transaction.
CREATE OR REPLACE FUNCTION public.vote_board_post(p_post_id varchar, p_session_id varchar)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.board_votes (post_id, session_id)
    VALUES (p_post_id, p_session_id)
    ON CONFLICT (post_id, session_id) DO NOTHING;

    UPDATE public.board_posts
    SET vote_count = (
        SELECT count(*) FROM public.board_votes WHERE post_id = p_post_id
    )
    WHERE id = p_post_id;
END $$;

-- Unvote: remove vote then recompute the counter.
CREATE OR REPLACE FUNCTION public.unvote_board_post(p_post_id varchar, p_session_id varchar)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.board_votes WHERE post_id = p_post_id AND session_id = p_session_id;

    UPDATE public.board_posts
    SET vote_count = (
        SELECT count(*) FROM public.board_votes WHERE post_id = p_post_id
    )
    WHERE id = p_post_id;
END $$;

ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_posts_readable_by_all" ON public.board_posts
    FOR SELECT USING (true);
CREATE POLICY "board_posts_anyone_can_insert" ON public.board_posts
    FOR INSERT WITH CHECK (true);
CREATE POLICY "board_posts_anyone_can_vote" ON public.board_votes
    FOR ALL USING (true);

-- ============ Profiles extras ============
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS github_username varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS bio text DEFAULT '';

-- ============ Notification settings ============
CREATE TABLE IF NOT EXISTS public.notification_settings (
    session_id varchar(255) PRIMARY KEY,
    push_enabled boolean NOT NULL DEFAULT false,
    sound_enabled boolean NOT NULL DEFAULT true,
    message_sound varchar(50) NOT NULL DEFAULT 'Pop',
    call_ringtone varchar(50) NOT NULL DEFAULT 'Classic',
    dnd_enabled boolean NOT NULL DEFAULT false,
    dnd_days text[] NOT NULL DEFAULT '{}',
    dnd_start time NOT NULL DEFAULT '22:00',
    dnd_end time NOT NULL DEFAULT '08:00',
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings_all" ON public.notification_settings
    FOR ALL USING (true);

-- ============ Realtime ============
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'board_posts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.board_posts;
    END IF;
END $$;
