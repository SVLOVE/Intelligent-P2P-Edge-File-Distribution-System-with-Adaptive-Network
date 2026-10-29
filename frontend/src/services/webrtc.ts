/**
 * WebRTC and Signaling Connection Manager.
 * Implements authenticated WebSocket signaling, session presence,
 * RFC-compliant WebRTC perfect negotiation, queued ICE candidates,
 * and a lightweight 'p2p-control' data channel for RTT ping/pong testing.
 *
 * Strict boundary: No file chunks or bulk data transfers are handled in Phase 4.4.
 */

import {
  createSignalingTicket,
  fetchIceServers,
  API_BASE_URL,
} from './api';

export type SignalingConnectionState =
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'session_joined'
  | 'disconnected'
  | 'error';

export type PeerP2PState =
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

export interface LivePeerRecord {
  peerId: string;
  userId: string;
  joinedAt: string;
  p2pState: PeerP2PState;
  dataChannelState: 'closed' | 'connecting' | 'open';
  rttMs?: number;
  lastPingSent?: number;
}

export class WebRTCManager {
  public localPeerId: string;
  public currentSessionId: string | null = null;
  public signalingState: SignalingConnectionState = 'offline';

  private ws: WebSocket | null = null;
  private iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private queuedCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private peers: Map<string, LivePeerRecord> = new Map();

  // Callbacks
  public onSignalingStateChange?: (state: SignalingConnectionState) => void;
  public onPeersChange?: (peers: LivePeerRecord[]) => void;
  public onError?: (error: string) => void;
  public onLog?: (log: string) => void;

  constructor(customPeerId?: string) {
    this.localPeerId = customPeerId || `peer-${Math.random().toString(36).substring(2, 10)}`;
  }

  public getPeersList(): LivePeerRecord[] {
    return Array.from(this.peers.values());
  }

  private log(message: string): void {
    if (this.onLog) this.onLog(`[WebRTC] ${message}`);
  }

  private setSignalingState(state: SignalingConnectionState): void {
    this.signalingState = state;
    if (this.onSignalingStateChange) {
      this.onSignalingStateChange(state);
    }
  }

  private notifyPeersChanged(): void {
    if (this.onPeersChange) {
      this.onPeersChange(this.getPeersList());
    }
  }

