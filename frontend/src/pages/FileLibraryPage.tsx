import React, { useState } from 'react';
import type { P2PFile, ScreenId, FileStatus } from '../types';
import { SearchIcon, UploadIcon, FileTextIcon } from '../components/icons/Icons';
import { formatBytes, truncateHash } from '../utils';

interface FileLibraryPageProps {
  files: P2PFile[];
  onNavigate: (screen: ScreenId, params?: { fileId?: string }) => void;
  onInitiateTransfer: (file: P2PFile) => void;
}

export const FileLibraryPage: React.FC<FileLibraryPageProps> = ({
  files,
  onNavigate,
  onInitiateTransfer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FileStatus | 'all'>('all');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.sha256.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || file.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-container file-library-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Catalog Integrity Disclosures:</strong> Whole-file SHA-256 digests shown in this catalog are
          simulated placeholders. In Phase 2/3, these model the catalog schema. True cryptographic hashing
          and Merkle root calculation occur per chunk during Phase 4 staging.
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="library-toolbar">
        <div className="search-box">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search by filename, SHA-256 hash or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search files"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="status-select" className="filter-label">Status:</label>
          <select
            id="status-select"
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FileStatus | 'all')}
          >
            <option value="all">All Statuses ({files.length})</option>
            <option value="ready">Ready (Stored)</option>
            <option value="distributing">Distributing (P2P)</option>
            <option value="verifying">Verifying</option>
          </select>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigate('upload')}
        >
          <UploadIcon size={16} />
          <span>Stage New File</span>
        </button>
      </div>

      {/* Files Table */}
      <div className="table-responsive-wrapper">
        <table className="data-table" aria-label="Distributed Files Library">
          <thead>
            <tr>
              <th>File Name & Details</th>
              <th>Size</th>
              <th>Chunks (1 MiB)</th>
              <th>Whole-File SHA-256</th>
              <th>Swarm Availability</th>
              <th>Status</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-table-cell">
                  <div className="empty-state-box">
                    <span className="empty-icon">📁</span>
                    <p className="empty-title">No matching files found</p>
                    <p className="empty-desc">
                      Try adjusting your search criteria or stage a new file for chunk distribution.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => (
                <tr key={file.id}>
                  <td>
                    <div className="file-name-cell">
                      <FileTextIcon size={20} className="file-type-icon" />
                      <div>
                        <button
                          type="button"
                          className="file-title-link"
                          onClick={() => onNavigate('file-details', { fileId: file.id })}
                        >
                          {file.name}
                        </button>
                        <p className="file-desc-sub">{file.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="monospace-cell">{formatBytes(file.sizeBytes)}</td>
                  <td className="monospace-cell">{file.totalChunks} chunks</td>
                  <td>
                    <div className="hash-copy-cell">
                      <code title={file.wholeFileSha256 || file.sha256}>
                        {truncateHash(file.wholeFileSha256 || file.sha256, 8, 6)}
                      </code>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => handleCopyHash(file.wholeFileSha256 || file.sha256)}
                        title="Copy whole-file SHA-256 hash"
                        aria-label="Copy hash"
                      >
                        {copiedHash === (file.wholeFileSha256 || file.sha256) ? '✓' : '⧉'}
                      </button>
                    </div>
                    {file.isPlaceholderHash ? (
                      <span className="hash-tag-simulated">Simulated Digest</span>
                    ) : (
                      <span className="hash-tag-verified">Verified SHA-256</span>
                    )}
                  </td>
                  <td>
                    <div className="swarm-seeds-pill">
                      <span className="seeds-text" title="Active Seeders">{file.seederCount} seeds</span>
                      <span className="divider">/</span>
                      <span className="leech-text" title="Active Leechers">{file.leecherCount} leech</span>

                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${file.status}`}>
                      {file.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn-action"
                        onClick={() => onNavigate('file-details', { fileId: file.id })}
                        title="Inspect Chunks and Manifest"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="btn-action primary"
                        onClick={() => onInitiateTransfer(file)}
                        title="Simulate Swarm Download"
                      >
                        Fetch (P2P)
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
