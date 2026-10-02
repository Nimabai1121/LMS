-- Run this once in Supabase SQL Editor for projects created before the course feedback feed was added.
drop policy if exists "tutors delete feedback in owned courses" on public.feedback;
create policy "tutors delete feedback in owned courses" on public.feedback
  for delete to authenticated using (exists (
    select 1 from public.topics t
    join public.courses c on c.id = t.course_id
    where t.id = topic_id and c.tutor_id = (select auth.uid())
  ));

grant delete on public.feedback to authenticated;
