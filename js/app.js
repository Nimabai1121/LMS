const app = document.querySelector("#app");
const topbarActions = document.querySelector("#topbar-actions");
const dialog = document.querySelector("#app-dialog");
const toastRegion = document.querySelector("#toast-region");

const state = {
  client: window.itpClient,
  session: null,
  authMode: "login",
  student: null,
  studentQuiz: null,
  result: null,
  courseFeedback: []
};

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
}[character]));

function toast(message, isError = false) {
  const item = document.createElement("div");
  item.className = `toast${isError ? " error" : ""}`;
  item.textContent = message;
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), 4200);
}

function fail(error) {
  console.error(error);
  toast(error.message || "Something went wrong. Please try again.", true);
}

function routeParts() {
  return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

function oneRelation(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function renderCourseFeedback() {
  const results = document.querySelector("#feedback-feed-results");
  if (!results) return;
  const search = document.querySelector("#feedback-search").value.trim().toLowerCase();
  const topicId = document.querySelector("#feedback-topic-filter").value;
  const rating = document.querySelector("#feedback-rating-filter").value;
  const commentFilter = document.querySelector("#feedback-comment-filter").value;
  const visible = state.courseFeedback.filter(item => {
    const topic = oneRelation(item.topics);
    if (topicId && item.topic_id !== topicId) return false;
    if (rating !== "all") {
      const [field, value] = rating.split(":");
      if (Number(item[field]) !== Number(value)) return false;
    }
    if (commentFilter === "with-comment" && !item.comment?.trim()) return false;
    if (commentFilter === "without-comment" && item.comment?.trim()) return false;
    return !search || item.comment?.toLowerCase().includes(search);
  });
  if (!visible.length) {
    results.innerHTML = `<p class="feedback-empty">${state.courseFeedback.length ? "No feedback matches these filters." : "No feedback has been submitted for this course yet."}</p>`;
    return;
  }
  const paceLabels = ["", "Too slow", "Good", "Too fast"];
  const difficultyLabels = ["", "Easy", "Moderate", "Difficult"];
  results.innerHTML = `<p class="feedback-result-count">Showing ${visible.length} of ${state.courseFeedback.length} responses</p><div class="feedback-list">${visible.map(item => {
    const topic = oneRelation(item.topics);
    const date = new Date(item.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    return `<article class="feedback-entry"><div class="feedback-entry-heading"><div><strong>${escapeHtml(topic?.title || "Topic")}</strong><time datetime="${escapeHtml(item.created_at)}">${escapeHtml(date)}</time></div><button class="button danger small" type="button" data-action="delete-feedback" data-id="${item.id}" aria-label="Delete feedback from ${escapeHtml(topic?.title || "topic")}">Delete</button></div><div class="feedback-ratings"><span>Clarity <strong>${item.clarity}/5</strong></span><span>Pace <strong>${escapeHtml(paceLabels[item.pace])}</strong></span><span>Difficulty <strong>${escapeHtml(difficultyLabels[item.difficulty])}</strong></span></div><p class="feedback-comment">${item.comment?.trim() ? escapeHtml(item.comment) : `<span class="muted">No written comment</span>`}</p></article>`;
  }).join("")}</div>`;
}

function handleFeedbackFilter(event) {
  if (event.target.matches("[data-feedback-filter]")) renderCourseFeedback();
}

function setTopbar() {
  if (new URLSearchParams(location.search).has("student")) {
    topbarActions.innerHTML = "";
    return;
  }
  if (state.session) {
    const name = state.session.user.user_metadata?.full_name || state.session.user.email;
    topbarActions.innerHTML = `<span class="muted" style="font-size:12px">${escapeHtml(name)}</span><button class="button secondary small" data-action="sign-out">Sign out</button>`;
  } else {
    topbarActions.innerHTML = `<a class="button secondary small" href="#/login">Tutor sign in</a>`;
  }
}

function setupNotice() {
  topbarActions.innerHTML = "";
  app.innerHTML = `<section class="setup-banner">
    <p class="eyebrow">One quick setup step</p>
    <h1>Connect your Supabase project</h1>
    <p>The app is ready to run, but it needs your project URL and publishable key. Create a Supabase project, run <code>supabase/schema.sql</code> in its SQL Editor, then add the two client-safe values to <code>js/supabase.js</code>.</p>
    <p>Use the project's publishable/anon key only. Never put a service-role key in browser code.</p>
    <a class="button secondary" href="README.md">Read setup instructions</a>
  </section>`;
}

function authView() {
  const signingUp = state.authMode === "signup";
  app.innerHTML = `<section class="form-card card">
    <p class="eyebrow">For college teaching teams</p>
    <h1>${signingUp ? "Create your tutor account" : "Welcome back"}</h1>
    <p class="subhead">${signingUp ? "Set up a space for your courses and in-class quizzes." : "Sign in to manage your courses and see how students are doing."}</p>
    <form class="form-stack" data-form="auth" style="margin-top:22px">
      ${signingUp ? `<div class="field"><label for="full-name">Your name</label><input id="full-name" name="full_name" autocomplete="name" required></div>` : ""}
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" minlength="8" autocomplete="${signingUp ? "new-password" : "current-password"}" required></div>
      <button class="button" type="submit">${signingUp ? "Create account" : "Sign in"}</button>
    </form>
    <div class="form-footer"><span>${signingUp ? "Already have an account?" : "New to Fieldnotes?"}</span><button class="inline-link" data-action="auth-mode" data-mode="${signingUp ? "login" : "signup"}">${signingUp ? "Sign in" : "Create a tutor account"}</button></div>
  </section>`;
}

function courseForm(course = {}) {
  return `<form class="form-stack" data-form="${course.id ? "edit-course" : "create-course"}" ${course.id ? `data-id="${course.id}"` : ""}>
    <div class="field"><label for="course-code">Course code</label><input id="course-code" name="code" maxlength="24" placeholder="ISM201" value="${escapeHtml(course.code || "")}" required></div>
    <div class="field"><label for="course-name">Course name</label><input id="course-name" name="name" maxlength="120" placeholder="Instrumentation Systems" value="${escapeHtml(course.name || "")}" required></div>
    <div class="field"><label for="course-description">Description <span class="muted">(optional)</span></label><textarea id="course-description" name="description" maxlength="500" placeholder="A short description for students">${escapeHtml(course.description || "")}</textarea></div>
    <button class="button" type="submit">${course.id ? "Save course details" : "Create course"}</button>
  </form>`;
}

async function dashboardView() {
  app.innerHTML = `<div class="loading">Loading your courses...</div>`;
  const { data, error } = await state.client.from("courses")
    .select("id, code, name, description, topics(id, quizzes(id, is_active))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const courses = data || [];
  const { data: recentAttempts, error: attemptsError } = await state.client.from("quiz_attempts")
    .select("id, score, total, percentage, created_at, quizzes(title, topics(title, courses(code)))")
    .order("created_at", { ascending: false }).limit(5);
  if (attemptsError) throw attemptsError;
  const topicCount = courses.reduce((total, course) => total + (course.topics?.length || 0), 0);
  const activeCount = courses.reduce((total, course) => total + (course.topics || []).filter(topic => oneRelation(topic.quizzes)?.is_active).length, 0);
  app.innerHTML = `<div class="page-heading"><div class="page-heading-copy"><p class="eyebrow">Tutor workspace</p><h1>Your teaching, in one place</h1><p class="subhead">Build a course, add a topic, and check what the room understood.</p></div><button class="button" data-action="new-course">＋ New course</button></div>
    <div class="stats-row"><div class="stat card"><span class="stat-value">${courses.length}</span><span class="stat-label">Courses</span></div><div class="stat card"><span class="stat-value">${topicCount}</span><span class="stat-label">Topics</span></div><div class="stat card"><span class="stat-value">${activeCount}</span><span class="stat-label">Live quizzes</span></div></div>
    <div class="section-heading"><h2>My courses</h2><span class="muted" style="font-size:12px">${courses.length} total</span></div>
    ${courses.length ? `<div class="course-grid">${courses.map(course => `<article class="course-card card"><span class="course-code">${escapeHtml(course.code)}</span><h3>${escapeHtml(course.name)}</h3><p>${course.topics?.length || 0} ${(course.topics?.length || 0) === 1 ? "topic" : "topics"}${course.description ? ` · ${escapeHtml(course.description)}` : ""}</p><a class="button secondary small" href="#/course/${course.id}">Manage course <span aria-hidden="true">→</span></a></article>`).join("")}</div>` : `<section class="empty-state card"><div class="empty-icon" aria-hidden="true">＋</div><h3>Your first course starts here</h3><p>Create a course to organize its lectures and share topic quizzes with students.</p><button class="button" data-action="new-course">Create a course</button></section>`}
    <div class="section-heading"><h2>Recent student responses</h2></div>
    <section class="panel card">${recentAttempts?.length ? `<div class="recent-list">${recentAttempts.map(attempt => `<div class="recent-row"><span><strong>${escapeHtml(attempt.quizzes.topics.courses.code)} · ${escapeHtml(attempt.quizzes.topics.title)}</strong><br><span class="muted">${new Date(attempt.created_at).toLocaleString()}</span></span><strong>${attempt.score} / ${attempt.total} · ${Math.round(attempt.percentage)}%</strong></div>`).join("")}</div>` : `<p class="muted" style="margin:0;font-size:13px">Student attempts will appear here after a live quiz is submitted.</p>`}</section>`;
}

async function courseView(courseId) {
  app.innerHTML = `<div class="loading">Loading course...</div>`;
  const { data: course, error } = await state.client.from("courses")
    .select("id, code, name, description, topics(id, title, lecture_number, description, quizzes(id, is_active, questions(id)))")
    .eq("id", courseId).single();
  if (error) throw error;
  const topics = (course.topics || []).sort((a, b) => a.lecture_number - b.lecture_number);
  const { data: feedback, error: feedbackError } = await state.client.from("feedback")
    .select("id, topic_id, clarity, pace, difficulty, comment, created_at, topics!inner(id, title, course_id)")
    .eq("topics.course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (feedbackError) throw feedbackError;
  state.courseFeedback = feedback || [];
  app.innerHTML = `<a class="back-link" href="#/dashboard">← All courses</a>
    <div class="page-heading"><div class="page-heading-copy"><p class="eyebrow">${escapeHtml(course.code)}</p><h1>${escapeHtml(course.name)}</h1><p class="subhead">${escapeHtml(course.description || "Manage lectures, quizzes, and student understanding.")}</p></div><button class="button secondary" data-action="edit-course" data-id="${course.id}">Edit course</button></div>
    <div class="section-heading"><h2>Topics & lectures</h2><span class="muted" style="font-size:12px">${topics.length} total</span></div>
    ${topics.length ? `<div class="topic-list">${topics.map(topic => {
      const quiz = oneRelation(topic.quizzes);
      return `<article class="topic-row card"><span class="topic-number">${topic.lecture_number}</span><div class="topic-copy"><h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.description || "No description")}</p></div><span class="status ${quiz?.is_active ? "live" : "off"}">${quiz?.is_active ? "Quiz live" : "Quiz off"}</span><div class="topic-actions"><a class="button secondary small" href="#/topic/${topic.id}">Manage topic</a></div></article>`;
    }).join("")}</div>` : `<div class="empty-state card"><h3>No topics yet</h3><p>Add your first lecture topic below.</p></div>`}
    <div class="section-heading"><h2>Student feedback</h2><span class="muted feedback-count" style="font-size:12px">${state.courseFeedback.length} responses</span></div>
    <section class="course-feedback card" aria-label="Student feedback feed">
      <div class="feedback-filters">
        <div class="field"><label for="feedback-search">Search comments</label><input id="feedback-search" data-feedback-filter type="search" placeholder="Search written feedback"></div>
        <div class="field"><label for="feedback-topic-filter">Topic</label><select id="feedback-topic-filter" data-feedback-filter><option value="">All topics</option>${topics.map(topic => `<option value="${topic.id}">${escapeHtml(topic.title)}</option>`).join("")}</select></div>
        <div class="field"><label for="feedback-rating-filter">Rating</label><select id="feedback-rating-filter" data-feedback-filter><option value="all">Any rating</option>${[1, 2, 3, 4, 5].map(value => `<option value="clarity:${value}">Clarity: ${value}/5</option>`).join("")}${[[1, "Too slow"], [2, "Good"], [3, "Too fast"]].map(([value, label]) => `<option value="pace:${value}">Pace: ${label}</option>`).join("")}${[[1, "Easy"], [2, "Moderate"], [3, "Difficult"]].map(([value, label]) => `<option value="difficulty:${value}">Difficulty: ${label}</option>`).join("")}</select></div>
        <div class="field"><label for="feedback-comment-filter">Written response</label><select id="feedback-comment-filter" data-feedback-filter><option value="all">All responses</option><option value="with-comment">Has comment</option><option value="without-comment">No comment</option></select></div>
      </div>
      <div id="feedback-feed-results" aria-live="polite"></div>
    </section>
    <div class="section-heading"><h2>Add a topic</h2></div>
    <section class="panel card"><form class="form-stack" data-form="create-topic" data-course-id="${course.id}" style="grid-template-columns:1fr 1fr;align-items:end">
      <div class="field"><label for="topic-title">Topic title</label><input id="topic-title" name="title" maxlength="140" placeholder="Measurement Errors" required></div>
      <div class="field"><label for="lecture-number">Lecture number</label><input id="lecture-number" name="lecture_number" type="number" min="1" max="999" value="${topics.length + 1}" required></div>
      <div class="field" style="grid-column:1 / -1"><label for="topic-description">Short description</label><textarea id="topic-description" name="description" maxlength="500" placeholder="What will students learn in this lecture?"></textarea></div>
      <button class="button" type="submit" style="grid-column:1 / -1;justify-self:start">Add topic</button>
    </form></section>`;
  renderCourseFeedback();
}

function builderQuestion(question = {}, index = 0) {
  const options = question.options || ["", "", "", ""];
  const correctIndex = question.correct_index ?? 0;
  return `<article class="question-card builder-question card" data-question-id="${question.id || ""}">
    <div class="question-top"><div style="flex:1" class="field"><label>Question ${index + 1}</label><textarea class="builder-prompt" maxlength="1000" required placeholder="Write a clear question">${escapeHtml(question.prompt || "")}</textarea></div><button class="button text-button" type="button" data-action="delete-question" aria-label="Delete question">Remove</button></div>
    <div class="question-options">${[0, 1, 2, 3].map(option => `<div class="field"><label>Option ${String.fromCharCode(65 + option)}</label><input class="builder-option" maxlength="300" value="${escapeHtml(options[option] || "")}" required></div>`).join("")}</div>
    <div class="field"><label>Correct option</label><select class="builder-correct">${[0, 1, 2, 3].map(option => `<option value="${option}" ${correctIndex === option ? "selected" : ""}>${String.fromCharCode(65 + option)}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:10px"><label>Explanation <span class="muted">(optional)</span></label><textarea class="builder-explanation" maxlength="800" placeholder="Explain why this is correct">${escapeHtml(question.explanation || "")}</textarea></div>
    <div class="button-row" style="justify-content:flex-end;margin-top:9px"><button class="button text-button" type="button" data-action="move-question" data-direction="up">Move up ↑</button><button class="button text-button" type="button" data-action="move-question" data-direction="down">Move down ↓</button></div>
  </article>`;
}

async function topicView(topicId) {
  app.innerHTML = `<div class="loading">Loading topic...</div>`;
  const { data: topic, error } = await state.client.from("topics")
    .select("id, title, lecture_number, description, course_id, courses(id, code, name), quizzes(id, title, is_active, questions(id, prompt, options, correct_index, explanation, sort_order))")
    .eq("id", topicId).single();
  if (error) throw error;
  const quiz = oneRelation(topic.quizzes);
  const questions = (quiz?.questions || []).sort((a, b) => a.sort_order - b.sort_order);
  app.innerHTML = `<a class="back-link" href="#/course/${topic.course_id}">← ${escapeHtml(topic.courses.code)} · ${escapeHtml(topic.courses.name)}</a>
    <div class="page-heading"><div class="page-heading-copy"><p class="eyebrow">Lecture ${topic.lecture_number}</p><h1>${escapeHtml(topic.title)}</h1><p class="subhead">${escapeHtml(topic.description || "Add a short description to set context for students.")}</p></div><span class="status ${quiz?.is_active ? "live" : "off"}">${quiz?.is_active ? "Quiz live" : "Quiz off"}</span></div>
    <section class="details-panel"><div class="panel card"><div class="panel-title"><h2>Quiz builder</h2>${quiz ? `<a class="button secondary small" href="#/responses/${quiz.id}">View responses</a>` : ""}</div>
      ${!quiz ? `<p class="muted" style="font-size:13px">Add a quiz to check understanding after this lecture.</p><button class="button" data-action="create-quiz" data-topic-id="${topic.id}">＋ Create quiz</button>` : `<form data-form="save-quiz" data-quiz-id="${quiz.id}" data-topic-id="${topic.id}">
        <div class="field" style="margin-bottom:16px"><label for="quiz-title">Quiz title</label><input id="quiz-title" name="title" maxlength="160" value="${escapeHtml(quiz.title)}" required></div>
        <div id="question-builder">${questions.map((question, index) => builderQuestion(question, index)).join("")}</div>
        <div class="button-row"><button class="button secondary" type="button" data-action="add-question">＋ Add question</button><button class="button" type="submit">Save quiz</button></div>
      </form>`}
    </div><aside class="panel card"><div class="panel-title"><h3>In your lecture</h3></div><p class="muted" style="font-size:13px;line-height:1.6">Students can open this topic link on their phone. Only an enabled quiz can be started.</p>
      ${quiz ? `<div class="button-row" style="display:grid"><button class="button ${quiz.is_active ? "danger" : ""}" data-action="toggle-quiz" data-quiz-id="${quiz.id}" data-active="${quiz.is_active}">${quiz.is_active ? "Disable quiz" : "Enable quiz"}</button><button class="button secondary" data-action="show-qr" data-topic-id="${topic.id}">▦ Generate QR</button></div><p class="muted" style="margin:12px 0 0;font-size:11px">${questions.length} ${questions.length === 1 ? "question" : "questions"}</p>` : ""}
      <hr style="border:0;border-top:1px solid var(--line);margin:20px 0"><form class="form-stack" data-form="edit-topic" data-id="${topic.id}" data-course-id="${topic.course_id}">
       <div class="field"><label for="edit-topic-title">Topic title</label><input id="edit-topic-title" name="title" value="${escapeHtml(topic.title)}" required></div>
       <div class="field"><label for="edit-topic-lecture">Lecture number</label><input id="edit-topic-lecture" name="lecture_number" type="number" min="1" value="${topic.lecture_number}" required></div>
       <div class="field"><label for="edit-topic-description">Description</label><textarea id="edit-topic-description" name="description">${escapeHtml(topic.description || "")}</textarea></div>
       <div class="button-row"><button class="button secondary small" type="submit">Save topic</button><button class="button text-button" type="button" data-action="delete-topic" data-id="${topic.id}" data-course-id="${topic.course_id}">Delete</button></div>
      </form></aside></section>`;
}

async function responsesView(quizId) {
  app.innerHTML = `<div class="loading">Loading responses...</div>`;
  const { data: quiz, error } = await state.client.from("quizzes")
    .select("id, title, topic_id, topics(id, title, course_id, courses(code)), questions(id, prompt, sort_order)")
    .eq("id", quizId).single();
  if (error) throw error;
  const { data: attempts, error: attemptError } = await state.client.from("quiz_attempts")
    .select("id, score, total, percentage, created_at, answers(question_id, is_correct)")
    .eq("quiz_id", quizId).order("created_at", { ascending: false });
  if (attemptError) throw attemptError;
  const rows = attempts || [];
  const percentages = rows.map(attempt => Number(attempt.percentage));
  const average = percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : 0;
  const highest = percentages.length ? Math.max(...percentages) : 0;
  const lowest = percentages.length ? Math.min(...percentages) : 0;
  const questions = (quiz.questions || []).sort((a, b) => a.sort_order - b.sort_order);
  const questionStats = questions.map((question, index) => {
    const correct = rows.reduce((total, attempt) => total + (attempt.answers || []).filter(answer => answer.question_id === question.id && answer.is_correct).length, 0);
    const rate = rows.length ? Math.round(correct / rows.length * 100) : 0;
    return `<div class="bar-row"><span>Q${index + 1} · ${escapeHtml(question.prompt)}</span><div class="bar-track"><div class="bar-fill" style="width:${rate}%"></div></div><strong>${correct}/${rows.length}</strong></div>`;
  }).join("");
  const feedbackResult = await state.client.from("feedback").select("clarity, pace, difficulty").eq("topic_id", quiz.topic_id);
  if (feedbackResult.error) throw feedbackResult.error;
  const feedback = feedbackResult.data || [];
  const mean = field => feedback.length ? (feedback.reduce((sum, item) => sum + Number(item[field]), 0) / feedback.length).toFixed(1) : "—";
  app.innerHTML = `<a class="back-link" href="#/topic/${quiz.topic_id}">← ${escapeHtml(quiz.topics.title)}</a>
    <div class="page-heading"><div class="page-heading-copy"><p class="eyebrow">${escapeHtml(quiz.topics.courses.code)} · ${escapeHtml(quiz.topics.title)}</p><h1>${escapeHtml(quiz.title)}</h1><p class="subhead">Quiz responses and lecture feedback.</p></div></div>
    <div class="analytics-grid"><div class="stat card"><span class="stat-value">${rows.length}</span><span class="stat-label">Attempts</span></div><div class="stat card"><span class="stat-value">${average}%</span><span class="stat-label">Average score</span></div><div class="stat card"><span class="stat-value">${highest}%</span><span class="stat-label">Highest score</span></div><div class="stat card"><span class="stat-value">${lowest}%</span><span class="stat-label">Lowest score</span></div></div>
    <section class="panel card" style="margin-bottom:14px"><div class="panel-title"><h2>Question analysis</h2><span class="muted" style="font-size:12px">Correct responses</span></div>${rows.length ? questionStats : `<p class="muted" style="font-size:13px">No students have attempted this quiz yet.</p>`}</section>
    <section class="panel card" style="margin-bottom:14px"><div class="panel-title"><h2>Lecture feedback</h2><span class="muted" style="font-size:12px">${feedback.length} responses</span></div><div class="analytics-grid" style="margin-bottom:0"><div class="stat"><span class="stat-value">${mean("clarity")}</span><span class="stat-label">Clarity / 5</span></div><div class="stat"><span class="stat-value">${mean("pace")}</span><span class="stat-label">Pace / 3</span></div><div class="stat"><span class="stat-value">${mean("difficulty")}</span><span class="stat-label">Difficulty / 3</span></div></div></section>
    <section class="panel card"><div class="panel-title"><h2>Recent attempts</h2></div>${rows.length ? `<div class="recent-list">${rows.slice(0, 20).map(attempt => `<div class="recent-row"><span>${new Date(attempt.created_at).toLocaleString()}</span><strong>${attempt.score} / ${attempt.total} · ${Math.round(attempt.percentage)}%</strong></div>`).join("")}</div>` : `<p class="muted" style="font-size:13px">Submissions will appear here after students finish the quiz.</p>`}</section>`;
}

async function studentView(topicId) {
  app.innerHTML = `<div class="loading">Opening this lecture...</div>`;
  state.student = null;
  state.studentQuiz = null;
  state.result = null;
  const { data: topic, error } = await state.client.from("topics")
    .select("id, title, lecture_number, description, courses(code, name)")
    .eq("id", topicId).single();
  if (error) throw error;
  const { data: quiz, error: quizError } = await state.client.rpc("get_active_quiz", { p_topic_id: topicId });
  if (quizError) throw quizError;
  state.student = topic;
  state.studentQuiz = quiz;
  const savedResult = quiz && localStorage.getItem(`itp-result-${quiz.id}`);
  state.result = savedResult ? JSON.parse(savedResult) : null;
  renderStudent();
}

function renderStudent() {
  const topic = state.student;
  if (!topic) return;
  const quiz = state.studentQuiz;
  const courseLine = `${escapeHtml(topic.courses.code)} · ${escapeHtml(topic.courses.name)}`;
  const hero = `<section class="student-hero"><p class="eyebrow">${courseLine}</p><p class="student-course">Lecture ${topic.lecture_number}</p><h1>${escapeHtml(topic.title)}</h1>${topic.description ? `<p class="muted" style="max-width:520px;font-size:14px">${escapeHtml(topic.description)}</p>` : ""}</section>`;
  if (!quiz) {
    app.innerHTML = `<div class="student-wrap">${hero}<section class="panel card" style="margin-top:16px"><span class="status off">Quiz unavailable</span><h2 style="margin-top:13px">No quiz is currently available.</h2><p class="muted" style="font-size:13px">Your tutor has not enabled a quiz for this lecture yet.</p></section></div>`;
    return;
  }
  if (state.result) {
    const result = state.result;
    app.innerHTML = `<div class="student-wrap">${hero}<section class="panel card" style="margin-top:16px"><p class="eyebrow">${escapeHtml(quiz.title)}</p><h2>Your result</h2><div class="result-score"><div class="score-ring">${Math.round(result.percentage)}%</div><div><strong style="font:800 23px Manrope">${result.score} / ${result.total}</strong><p class="muted" style="margin:4px 0 0;font-size:13px">${result.score === result.total ? "Excellent work." : "Thanks for giving it a try."}</p></div></div>
      ${result.breakdown.map((item, index) => `<div class="result-item"><strong>Question ${index + 1}</strong><p class="${item.is_correct ? "result-correct" : "result-incorrect"}">${item.is_correct ? "Correct" : `Not quite · Correct answer: ${escapeHtml(item.correct_option)}`}</p>${!item.is_correct && item.explanation ? `<p class="muted">${escapeHtml(item.explanation)}</p>` : ""}</div>`).join("")}</section>
      <section class="panel card feedback-form"><div class="panel-title"><h2>How was this lecture?</h2></div><p class="muted" style="font-size:12px">Anonymous feedback helps your tutor improve the next class.</p><form class="form-stack" data-form="feedback" data-topic-id="${topic.id}">
       <div class="field"><span class="field-label">How clear was today's lecture? (1 unclear, 5 very clear)</span><div class="rating-row">${[1, 2, 3, 4, 5].map(value => `<label><input type="radio" name="clarity" value="${value}" required><span>${value}</span></label>`).join("")}</div></div>
       <div class="field"><label for="pace">How was the pace?</label><select id="pace" name="pace" required><option value="">Choose one</option><option value="1">Too slow</option><option value="2">Good</option><option value="3">Too fast</option></select></div>
       <div class="field"><label for="difficulty">How difficult was this topic?</label><select id="difficulty" name="difficulty" required><option value="">Choose one</option><option value="1">Easy</option><option value="2">Moderate</option><option value="3">Difficult</option></select></div>
       <div class="field"><label for="comment">What should the tutor explain again? <span class="muted">(optional)</span></label><textarea id="comment" name="comment" maxlength="1000" placeholder="Your response is anonymous"></textarea></div><button class="button" type="submit">Send feedback</button>
      </form></section></div>`;
    return;
  }
  app.innerHTML = `<div class="student-wrap">${hero}<section class="panel card" style="margin-top:16px"><div class="panel-title"><div><p class="eyebrow">After the lecture</p><h2>${escapeHtml(quiz.title)}</h2></div><span class="status live">Quiz available</span></div><p class="muted" style="font-size:13px">${quiz.questions.length} ${quiz.questions.length === 1 ? "question" : "questions"} · Your result will appear when you submit.</p><button class="button" data-action="start-student-quiz">Start quiz <span aria-hidden="true">→</span></button></section></div>`;
}

function quizAttemptView() {
  const quiz = state.studentQuiz;
  const topic = state.student;
  app.innerHTML = `<div class="student-wrap"><a class="back-link" href="#" data-action="cancel-attempt">← ${escapeHtml(topic.title)}</a><section class="student-hero"><p class="eyebrow">${escapeHtml(topic.courses.code)} · Lecture ${topic.lecture_number}</p><h1>${escapeHtml(quiz.title)}</h1><p class="muted" style="margin:0;font-size:13px">${quiz.questions.length} questions</p></section><form class="quiz-form" data-form="student-quiz" data-quiz-id="${quiz.id}">${quiz.questions.map((question, questionIndex) => `<section class="quiz-question card"><h2>${questionIndex + 1}. ${escapeHtml(question.prompt)}</h2><div class="option-list">${question.options.map((option, index) => `<label class="answer-option"><input type="radio" name="q-${question.id}" value="${index}" required><span>${String.fromCharCode(65 + index)}. ${escapeHtml(option)}</span></label>`).join("")}</div></section>`).join("")}<button class="button" type="submit">Submit answers</button></form></div>`;
}

async function render() {
  setTopbar();
  if (!state.client) return setupNotice();
  const studentId = new URLSearchParams(location.search).get("student");
  if (studentId) {
    try { await studentView(studentId); } catch (error) { app.innerHTML = `<section class="empty-state"><h1>We couldn't open this topic</h1><p>${escapeHtml(error.message)}</p></section>`; }
    return;
  }
  if (!state.session) return authView();
  const [view, id] = routeParts();
  try {
    if (view === "course" && id) return await courseView(id);
    if (view === "topic" && id) return await topicView(id);
    if (view === "responses" && id) return await responsesView(id);
    await dashboardView();
  } catch (error) {
    fail(error);
    app.innerHTML = `<section class="empty-state"><h1>We couldn't load this page</h1><p class="muted">${escapeHtml(error.message)}</p><a class="button secondary" href="#/dashboard">Return to dashboard</a></section>`;
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (form.dataset.form === "auth") {
      if (state.authMode === "signup") {
        const { error } = await state.client.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { full_name: values.full_name },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        toast("Account created. Check your inbox and spam folder for a confirmation link.");
      } else {
        const { error } = await state.client.auth.signInWithPassword({ email: values.email, password: values.password });
        if (error) throw error;
      }
      return;
    }
    if (form.dataset.form === "create-course") {
      const { error } = await state.client.from("courses").insert({ ...values, tutor_id: state.session.user.id });
      if (error) throw error;
      toast("Course created.");
      location.hash = "#/dashboard";
      await render();
    } else if (form.dataset.form === "edit-course") {
      const { error } = await state.client.from("courses").update(values).eq("id", form.dataset.id);
      if (error) throw error;
      toast("Course details saved.");
      dialog.close();
      await render();
    } else if (form.dataset.form === "create-topic") {
      const { error } = await state.client.from("topics").insert({
        course_id: form.dataset.courseId,
        title: values.title,
        lecture_number: Number(values.lecture_number),
        description: values.description
      });
      if (error) throw error;
      toast("Topic added.");
      await render();
    } else if (form.dataset.form === "edit-topic") {
      const { error } = await state.client.from("topics").update({
        title: values.title,
        lecture_number: Number(values.lecture_number),
        description: values.description
      }).eq("id", form.dataset.id);
      if (error) throw error;
      toast("Topic updated.");
      await render();
    } else if (form.dataset.form === "save-quiz") {
      const cards = [...form.querySelectorAll(".builder-question")];
      if (!cards.length) throw new Error("Add at least one question before saving.");
      const records = cards.map((card, index) => ({
        id: card.dataset.questionId || crypto.randomUUID(),
        quiz_id: form.dataset.quizId,
        prompt: card.querySelector(".builder-prompt").value.trim(),
        options: [...card.querySelectorAll(".builder-option")].map(input => input.value.trim()),
        correct_index: Number(card.querySelector(".builder-correct").value),
        explanation: card.querySelector(".builder-explanation").value.trim(),
        sort_order: index + 1
      }));
      if (records.some(question => !question.prompt || question.options.some(option => !option))) throw new Error("Complete the question and all four options before saving.");
      const { error: quizError } = await state.client.from("quizzes").update({ title: values.title }).eq("id", form.dataset.quizId);
      if (quizError) throw quizError;
      const { error: questionError } = await state.client.from("questions").upsert(records, { onConflict: "id" });
      if (questionError) throw questionError;
      const savedIds = records.filter(question => question.id).map(question => question.id);
      const { data: existing, error: existingError } = await state.client.from("questions").select("id").eq("quiz_id", form.dataset.quizId);
      if (existingError) throw existingError;
      const removedIds = existing.map(question => question.id).filter(id => !savedIds.includes(id));
      if (removedIds.length) {
        const { error: deleteError } = await state.client.from("questions").delete().in("id", removedIds);
        if (deleteError) throw deleteError;
      }
      toast("Quiz saved.");
      await render();
    } else if (form.dataset.form === "student-quiz") {
      const quiz = state.studentQuiz;
      const tokenKey = `itp-participant-${quiz.id}`;
      let token = localStorage.getItem(tokenKey);
      if (!token) {
        token = crypto.randomUUID();
        localStorage.setItem(tokenKey, token);
      }
      const responses = quiz.questions.map(question => ({
        question_id: question.id,
        selected_index: Number(formData.get(`q-${question.id}`))
      }));
      const { data, error } = await state.client.rpc("submit_quiz", {
        p_quiz_id: quiz.id,
        p_participant_token: token,
        p_responses: responses
      });
      if (error) throw error;
      state.result = data;
      localStorage.setItem(`itp-result-${quiz.id}`, JSON.stringify(data));
      renderStudent();
    } else if (form.dataset.form === "feedback") {
      const { error } = await state.client.from("feedback").insert({
        topic_id: form.dataset.topicId,
        clarity: Number(values.clarity),
        pace: Number(values.pace),
        difficulty: Number(values.difficulty),
        comment: values.comment.trim() || null
      });
      if (error) throw error;
      form.innerHTML = `<p class="eyebrow">Feedback received</p><h3>Thanks for helping improve this lecture.</h3>`;
    }
  } catch (error) {
    fail(error);
    if (submitButton) submitButton.disabled = false;
  }
}

async function handleClick(event) {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  try {
    if (action === "auth-mode") {
      state.authMode = control.dataset.mode;
      return authView();
    }
    if (action === "sign-out") {
      const { error } = await state.client.auth.signOut();
      if (error) throw error;
      location.hash = "#/login";
    } else if (action === "new-course") {
      dialog.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">New course</p><h2>Create a course</h2></div><button class="button text-button" data-action="close-dialog" aria-label="Close">✕</button></div><div style="margin-top:18px">${courseForm()}</div>`;
      dialog.showModal();
    } else if (action === "edit-course") {
      const { data, error } = await state.client.from("courses").select("id, code, name, description").eq("id", control.dataset.id).single();
      if (error) throw error;
      dialog.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">Course settings</p><h2>Edit course</h2></div><button class="button text-button" data-action="close-dialog" aria-label="Close">✕</button></div><div style="margin-top:18px">${courseForm(data)}</div>`;
      dialog.showModal();
    } else if (action === "close-dialog") {
      dialog.close();
    } else if (action === "delete-feedback") {
      if (!confirm("Delete this anonymous feedback response? This cannot be undone.")) return;
      const { data, error } = await state.client.from("feedback").delete().eq("id", control.dataset.id).select("id").maybeSingle();
      if (error) {
        if (error.code === "42501") throw new Error("Feedback deletion is not enabled in Supabase yet. Run supabase/feedback_delete_policy.sql in the SQL Editor.");
        throw error;
      }
      if (!data) throw new Error("No feedback was deleted. Run supabase/feedback_delete_policy.sql in the SQL Editor, then try again.");
      state.courseFeedback = state.courseFeedback.filter(item => item.id !== control.dataset.id);
      const count = document.querySelector(".feedback-count");
      if (count) count.textContent = `${state.courseFeedback.length} responses`;
      renderCourseFeedback();
      toast("Feedback deleted.");
    } else if (action === "create-quiz") {
      const { data, error } = await state.client.from("quizzes").insert({ topic_id: control.dataset.topicId, title: "Topic quiz" }).select("id").single();
      if (error) throw error;
      location.hash = `#/topic/${control.dataset.topicId}`;
      await render();
      toast(`Quiz created. Add questions below.`);
      if (data.id) document.querySelector("#quiz-title")?.focus();
    } else if (action === "toggle-quiz") {
      const nextActive = control.dataset.active !== "true";
      const { error } = await state.client.from("quizzes").update({ is_active: nextActive }).eq("id", control.dataset.quizId);
      if (error) throw error;
      toast(nextActive ? "Quiz is now live." : "Quiz disabled. New attempts are blocked.");
      await render();
    } else if (action === "add-question") {
      const container = document.querySelector("#question-builder");
      container.insertAdjacentHTML("beforeend", builderQuestion({}, container.children.length));
      container.lastElementChild.querySelector("textarea").focus();
    } else if (action === "delete-question") {
      control.closest(".builder-question").remove();
      document.querySelectorAll(".builder-question .question-top label").forEach((label, index) => { label.textContent = `Question ${index + 1}`; });
    } else if (action === "move-question") {
      const card = control.closest(".builder-question");
      if (control.dataset.direction === "up" && card.previousElementSibling) card.parentElement.insertBefore(card, card.previousElementSibling);
      if (control.dataset.direction === "down" && card.nextElementSibling) card.parentElement.insertBefore(card.nextElementSibling, card);
      document.querySelectorAll(".builder-question .question-top label").forEach((label, index) => { label.textContent = `Question ${index + 1}`; });
    } else if (action === "delete-topic") {
      if (!confirm("Delete this topic and its quiz? This cannot be undone.")) return;
      const { error } = await state.client.from("topics").delete().eq("id", control.dataset.id);
      if (error) throw error;
      location.hash = `#/course/${control.dataset.courseId}`;
      await render();
    } else if (action === "show-qr") {
      const link = new URL(location.href);
      link.hash = "";
      link.search = new URLSearchParams({ student: control.dataset.topicId }).toString();
      const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(link.hostname);
      const localWarning = isLocalHost ? `<p class="local-link-warning">This link only opens on this computer. To test on a phone, open the tutor page using this computer's LAN IP address and the same port, then generate the QR again. Both devices must be on the same network.</p>` : "";
      dialog.innerHTML = `<div class="dialog-heading"><div><p class="eyebrow">Share with students</p><h2>Topic QR code</h2></div><button class="button text-button" data-action="close-dialog" aria-label="Close">✕</button></div>${localWarning}<div id="qr-box" class="qr-box"></div><label class="field"><span class="field-label">Student link</span><input readonly value="${escapeHtml(link.href)}"></label><div class="button-row" style="margin-top:14px"><button class="button secondary" data-action="copy-link" data-link="${escapeHtml(link.href)}">Copy link</button><button class="button" data-action="print-qr">Print QR</button></div>`;
      dialog.showModal();
      if (window.QRCode) new QRCode(document.querySelector("#qr-box"), { text: link.href, width: 200, height: 200, colorDark: "#172a28", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
      else document.querySelector("#qr-box").textContent = "QR library did not load. Copy the topic link instead.";
    } else if (action === "copy-link") {
      await navigator.clipboard.writeText(control.dataset.link);
      toast("Student link copied.");
    } else if (action === "print-qr") {
      const image = document.querySelector("#qr-box canvas")?.toDataURL("image/png") || document.querySelector("#qr-box img")?.src;
      if (!image) throw new Error("QR code is not ready yet.");
      const printWindow = window.open("", "_blank", "width=520,height=620");
      printWindow.document.write(`<title>Topic QR code</title><body style="font:16px sans-serif;text-align:center;padding:40px"><h1>Scan to open the lecture quiz</h1><img src="${image}" style="width:280px;height:280px"><p>${escapeHtml(state.student?.title || "")}</p><script>window.onload=()=>window.print()<\/script></body>`);
      printWindow.document.close();
    } else if (action === "start-student-quiz") {
      const { data, error } = await state.client.rpc("get_active_quiz", { p_topic_id: state.student.id });
      if (error) throw error;
      if (!data) {
        state.studentQuiz = null;
        renderStudent();
        toast("This quiz is no longer available.", true);
        return;
      }
      state.studentQuiz = data;
      quizAttemptView();
    } else if (action === "cancel-attempt") {
      event.preventDefault();
      renderStudent();
    }
  } catch (error) { fail(error); }
}

app.addEventListener("submit", handleSubmit);
app.addEventListener("click", handleClick);
app.addEventListener("input", handleFeedbackFilter);
app.addEventListener("change", handleFeedbackFilter);
dialog.addEventListener("submit", handleSubmit);
dialog.addEventListener("click", handleClick);
window.addEventListener("hashchange", () => { state.student = null; state.studentQuiz = null; state.result = null; render(); });

if (state.client) {
  state.client.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    render();
  });
  state.client.auth.getSession().then(({ data }) => {
    state.session = data.session;
    render();
  });
} else {
  render();
}