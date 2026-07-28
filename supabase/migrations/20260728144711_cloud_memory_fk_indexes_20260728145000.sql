create index if not exists memory_evidence_spans_created_by_job_idx
  on public.memory_evidence_spans (owner_id, created_by_job_id);

create index if not exists turn_traces_conversation_idx
  on public.turn_traces (owner_id, conversation_id);
