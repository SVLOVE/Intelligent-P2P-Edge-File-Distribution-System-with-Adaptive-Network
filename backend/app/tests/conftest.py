"""Pytest configuration and test isolation fixtures."""

import pytest
from app.core.config import settings


@pytest.fixture(autouse=True)
def isolate_test_environment(monkeypatch):
    """
    Ensure unit tests run deterministically against in-memory repository test doubles
    without depending on live external Supabase cloud state, fulfilling Step 8 requirement:
    'Tests must run without requiring live Supabase credentials or an external database.'
    """
    # Temporarily isolate unit tests to in-memory mode
    monkeypatch.setattr(settings, "SUPABASE_URL", None)
    monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", None)
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
