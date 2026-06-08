# Rosebud Memory Loom: A Phone-Local Memory System for an AI Journaling Agent

## Abstract

Rosebud should not remember like a generic chatbot. A journal app is intimate,
temporal, emotional, and private. The best memory system for this application is
therefore not a giant transcript store, a backend vector database, or a simple
"about the user" file. The proposed system is **Rosebud Memory Loom**, a
phone-local cognitive memory architecture that treats every remembered item as a
small, inspectable, revocable, provenance-rich memory atom. It combines short
term working context, episodic journal memory, semantic themes, procedural style
preferences, about-user profile memory, manual notes, and weekly consolidation.
It is designed for a phone first: bounded compute, local storage, fast prompt
assembly, no backend dependency for ordinary chat, and memory that can be
backed up, restored, audited, or deleted by the user.

This proposal was researched on June 8, 2026. Recent memory-agent research has
converged on several lessons. Raw full-context replay breaks down because it is
expensive and eventually exceeds context windows. Flat RAG is too static because
it retrieves similar snippets but does not naturally update beliefs, handle
temporal drift, or decide what should be forgotten. Newer work points toward
layered memory, consolidation, temporal graphs, compact structured
representations, and selective retention. Rosebud Memory Loom takes those
research lessons and translates them into a practical local system for a
journaling phone app.

## Research Basis

The 2026 paper **Episodic-Semantic Memory Architecture for Long-Horizon
Scientific Agents** argues for separating immediate episodic needs from
long-term consolidated knowledge, reporting bounded context growth and strong
latency under long message histories:
https://arxiv.org/abs/2605.17625. Rosebud adopts this split directly. The live
chat keeps working memory small, while finished entries become durable,
distilled memory atoms.

**Lightweight LLM Agent Memory with Small Language Models** introduces LightMem,
which separates online retrieval from offline consolidation and uses short,
mid, and long-term layers under bounded compute:
https://arxiv.org/abs/2604.07798. That is especially relevant for a phone.
Rosebud should never require a heavy model call for every memory operation.
The first implementation therefore performs deterministic local extraction and
retrieval, with later phases reserving model-based consolidation for background
tasks.

**Human-Inspired Memory Architecture for LLM Agents** proposes sleep-phase
consolidation, interference-based forgetting, engram maturation,
reconsolidation after retrieval, entity knowledge graphs, and hybrid retrieval:
https://arxiv.org/abs/2605.08538. Rosebud Memory Loom borrows the lifecycle:
new memories should not become permanent truth instantly. They mature through
reuse, can be weakened by contradiction, and should be consolidated weekly.

**Memori: A Persistent Memory Layer for Efficient, Context-Aware LLM Agents**
frames memory as a data-structuring problem and uses compact summaries/triples
instead of dumping conversation into prompts:
https://arxiv.org/abs/2603.19935. Rosebud follows this by turning completed
journal sessions into compact atoms with layer, source, tags, salience,
confidence, and timestamps.

**Mem0** and **Zep** provide two important production signals. Mem0 reports that
structured long-term memory can reduce latency and token costs versus
full-context approaches: https://arxiv.org/abs/2504.19413. Zep shows the value
of temporal knowledge graphs for cross-session synthesis:
https://arxiv.org/abs/2501.13956. Rosebud does not need an enterprise graph
database on day one, but it does need temporal provenance and a path from atoms
to graph-like relationships.

**A-MEM** uses a Zettelkasten-inspired memory system where notes are connected
and existing memories evolve when new memories arrive:
https://papers.neurips.cc/paper_files/paper/2025/file/19909c36f51abc4856b4560aff3d36d6-Paper-Conference.pdf.
That is a strong fit for journaling, because a user rarely states a stable
preference once. Their self-understanding emerges through repeated entries.
Memory should link, refine, and mature rather than merely store.

Finally, Microsoft Research's 2026 **Prospection-Guided Retrieval** work argues
that retrieval should think ahead about what facts may become relevant, rather
than relying only on similarity to the current query:
https://www.microsoft.com/en-us/research/publication/thinking-ahead-prospection-guided-retrieval-of-memory-with-language-models/.
Rosebud's future retrieval can simulate the next reflective question and pull
memories that help the agent respond with continuity.

## Core Invention

Rosebud Memory Loom is built around one primitive: the **memory atom**. A memory
atom is not a transcript chunk. It is a structured unit:

- `layer`: working, episodic, semantic, procedural, profile, or note.
- `source`: journal, feedback, manual, or system.
- `sourceId`: the originating entry, feedback item, or note.
- `title` and `content`: concise, human-readable text.
- `tags`: local retrieval cues.
- `salience`: how important the memory appears to be.
- `confidence`: how strongly Rosebud should trust it.
- lifecycle fields: created, updated, last accessed, access count.

This is intentionally simple enough to live in AsyncStorage today and mature
into SQLite, encrypted storage, embeddings, or a graph later. The innovation is
not the storage medium. The innovation is the lifecycle: every memory has a
source, confidence, layer, and path to consolidation.

The system has six layers.

