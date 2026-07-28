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
