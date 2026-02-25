import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

_audit_log: List[Dict[str, Any]] = []

_LOG_PATH = os.path.join(
    os.path.dirname(__file__),
    "..", "..", "datasets", "chemical_compliance", "audit_log.json"
)


def _load_from_disk():
    """Load existing audit log from disk on startup."""
    global _audit_log
    path = os.path.abspath(_LOG_PATH)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                _audit_log = json.load(f)
        except Exception:
            _audit_log = []


def _save_to_disk():
    path = os.path.abspath(_LOG_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(_audit_log, f, indent=2, default=str)
    except Exception:
        pass  # Non-critical: audit write failure should not break the request


def log_event(action: str, details: Dict[str, Any]):
    """Append an event to the audit log and persist to disk."""
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        **details,
    }
    _audit_log.append(event)
    _save_to_disk()


def get_log() -> List[Dict[str, Any]]:
    """Return audit events, newest first."""
    return list(reversed(_audit_log))


def clear_log():
    """Clear the audit log (for testing)."""
    global _audit_log
    _audit_log = []
    _save_to_disk()


# Load from disk when module is imported
_load_from_disk()
