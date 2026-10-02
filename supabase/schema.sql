-- Run once in the Supabase SQL Editor. All client requests still pass through RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 24),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  lecture_number integer not null check (lecture_number between 1 and 999),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  unique (course_id, lecture_number)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null unique references public.topics (id) on delete cascade,
  title text not null default 'Topic quiz' check (char_length(title) between 1 and 160),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 1000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text not null default '' check (char_length(explanation) <= 800),
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  participant_token uuid not null,
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  percentage numeric(5, 2) not null check (percentage between 0 and 100),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (quiz_id, participant_token)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct boolean not null,
  unique (attempt_id, question_id)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  clarity smallint not null check (clarity between 1 and 5),
  pace smallint not null check (pace between 1 and 3),
  difficulty smallint not null check (difficulty between 1 and 3),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists topics_course_idx on public.topics (course_id, lecture_number);
create index if not exists quizzes_active_idx on public.quizzes (topic_id) where is_active;
create index if not exists questions_quiz_order_idx on public.questions (quiz_id, sort_order);
create index if not exists attempts_quiz_created_idx on public.quiz_attempts (quiz_id, created_at desc);
create index if not exists answers_question_idx on public.answers (question_id);
create index if not exists feedback_topic_created_idx on public.feedback (topic_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.topics enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.answers enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "profile owner reads profile" on public.profiles;
create policy "profile owner reads profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profile owner updates profile" on public.profiles;
create policy "profile owner updates profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "courses are publicly readable" on public.courses;
create policy "courses are publicly readable" on public.courses
  for select to anon, authenticated using (true);
drop policy if exists "tutors create owned courses" on public.courses;
create policy "tutors create owned courses" on public.courses
  for insert to authenticated with check (tutor_id = (select auth.uid()));
drop policy if exists "tutors update owned courses" on public.courses;
create policy "tutors update owned courses" on public.courses
  for update to authenticated using (tutor_id = (select auth.uid())) with check (tutor_id = (select auth.uid()));
drop policy if exists "tutors delete owned courses" on public.courses;
create policy "tutors delete owned courses" on public.courses
  for delete to authenticated using (tutor_id = (select auth.uid()));

drop policy if exists "topics are publicly readable" on public.topics;
create policy "topics are publicly readable" on public.topics
  for select to anon, authenticated using (true);
drop policy if exists "tutors manage topics in owned courses" on public.topics;
create policy "tutors manage topics in owned courses" on public.topics
  for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.tutor_id = (select auth.uid())))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.tutor_id = (select auth.uid())));

drop policy if exists "quiz metadata is publicly readable" on public.quizzes;
create policy "quiz metadata is publicly readable" on public.quizzes
  for select to anon, authenticated using (true);
drop policy if exists "tutors manage quizzes in owned courses" on public.quizzes;
create policy "tutors manage quizzes in owned courses" on public.quizzes
  for all to authenticated
  using (exists (
    select 1 from public.topics t join public.courses c on c.id = t.course_id
    where t.id = topic_id and c.tutor_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.topics t join public.courses c on c.id = t.course_id
    where t.id = topic_id and c.tutor_id = (select auth.uid())
  ));

drop policy if exists "tutors read questions in owned courses" on public.questions;
create policy "tutors read questions in owned courses" on public.questions
  for select to authenticated using (exists (
    select 1 from public.quizzes q join public.topics t on t.id = q.topic_id join public.courses c on c.id = t.course_id
    where q.id = quiz_id and c.tutor_id = (select auth.uid())
  ));
drop policy if exists "tutors insert questions in owned courses" on public.questions;
create policy "tutors insert questions in owned courses" on public.questions
  for insert to authenticated with check (exists (
    select 1 from public.quizzes q join public.topics t on t.id = q.topic_id join public.courses c on c.id = t.course_id
    where q.id = quiz_id and c.tutor_id = (select auth.uid())
  ));
drop policy if exists "tutors update questions in owned courses" on public.questions;
create policy "tutors update questions in owned courses" on public.questions
  for update to authenticated
  using (exists (
    select 1 from public.quizzes q join public.topics t on t.id = q.topic_id join public.courses c on c.id = t.course_id
    where q.id = quiz_id and c.tutor_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.quizzes q join public.topics t on t.id = q.topic_id join public.courses c on c.id = t.course_id
    where q.id = quiz_id and c.tutor_id = (select auth.uid())
  ));
drop policy if exists "tutors delete questions in owned courses" on public.questions;
create policy "tutors delete questions in owned courses" on public.questions
  for delete to authenticated using (exists (
    select 1 from public.quizzes q join public.topics t on t.id = q.topic_id join public.courses c on c.id = t.course_id
    where q.id = quiz_id and c.tutor_id = (select auth.uid())
  ));

drop policy if exists "tutors read attempts in owned courses" on public.quiz_attempts;
create policy "tutors read attempts in owned courses" on public.quiz_attempts
  for select to authenticated using (exists (
    select 1 from public.quizzes q join public.topics t on t.id = q.topic_id join public.courses c on c.id = t.course_id
    where q.id = quiz_id and c.tutor_id = (select auth.uid())
  ));
drop policy if exists "tutors read answers in owned courses" on public.answers;
create policy "tutors read answers in owned courses" on public.answers
  for select to authenticated using (exists (
    select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
    join public.topics t on t.id = q.topic_id join public.courses c on c.id = t.course_id
    where a.id = attempt_id and c.tutor_id = (select auth.uid())
  ));

drop policy if exists "feedback can be submitted publicly" on public.feedback;
create policy "feedback can be submitted publicly" on public.feedback
  for insert to anon, authenticated with check (exists (select 1 from public.topics t where t.id = topic_id));
