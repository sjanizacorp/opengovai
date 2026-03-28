"""
OpenGovAI — In-memory database with SQLite persistence option
Supports both dev (in-memory) and production (SQLite/PostgreSQL) modes
"""
import json
import asyncio
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager

# Global in-memory store (used for demo; swap for SQLAlchemy in production)
_db: Dict[str, Dict[str, Any]] = {}
_lock = asyncio.Lock()


class DBSession:
    """Async database session abstraction"""

    async def get_all(self, table: str) -> List[Dict]:
        async with _lock:
            return list(_db.get(table, {}).values())

    async def get_by_id(self, table: str, record_id: str) -> Optional[Dict]:
        async with _lock:
            return _db.get(table, {}).get(record_id)

    async def insert(self, table: str, record: Dict) -> Dict:
        async with _lock:
            if table not in _db:
                _db[table] = {}
            record_id = record.get("id")
            _db[table][record_id] = record
            return record

    async def update(self, table: str, record_id: str, record: Dict) -> Dict:
        async with _lock:
            if table not in _db:
                _db[table] = {}
            _db[table][record_id] = record
            return record

    async def delete(self, table: str, record_id: str) -> bool:
        async with _lock:
            if table in _db and record_id in _db[table]:
                del _db[table][record_id]
                return True
            return False

    async def query(self, table: str, filters: Dict) -> List[Dict]:
        async with _lock:
            records = list(_db.get(table, {}).values())
            for key, value in filters.items():
                records = [r for r in records if r.get(key) == value]
            return records


@asynccontextmanager
async def get_db_session():
    session = DBSession()
    try:
        yield session
    finally:
        pass  # In production, close connection here


async def init_db():
    """Initialize database tables"""
    tables = ["assets", "scans", "findings", "policies", "workflows", "schedules", "audit_logs"]
    async with _lock:
        for table in tables:
            if table not in _db:
                _db[table] = {}
