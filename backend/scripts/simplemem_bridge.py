#!/usr/bin/env python
"""
SimpleMem bridge for backend integration.

This script adapts SimpleMem-style memory extraction/retrieval for the Node backend:
- LLM operations (memory extraction/planning): Nano GPT (OpenAI-compatible endpoint)
- Embeddings: OpenRouter endpoint with openai/text-embedding-3-small (or override)
- Storage: LanceDB
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
import lancedb
import pyarrow as pa


DEFAULT_NANO_BASE_URL = "https://nano-gpt.com/api/v1"
DEFAULT_NANO_MODEL = "moonshotai/kimi-k2.5"
DEFAULT_EMBEDDING_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small"
DEFAULT_DB_PATH = "./data/simplemem"
DEFAULT_TABLE_NAME = "journal_global_memory"
DEFAULT_TOP_K = 12
DEFAULT_EMBEDDING_DIMENSION = 1536
HTTP_TIMEOUT_SECONDS = 120.0


@dataclass
class MemoryEntry:
    entry_id: str
    lossless_restatement: str
    keywords: List[str]
    timestamp: Optional[str] = None
    location: Optional[str] = None
    persons: List[str] = None
    entities: List[str] = None
    topic: Optional[str] = None

    def __post_init__(self) -> None:
        if self.persons is None:
            self.persons = []
        if self.entities is None:
            self.entities = []


class DualProviderClient:
    def __init__(self) -> None:
        self.nano_api_key = os.getenv("NANO_GPT_API_KEY")
        self.nano_base_url = (os.getenv("NANO_GPT_API_BASE_URL") or DEFAULT_NANO_BASE_URL).rstrip("/")
        self.nano_model = os.getenv("NANO_GPT_MODEL") or DEFAULT_NANO_MODEL

        self.embedding_api_key = os.getenv("OPENROUTER_EMBEDDING_API_KEY")
        self.embedding_base_url = (
            os.getenv("OPENROUTER_EMBEDDING_BASE_URL") or DEFAULT_EMBEDDING_BASE_URL
        ).rstrip("/")
        self.embedding_model = os.getenv("SIMPLEMEM_EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL

        if not self.nano_api_key:
            raise RuntimeError("Missing NANO_GPT_API_KEY")
        if not self.embedding_api_key:
            raise RuntimeError("Missing OPENROUTER_EMBEDDING_API_KEY")

        self._nano_client = httpx.Client(
            timeout=HTTP_TIMEOUT_SECONDS,
            headers={
                "Authorization": f"Bearer {self.nano_api_key}",
                "Content-Type": "application/json",
            },
        )
        self._embedding_client = httpx.Client(
            timeout=HTTP_TIMEOUT_SECONDS,
            headers={
                "Authorization": f"Bearer {self.embedding_api_key}",
                "Content-Type": "application/json",
            },
        )

    def close(self) -> None:
        self._nano_client.close()
        self._embedding_client.close()

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        payload: Dict[str, Any] = {
            "model": self.nano_model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format:
            payload["response_format"] = response_format

        response = self._nano_client.post(
            f"{self.nano_base_url}/chat/completions",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        message = (data.get("choices") or [{}])[0].get("message") or {}
        return (
            message.get("content")
            or message.get("reasoning")
            or message.get("reasoning_content")
            or ""
        )

    def create_embedding(self, texts: List[str]) -> List[List[float]]:
        payload = {
            "model": self.embedding_model,
            "input": texts,
        }
        response = self._embedding_client.post(
            f"{self.embedding_base_url}/embeddings",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        vectors = sorted(data.get("data", []), key=lambda item: item.get("index", 0))
        return [item.get("embedding", []) for item in vectors]

    def create_single_embedding(self, text: str) -> List[float]:
        vectors = self.create_embedding([text])
        return vectors[0] if vectors else []

    def extract_json(self, text: str) -> Optional[Any]:
        if not text:
            return None

        stripped = text.strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

        code_block = re.search(r"```json\s*([\s\S]*?)\s*```", stripped, re.IGNORECASE)
        if code_block:
            try:
                return json.loads(code_block.group(1))
            except json.JSONDecodeError:
                pass

        first_object = self._extract_balanced(stripped, "{", "}")
        if first_object:
            try:
                return json.loads(first_object)
            except json.JSONDecodeError:
                pass

        return None

    def _extract_balanced(self, text: str, left: str, right: str) -> Optional[str]:
        start = text.find(left)
        if start == -1:
            return None

        depth = 0
        in_string = False
        escaped = False
        for index in range(start, len(text)):
            char = text[index]
            if escaped:
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if char == left:
                depth += 1
            elif char == right:
                depth -= 1
                if depth == 0:
                    return text[start:index + 1]
        return None


class SimpleMemVectorStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        os.makedirs(db_path, exist_ok=True)
        self.db = lancedb.connect(db_path)
        self._tables: Dict[str, Any] = {}

    def _schema(self, embedding_dim: int) -> pa.Schema:
        return pa.schema([
            pa.field("entry_id", pa.string()),
            pa.field("lossless_restatement", pa.string()),
            pa.field("keywords", pa.list_(pa.string())),
            pa.field("timestamp", pa.string()),
            pa.field("location", pa.string()),
            pa.field("persons", pa.list_(pa.string())),
            pa.field("entities", pa.list_(pa.string())),
            pa.field("topic", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), embedding_dim)),
            pa.field("created_at", pa.string()),
        ])

    def get_table(self, table_name: str, embedding_dim: int) -> Any:
        if table_name in self._tables:
            return self._tables[table_name]

        if table_name in self.db.table_names():
            table = self.db.open_table(table_name)
        else:
            table = self.db.create_table(table_name, schema=self._schema(embedding_dim))
        self._tables[table_name] = table
        return table

    def add_entries(
        self,
        table_name: str,
        entries: List[MemoryEntry],
        vectors: List[List[float]],
        embedding_dim: int,
    ) -> int:
        if not entries:
            return 0

        table = self.get_table(table_name, embedding_dim)
        now = datetime.utcnow().isoformat()
        records = []
        for entry, vector in zip(entries, vectors):
            records.append({
                "entry_id": entry.entry_id,
                "lossless_restatement": entry.lossless_restatement,
                "keywords": entry.keywords,
                "timestamp": entry.timestamp or "",
                "location": entry.location or "",
                "persons": entry.persons,
                "entities": entry.entities,
                "topic": entry.topic or "",
                "vector": vector,
                "created_at": now,
            })
        table.add(records)
        return len(records)

    def semantic_search(
        self,
        table_name: str,
        query_vector: List[float],
        top_k: int,
        embedding_dim: int,
    ) -> List[MemoryEntry]:
        table = self.get_table(table_name, embedding_dim)
        if table.count_rows() == 0:
            return []

        rows = table.search(query_vector).limit(top_k).to_list()
        return [self._row_to_entry(row) for row in rows]

    def keyword_search(
        self,
        table_name: str,
        keywords: List[str],
        top_k: int,
        embedding_dim: int,
    ) -> List[MemoryEntry]:
        table = self.get_table(table_name, embedding_dim)
        if table.count_rows() == 0 or not keywords:
            return []

        rows = table.to_arrow().to_pylist()
        scored: List[tuple[int, Dict[str, Any]]] = []
        normalized = [k.lower() for k in keywords]

        for row in rows:
            text = str(row.get("lossless_restatement", "")).lower()
            row_keywords = [str(k).lower() for k in row.get("keywords", [])]
            score = 0
            for keyword in normalized:
                if keyword in text:
                    score += 1
                if keyword in row_keywords:
                    score += 2
            if score > 0:
                scored.append((score, row))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [self._row_to_entry(row) for _, row in scored[:top_k]]

    def _row_to_entry(self, row: Dict[str, Any]) -> MemoryEntry:
        return MemoryEntry(
            entry_id=row.get("entry_id", ""),
            lossless_restatement=row.get("lossless_restatement", ""),
            keywords=list(row.get("keywords", []) or []),
            timestamp=row.get("timestamp") or None,
            location=row.get("location") or None,
            persons=list(row.get("persons", []) or []),
            entities=list(row.get("entities", []) or []),
            topic=row.get("topic") or None,
        )


def _safe_keywords(text: str) -> List[str]:
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9_-]{1,40}", text.lower())
    stop = {
        "the", "and", "for", "that", "this", "with", "from", "have", "has",
        "are", "was", "were", "you", "your", "about", "what", "when", "where",
        "how", "why", "will", "would", "could", "should", "just", "like",
    }
    unique = []
    for word in words:
        if word in stop:
            continue
        if word not in unique:
            unique.append(word)
    return unique[:10]


def _extract_memory_entries(
    client: DualProviderClient,
    speaker: str,
    content: str,
    timestamp: Optional[str],
) -> List[MemoryEntry]:
    prompt = f"""
