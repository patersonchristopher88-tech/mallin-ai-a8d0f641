DELETE FROM public.messages m
USING public.messages k
WHERE m.thread_id = k.thread_id
  AND m.role = k.role
  AND m.parts::text = k.parts::text
  AND m.created_at >= k.created_at
  AND m.id <> k.id
  AND m.ctid > k.ctid;