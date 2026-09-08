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

## Notes

- PDF and image selection is supported by the upload interface. Image OCR and PDF text extraction are intentionally mocked for the MVP and route to the dependable demo data after processing.
- Pasted text is parsed client-side with date and event-type patterns. No syllabus content leaves the browser.
- The `.ics` export is generated entirely in the browser, including weekly RRULE recurrence for office hours.
- A future OCR or AI integration belongs behind `src/parser.ts`, with credentials and document handling kept server-side.
