# Interactive Teaching Platform

A small, static web app for topic-based college quizzes. The frontend is plain HTML, CSS, and JavaScript; Supabase provides authentication, PostgreSQL, row-level security, and server-side quiz scoring. There is no build step.

## What is included

- Tutor sign-up/sign-in and an owner-scoped course dashboard.
- Course and lecture-topic creation and editing.
- Multiple-choice quiz editing, question ordering, and live/off controls.
- Public student topic links, a QR code, mobile quiz submission, and result review.
- Anonymous topic feedback and tutor-side quiz/feedback summaries.
- Course-page feedback feed with topic, rating, comment-presence, and text-search filters; tutors can delete feedback belonging to their own courses.
- Supabase RLS policies and RPCs that keep answer keys out of public reads and reject new submissions after a quiz is disabled.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com/) and wait for its database to finish provisioning.
2. In the Supabase Dashboard, open **SQL Editor**, create a query, paste in [`supabase/schema.sql`](supabase/schema.sql), and run it. The migration creates the tables, indexes, auth profile trigger, RLS policies, and the two RPC functions used by students.
3. In **Project Settings → API**, copy the Project URL and the **publishable key** (or legacy `anon` key). Never use the `service_role` key in this app.
4. Paste those values into [`js/supabase.js`](js/supabase.js):

   ```js
   window.ITP_CONFIG = {
     supabaseUrl: "https://YOUR_PROJECT.supabase.co",
     supabaseAnonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY"
   };
   ```

5. In **Authentication → URL Configuration**, add the local and deployed origins to **Redirect URLs**, for example `http://localhost:3000/**`, `http://127.0.0.1:3000/**`, and `https://your-site.example/**`. The signup form requests a confirmation redirect to the current origin. Set the **Site URL** to `http://localhost:3000` while testing locally; change it to the deployed site URL after deployment. Keep the local origin in Redirect URLs for local testing.
6. For a quick tutor test, register through the app and check the inbox's spam/junk folder. Deployment is not required for email confirmation. Supabase's built-in email sender has delivery and rate limits; for production or reliable delivery, configure custom SMTP under **Authentication → SMTP Settings**. If no message arrives, check **Authentication → Logs** and confirm email signup is enabled in the project's Auth provider settings.
7. If this Supabase project was initialized before the course feedback feed was added, run [`supabase/feedback_delete_policy.sql`](supabase/feedback_delete_policy.sql) in the SQL Editor to allow tutors to delete feedback for their own courses. New setups already receive this policy from `schema.sql`.

The client key is intentionally public. RLS is the authorization boundary; the answer key is only returned by `submit_quiz` after grading and is never included in `get_active_quiz`.

## Run locally

Serve this directory over HTTP (opening `index.html` directly with `file://` is not supported because browser module/network security differs):

```powershell
npx serve .
```

Open the local URL printed by the command. Node.js is needed only if you use `npx serve`; it is not an app build dependency. Alternatively, use the Live Server extension in VS Code.

## Deploy

This is a static site. Import the GitHub repository into Vercel or Netlify and use the repository root as the publish directory. No build command is required. Add the deployed origin to Supabase Auth's Redirect URLs. The Supabase URL and publishable/anon key in `js/supabase.js` are designed to be browser-visible; do not add a service-role key or database password there.

Suggested GitHub workflow:

```powershell
git init
git add index.html css js supabase README.md
git commit -m "Build interactive teaching platform MVP"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

## Student links and behavior

Each topic's QR code opens `/?student=TOPIC_UUID` on the current site. The topic and course summary are public, but students can only fetch quiz content while its quiz is live. The scoring RPC rechecks the live flag under a database lock when accepting a new attempt. A browser-generated participant token plus a unique database constraint prevents repeat attempts from that browser for the same quiz; it is a practical MVP guard, not identity verification.

Feedback is anonymous. The tutor's response page shows aggregate ratings and per-question correctness. Student answer keys are withheld from normal table reads by RLS; only the scoring RPC returns explanations and correct choices after submission.

## Scope and operations

This MVP intentionally has no student accounts, roster, or identity-based anti-cheat. Anyone with a topic link can attempt a live quiz, and public courses/topics are readable to support QR access. Feedback submissions are anonymous. Add rate limiting or a trusted server if the deployment needs abuse protection or stronger identity controls.

Back up the Supabase database using the project's normal Supabase backup settings. To change the schema later, create a new migration rather than re-running edited table definitions over live data.