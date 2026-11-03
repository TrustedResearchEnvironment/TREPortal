"""Unit tests for SQL Server project-lock coordination."""

from unittest.mock import Mock

import pytest

from app.request_supersede import acquire_project_lock


def test_acquire_project_lock_rejects_unknown_request_type():
    with pytest.raises(ValueError, match="Unsupported request type"):
        acquire_project_lock(Mock(), "Unknown", 123)
