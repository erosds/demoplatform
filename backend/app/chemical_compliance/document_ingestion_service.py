import base64
import io
import uuid
import json
from datetime import datetime, timezone
from typing import Any, Dict, List

# Optional heavy deps — degrade gracefully
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import (
        Distance, VectorParams, PointStruct,
        Filter, FieldCondition, MatchValue,
    )
    _QDRANT_OK = True
except ImportError:
    _QDRANT_OK = False

try:
    import requests as _requests
    _REQUESTS_OK = True
except ImportError:
    _REQUESTS_OK = False

try:
    from pdfminer.high_level import extract_text as _pdf_extract
    _PDF_OK = True
except ImportError:
    _PDF_OK = False

try:
    from docx import Document as _DocxDocument
    _DOCX_OK = True
except ImportError:
    _DOCX_OK = False


QDRANT_URL = "http://localhost:6333"
OLLAMA_URL = "http://localhost:11434"
COLLECTION = "chemical_documents"
EMBED_DIM = 768
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64

# H/P code pattern — we never split these lines from context
import re
_HP_PATTERN = re.compile(r'\b[HP]\d{3}[A-Z0-9]*\b')


def _get_qdrant() -> "QdrantClient":
    if not _QDRANT_OK:
        raise RuntimeError("qdrant-client not installed. Run: pip install qdrant-client")
    client = QdrantClient(url=QDRANT_URL)
    _ensure_collection(client)
    return client


def _ensure_collection(client: "QdrantClient"):
    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )


def _embed(texts: List[str]) -> List[List[float]]:
    """Call Ollama nomic-embed-text to get embeddings."""
    if not _REQUESTS_OK:
        raise RuntimeError("requests not installed")
    vectors = []
    for text in texts:
        resp = _requests.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": "nomic-embed-text", "prompt": text},
            timeout=60,
        )
        resp.raise_for_status()
        vectors.append(resp.json()["embedding"])
    return vectors


def _parse_content(name: str, content: str) -> str:
    """Parse file content. Tries base64 PDF/DOCX, falls back to plain text."""
    lower = name.lower()

    # Try base64 decode
    try:
        raw = base64.b64decode(content)
    except Exception:
        # Already plain text
        return content

    if lower.endswith(".pdf"):
        if not _PDF_OK:
            raise RuntimeError("pdfminer.six not installed. Run: pip install pdfminer.six")
        return _pdf_extract(io.BytesIO(raw))

    if lower.endswith(".docx"):
        if not _DOCX_OK:
            raise RuntimeError("python-docx not installed. Run: pip install python-docx")
        doc = _DocxDocument(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    # Unknown binary — treat as UTF-8 text
    try:
        return raw.decode("utf-8")
    except Exception:
        return content


def _smart_chunk(text: str) -> List[Dict[str, str]]:
    """
    Split text into chunks of ~CHUNK_SIZE chars with CHUNK_OVERLAP.
    Never splits H/P code lines from adjacent context: if a chunk ends
    mid-sentence containing an H/P code, merge with the next chunk.
    Returns list of {text, section_title}.
    """
    # Split into lines; detect section titles (short lines ending with common markers)
    lines = text.splitlines()
    chunks: List[Dict[str, str]] = []
    current_section = "General"
    current_buf = []
    current_len = 0

    def flush(buf, section):
        joined = "\n".join(buf).strip()
        if joined:
            chunks.append({"text": joined, "section_title": section})

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Heuristic: a line is a section title if ≤80 chars and ends with ":" or is all-uppercase
        is_title = (len(stripped) <= 80 and (stripped.endswith(":") or stripped.isupper() or stripped.endswith(".")==False and len(stripped.split()) <= 6))
        if is_title and len(stripped) > 3:
            if current_buf and current_len > CHUNK_SIZE // 4:
                flush(current_buf, current_section)
                current_buf = []
                current_len = 0
            current_section = stripped.rstrip(":")

        current_buf.append(stripped)
        current_len += len(stripped) + 1

        if current_len >= CHUNK_SIZE:
            # Check if the last line contains an H/P code — if so, don't split yet
            last_line = current_buf[-1] if current_buf else ""
            if _HP_PATTERN.search(last_line):
                continue  # accumulate more to keep H/P code in context
            flush(current_buf[-CHUNK_OVERLAP // 80:] if CHUNK_OVERLAP else [], current_section)
            # Keep overlap
            overlap_lines = current_buf[-(CHUNK_OVERLAP // max(1, max(len(l) for l in current_buf[-5:] or ["x"]))):]
            current_buf = overlap_lines if overlap_lines else []
            current_len = sum(len(l) + 1 for l in current_buf)

    if current_buf:
        flush(current_buf, current_section)

    return chunks if chunks else [{"text": text[:CHUNK_SIZE], "section_title": "General"}]


def ingest_document(
    name: str,
    content: str,
    document_type: str,
    matrix_type: str,
    revision: str,
) -> Dict[str, Any]:
    """Parse, chunk, embed and store a document. Returns {doc_id, chunks_created, status}."""
    from app.chemical_compliance.audit_service import log_event

    text = _parse_content(name, content)
    chunks = _smart_chunk(text)
    doc_id = str(uuid.uuid4())
    upload_date = datetime.now(timezone.utc).isoformat()

    vectors = _embed([c["text"] for c in chunks])

    client = _get_qdrant()
    points = []
    for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vec,
                payload={
                    "text": chunk["text"],
                    "document_type": document_type,
                    "matrix_type": matrix_type,
                    "revision": revision,
                    "source_file": name,
                    "section_title": chunk["section_title"],
                    "upload_date": upload_date,
                    "doc_id": doc_id,
                    "chunk_index": i,
                },
            )
        )

    client.upsert(collection_name=COLLECTION, points=points)

    log_event("ingest", {
        "doc_id": doc_id,
        "name": name,
        "document_type": document_type,
        "chunks_created": len(chunks),
    })

    return {"doc_id": doc_id, "chunks_created": len(chunks), "status": "ok"}


def list_documents() -> List[Dict[str, Any]]:
    """Return distinct documents from Qdrant (one entry per doc_id)."""
    client = _get_qdrant()
    seen_ids: set = set()
    docs = []
    offset = None

    while True:
        result, next_offset = client.scroll(
            collection_name=COLLECTION,
            limit=100,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for point in result:
            p = point.payload or {}
            doc_id = p.get("doc_id")
            if doc_id and doc_id not in seen_ids:
                seen_ids.add(doc_id)
                docs.append({
                    "doc_id": doc_id,
                    "name": p.get("source_file", ""),
                    "document_type": p.get("document_type", ""),
                    "matrix_type": p.get("matrix_type", ""),
                    "revision": p.get("revision", ""),
                    "upload_date": p.get("upload_date", ""),
                })
        if next_offset is None:
            break
        offset = next_offset

    return docs


def delete_document(doc_id: str) -> Dict[str, Any]:
    """Remove all chunks belonging to a doc_id."""
    from app.chemical_compliance.audit_service import log_event

    client = _get_qdrant()
    client.delete(
        collection_name=COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
    )
    log_event("delete", {"doc_id": doc_id})
    return {"status": "deleted", "doc_id": doc_id}
