# SylliSync

SylliSync turns a course syllabus into an editable semester plan and exports selected events as an `.ics` calendar file.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Select **Try a demo syllabus** for the most reliable hackathon walkthrough, or paste syllabus text to exercise the local deterministic parser.

## Accounts and saved schedules

SylliSync supports optional Supabase email/password accounts. A signed-in student can save multiple course schedules, view every saved event in the Calendar tab, and export one combined `.ics` calendar.

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL Editor. It creates the course/event tables and row-level-security policies.
3. Copy `.env.example` to `.env.local` and provide the project URL plus anonymous key.
4. In Supabase Auth, enable Email authentication and configure the confirmation redirect URL for your local or deployed app.

Without those variables, the app still runs in local demo mode and clearly explains that account creation needs configuration.

## AI Extraction With Gemini

SylliSync uses the Gemini API as its preferred syllabus extractor. The Vercel `/api/extract` function sends locally extracted document text to Gemini and requests schema-constrained calendar JSON; the deterministic parser remains the fallback if the API is unavailable.

Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey), then add these **server-only** Vercel environment variables:

```text
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Do not prefix either variable with `VITE_`, and do not expose the key in browser code. `npm run dev` includes a development-only Gemini proxy that reads the same variables from `.env.local`; Vercel uses `api/extract.js` in production.

## Deploy to Vercel

Import this repository into Vercel and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Production (and Preview, if desired) environment variables. Redeploy after adding them. Then add your Vercel deployment URL to Supabase Authentication's Redirect URLs. The anonymous key is designed for browser use; row-level security in `supabase/schema.sql` ensures each authenticated user can only access their own courses and events.

## Notes

- PDFs are read client-side with PDF.js, DOCX files are read with Mammoth, and PNG/JPG/HEIC images use browser-side Tesseract OCR. Scanned PDFs without embedded text are reported as unreadable rather than replaced with demo data.
- Extracted text is parsed client-side with date and event-type patterns. No syllabus content leaves the browser.
- The `.ics` export is generated entirely in the browser, including weekly RRULE recurrence for office hours.
- A future OCR or AI integration belongs behind `src/parser.ts`, with credentials and document handling kept server-side.
