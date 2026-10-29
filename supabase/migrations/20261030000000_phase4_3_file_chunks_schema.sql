-- ==============================================================================
-- Migration: 20261030000000_phase4_3_file_chunks_schema.sql
-- Description: Phase 4.3 Cryptographic Chunk Manifest Schema & Proof Storage
-- Target Engine: Supabase PostgreSQL 15+
-- ==============================================================================

CREATE TABLE IF NOT EXISTS file_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    byte_offset BIGINT NOT NULL CHECK (byte_offset >= 0),
    byte_length INTEGER NOT NULL CHECK (byte_length > 0),
    sha256_hash VARCHAR(64) NOT NULL CHECK (sha256_hash ~ '^[a-fA-F0-9]{64}$'),
    merkle_leaf_hash VARCHAR(64) CHECK (merkle_leaf_hash IS NULL OR merkle_leaf_hash ~ '^[a-fA-F0-9]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_file_chunks_lookup ON file_chunks(file_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_file_chunks_hash ON file_chunks(sha256_hash);

-- Enable Row Level Security (RLS)
ALTER TABLE file_chunks ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS Policies: file_chunks
-- ------------------------------------------------------------------------------

-- Authenticated users can read chunks if they have access to parent file
CREATE POLICY file_chunks_select_allowed
    ON file_chunks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM files 
            WHERE files.id = file_chunks.file_id 
              AND (files.owner_id = auth.uid() OR files.status = 'available')
        )
    );

-- File owner can register chunk manifest records
CREATE POLICY file_chunks_insert_own
    ON file_chunks FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM files 
            WHERE files.id = file_chunks.file_id 
              AND files.owner_id = auth.uid()
        )
    );

-- File owner can update chunk manifest records
CREATE POLICY file_chunks_update_own
    ON file_chunks FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM files 
            WHERE files.id = file_chunks.file_id 
              AND files.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM files 
            WHERE files.id = file_chunks.file_id 
              AND files.owner_id = auth.uid()
        )
    );

-- File owner can delete chunk manifest records
CREATE POLICY file_chunks_delete_own
    ON file_chunks FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM files 
            WHERE files.id = file_chunks.file_id 
              AND files.owner_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- Expand files table status constraint to support Phase 4.3 processing states
-- ------------------------------------------------------------------------------
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_status_check;
ALTER TABLE files ADD CONSTRAINT files_status_check 
    CHECK (status IN ('metadata_only', 'upload_pending', 'available', 'active', 'failed', 'deprecated', 'pending', 'processing', 'verified'));

