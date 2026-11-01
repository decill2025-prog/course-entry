CREATE TABLE public.nexus_posts (
  id text PRIMARY KEY,
  level text NOT NULL,
  course text NOT NULL,
  code text NOT NULL,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, course, code, topic)
);
CREATE INDEX nexus_posts_feed_idx ON public.nexus_posts (level, course, created_at DESC);
GRANT SELECT ON public.nexus_posts TO anon, authenticated;
GRANT ALL ON public.nexus_posts TO service_role;
ALTER TABLE public.nexus_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lessons are public to read" ON public.nexus_posts FOR SELECT TO anon, authenticated USING (true);