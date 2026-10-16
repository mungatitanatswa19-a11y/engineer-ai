# Engineer AI — Your Engineering Study Partner

Next.js 15 + Supabase + Claude. AI tutor for Diesel Plant Fitting and related engineering courses, a public question paper library, and a private upload-and-solve workflow.

## 1. What needs configuring (nothing works until these are set)

| Item | Where to get it | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Accounts, library browsing, chat history |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. **Server only, never expose** | Uploads, downloads, moderation |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com | Chat, Solve, Study Tools |
| `ANTHROPIC_MODEL` (optional) | — | Defaults to `claude-sonnet-5-5` |
| `PAPER_MODERATION` (optional) | — | `on` = new public papers wait for admin approval |

## 2. Setup

```bash
cp .env.example .env.local      # fill in the values above
npm install
```

1. Create a Supabase project, open **SQL Editor**, paste and run `supabase/schema.sql` (tables, security policies, private storage bucket).
2. In Supabase → Authentication → URL Configuration, set Site URL to your site (e.g. `http://localhost:3000`) and add `http://localhost:3000/auth/callback` (and your production URL + `/auth/callback`) to Redirect URLs. For quick testing you can turn off "Confirm email".
3. `npm run dev` → http://localhost:3000
4. Sign up, then make yourself admin in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

Deploy on Vercel: import the repo, add the same environment variables, deploy. Routes that stream AI answers set `maxDuration` (300 s); Vercel Hobby caps functions lower, so use a plan that allows longer functions for big papers.

## 3. How it fits together

- **Chat** (`/`, `POST /api/chat`): streams answers from Claude using the DPF tutor system prompt. Modes: Standard, Explain like I'm 5, Detailed, Exam. Accepts photos/PDF/DOCX/TXT (4 MB in chat). Guests can chat (rate limited); signed-in users get saved history.
- **Library** (`/library`): anyone can search, filter, preview and download **published** papers, no login. Downloads go through `GET /api/papers/[id]/download`, which counts the download and returns a 60-second signed link; the storage bucket itself is private.
- **Upload** (`/upload`, `POST /api/papers/upload`): sign-in required. Two clear choices:
  - **A. Solve with Engineer AI** → stored **private**, then `/solve/[id]` streams a step-by-step solution that keeps question numbering and respects marks.
  - **B. Publish to library** → requires subject, course and an explicit consent checkbox. Nothing is ever published automatically.
- **Safety**: type + file-signature validation, 10 MB limit, PDFs with scripts/embedded files are rejected, per-user/IP rate limits, report button (5 reports auto-pull a paper into the review queue), admin dashboard to approve/remove/restore.
- **Study Tools** (`/tools`): notes, summaries, solver, flashcards, practice tests, assignment helper, diagram explainer, revision planner (sign-in required).
- **Pages**: Home/Chat, Library, Upload, Study Tools, Saved Papers (+ My uploads), Chat History, Profile, Admin, About, Contact.

## 3b. New in this version (ChatGPT-style interface)

- **Layout**: the home screen is a blank ChatGPT-style chat with the composer at the bottom; About, Try asking and Popular subjects live in the sidebar. Dark sidebar (New chat, Search chats, Tools, Recent chats, account menu), centred composer with a **+** menu (add photos/files, Create image, Flashcards, Practice quiz, Study notes, Summarise, Calculators, Solve a paper), answer-style picker, Stop and Regenerate buttons, collapsible sidebar, mobile drawer, dark mode.
- **Image Studio** (`/images`, `POST /api/image`): Claude draws labelled engineering diagrams (labelled, cutaway, exploded, schematic, blueprint) as SVG. The server sanitises every drawing with an allow-list (`src/lib/svg.ts`) before storing it in the private `images` table, and the browser sanitises again and shows it through `<img>`. Download as PNG or SVG. These are vector illustrations, not photographs. Guests get 3 images per 10 minutes; signed-in users get 12 and a private gallery.
- **Calculators** (`/calculators`): compression ratio, power/torque, gear ratio, hydraulic jack, limits and fits, vehicle speed, unit converter. They run in the browser; "Explain this with Engineer AI" opens a chat with the inputs.
- **Database**: **re-run `supabase/schema.sql`** after updating. It is safe to re-run and adds the `images` table with owner-only security.

## Putting it on your own domain (for example engineerai.com)

1. Buy the domain at a registrar (Namecheap, GoDaddy, Cloudflare, or a local registrar).
2. Push this folder to a GitHub repository and import it in Vercel. Add the environment variables from section 1 and deploy.
3. Vercel → Project → Settings → Domains → add your domain and copy the DNS records it shows into the registrar.
4. In Supabase → Authentication → URL Configuration, add `https://yourdomain/auth/callback` and set the Site URL to your domain.

## 4. Adding more courses later

Edit `COURSES` / `SUBJECTS` in `src/lib/types.ts` (filters and upload forms update automatically) and extend the subject list in `src/lib/prompts.ts`.

## 5. Known limitations / next steps

- The in-memory rate limiter is per server instance; use Upstash Redis or similar for multi-instance production.
- Uploaded files are validated by type/signature and PDF markers, but there is no antivirus scan. For a large public deployment, add a scanning service (e.g. ClamAV) before publishing.
- Flashcards and quizzes are rendered as formatted text, not interactive flip cards yet (the single-file Claude artifact version has interactive ones).
- Images made inside a chat show in that session only; Image Studio images are saved to your gallery.
- This version was written without being able to run `npm install` or `next build` in the build environment, so run `npm install && npm run build` first and fix any type errors it reports.
- Copyright is the uploader's responsibility; the report and moderation flow exists to remove unauthorized material quickly.
- AI answers can be wrong. The tutor is instructed to say when it is unsure, but students must verify specs against workshop manuals.
