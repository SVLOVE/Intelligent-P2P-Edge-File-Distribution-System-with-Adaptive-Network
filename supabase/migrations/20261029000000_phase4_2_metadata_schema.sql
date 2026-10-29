-- ==============================================================================
-- Migration: 20261029000000_phase4_2_metadata_schema.sql
-- Description: Phase 4.2 Database, Authentication & Metadata Persistence Schema
-- Target Engine: Supabase PostgreSQL 15+
-- ==============================================================================

-- 1. Helper Function: Automatic updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. Table: profiles
-- Stores application profile metadata linked 1-to-1 with Supabase auth.users.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 3. Table: files
-- Stores authoritative catalog file metadata, size, and cryptographic digests.
-- Status is constrained to honest lifecycle phases: metadata_only, upload_pending, available, failed, deprecated.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    mime_type VARCHAR(128) DEFAULT 'application/octet-stream',
    status VARCHAR(32) NOT NULL DEFAULT 'metadata_only' 
        CHECK (status IN ('metadata_only', 'upload_pending', 'available', 'failed', 'deprecated')),
    whole_file_sha256 VARCHAR(64) 
        CHECK (whole_file_sha256 IS NULL OR whole_file_sha256 ~ '^[a-fA-F0-9]{64}$'),
    merkle_root_hash VARCHAR(64) 
        CHECK (merkle_root_hash IS NULL OR merkle_root_hash ~ '^[a-fA-F0-9]{64}$'),
    storage_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_sha256 ON files(whole_file_sha256) WHERE whole_file_sha256 IS NOT NULL;

CREATE TRIGGER update_files_modtime
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 4. Table: transfers
-- Records user transfer tracking sessions, direction, and recorded byte progress.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    direction VARCHAR(16) NOT NULL DEFAULT 'download' 
        CHECK (direction IN ('upload', 'download')),
    status VARCHAR(24) NOT NULL DEFAULT 'initializing' 
        CHECK (status IN ('initializing', 'active', 'completed', 'cancelled', 'failed')),
    bytes_transferred BIGINT NOT NULL DEFAULT 0 CHECK (bytes_transferred >= 0),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_owner_status ON transfers(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_file ON transfers(file_id);

CREATE TRIGGER update_transfers_modtime
    BEFORE UPDATE ON transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 5. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS across all metadata tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Policies: profiles
-- ------------------------------------------------------------------------------
CREATE POLICY profiles_select_own
    ON profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY profiles_insert_own
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Policies: files
-- ------------------------------------------------------------------------------
-- Authenticated users may read files they own OR files marked as publicly 'available'
CREATE POLICY files_select_allowed
    ON files FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid() OR status = 'available');

-- Authenticated users may insert files only when owner_id equals their own auth.uid()
CREATE POLICY files_insert_own
    ON files FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- File owner can update their own file record, cannot change owner_id to another user
CREATE POLICY files_update_own
    ON files FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- File owner can delete their own file record
CREATE POLICY files_delete_own
    ON files FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- ------------------------------------------------------------------------------
-- Policies: transfers
-- ------------------------------------------------------------------------------
-- Authenticated users can only see their own transfer sessions
CREATE POLICY transfers_select_own
    ON transfers FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

-- Authenticated users can only initiate transfers under their own identity
CREATE POLICY transfers_insert_own
    ON transfers FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Authenticated users can only update their own transfers
CREATE POLICY transfers_update_own
    ON transfers FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Authenticated users can delete their own transfer session history
CREATE POLICY transfers_delete_own
    ON transfers FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());
