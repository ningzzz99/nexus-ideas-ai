-- Create mind map nodes table
CREATE TABLE public.mind_map_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  x_position FLOAT NOT NULL DEFAULT 0,
  y_position FLOAT NOT NULL DEFAULT 0,
  agent_type TEXT,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mind map edges table
CREATE TABLE public.mind_map_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.mind_map_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.mind_map_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mind_map_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mind_map_edges ENABLE ROW LEVEL SECURITY;

-- RLS policies for nodes
CREATE POLICY "Users can view nodes in their sessions"
ON public.mind_map_nodes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = mind_map_nodes.session_id
    AND (sessions.created_by = auth.uid() OR public.is_session_participant(auth.uid(), sessions.id))
  )
);

CREATE POLICY "Users can create nodes in their sessions"
ON public.mind_map_nodes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = mind_map_nodes.session_id
    AND (sessions.created_by = auth.uid() OR public.is_session_participant(auth.uid(), sessions.id))
  )
);

CREATE POLICY "Users can update nodes in their sessions"
ON public.mind_map_nodes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = mind_map_nodes.session_id
    AND (sessions.created_by = auth.uid() OR public.is_session_participant(auth.uid(), sessions.id))
  )
);

-- RLS policies for edges
CREATE POLICY "Users can view edges in their sessions"
ON public.mind_map_edges
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = mind_map_edges.session_id
    AND (sessions.created_by = auth.uid() OR public.is_session_participant(auth.uid(), sessions.id))
  )
);

CREATE POLICY "Users can create edges in their sessions"
ON public.mind_map_edges
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = mind_map_edges.session_id
    AND (sessions.created_by = auth.uid() OR public.is_session_participant(auth.uid(), sessions.id))
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mind_map_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mind_map_edges;