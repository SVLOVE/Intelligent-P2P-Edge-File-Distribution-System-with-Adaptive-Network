"""In-memory service managing edge peer discovery and telemetry descriptors."""

import threading
from typing import Dict, List, Optional, Tuple
from app.schemas.peers import PeerResponse, PeerRole, PeerStatus


class PeersService:
    """Thread-safe in-memory peer discovery service for development."""

    def __init__(self):
        self._lock = threading.Lock()
        self._peers: Dict[str, PeerResponse] = {}
        self._seed_initial_data()

    def _seed_initial_data(self) -> None:
        """Seed initial development edge peers."""
        initial_records = [
            PeerResponse(
                peer_id="peer_usr9482_ab71ef",
                role=PeerRole.SEEDER,
                status=PeerStatus.ONLINE,
                region="us-east",
                device_tier="Desktop Gateway",
                simulated_capacity_kbps=15000,
                is_simulated=True,
                telemetry_notice="Simulated edge peer descriptor for development. Not a live physical network measurement.",
                last_seen="2026-10-29T21:40:00Z",
            ),
            PeerResponse(
                peer_id="peer_usr4412_98d7fa",
                role=PeerRole.SEEDER,
                status=PeerStatus.ONLINE,
                region="us-east",
                device_tier="Edge Micro-Server",
                simulated_capacity_kbps=25000,
                is_simulated=True,
                telemetry_notice="Simulated edge peer descriptor for development. Not a live physical network measurement.",
                last_seen="2026-10-29T21:40:02Z",
            ),
            PeerResponse(
                peer_id="peer_usr1104_cc33da",
                role=PeerRole.LEECHER,
                status=PeerStatus.ONLINE,
                region="eu-central",
                device_tier="Laptop Client",
                simulated_capacity_kbps=8000,
                is_simulated=True,
                telemetry_notice="Simulated edge peer descriptor for development. Not a live physical network measurement.",
                last_seen="2026-10-29T21:39:55Z",
            ),
            PeerResponse(
                peer_id="peer_usr8821_ee99bb",
                role=PeerRole.COORDINATOR,
                status=PeerStatus.ONLINE,
                region="ap-southeast",
                device_tier="Swarm Coordinator",
                simulated_capacity_kbps=50000,
                is_simulated=True,
                telemetry_notice="Simulated edge peer descriptor for development. Not a live physical network measurement.",
                last_seen="2026-10-29T21:40:01Z",
            ),
        ]
        for p in initial_records:
            self._peers[p.peer_id] = p

    def list_peers(
        self,
        page: int = 1,
        limit: int = 20,
        role: Optional[PeerRole] = None,
    ) -> Tuple[List[PeerResponse], int]:
        """Return paginated edge peer descriptors, filtered optionally by role."""
        with self._lock:
            all_peers = list(self._peers.values())

        if role:
            filtered = [p for p in all_peers if p.role == role]
        else:
            filtered = all_peers

        total = len(filtered)
        start = (page - 1) * limit
        end = start + limit
        items = filtered[start:end]
        return items, total


peers_service = PeersService()