Convert this dialogue into compact atomic memory facts.

Dialogue:
- speaker: {speaker}
- timestamp: {timestamp or datetime.utcnow().isoformat()}
- content: {content}

Rules:
1. Preserve meaning with explicit subjects and concrete details.
2. Extract stable preferences, goals, identity, plans, routines, relationships, and notable events.
3. Keep even small personal details if they might matter later.
4. Return valid JSON only.

Output schema:
{{
  "entries": [
    {{
      "lossless_restatement": "string",
      "keywords": ["string"],
      "timestamp": "ISO-8601 or null",
      "location": "string or null",
      "persons": ["string"],
      "entities": ["string"],
      "topic": "string or null"
    }}
  ]
}}
"""

    messages = [
        {
            "role": "system",
            "content": (
                "You are a memory extraction model. "
                "Return only JSON. Capture meaningful user and assistant details for long-term memory."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    try:
        raw = client.chat_completion(messages, temperature=0.1, response_format={"type": "json_object"})
        data = client.extract_json(raw) or {}
        items = data if isinstance(data, list) else data.get("entries", [])
        entries: List[MemoryEntry] = []
        for item in items:
            restatement = str(item.get("lossless_restatement", "")).strip()
            if not restatement:
                continue
            entries.append(MemoryEntry(
                entry_id=str(uuid.uuid4()),
                lossless_restatement=restatement,
                keywords=list(item.get("keywords") or _safe_keywords(restatement)),
                timestamp=item.get("timestamp") or timestamp,
                location=item.get("location"),
                persons=list(item.get("persons") or []),
                entities=list(item.get("entities") or []),
                topic=item.get("topic"),
            ))
        if entries:
            return entries
    except Exception:
        pass

    fallback = content.strip()
    if not fallback:
        return []
    return [MemoryEntry(
        entry_id=str(uuid.uuid4()),
        lossless_restatement=fallback,
        keywords=_safe_keywords(fallback),
        timestamp=timestamp,
        topic=f"{speaker} message",
    )]


def _plan_queries(client: DualProviderClient, query: str) -> List[str]:
    messages = [
        {
            "role": "system",
            "content": "Generate targeted memory retrieval queries. Return JSON only.",
        },
        {
            "role": "user",
            "content": (
                "Given this user query, output 1-3 focused retrieval queries.\n"
                f"Query: {query}\n"
                'JSON: {"queries":["..."]}'
            ),
        },
    ]
    try:
        raw = client.chat_completion(messages, temperature=0.1, response_format={"type": "json_object"})
        data = client.extract_json(raw) or {}
        queries = data.get("queries", [])
        cleaned = [str(item).strip() for item in queries if str(item).strip()]
        return cleaned[:3] if cleaned else [query]
    except Exception:
        return [query]


def handle_store(payload: Dict[str, Any]) -> Dict[str, Any]:
    speaker = str(payload.get("speaker", "user")).strip() or "user"
    content = str(payload.get("content", "")).strip()
    table_name = str(payload.get("table_name") or os.getenv("SIMPLEMEM_TABLE_NAME") or DEFAULT_TABLE_NAME)
    timestamp = payload.get("timestamp") or datetime.utcnow().isoformat()
    db_path = os.getenv("SIMPLEMEM_DB_PATH") or DEFAULT_DB_PATH
    embedding_dim = int(os.getenv("SIMPLEMEM_EMBEDDING_DIMENSION") or DEFAULT_EMBEDDING_DIMENSION)

    if not content:
        return {"stored_entries": 0}

    client = DualProviderClient()
    store = SimpleMemVectorStore(db_path=db_path)

    try:
        entries = _extract_memory_entries(client, speaker=speaker, content=content, timestamp=timestamp)
        if not entries:
            return {"stored_entries": 0}

        vectors = client.create_embedding([entry.lossless_restatement for entry in entries])
        if vectors and len(vectors[0]) > 0:
            embedding_dim = len(vectors[0])
        stored = store.add_entries(
            table_name=table_name,
            entries=entries,
            vectors=vectors,
            embedding_dim=embedding_dim,
        )
        return {"stored_entries": stored}
    finally:
        client.close()


def handle_retrieve(payload: Dict[str, Any]) -> Dict[str, Any]:
    query = str(payload.get("query", "")).strip()
    table_name = str(payload.get("table_name") or os.getenv("SIMPLEMEM_TABLE_NAME") or DEFAULT_TABLE_NAME)
    top_k = int(payload.get("top_k") or os.getenv("SIMPLEMEM_TOP_K") or DEFAULT_TOP_K)
    db_path = os.getenv("SIMPLEMEM_DB_PATH") or DEFAULT_DB_PATH
    embedding_dim = int(os.getenv("SIMPLEMEM_EMBEDDING_DIMENSION") or DEFAULT_EMBEDDING_DIMENSION)

    if not query:
        return {"entries": []}

    client = DualProviderClient()
    store = SimpleMemVectorStore(db_path=db_path)

    try:
        planned_queries = _plan_queries(client, query)
        dedup: Dict[str, MemoryEntry] = {}

        for planned_query in planned_queries:
            vector = client.create_single_embedding(planned_query)
            if vector:
                embedding_dim = len(vector)
                for entry in store.semantic_search(
                    table_name=table_name,
                    query_vector=vector,
                    top_k=top_k,
                    embedding_dim=embedding_dim,
                ):
                    dedup[entry.entry_id] = entry

            keywords = _safe_keywords(planned_query)
            for entry in store.keyword_search(
                table_name=table_name,
                keywords=keywords,
                top_k=max(3, top_k // 2),
                embedding_dim=embedding_dim,
            ):
                dedup[entry.entry_id] = entry

        entries = list(dedup.values())[:top_k]
        return {
            "entries": [asdict(entry) for entry in entries],
        }
    finally:
        client.close()


def parse_stdin_payload() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Invalid JSON payload: {error}") from error


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["store", "retrieve"])
    args = parser.parse_args()

    try:
        payload = parse_stdin_payload()
        if args.command == "store":
            result = handle_store(payload)
        else:
            result = handle_retrieve(payload)

        print(json.dumps(result, ensure_ascii=True))
        return 0
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

