"""Service managing transfer tracking sessions with Supabase persistence and ownership authorization."""

import threading
from typing import Dict, List, Optional, Tuple
from app.core.config import settings
from app.core.exceptions import ResourceNotFoundError
from app.core.supabase import supabase_client
from app.schemas.common import get_utc_now_iso
from app.schemas.transfers import (
    TransferMode,
    TransferResponse,
    TransferStatus,
)


class TransfersService:
    """Thread-safe transfer tracking service supporting Supabase persistence with in-memory fallback."""

    def __init__(self):
        self._lock = threading.Lock()
        self._transfers: Dict[str, TransferResponse] = {}
        self._seed_initial_data()

    def _seed_initial_data(self) -> None:
        """Seed initial development transfer sessions."""
        initial_records = [
            TransferResponse(
                transfer_id="t982b10a-319a-4c90-b9df-415891ac3710",
                file_id="f47ac10b-58cc-4372-a567-0e02b2c3d479",
                owner_id="00000000-0000-0000-0000-000000000001",
                file_name="edge_model_weights.bin",
                transfer_mode=TransferMode.HYBRID_P2P,
                direction="download",
                status=TransferStatus.ACTIVE,
                chunks_total=100,
                chunks_completed=45,
                bytes_transferred=47185920,
                bytes_from_p2p=36700160,
                bytes_from_origin=10485760,
                p2p_ratio_percentage=77.7,
                is_simulated=True,
                transfer_notice="Simulated transfer session. No active WebRTC data channels or live network transmissions.",
                created_at="2026-10-29T21:30:00Z",
                updated_at="2026-10-29T21:32:15Z",
            ),
            TransferResponse(
                transfer_id="t204f81c-821b-4f91-a1e4-593b4819d082",
                file_id="b183ce52-974a-4e2a-8991-628d011245fa",
                owner_id="00000000-0000-0000-0000-000000000001",
                file_name="training_dataset_shard_01.tar.gz",
                transfer_mode=TransferMode.HYBRID_P2P,
                direction="download",
                status=TransferStatus.COMPLETED,
                chunks_total=200,
                chunks_completed=200,
                bytes_transferred=209715200,
                bytes_from_p2p=177196032,
                bytes_from_origin=32519168,
                p2p_ratio_percentage=84.5,
                is_simulated=True,
                transfer_notice="Simulated transfer session. No active WebRTC data channels or live network transmissions.",
                created_at="2026-10-29T20:00:00Z",
                updated_at="2026-10-29T20:04:30Z",
            ),
        ]
        for t in initial_records:
            self._transfers[t.transfer_id] = t

    async def list_transfers(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[TransferStatus] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[List[TransferResponse], int]:
        """Return paginated transfer sessions belonging to the authenticated user."""
        if settings.is_supabase_configured:
            records, total = await supabase_client.list_transfers(
                page=page,
                limit=limit,
                status=status.value if status else None,
                owner_id=user_id,
            )
            items = []
            for r in records:
                items.append(
                    TransferResponse(
                        transfer_id=r.get("id"),
                        file_id=r.get("file_id"),
                        owner_id=r.get("owner_id"),
                        file_name=None,
                        transfer_mode=TransferMode.HYBRID_P2P,
                        direction=r.get("direction", "download"),
                        status=TransferStatus(r.get("status", "initializing")),
                        chunks_total=0,
                        chunks_completed=0,
                        bytes_transferred=r.get("bytes_transferred", 0),
                        bytes_from_p2p=0,
                        bytes_from_origin=r.get("bytes_transferred", 0),
                        p2p_ratio_percentage=0.0,
                        is_simulated=False,
                        transfer_notice="Authoritative transfer record in Supabase PostgreSQL.",
                        created_at=r.get("created_at", get_utc_now_iso()),
                        updated_at=r.get("updated_at", get_utc_now_iso()),
                    )
                )
            return items, total

        with self._lock:
            all_transfers = list(self._transfers.values())

        filtered = []
        for t in all_transfers:
            if user_id and t.owner_id and t.owner_id != user_id:
                continue
            if status and t.status != status:
                continue
            filtered.append(t)

        total = len(filtered)
        start = (page - 1) * limit
        end = start + limit
        items = filtered[start:end]
        return items, total

    async def get_transfer(self, transfer_id: str, user_id: Optional[str] = None) -> TransferResponse:
        """Retrieve a transfer session by UUID, enforcing ownership."""
        if settings.is_supabase_configured:
            record = await supabase_client.get_transfer(transfer_id)
            if not record:
                raise ResourceNotFoundError(resource="Transfer", resource_id=transfer_id)
            
            if user_id and record.get("owner_id") != user_id:
                # Deny access without revealing existence
                raise ResourceNotFoundError(resource="Transfer", resource_id=transfer_id)

            return TransferResponse(
                transfer_id=record.get("id"),
                file_id=record.get("file_id"),
                owner_id=record.get("owner_id"),
                file_name=None,
                transfer_mode=TransferMode.HYBRID_P2P,
                direction=record.get("direction", "download"),
                status=TransferStatus(record.get("status", "initializing")),
                chunks_total=0,
                chunks_completed=0,
                bytes_transferred=record.get("bytes_transferred", 0),
                bytes_from_p2p=0,
                bytes_from_origin=record.get("bytes_transferred", 0),
                p2p_ratio_percentage=0.0,
                is_simulated=False,
                transfer_notice="Authoritative transfer record in Supabase PostgreSQL.",
                created_at=record.get("created_at", get_utc_now_iso()),
                updated_at=record.get("updated_at", get_utc_now_iso()),
            )

        with self._lock:
            transfer = self._transfers.get(transfer_id)

        if not transfer:
            raise ResourceNotFoundError(resource="Transfer", resource_id=transfer_id)

        if user_id and transfer.owner_id and transfer.owner_id != user_id:
            raise ResourceNotFoundError(resource="Transfer", resource_id=transfer_id)

        return transfer


transfers_service = TransfersService()
