/**
 * Utility helpers for formatting edge telemetry, bitrates, file sizes, and hash digests.
 */

/**
 * Extract human-readable error message from any error object.
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred while communicating with the backend.';
}

/**
 * Format raw bytes into human readable binary units (B, KiB, MiB, GiB, TiB).
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * Format bytes per second into standard throughput notation (e.g. 14.2 MB/s).
 */
export function formatSpeed(bytesPerSec: number, decimals = 1): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 B/s';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytesPerSec / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * Format seconds into human readable countdown or elapsed duration (e.g. "2m 14s", "45s").
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Truncate long SHA-256 hashes for clean UI presentation (e.g. "e3b0c442...b987").
 */
export function truncateHash(hash: string, lead = 8, trail = 6): string {
  if (!hash) return '';
  if (hash.length <= lead + trail) return hash;
  return `${hash.slice(0, lead)}...${hash.slice(-trail)}`;
}

/**
 * Format numeric ratios to clean percentage strings.
 */
export function formatPercent(ratio: number, decimals = 1): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/**
 * Format ISO timestamp into localized compact time.
 */
export function formatTimestamp(isoString: string): string {
  if (!isoString) return '--:--:--';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}
