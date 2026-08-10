-- Dev profiles & status (Phase C)
-- presence: user-set status shown next to auto online/offline presence
ALTER TABLE presence ADD COLUMN status TEXT NOT NULL DEFAULT 'online';
ALTER TABLE presence ADD COLUMN status_text TEXT NOT NULL DEFAULT '';

-- profiles: persisted skills + optional dev title (replaces localStorage skills)
ALTER TABLE profiles ADD COLUMN skills TEXT NOT NULL DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN title TEXT NOT NULL DEFAULT '';
