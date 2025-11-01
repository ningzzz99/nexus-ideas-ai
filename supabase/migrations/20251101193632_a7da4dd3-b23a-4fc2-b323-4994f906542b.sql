-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON public.session_participants;

-- Create security definer function to check if user is session participant
CREATE OR REPLACE FUNCTION public.is_session_participant(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_participants
    WHERE user_id = _user_id
    AND session_id = _session_id
  )
$$;

-- Create security definer function to check if user is session creator
CREATE OR REPLACE FUNCTION public.is_session_creator(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions
    WHERE id = _session_id
    AND created_by = _user_id
  )
$$;

-- Recreate sessions policy using security definer function
CREATE POLICY "Users can view sessions they participate in"
  ON public.sessions FOR SELECT
  USING (
    auth.uid() = created_by OR
    public.is_session_participant(auth.uid(), id)
  );

-- Recreate session_participants policy using security definer function
CREATE POLICY "Users can view participants in their sessions"
  ON public.session_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_session_creator(auth.uid(), session_id)
  );