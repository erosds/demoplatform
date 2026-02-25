import asyncio
import json
import re
from typing import Any, AsyncGenerator, Dict, List

try:
    import httpx
    _HTTPX_OK = True
except ImportError:
    _HTTPX_OK = False

try:
    import requests as _requests
    _REQUESTS_OK = True
except ImportError:
    _REQUESTS_OK = False

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http.models import Filter, FieldCondition, MatchValue, MatchAny
    _QDRANT_OK = True
except ImportError:
    _QDRANT_OK = False

QDRANT_URL = "http://localhost:6333"
OLLAMA_URL = "http://localhost:11434"
COLLECTION = "chemical_documents"
LLM_MODEL = "llama3.2"
MIN_SCORE_THRESHOLD = 0.30
MAX_HISTORY_TURNS = 3  # last N user+assistant pairs to include

_SYSTEM_PROMPT = """\
You are ChemAssist, a compliance assistant for industrial QA/QC laboratories.
You help analysts, chemists, and quality managers with SOPs, SDS sheets, \
regulations, Certificates of Analysis, and analytical methods.

RULES:
- Answer ONLY from the retrieved context provided. Never invent facts, limits, or codes.
- Cite every factual claim inline as [filename / section].
- If the answer is not in the context: say "I could not find this in the loaded documents." \
and suggest which document type to upload (SOP, SDS, REGULATION, METHOD, or COA).
- Be concise and structured. Use bullet points for H/P codes, exposure limits, or procedure steps.
- For greetings or off-topic questions: introduce yourself in 2 sentences and list 3 things you can help with.
- Never make GMP release decisions or batch disposition recommendations.
"""


# ── Qdrant helpers ─────────────────────────────────────────────────────────────

def _get_qdrant() -> "QdrantClient":
    if not _QDRANT_OK:
        raise RuntimeError("qdrant-client not installed")
    return QdrantClient(url=QDRANT_URL)


def _collection_exists() -> bool:
    try:
        client = QdrantClient(url=QDRANT_URL)
        info = client.get_collection(COLLECTION)
        return (info.points_count or 0) > 0
    except Exception:
        return False


def _build_filter(mode: str, document_types: List[str]):
    if not _QDRANT_OK:
        return None
    conditions = []
    if mode == "regulatory":
        conditions.append(FieldCondition(key="document_type", match=MatchValue(value="REGULATION")))
    elif mode == "sds_extract":
        conditions.append(FieldCondition(key="document_type", match=MatchValue(value="SDS")))
    elif document_types:
        conditions.append(FieldCondition(key="document_type", match=MatchAny(any=document_types)))
    return Filter(must=conditions) if conditions else None


# ── Embedding ──────────────────────────────────────────────────────────────────

def _embed_query(query: str) -> List[float]:
    if not _REQUESTS_OK:
        raise RuntimeError("requests not installed")
    resp = _requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": query},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]


# ── Retrieval ──────────────────────────────────────────────────────────────────