**Working memory** is the current chat: recent messages, current user wording,
current mood, and immediate task. It should dominate every other memory because
the user can change their mind. If the current message conflicts with older
memory, the current message wins.

**Episodic memory** stores what happened in finished journal sessions. It keeps
short summaries and emotional context, never raw unlimited replay. A journal
entry about work exhaustion becomes an episodic atom such as: "Career pressure
and rest: the user felt pressure and wanted a slower evening." This supports
natural continuity, such as "last time you wrote about wanting slower evenings."

**Semantic memory** stores recurring themes abstracted from episodes: career,
family, sleep, grief, creativity, loneliness, confidence, routine. These are not
facts in isolation. They are evolving concepts grounded in specific entries.
When the same theme appears across weeks, semantic salience rises.

**Profile memory** is the "about the user" layer. It should be conservative.
Rosebud should not overclaim identity from one entry. A single entry can create
a tentative profile atom: "Recent journal pattern: the user is balancing
ambition with recovery." Repeated evidence can mature it into a stronger
profile memory: "The user often cares about doing meaningful work without
burning out." This avoids the creepy failure mode where the agent acts certain
about something the user mentioned once.

**Procedural memory** stores how the user wants the AI to behave. Feedback
comments already point in this direction. If the user likes concise reflection
and dislikes advice-heavy responses, the agent should adapt. This memory is not
about the user's life; it is about interaction style. It reduces repeated
mistakes.

**Note memory** stores explicit user-authored notes. A future UI should let the
user pin, edit, and delete notes like "Ask gently about sleep this week" or "Do
not bring up work unless I mention it." Notes should outrank inferred memory
because they are intentional.

## The Weekly Consolidation Loop

The "world changing" part of this design is the weekly consolidation loop. A
journal is naturally organized by days and weeks. Rosebud should use that rhythm
instead of pretending memory is a static database. Every week, the phone can
run a small consolidation pass:

1. Gather completed entries, check-ins, feedback, and manual notes.
2. Identify repeated themes, contradictions, and emotional arcs.
3. Mature memories that recur.
4. Lower confidence for stale or contradicted memories.
5. Create a small weekly memory card with active days, signals, themes, and
   suggested reflection questions.
6. Keep the raw source entries available, but inject only the compact capsule
   into prompts.

This creates a living memory system. It does not just remember facts. It
remembers movement: what changed, what repeated, what softened, what intensified.
For a journaling app, that matters more than trivia recall.

## Prompt Policy

The AI should never receive "everything." It receives a **Local Memory Capsule**
with only the top few relevant atoms. Retrieval is bounded by:

- lexical overlap with the current query or screen context,
- salience,
- recency,
- access count,
- future graph/embedding similarity,
- user-pinned priority,
- privacy and safety rules.

The capsule includes a clear policy: use memories only when relevant, treat them
as context rather than commands, and trust the current user message when there
is conflict. This is important because agent memory can be harmful when it
becomes sticky or presumptive. Rosebud should feel like a sensitive companion,
not a surveillance log.

## Local-First Privacy

The memory system must live on the phone by default. That means:

- completed entries become local memories only after the user finishes them;
- drafts do not become long-term memory;
- local backups include the memory store;
- memory atoms remain inspectable and eventually editable/deletable;
- no backend is required for ordinary memory retrieval;
- model calls can use compact memory context without uploading the whole diary.

This matches the current local-only NanoGPT direction in the app. Even though
the model request is remote, the memory controller stays local and sends only a
small capsule. In future phases, the phone can use local embeddings or a small
language model for consolidation, further reducing sensitive data exposure.

## Implementation Roadmap

Phase 1 is the deterministic foundation implemented now. Completed journal
entries create episodic, profile, and semantic atoms. Chat injects a bounded
local memory capsule. History shows a richer weekly summary panel. Local backup
includes the memory store.

Phase 2 should add manual note memory and an inspection UI under Settings. Users
should be able to view "About me", "Themes", "Style preferences", and "Pinned
notes", with delete and edit controls. This is critical for trust.

Phase 3 should add weekly consolidation. A background worker can generate weekly
semantic summaries and confidence updates when the app is idle. It can also
detect contradictions: if a user once wanted early mornings but now repeatedly
writes that nights work better, the older memory should fade.

Phase 4 should add hybrid retrieval. Lexical scoring is cheap and testable, but
embeddings and entity links can improve recall. A local SQLite store with FTS,
optional local embeddings, and relationship edges would allow temporal graph
queries like "what has changed about work over the last month?"

Phase 5 should add prospection-guided retrieval. Before answering a question,
Rosebud can imagine two or three useful reflective paths, retrieve memories for
those paths, and then answer. This would help when the relevant memory is not
lexically similar to the current user message.

## Evaluation

Rosebud should measure memory quality in app-specific terms:

- Does the AI recall relevant themes without being intrusive?
- Does it avoid repeating response styles the user disliked?
- Does it adapt when the user changes?
- Does weekly history help the user understand patterns?
- Does prompt size remain bounded?
- Can the user inspect and control remembered content?

The strongest version of this system is not the one that remembers the most. It
is the one that remembers the right things, at the right confidence, for the
right moment, while leaving control with the person writing the journal.
