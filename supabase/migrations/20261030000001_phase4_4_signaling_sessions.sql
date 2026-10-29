-- ==============================================================================
-- Migration: 20261030000001_phase4_4_signaling_sessions.sql
-- Description: Phase 4.4 WebRTC Signaling Sessions & Peer Membership Schema
-- Target Engine: Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Table: signaling_sessions
-- Tracks authorized coordination sessions/swarms for WebRTC signaling exchange.
CREATE TABLE IF NOT EXISTS signaling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL DEFAULT 'Swarm Session',
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
    max_peers INTEGER NOT NULL DEFAULT 16 CHECK (max_peers > 0 AND max_peers <= 64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signaling_sessions_file ON signaling_sessions(file_id);
CREATE INDEX IF NOT EXISTS idx_signaling_sessions_creator ON signaling_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_signaling_sessions_status ON signaling_sessions(status);

CREATE TRIGGER update_signaling_sessions_modtime
    BEFORE UPDATE ON signaling_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Table: signaling_session_peers
-- Tracks registered peer memberships in active signaling sessions.
CREATE TABLE IF NOT EXISTS signaling_session_peers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES signaling_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    peer_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'peer' CHECK (role IN ('initiator', 'peer', 'coordinator')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, user_id, peer_id)
);

CREATE INDEX IF NOT EXISTS idx_session_peers_lookup ON signaling_session_peers(session_id, peer_id);
CREATE INDEX IF NOT EXISTS idx_session_peers_user ON signaling_session_peers(user_id);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE signaling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signaling_session_peers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies: signaling_sessions
-- ------------------------------------------------------------------------------

-- Authenticated users can view active sessions or sessions they created
CREATE POLICY signaling_sessions_select_allowed
    ON signaling_sessions FOR SELECT
    TO authenticated
    USING (created_by = auth.uid() OR status = 'active');

-- Authenticated users can create new signaling sessions
CREATE POLICY signaling_sessions_insert_own
    ON signaling_sessions FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Creator can update session (e.g. close session)
CREATE POLICY signaling_sessions_update_own
    ON signaling_sessions FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Creator can delete session
CREATE POLICY signaling_sessions_delete_own
    ON signaling_sessions FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- ------------------------------------------------------------------------------
-- RLS Policies: signaling_session_peers
-- ------------------------------------------------------------------------------

-- Members can see other peers in the same session
CREATE POLICY session_peers_select_allowed
    ON signaling_session_peers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM signaling_sessions s
            WHERE s.id = signaling_session_peers.session_id
              AND (s.created_by = auth.uid() OR s.status = 'active')
        )
    );

-- Users can register their own peer membership
CREATE POLICY session_peers_insert_own
    ON signaling_session_peers FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own peer presence ping
CREATE POLICY session_peers_update_own
    ON signaling_session_peers FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can remove their own peer membership
CREATE POLICY session_peers_delete_own
    ON signaling_session_peers FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
