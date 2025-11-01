-- Create session_summaries table
CREATE TABLE public.session_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  mindmap_image_url TEXT,
  key_insights TEXT[],
  main_ideas TEXT[],
  action_items TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;

-- Users can view summaries for sessions they created or participated in
CREATE POLICY "Users can view their session summaries"
ON public.session_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_summaries.session_id
    AND (sessions.created_by = auth.uid() OR is_session_participant(auth.uid(), sessions.id))
  )
);

-- Session creators can delete summaries
CREATE POLICY "Session creators can delete summaries"
ON public.session_summaries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_summaries.session_id
    AND sessions.created_by = auth.uid()
  )
);

-- Add index for performance
CREATE INDEX idx_session_summaries_session_id ON public.session_summaries(session_id);