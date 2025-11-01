-- Create table for private messages between users and facilitator
CREATE TABLE IF NOT EXISTS public.private_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  from_facilitator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own private messages
CREATE POLICY "Users can view their own private messages"
ON public.private_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create private messages
CREATE POLICY "Users can create private messages"
ON public.private_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add strikethrough and color fields to mind_map_nodes
ALTER TABLE public.mind_map_nodes
ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS highlight_color TEXT;

-- Enable realtime for private messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;