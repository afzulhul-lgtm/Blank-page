
-- Folders
CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'New folder',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folders select own" ON public.folders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "folders insert own" ON public.folders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "folders update own" ON public.folders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "folders delete own" ON public.folders FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER folders_touch BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Documents: folder_id + share fields
ALTER TABLE public.documents ADD COLUMN folder_id uuid NULL;
ALTER TABLE public.documents ADD COLUMN share_token text NULL UNIQUE;
ALTER TABLE public.documents ADD COLUMN share_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX idx_documents_folder ON public.documents(folder_id);

-- Public read of shared docs via security-definer function
CREATE OR REPLACE FUNCTION public.get_shared_document(_token text)
RETURNS TABLE (id uuid, title text, content text, word_count integer, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.title, d.content, d.word_count, d.updated_at
  FROM public.documents d
  WHERE d.share_token = _token AND d.share_enabled = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_document(text) TO anon, authenticated;
