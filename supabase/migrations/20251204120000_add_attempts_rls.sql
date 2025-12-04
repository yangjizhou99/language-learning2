-- Add RLS policies for shadowing_attempts
CREATE POLICY "Users can insert their own shadowing attempts"
ON public.shadowing_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own shadowing attempts"
ON public.shadowing_attempts
FOR SELECT
USING (auth.uid() = user_id);

-- Add RLS policies for cloze_attempts
CREATE POLICY "Users can insert their own cloze attempts"
ON public.cloze_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own cloze attempts"
ON public.cloze_attempts
FOR SELECT
USING (auth.uid() = user_id);