  /**
   * Connect to signaling WebSocket via secure single-use ticket.
   */
  public async connectSignaling(
    sessionId: string = '00000000-0000-0000-0000-000000000001',
    token?: string
  ): Promise<void> {
    if (this.ws) {
      this.disconnect();
    }

    this.setSignalingState('connecting');
    this.currentSessionId = sessionId;

    try {
      // 1. Fetch configured STUN/TURN servers
      try {
        const iceConfig = await fetchIceServers();
        if (iceConfig.ice_servers && iceConfig.ice_servers.length > 0) {
          this.iceServers = iceConfig.ice_servers;
          this.log(`Loaded ${iceConfig.ice_servers.length} ICE server configurations`);
        }
      } catch (e) {
        this.log(`Using fallback public STUN servers: ${e}`);
      }

      // 2. Obtain short-lived single-use ticket
      const ticketRes = await createSignalingTicket(sessionId, token);
      const ticket = ticketRes.ticket;

      // 3. Establish WebSocket connection
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const parsedApiUrl = new URL(API_BASE_URL);
      const host = parsedApiUrl.host;
      const wsUrl = `${wsProto}//${host}/api/v1/signaling/ws?ticket=${ticket}&peer_id=${this.localPeerId}`;

      this.log(`Connecting WebSocket to ${wsProto}//${host}/api/v1/signaling/ws`);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.log('Signaling WebSocket connected');
        this.setSignalingState('connected');
        // Join requested session
        this.joinSession(sessionId);
      };

      this.ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          this.handleSignalingEnvelope(envelope);
        } catch (err) {
          this.log(`Error parsing message: ${err}`);
        }
      };

      this.ws.onerror = () => {
        this.log('Signaling WebSocket error occurred');
        this.setSignalingState('error');
        if (this.onError) this.onError('Signaling WebSocket error');
      };

      this.ws.onclose = (event) => {
        this.log(`Signaling WebSocket closed (code: ${event.code})`);
        this.setSignalingState('disconnected');
        this.cleanupAllPeerConnections();
      };
    } catch (err: any) {
      this.setSignalingState('error');
      const msg = err.message || 'Failed to establish signaling connection';
      this.log(`Signaling setup failed: ${msg}`);
      if (this.onError) this.onError(msg);
      throw err;
    }
  }

  /**
   * Join an authorized signaling coordination session.
   */
  public joinSession(sessionId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Signaling WebSocket is not open');
    }
    this.currentSessionId = sessionId;
    this.ws.send(
      JSON.stringify({
        protocol_version: 'v1',
        type: 'join_session',
        session_id: sessionId,
      })
    );
  }

  /**
   * Dispatch incoming signaling message envelopes.
   */
  private async handleSignalingEnvelope(envelope: any): Promise<void> {
    switch (envelope.type) {
      case 'session_joined': {
        this.log(`Joined session ${envelope.session_id}`);
        this.setSignalingState('session_joined');
        this.peers.clear();
        if (Array.isArray(envelope.existing_peers)) {
          envelope.existing_peers.forEach((p: any) => {
            if (p.peer_id !== this.localPeerId) {
              this.peers.set(p.peer_id, {
                peerId: p.peer_id,
                userId: p.user_id,
                joinedAt: p.joined_at,
                p2pState: 'offline',
                dataChannelState: 'closed',
              });
            }
          });
        }
        this.notifyPeersChanged();
        break;
      }

      case 'peer_joined': {
        const remotePeerId = envelope.sender_peer_id;
        if (remotePeerId && remotePeerId !== this.localPeerId) {
          this.log(`Remote peer joined session: ${remotePeerId}`);
          this.peers.set(remotePeerId, {
            peerId: remotePeerId,
            userId: envelope.user_id || 'remote-user',
            joinedAt: new Date().toISOString(),
            p2pState: 'offline',
            dataChannelState: 'closed',
          });
          this.notifyPeersChanged();
        }
        break;
      }

      case 'peer_left': {
        const remotePeerId = envelope.sender_peer_id;
        if (remotePeerId) {
          this.log(`Remote peer left: ${remotePeerId}`);
          this.closePeerConnection(remotePeerId);
          this.peers.delete(remotePeerId);
          this.notifyPeersChanged();
        }
        break;
      }

      case 'offer': {
        await this.handleRemoteOffer(envelope.sender_peer_id, envelope.sdp);
        break;
      }

      case 'answer': {
        await this.handleRemoteAnswer(envelope.sender_peer_id, envelope.sdp);
        break;
      }

      case 'ice_candidate': {
        await this.handleRemoteCandidate(envelope.sender_peer_id, envelope.candidate);
        break;
      }

      case 'error': {
        this.log(`Signaling server error: [${envelope.code}] ${envelope.message}`);
        if (this.onError) {
          this.onError(`[${envelope.code}] ${envelope.message}`);
        }
        break;
      }
    }
  }

  /**
   * Determine polite role for WebRTC perfect negotiation.
   * Deterministic: higher peer ID is polite.
   */
  private isPolite(remotePeerId: string): boolean {
    return this.localPeerId > remotePeerId;
  }

  /**
   * Get or instantiate an RTCPeerConnection for a remote peer.
   */
  private getOrCreatePeerConnection(remotePeerId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(remotePeerId);
    if (pc) return pc;

    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC RTCPeerConnection is not supported in this runtime environment');
    }

    pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(remotePeerId, pc);
    this.queuedCandidates.set(remotePeerId, []);
    this.makingOffer.set(remotePeerId, false);

    // 1. Negotiationneeded (Initiator or renegotiation)
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(remotePeerId, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);

        this.log(`Sending WebRTC offer to ${remotePeerId}`);
        this.sendSignalingMessage({
          type: 'offer',
          session_id: this.currentSessionId,
          target_peer_id: remotePeerId,
          sdp: pc.localDescription?.sdp,
        });
      } catch (err) {
        this.log(`Negotiation error for ${remotePeerId}: ${err}`);
      } finally {
        this.makingOffer.set(remotePeerId, false);
      }
    };

    // 2. ICE Candidate gathering
    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSignalingMessage({
          type: 'ice_candidate',
          session_id: this.currentSessionId,
          target_peer_id: remotePeerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // 3. ICE Connection State changes
    pc.oniceconnectionstatechange = () => {
      this.log(`ICE state for ${remotePeerId}: ${pc.iceConnectionState}`);
      this.updatePeerRecord(remotePeerId, {
        p2pState: this.mapIceToP2PState(pc.iceConnectionState),
      });
    };

    // 4. Peer Connection State changes
    pc.onconnectionstatechange = () => {
      this.log(`Connection state for ${remotePeerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.updatePeerRecord(remotePeerId, { p2pState: 'disconnected' });
      } else if (pc.connectionState === 'connected') {
        this.updatePeerRecord(remotePeerId, { p2pState: 'connected' });
      }
    };

    // 5. Remote Data Channel event
    pc.ondatachannel = (event) => {
      this.log(`Received incoming data channel '${event.channel.label}' from ${remotePeerId}`);
      this.setupDataChannel(remotePeerId, event.channel);
    };

    return pc;
  }

  /**
   * Initiate a P2P connection to an authorized peer in the session.
   */
  public async connectToPeer(remotePeerId: string): Promise<void> {
    this.log(`Initiating WebRTC connection to peer ${remotePeerId}`);
    this.updatePeerRecord(remotePeerId, { p2pState: 'connecting' });

    const pc = this.getOrCreatePeerConnection(remotePeerId);

    // Create control data channel
    const dc = pc.createDataChannel('p2p-control', { ordered: true });
    this.setupDataChannel(remotePeerId, dc);
  }

  /**
   * Configure control data channel listeners and ping/pong latency test.
   */
  private setupDataChannel(remotePeerId: string, dc: RTCDataChannel): void {
    this.dataChannels.set(remotePeerId, dc);

    dc.onopen = () => {
      this.log(`DataChannel '${dc.label}' open with ${remotePeerId}`);
      this.updatePeerRecord(remotePeerId, {
        dataChannelState: 'open',
        p2pState: 'connected',
      });
      // Send immediate connection test control ping
      this.sendControlPing(remotePeerId);
    };

    dc.onclose = () => {
      this.log(`DataChannel '${dc.label}' closed with ${remotePeerId}`);
      this.updatePeerRecord(remotePeerId, { dataChannelState: 'closed' });
    };

    dc.onerror = (err) => {
      this.log(`DataChannel error with ${remotePeerId}: ${err}`);
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ping') {
          // Respond to ping with pong
          dc.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
        } else if (msg.type === 'pong' && typeof msg.timestamp === 'number') {
          const rtt = Date.now() - msg.timestamp;
          this.log(`Measured RTT with ${remotePeerId}: ${rtt} ms`);
          this.updatePeerRecord(remotePeerId, { rttMs: rtt });
        }
      } catch (err) {
        this.log(`Non-JSON data received on control channel: ${err}`);
      }
    };
  }

  /**
   * Send control ping across WebRTC DataChannel to measure actual round-trip latency.
   */
  public sendControlPing(remotePeerId: string): void {
    const dc = this.dataChannels.get(remotePeerId);
    if (dc && dc.readyState === 'open') {
      const now = Date.now();
      this.updatePeerRecord(remotePeerId, { lastPingSent: now });
      dc.send(JSON.stringify({ type: 'ping', timestamp: now }));
    }
  }

  /**
   * Handle incoming WebRTC offer using perfect negotiation pattern.
   */
  private async handleRemoteOffer(remotePeerId: string, sdp: string): Promise<void> {
    const pc = this.getOrCreatePeerConnection(remotePeerId);
    const isPolite = this.isPolite(remotePeerId);
    const offerCollision =
      this.makingOffer.get(remotePeerId) || pc.signalingState !== 'stable';

    if (offerCollision && !isPolite) {
      this.log(`Offer glare collision detected with ${remotePeerId}; ignoring (impolite)`);
      return;
    }

    this.log(`Accepting offer from ${remotePeerId} (polite=${isPolite})`);
    await pc.setRemoteDescription({ type: 'offer', sdp });
    await this.drainQueuedCandidates(remotePeerId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({
      type: 'answer',
      session_id: this.currentSessionId,
      target_peer_id: remotePeerId,
      sdp: pc.localDescription?.sdp,
    });
  }

  /**
   * Handle incoming WebRTC answer.
   */
  private async handleRemoteAnswer(remotePeerId: string, sdp: string): Promise<void> {
    const pc = this.peerConnections.get(remotePeerId);
    if (!pc) return;

    this.log(`Accepting answer from ${remotePeerId}`);
    await pc.setRemoteDescription({ type: 'answer', sdp });
    await this.drainQueuedCandidates(remotePeerId);
  }

  /**
   * Handle incoming ICE candidate with safe queueing before remote description setup.
   */
  private async handleRemoteCandidate(
    remotePeerId: string,
    candidateInit: RTCIceCandidateInit
  ): Promise<void> {
    const pc = this.peerConnections.get(remotePeerId);
    if (!pc || !pc.remoteDescription) {
      // Queue candidate until remote description is applied
      const queue = this.queuedCandidates.get(remotePeerId) || [];
      queue.push(candidateInit);
      this.queuedCandidates.set(remotePeerId, queue);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (e) {
      this.log(`Failed to add ICE candidate: ${e}`);
    }
  }

  /**
   * Drain queued candidates once remote description is set.
   */
  private async drainQueuedCandidates(remotePeerId: string): Promise<void> {
    const pc = this.peerConnections.get(remotePeerId);
    const queue = this.queuedCandidates.get(remotePeerId);
    if (!pc || !queue) return;

    while (queue.length > 0) {
      const candidateInit = queue.shift();
      if (candidateInit) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (e) {
          this.log(`Failed to add queued candidate: ${e}`);
        }
      }
    }
  }

  private sendSignalingMessage(msg: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ protocol_version: 'v1', ...msg }));
    }
  }

  private updatePeerRecord(peerId: string, partial: Partial<LivePeerRecord>): void {
    const existing = this.peers.get(peerId);
    if (existing) {
      Object.assign(existing, partial);
      this.notifyPeersChanged();
    }
  }

  private mapIceToP2PState(iceState: RTCIceConnectionState): PeerP2PState {
    switch (iceState) {
      case 'new':
      case 'checking':
        return 'connecting';
      case 'connected':
      case 'completed':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      case 'failed':
      case 'closed':
        return 'failed';
      default:
        return 'offline';
    }
  }

  public closePeerConnection(remotePeerId: string): void {
    const dc = this.dataChannels.get(remotePeerId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(remotePeerId);
    }
    const pc = this.peerConnections.get(remotePeerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remotePeerId);
    }
    this.queuedCandidates.delete(remotePeerId);
    this.makingOffer.delete(remotePeerId);
    this.updatePeerRecord(remotePeerId, {
      p2pState: 'offline',
      dataChannelState: 'closed',
    });
  }

  private cleanupAllPeerConnections(): void {
    for (const peerId of Array.from(this.peerConnections.keys())) {
      this.closePeerConnection(peerId);
    }
  }

  public disconnect(): void {
    this.cleanupAllPeerConnections();
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this.setSignalingState('offline');
    this.peers.clear();
    this.notifyPeersChanged();
  }
}
