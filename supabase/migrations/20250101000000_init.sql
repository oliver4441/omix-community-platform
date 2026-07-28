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