drop policy if exists "tutors read feedback in owned courses" on public.feedback;
create policy "tutors read feedback in owned courses" on public.feedback
  for select to authenticated using (exists (
    select 1 from public.topics t join public.courses c on c.id = t.course_id
    where t.id = topic_id and c.tutor_id = (select auth.uid())
  ));
drop policy if exists "tutors delete feedback in owned courses" on public.feedback;
create policy "tutors delete feedback in owned courses" on public.feedback
  for delete to authenticated using (exists (
    select 1 from public.topics t join public.courses c on c.id = t.course_id
    where t.id = topic_id and c.tutor_id = (select auth.uid())
  ));

grant select, update on public.profiles to authenticated;
grant select on public.courses, public.topics, public.quizzes to anon, authenticated;
grant insert, update, delete on public.courses, public.topics, public.quizzes to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select on public.quiz_attempts, public.answers to authenticated;
grant select on public.feedback to authenticated;
grant insert on public.feedback to anon, authenticated;
grant delete on public.feedback to authenticated;

create or replace function public.get_active_quiz(p_topic_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', q.id,
    'topic_id', q.topic_id,
    'title', q.title,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', questions.id,
        'prompt', questions.prompt,
        'options', questions.options
      ) order by questions.sort_order, questions.created_at)
      from public.questions
      where questions.quiz_id = q.id
    ), '[]'::jsonb)
  )
  from public.quizzes q
  where q.topic_id = p_topic_id and q.is_active = true
    and exists (select 1 from public.questions questions where questions.quiz_id = q.id);
$$;

create or replace function public.submit_quiz(
  p_quiz_id uuid,
  p_participant_token uuid,
  p_responses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quiz_row public.quizzes%rowtype;
  question_row public.questions%rowtype;
  response_row jsonb;
  attempt_id uuid;
  previous_result jsonb;
  answer_index integer;
  question_count integer;
  correct_count integer := 0;
  breakdown jsonb := '[]'::jsonb;
  saved_answers jsonb := '[]'::jsonb;
  result_payload jsonb;
begin
  if p_participant_token is null or jsonb_typeof(p_responses) <> 'array' then
    raise exception 'Invalid quiz submission.' using errcode = '22023';
  end if;

  select result into previous_result
  from public.quiz_attempts
  where quiz_id = p_quiz_id and participant_token = p_participant_token;
  if found then
    return previous_result;
  end if;

  select * into quiz_row from public.quizzes where id = p_quiz_id for share;
  if not found or not quiz_row.is_active then
    raise exception 'This quiz is no longer available.' using errcode = '22023';
  end if;

  select count(*) into question_count from public.questions where quiz_id = p_quiz_id;
  if question_count = 0 or jsonb_array_length(p_responses) <> question_count then
    raise exception 'Answer every question before submitting.' using errcode = '22023';
  end if;

  for question_row in
    select * from public.questions where quiz_id = p_quiz_id order by sort_order, created_at
  loop
    select item into response_row
    from jsonb_array_elements(p_responses) as elements(item)
    where item ->> 'question_id' = question_row.id::text;
    if response_row is null then
      raise exception 'A question response is missing.' using errcode = '22023';
    end if;
    answer_index := (response_row ->> 'selected_index')::integer;
    if answer_index < 0 or answer_index > 3 then
      raise exception 'An answer choice is invalid.' using errcode = '22023';
    end if;
    if answer_index = question_row.correct_index then
      correct_count := correct_count + 1;
    end if;
    breakdown := breakdown || jsonb_build_array(jsonb_build_object(
      'question_id', question_row.id,
      'prompt', question_row.prompt,
      'is_correct', answer_index = question_row.correct_index,
      'correct_option', question_row.options ->> question_row.correct_index,
      'explanation', question_row.explanation
    ));
    saved_answers := saved_answers || jsonb_build_array(jsonb_build_object(
      'question_id', question_row.id,
      'selected_index', answer_index,
      'is_correct', answer_index = question_row.correct_index
    ));
  end loop;

  if (select count(distinct item ->> 'question_id') from jsonb_array_elements(p_responses) as elements(item)) <> question_count then
    raise exception 'Each question must be answered once.' using errcode = '22023';
  end if;

  result_payload := jsonb_build_object(
    'score', correct_count,
    'total', question_count,
    'percentage', round(correct_count::numeric * 100 / question_count, 2),
    'breakdown', breakdown
  );

  begin
    insert into public.quiz_attempts (quiz_id, participant_token, score, total, percentage, result)
    values (p_quiz_id, p_participant_token, correct_count, question_count,
      round(correct_count::numeric * 100 / question_count, 2), result_payload)
    returning id into attempt_id;
  exception when unique_violation then
    select result into previous_result from public.quiz_attempts
    where quiz_id = p_quiz_id and participant_token = p_participant_token;
    return previous_result;
  end;

  insert into public.answers (attempt_id, question_id, selected_index, is_correct)
  select attempt_id,
    (item ->> 'question_id')::uuid,
    (item ->> 'selected_index')::smallint,
    (item ->> 'is_correct')::boolean
  from jsonb_array_elements(saved_answers) as elements(item);

  return result_payload;
end;
$$;

revoke all on function public.get_active_quiz(uuid) from public;
revoke all on function public.submit_quiz(uuid, uuid, jsonb) from public;
grant execute on function public.get_active_quiz(uuid) to anon, authenticated;
grant execute on function public.submit_quiz(uuid, uuid, jsonb) to anon, authenticated;