def retrieve(
    query: str,
    mode: str = "general",
    document_types: List[str] = [],
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    client = _get_qdrant()
    vec = _embed_query(query)
    filt = _build_filter(mode, document_types)
    results = client.search(
        collection_name=COLLECTION,
        query_vector=vec,
        limit=top_k,
        query_filter=filt,
        with_payload=True,
        score_threshold=MIN_SCORE_THRESHOLD,
    )
    chunks = []
    for hit in results:
        p = hit.payload or {}
        chunks.append({
            "text": p.get("text", ""),
            "source_file": p.get("source_file", ""),
            "section_title": p.get("section_title", ""),
            "document_type": p.get("document_type", ""),
            "score": hit.score,
        })
    return chunks


# ── Prompt building ────────────────────────────────────────────────────────────

def _build_conversation_context(messages: List[Dict]) -> str:
    """Format the last N turns as conversation history."""
    if not messages:
        return ""
    # Take last MAX_HISTORY_TURNS * 2 messages (user + assistant pairs)
    recent = messages[-(MAX_HISTORY_TURNS * 2):]
    lines = ["CONVERSATION HISTORY:"]
    for msg in recent:
        role = "User" if msg["role"] == "user" else "Assistant"
        content = msg["content"]
        # Truncate long assistant messages to keep prompt size manageable
        if len(content) > 400:
            content = content[:400] + "…"
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _build_prompt(
    query: str,
    chunks: List[Dict[str, Any]],
    messages: List[Dict],
) -> str:
    parts = [_SYSTEM_PROMPT]

    history = _build_conversation_context(messages)
    if history:
        parts.append(history)

    if chunks:
        context_parts = []
        for i, c in enumerate(chunks, 1):
            context_parts.append(
                f"[{i}] {c['source_file']} / {c['section_title']}\n{c['text']}"
            )
        parts.append("RETRIEVED CONTEXT:\n" + "\n\n---\n\n".join(context_parts))
    else:
        parts.append("RETRIEVED CONTEXT: (none — no relevant documents found)")

    parts.append(f"USER QUERY: {query}\n\nASSISTANT:")
    return "\n\n".join(parts)


# ── Entity extraction ──────────────────────────────────────────────────────────

def _extract_entities(text: str) -> Dict[str, Any]:
    cas = re.findall(r'\b\d{2,7}-\d{2}-\d\b', text)
    hazard = re.findall(r'\bH\d{3}[A-Z0-9]*\b', text)
    precautionary = re.findall(r'\bP\d{3}[A-Z0-9]*\b', text)
    formulas = re.findall(r'\b[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+\b', text)
    return {
        "cas_numbers": list(set(cas)),
        "hazard_statements": list(set(hazard)),
        "precautionary_statements": list(set(precautionary)),
        "chemical_formulas": list(set(formulas)),
    }


# ── Confidence ─────────────────────────────────────────────────────────────────

def compute_confidence(
    n_chunks: int,
    avg_score: float,
    n_unique_docs: int,
    mode: str,
) -> float:
    if n_chunks == 0:
        return 0.0
    base = avg_score
    coverage_bonus = min(0.1 * max(n_unique_docs - 1, 0), 0.3)
    if mode == "regulatory" and n_unique_docs < 2:
        base *= 0.7
    return round(min(max(base + coverage_bonus, 0.0), 0.99), 2)


# ── Streaming pipeline ─────────────────────────────────────────────────────────

async def stream_query_pipeline(
    query: str,
    mode: str = "general",
    document_types: List[str] = [],
    top_k: int = 5,
    messages: List[Dict] = [],
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Async generator yielding SSE-style dicts:
      {"type": "token",  "content": "..."}
      {"type": "meta",   "sources": [...], "confidence": 0.x, "entities": {...}}
      {"type": "error",  "message": "..."}
      {"type": "done"}
    """
    from app.chemical_compliance.audit_service import log_event
    from app.chemical_compliance.regulatory_mode import apply_regulatory_constraints

    loop = asyncio.get_event_loop()

    # 1. Short-circuit: empty knowledge base
    has_docs = await loop.run_in_executor(None, _collection_exists)
    if not has_docs:
        yield {"type": "token", "content": (
            "The knowledge base is empty. Upload documents in **Upload & Ingest** "
            "to get started — try the sample SOP, SDS, or regulation files."
        )}
        yield {"type": "meta", "sources": [], "confidence": 0.0, "entities": {}}
        yield {"type": "done"}
        return

    # 2. Retrieve relevant chunks
    try:
        chunks = await loop.run_in_executor(
            None, lambda: retrieve(query, mode, document_types, top_k)
        )
    except Exception as e:
        yield {"type": "error", "message": str(e)}
        yield {"type": "done"}
        return

    # 3. No relevant chunks above threshold
    if not chunks:
        no_doc_msg = (
            "I could not find relevant information in the loaded documents "
            "for this query.\n\n"
            "Try uploading more specific documents, or rephrase using "
            "technical terminology (substance names, CAS numbers, H/P codes)."
        )
        yield {"type": "token", "content": no_doc_msg}
        yield {"type": "meta", "sources": [], "confidence": 0.0, "entities": {}}
        yield {"type": "done"}
        log_event("query", {"query": query, "mode": mode, "chunks_retrieved": 0,
                             "confidence": 0.0, "unique_sources": 0})
        return

    # 4. Build prompt with history
    if mode == "regulatory":
        _, chunks = apply_regulatory_constraints(chunks, "", query)
    prompt = _build_prompt(query, chunks, messages)

    # 5. Stream tokens from Ollama
    full_response = ""
    try:
        if not _HTTPX_OK:
            raise RuntimeError("httpx not installed")
        async with httpx.AsyncClient(timeout=180) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_URL}/api/generate",
                json={"model": LLM_MODEL, "prompt": prompt, "stream": True},
            ) as resp:
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    token = data.get("response", "")
                    if token:
                        full_response += token
                        yield {"type": "token", "content": token}
                    if data.get("done"):
                        break
    except Exception as e:
        yield {"type": "error", "message": f"Generation failed: {e}"}
        yield {"type": "done"}
        return

    # 6. Compute metadata
    scores = [c["score"] for c in chunks]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    unique_docs = len(set(c["source_file"] for c in chunks))
    confidence = compute_confidence(len(chunks), avg_score, unique_docs, mode)
    entities = _extract_entities(full_response)
    sources = [
        {
            "source_file": c["source_file"],
            "section_title": c["section_title"],
            "score": round(c["score"], 4),
            "text_snippet": c["text"][:200],
        }
        for c in chunks
    ]

    log_event("query", {
        "query": query,
        "mode": mode,
        "chunks_retrieved": len(chunks),
        "confidence": confidence,
        "unique_sources": unique_docs,
    })

    yield {"type": "meta", "sources": sources, "confidence": confidence, "entities": entities}
    yield {"type": "done"}


# ── Non-streaming pipeline (kept for /query endpoint) ─────────────────────────

def query_pipeline(
    query: str,
    mode: str = "general",
    document_types: List[str] = [],
    top_k: int = 5,
    messages: List[Dict] = [],
) -> Dict[str, Any]:
    from app.chemical_compliance.regulatory_mode import apply_regulatory_constraints
    from app.chemical_compliance.audit_service import log_event

    if not _collection_exists():
        return {
            "answer": "The knowledge base is empty. Upload documents in Upload & Ingest first.",
            "sources": [], "extracted_entities": {}, "confidence_score": 0.0,
        }

    chunks = retrieve(query, mode, document_types, top_k)

    if not chunks:
        return {
            "answer": "I could not find relevant information in the loaded documents for this query.",
            "sources": [], "extracted_entities": {}, "confidence_score": 0.0,
        }

    if mode == "regulatory":
        _, chunks = apply_regulatory_constraints(chunks, "", query)

    prompt = _build_prompt(query, chunks, messages)

    if not _REQUESTS_OK:
        raise RuntimeError("requests not installed")
    resp = _requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": LLM_MODEL, "prompt": prompt, "stream": False},
        timeout=180,
    )
    resp.raise_for_status()
    answer = resp.json().get("response", "").strip()

    scores = [c["score"] for c in chunks]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    unique_docs = len(set(c["source_file"] for c in chunks))
    confidence = compute_confidence(len(chunks), avg_score, unique_docs, mode)
    entities = _extract_entities(answer)
    sources = [
        {"source_file": c["source_file"], "section_title": c["section_title"],
         "score": round(c["score"], 4), "text_snippet": c["text"][:200]}
        for c in chunks
    ]

    log_event("query", {"query": query, "mode": mode, "chunks_retrieved": len(chunks),
                        "confidence": confidence, "unique_sources": unique_docs})
    return {"answer": answer, "sources": sources, "extracted_entities": entities,
            "confidence_score": confidence}
