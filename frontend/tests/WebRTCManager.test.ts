import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebRTCManager } from '../src/services/webrtc';

describe('WebRTCManager & Signaling Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with a valid peer ID and offline state', () => {
    const manager = new WebRTCManager('peer-local-01');
    expect(manager.localPeerId).toBe('peer-local-01');
    expect(manager.signalingState).toBe('offline');
    expect(manager.getPeersList()).toEqual([]);
  });

  it('determines polite negotiation role deterministically', () => {
    const manager = new WebRTCManager('peer-zzz');
    // If localPeerId > remotePeerId, local is polite
    // 'peer-zzz' > 'peer-aaa' is true -> polite
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(manager['isPolite']('peer-aaa')).toBe(true);

    const manager2 = new WebRTCManager('peer-aaa');
    // 'peer-aaa' > 'peer-zzz' is false -> impolite
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(manager2['isPolite']('peer-zzz')).toBe(false);
  });

  it('handles session_joined envelope and registers discovered peers', async () => {
    const manager = new WebRTCManager('peer-alpha');
    const peersChangeSpy = vi.fn();
    manager.onPeersChange = peersChangeSpy;

    // Simulate incoming session_joined envelope
    // eslint-disable-next-line @typescript-eslint/dot-notation
    await manager['handleSignalingEnvelope']({
      protocol_version: 'v1',
      type: 'session_joined',
      session_id: 'session-test-uuid',
      existing_peers: [
        { peer_id: 'peer-beta', user_id: 'user-02', joined_at: '2026-10-30T00:00:00Z' },
        { peer_id: 'peer-alpha', user_id: 'user-01', joined_at: '2026-10-30T00:00:00Z' }, // local peer, should be omitted
      ],
    });

    expect(manager.signalingState).toBe('session_joined');
    const peers = manager.getPeersList();
    expect(peers.length).toBe(1);
    expect(peers[0].peerId).toBe('peer-beta');
    expect(peers[0].p2pState).toBe('offline');
    expect(peersChangeSpy).toHaveBeenCalled();
  });

  it('handles peer_joined and peer_left events dynamically', async () => {
    const manager = new WebRTCManager('peer-alpha');

    // Remote peer joins
    // eslint-disable-next-line @typescript-eslint/dot-notation
    await manager['handleSignalingEnvelope']({
      protocol_version: 'v1',
      type: 'peer_joined',
      session_id: 'session-test-uuid',
      sender_peer_id: 'peer-gamma',
      user_id: 'user-03',
    });

    expect(manager.getPeersList().length).toBe(1);
    expect(manager.getPeersList()[0].peerId).toBe('peer-gamma');

    // Remote peer leaves
    // eslint-disable-next-line @typescript-eslint/dot-notation
    await manager['handleSignalingEnvelope']({
      protocol_version: 'v1',
      type: 'peer_left',
      session_id: 'session-test-uuid',
      sender_peer_id: 'peer-gamma',
    });

    expect(manager.getPeersList().length).toBe(0);
  });

  it('queues ICE candidates when remote description is not yet applied', async () => {
    const manager = new WebRTCManager('peer-alpha');
    const candidatePayload = { candidate: 'candidate:1 ...', sdpMid: '0', sdpMLineIndex: 0 };

    // Remote candidate received before RTCPeerConnection remote description set
    // eslint-disable-next-line @typescript-eslint/dot-notation
    await manager['handleRemoteCandidate']('peer-beta', candidatePayload);

    // Candidate should be safely queued
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const queue = manager['queuedCandidates'].get('peer-beta');
    expect(queue).toBeDefined();
    expect(queue?.length).toBe(1);
    expect(queue?.[0]).toEqual(candidatePayload);
  });

  it('cleans up connections and resets state on disconnect', () => {
    const manager = new WebRTCManager('peer-alpha');
    manager.signalingState = 'session_joined';

    manager.disconnect();
    expect(manager.signalingState).toBe('offline');
    expect(manager.getPeersList().length).toBe(0);
  });
});
