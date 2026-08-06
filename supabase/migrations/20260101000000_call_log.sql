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
