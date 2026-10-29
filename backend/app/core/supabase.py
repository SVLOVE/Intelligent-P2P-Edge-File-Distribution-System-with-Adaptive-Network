"""Supabase PostgREST client and repository adapter."""

from typing import Any, Dict, List, Optional, Tuple
import httpx
from app.core.config import settings
from app.core.exceptions import AppException, ResourceNotFoundError


class SupabaseClient:
    """Async PostgREST client for interacting with Supabase database."""

    def __init__(self):
        self._base_url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self._key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""

    @property
    def is_configured(self) -> bool:
        return bool(self._base_url and self._key)

    def _headers(self, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        if custom_headers:
            headers.update(custom_headers)
        return headers

    async def check_health(self) -> bool:
        """Check if Supabase database endpoint is reachable."""
        if not self.is_configured:
            return False
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self._base_url}/rest/v1/", headers={"apikey": self._key})
                return res.status_code in (200, 404, 401)
        except Exception:
            return False

    async def list_files(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Fetch files from Supabase with pagination and optional owner/status filters."""
        if not self.is_configured:
            return [], 0

        offset = (page - 1) * limit
        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "order": "created_at.desc",
        }
        if status:
            params["status"] = f"eq.{status}"
        if owner_id:
            params["owner_id"] = f"eq.{owner_id}"

        headers = self._headers({"Prefer": "count=exact"})
        url = f"{self._base_url}/rest/v1/files"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=headers, params=params)
                if res.status_code != 200:
                    raise AppException("Failed to query files from Supabase database.")
                total = 0
                content_range = res.headers.get("content-range", "")
                if "/" in content_range:
                    try:
                        total = int(content_range.split("/")[-1])
                    except ValueError:
                        total = len(res.json())
                return res.json(), total
        except httpx.RequestError as exc:
            raise AppException(f"Supabase database connection error: {str(exc)}")

    async def get_file(self, file_id: str, owner_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Fetch a single file from Supabase by UUID."""
        if not self.is_configured:
            return None

        params = {"id": f"eq.{file_id}"}
        if owner_id:
            params["owner_id"] = f"eq.{owner_id}"

        url = f"{self._base_url}/rest/v1/files"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=self._headers(), params=params)
                if res.status_code != 200:
                    return None
                data = res.json()
                return data[0] if data else None
        except httpx.RequestError:
            return None

    async def insert_file(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a new file metadata record into Supabase."""
        if not self.is_configured:
            raise AppException("Supabase database is not configured.")

        url = f"{self._base_url}/rest/v1/files"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, headers=self._headers(), json=record)
                if res.status_code not in (200, 201):
                    raise AppException("Failed to register file in Supabase database.")
                data = res.json()
                return data[0] if isinstance(data, list) and data else record
        except httpx.RequestError as exc:
            raise AppException(f"Failed to communicate with Supabase: {str(exc)}")

    async def list_transfers(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Fetch transfer sessions from Supabase for a specific owner."""
        if not self.is_configured:
            return [], 0

        offset = (page - 1) * limit
        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "order": "created_at.desc",
        }
        if status:
            params["status"] = f"eq.{status}"
        if owner_id:
            params["owner_id"] = f"eq.{owner_id}"

        headers = self._headers({"Prefer": "count=exact"})
        url = f"{self._base_url}/rest/v1/transfers"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=headers, params=params)
                if res.status_code != 200:
                    raise AppException("Failed to query transfers from Supabase.")
                total = len(res.json())
                content_range = res.headers.get("content-range", "")
                if "/" in content_range:
                    try:
                        total = int(content_range.split("/")[-1])
                    except ValueError:
                        pass
                return res.json(), total
        except httpx.RequestError:
            return [], 0

    async def get_transfer(self, transfer_id: str, owner_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Fetch a single transfer session from Supabase."""
        if not self.is_configured:
            return None

        params = {"id": f"eq.{transfer_id}"}
        if owner_id:
            params["owner_id"] = f"eq.{owner_id}"

        url = f"{self._base_url}/rest/v1/transfers"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=self._headers(), params=params)
                if res.status_code != 200:
                    return None
                data = res.json()
                return data[0] if data else None
        except httpx.RequestError:
            return None

    async def insert_chunks(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Insert chunk metadata records into Supabase."""
        if not self.is_configured or not records:
            return []

        url = f"{self._base_url}/rest/v1/file_chunks"
        headers = self._headers({"Prefer": "resolution=merge-duplicates,return=representation"})
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=records)
                if res.status_code not in (200, 201):
                    raise AppException("Failed to insert chunk records in Supabase database.")
                data = res.json()
                return data if isinstance(data, list) else records
        except httpx.RequestError as exc:
            raise AppException(f"Failed to communicate with Supabase chunk table: {str(exc)}")

    async def list_chunks(
        self,
        file_id: str,
        page: int = 1,
        limit: int = 50,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Fetch paginated chunk metadata from Supabase for a file."""
        if not self.is_configured:
            return [], 0

        offset = (page - 1) * limit
        params: Dict[str, Any] = {
            "file_id": f"eq.{file_id}",
            "limit": limit,
            "offset": offset,
            "order": "chunk_index.asc",
        }
        headers = self._headers({"Prefer": "count=exact"})
        url = f"{self._base_url}/rest/v1/file_chunks"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=headers, params=params)
                if res.status_code != 200:
                    raise AppException("Failed to query chunks from Supabase.")
                total = len(res.json())
                content_range = res.headers.get("content-range", "")
                if "/" in content_range:
                    try:
                        total = int(content_range.split("/")[-1])
                    except ValueError:
                        pass
                return res.json(), total
        except httpx.RequestError:
            return [], 0

    async def get_all_chunks(self, file_id: str) -> List[Dict[str, Any]]:
        """Fetch all ordered chunk records for a file (for Merkle tree verification)."""
        if not self.is_configured:
            return []

        params = {
            "file_id": f"eq.{file_id}",
            "order": "chunk_index.asc",
            "limit": 10000,
        }
        url = f"{self._base_url}/rest/v1/file_chunks"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=self._headers(), params=params)
                if res.status_code != 200:
                    return []
                return res.json()
        except httpx.RequestError:
            return []

    async def update_file(self, file_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update file fields (e.g. status, whole_file_sha256, merkle_root_hash)."""
        if not self.is_configured:
            return None

        url = f"{self._base_url}/rest/v1/files"
        params = {"id": f"eq.{file_id}"}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.patch(url, headers=self._headers(), params=params, json=updates)
                if res.status_code not in (200, 204):
                    return None
                data = res.json()
                return data[0] if isinstance(data, list) and data else updates
        except httpx.RequestError:
            return None


supabase_client = SupabaseClient()

