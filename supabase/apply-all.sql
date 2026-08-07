-- =====================================================================
-- Omix Community — full schema apply (idempotent)
-- Project: https://frcmgkayluazwkokywux.supabase.co
--
-- How to use:  Supabase Dashboard > SQL Editor > New query
--              paste this entire file > Run.  Safe to re-run.
-- =====================================================================

-- ══════════════════════════════════════════════════════════
-- 20250101000000_init.sql
-- ══════════════════════════════════════════════════════════
-- Supabase migration: Initial schema for Omix Social app
-- Created by migration script

CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(255) NOT NULL UNIQUE,
    email_confirmed_at timestamptz,
    encrypted_password text,
    avatar_url text,
    full_name varchar(255),
    bio text,
    preferences jsonb DEFAULT '{}'::jsonb,
    last_login timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.servers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    description text,
    avatar_url text,
    created_by uuid REFERENCES public.users(id) ON DELETE CASCADE,
    member_count integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
    created_by uuid REFERENCES public.users(id),
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    pinned boolean NOT NULL DEFAULT false,
    reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.server_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    role varchar(50) NOT NULL DEFAULT 'member',
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_read_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    emoji varchar(50) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_servers_created_by ON public.servers(created_by);
CREATE INDEX IF NOT EXISTS idx_channels_server_id ON public.channels(server_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server_id ON public.server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON public.reactions(message_id);

-- Row Level Security policies (basic examples)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_select ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_self_update ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY servers_public_select ON public.servers FOR SELECT USING (true);
CREATE POLICY servers_owner_update ON public.servers FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY channels_public_select ON public.channels FOR SELECT USING (true);
CREATE POLICY messages_public_select ON public.messages FOR SELECT USING (true);
CREATE POLICY messages_owner_update ON public.messages FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY server_members_select ON public.server_members FOR SELECT USING (true);
CREATE POLICY reactions_public_select ON public.reactions FOR SELECT USING (true);

-- ══════════════════════════════════════════════════════════
-- 20250101000001_additional_tables.sql
-- ══════════════════════════════════════════════════════════
-- Additional tables for Omix Social app migration

-- Typing indicators (ephemeral, auto-cleaned)
CREATE TABLE IF NOT EXISTS public.typing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    display_name varchar(255) NOT NULL,
    session_id varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Presence tracking
CREATE TABLE IF NOT EXISTS public.presence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id varchar(255) NOT NULL UNIQUE,
    display_name varchar(255) NOT NULL,
    color varchar(50) NOT NULL,
    online boolean NOT NULL DEFAULT true,
    last_seen timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- User profiles (extended info beyond auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id varchar(255) NOT NULL UNIQUE,
    name varchar(255) NOT NULL,
    avatar text DEFAULT '',
    color varchar(50) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- User stats (XP, badges, streaks)
CREATE TABLE IF NOT EXISTS public.stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id varchar(255) NOT NULL UNIQUE,
    xp integer NOT NULL DEFAULT 0,
    level integer NOT NULL DEFAULT 1,
    messages_sent integer NOT NULL DEFAULT 0,
    reactions_received integer NOT NULL DEFAULT 0,
    replies_received integer NOT NULL DEFAULT 0,
    badges jsonb DEFAULT '[]'::jsonb,
    last_message_date varchar(20) DEFAULT '',
    streak_count integer NOT NULL DEFAULT 0,
    join_date varchar(20) DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- App config (admin settings)
CREATE TABLE IF NOT EXISTS public.config (
    id varchar(255) PRIMARY KEY,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Invite codes
CREATE TABLE IF NOT EXISTS public.invites (
    code varchar(255) PRIMARY KEY,
    server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
    created_by varchar(255) NOT NULL,
    uses integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- DM channels
CREATE TABLE IF NOT EXISTS public.dm_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participants jsonb NOT NULL DEFAULT '[]'::jsonb,
    participant_names jsonb DEFAULT '{}'::jsonb,
    last_message_at timestamptz,
    last_message_text text DEFAULT '',
    last_message_author varchar(255) DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- DM messages
CREATE TABLE IF NOT EXISTS public.dm_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dm_channel_id uuid REFERENCES public.dm_channels(id) ON DELETE CASCADE,
    author varchar(255) NOT NULL,
    author_id varchar(255) NOT NULL,
    session_id varchar(255) NOT NULL,
    text text NOT NULL,
    color varchar(50) NOT NULL,
    timestamp timestamptz NOT NULL DEFAULT now(),
    reactions jsonb DEFAULT '{}'::jsonb,
    edited boolean DEFAULT false,
    edited_at timestamptz,
    file_url text,
    file_type varchar(100),
    file_name text,
    file_size integer,
    reply_to jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- FCM tokens (for push notifications)
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id varchar(255) NOT NULL UNIQUE,
    token text NOT NULL,
    user_id varchar(255) NOT NULL,
    display_name varchar(255) DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications queue
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id varchar(255) NOT NULL,
    title varchar(255) NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    sent boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_typing_channel_id ON public.typing(channel_id);
CREATE INDEX IF NOT EXISTS idx_typing_session_id ON public.typing(session_id);
CREATE INDEX IF NOT EXISTS idx_presence_session_id ON public.presence(session_id);
CREATE INDEX IF NOT EXISTS idx_presence_online ON public.presence(online);
CREATE INDEX IF NOT EXISTS idx_profiles_session_id ON public.profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_stats_session_id ON public.stats(session_id);
CREATE INDEX IF NOT EXISTS idx_dm_channels_participants ON public.dm_channels USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_dm_messages_channel_id ON public.dm_messages(dm_channel_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_timestamp ON public.dm_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_invites_server_id ON public.invites(server_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_session_id ON public.fcm_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications(target_user_id);

-- RLS policies (allow all for community app)
ALTER TABLE public.typing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY typing_all ON public.typing FOR ALL USING (true);
CREATE POLICY presence_all ON public.presence FOR ALL USING (true);
CREATE POLICY profiles_all ON public.profiles FOR ALL USING (true);
CREATE POLICY stats_all ON public.stats FOR ALL USING (true);
CREATE POLICY config_all ON public.config FOR ALL USING (true);
CREATE POLICY invites_all ON public.invites FOR ALL USING (true);
CREATE POLICY dm_channels_all ON public.dm_channels FOR ALL USING (true);
CREATE POLICY dm_messages_all ON public.dm_messages FOR ALL USING (true);
CREATE POLICY fcm_tokens_all ON public.fcm_tokens FOR ALL USING (true);
CREATE POLICY notifications_all ON public.notifications FOR ALL USING (true);

-- ══════════════════════════════════════════════════════════
-- 20260101000000_call_log.sql
-- ══════════════════════════════════════════════════════════
-- Call history log (voice/video calls)
CREATE TABLE IF NOT EXISTS public.call_log (
    id varchar(255) PRIMARY KEY,
    caller_id varchar(255) NOT NULL,
    callee_id varchar(255) NOT NULL,
    caller_name varchar(255) DEFAULT '',
    callee_name varchar(255) DEFAULT '',
    video boolean NOT NULL DEFAULT false,
    status varchar(50) NOT NULL DEFAULT 'ringing',
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    duration_ms bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_log_caller ON public.call_log (caller_id);
CREATE INDEX IF NOT EXISTS idx_call_log_callee ON public.call_log (callee_id);

-- Enable realtime for call_log so the Recent Calls panel updates live.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'call_log'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_log;
    END IF;
END $$;

-- ══════════════════════════════════════════════════════════
-- 20260101000002_omix_features.sql
-- ══════════════════════════════════════════════════════════
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

-- ══════════════════════════════════════════════════════════
-- 20260101000003_workspace_discovery.sql
-- ══════════════════════════════════════════════════════════
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
