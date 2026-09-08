# SylliSync

**SylliSync turns a course syllabus into an editable semester plan.** Upload a syllabus, review the deadlines Gemini finds, see every class in one calendar, and export selected events as a standard `.ics` file.

Built for a hackathon to solve a practical student problem: important dates are often buried across many pages of prose and schedule tables.

## Quick Use

1. Open the app and select **Upload syllabus**.
2. Upload a PDF, DOCX, PNG, JPG, JPEG, or HEIC syllabus, or paste its text.
3. SylliSync extracts the document text and sends it to Gemini to identify the course and dated events.
4. Review, edit, add, delete, or deselect events in the **Schedule** tab.
5. Open **Calendar** to view events from every saved class. Hover over an event for its full details.
6. Select **Export calendar** to download the chosen events as an `.ics` file for Google Calendar, Apple Calendar, Outlook, and other calendar applications.
7. Create an account to save multiple classes and create one combined semester calendar.

Use **Try a demo syllabus** for a quick walkthrough without uploading a document or creating an account.

## What It Does

- Extracts schedule information from common syllabus file formats.
- Uses a Gemini LLM to identify assignments, quizzes, exams, projects, readings, office hours, due dates, and course metadata.
- Gives every event a confidence level and lets students correct extracted information before export.
- Supports multiple saved courses per user with Supabase authentication and database storage.
- Provides a month-by-month in-app calendar with previous/next controls and event detail tooltips.
- Exports selected events as RFC 5545-compatible iCalendar (`.ics`) data, including weekly recurrence rules when present.
- Lets signed-in users edit class details, edit individual events, delete events, and delete whole classes.

## Why Gemini?

The first prototype used a deterministic keyword and date parser. It worked for simple pasted text but was not reliable for real syllabi, especially multi-column PDFs where table cells, dates, readings, labs, and assignment due dates are laid out separately.

For the hackathon, the extraction step was moved to **Google Gemini**. Gemini receives structured text from the uploaded document and returns schema-constrained JSON for a course plus calendar events. The client validates that response before it is displayed or saved. This approach is more resilient to the variety of layouts instructors use while retaining a fully editable student-facing review step.

## Technology

| Area            | Technology                  | Role                                                                                |
| --------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| Frontend        | React + TypeScript          | Interactive single-page application and typed event models.                         |
| Build tool      | Vite                        | Local development server and production client build.                               |
| UI              | CSS + Lucide React          | Responsive application styling and interface icons.                                 |
| AI extraction   | Google Gemini API           | Converts extracted syllabus text into structured course and event JSON.             |
| Authentication  | Supabase Auth               | Email/password account creation and sign-in.                                        |
| Database        | Supabase Postgres           | Persists users' courses and syllabus events.                                        |
| Authorization   | Supabase Row Level Security | Restricts each user to their own courses and events.                                |
| PDF text        | PDF.js (`pdfjs-dist`)       | Reads text-based PDFs client-side and reconstructs visual rows for schedule tables. |
| DOCX text       | Mammoth                     | Extracts raw text from Word documents client-side.                                  |
| Image OCR       | Tesseract.js                | Reads uploaded PNG, JPG, and JPEG syllabus images in the browser.                   |
| HEIC support    | heic2any                    | Converts HEIC images before OCR.                                                    |
| Calendar export | Custom iCalendar generator  | Produces downloadable `.ics` files in the browser.                                  |
| Hosting         | Vercel                      | Hosts the Vite application and the serverless Gemini route.                         |

## Architecture

```text
Upload or paste syllabus
        |
        v
Browser document extraction
  PDF.js / Mammoth / Tesseract / HEIC conversion
        |
        v
POST /api/extract
        |
        v
Vercel serverless function (or Vite development middleware)
        |
        v
Google Gemini API -> schema-constrained course + event JSON
        |
        v
Client-side validation and editable review UI
        |
        +--> Supabase Auth + Postgres (signed-in users)
        |
        +--> In-app calendar and .ics export
```

### Main Modules

- `src/main.tsx`: app screens, upload workflow, event review, calendar, account UI, and persistence coordination.
- `src/extractor.ts`: client-side extraction for PDF, DOCX, image, and HEIC uploads. PDF words are grouped into visual rows so schedule tables retain useful column boundaries.
- `src/gemini.ts`: calls `/api/extract` and validates Gemini output before it becomes application data.
- `api/extract.js`: Vercel serverless handler for extraction requests.
- `api/gemini.js`: server-only Gemini prompt, response schema, and REST API request.
- `src/supabase.ts`: Supabase data access for courses and events.
- `supabase/schema.sql`: Postgres tables, foreign keys, cascading deletes, and row-level security policies.
- `src/ics.ts`: browser-side `.ics` serialization.
- `vite.config.ts`: development-only `/api/extract` middleware, which lets Gemini work with `npm run dev` without exposing the key to the browser.

## Local Setup

### Prerequisites

- Node.js 18 or later
- A Google AI Studio Gemini API key
- A Supabase project for accounts and persistent schedules

### Install and Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

### Environment Variables

Add the following to `.env.local`:

```text
# Browser-safe Supabase project settings
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-only. Never prefix these with VITE_.
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

`VITE_SUPABASE_ANON_KEY` is the Supabase **anon public** key, not the service-role key. The Gemini key remains server-only: it is read by Vercel's API function in production and by Vite middleware during local development.

Restart `npm run dev` after changing `.env.local` or `vite.config.ts`.

## Supabase Setup

1. Create a project in [Supabase](https://supabase.com/).
2. In **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql).
3. In **Authentication > Providers**, enable Email authentication.
4. For hackathon testing without confirmation emails, disable **Confirm email** in Supabase Auth settings.
5. Put the project URL and anon public key in `.env.local`.

The schema creates two tables:

- `courses`: course metadata owned by a Supabase Auth user.
- `syllabus_events`: dated events linked to a course. Deleting a course cascades to its events.

Row-level security ensures authenticated users can only read and modify courses where `user_id` matches their authenticated ID, and events belonging to those courses.

## Gemini Setup

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Set `GEMINI_API_KEY` in `.env.local` locally and in Vercel's environment variables when deployed.
3. Use `gemini-3.5-flash-lite` unless a different available Gemini model is configured through `GEMINI_MODEL`.

The API route asks Gemini for JSON matching a fixed schema: one course object and an array of events with validated date, type, time, all-day status, confidence, description, and recurrence fields. Events are selected for export by default. Invalid or unavailable responses are shown as upload errors rather than silently replaced with fake or demo data.

> Privacy note: uploaded documents are processed in the browser to extract text. That extracted syllabus text is then sent to the server-side Gemini API route for AI parsing. Do not upload documents containing information you are not comfortable sending to the configured AI provider.

## Supported Uploads

| File type        | Processing path         | Notes                                                                         |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------- |
| PDF              | PDF.js                  | Requires embedded/selectable text. Scanned PDFs without text report an error. |
| DOCX             | Mammoth                 | Extracts raw Word document text.                                              |
| PNG / JPG / JPEG | Tesseract.js            | OCR runs in the browser; clearer images produce better results.               |
| HEIC             | heic2any + Tesseract.js | Converted to JPEG in the browser, then OCR'd.                                 |
| Pasted text      | Direct                  | Sent directly to Gemini.                                                      |

## Development Commands

```bash
npm run dev    # Start Vite with the local Gemini API middleware
npm run build  # Type-check and build the production application
npm run lint   # Run ESLint
```

## Deploying to Vercel

1. Push the repository to GitHub and import it into Vercel. The included `vercel.json` selects the Vite build, deploys `dist`, and configures the Gemini API function.
2. Add these Vercel environment variables for Production and Preview as needed:

   ```text
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   GEMINI_API_KEY
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

3. Deploy or redeploy after saving the variables. Vercel serves the React/Vite application and runs `api/extract.js` as a serverless endpoint.
4. In Supabase **Authentication > URL Configuration**, add the deployed Vercel URL to the allowed redirect URLs.

Never deploy `.env.local`, and never add `GEMINI_API_KEY` or a Supabase service-role key to variables beginning with `VITE_`.

## Current Limitations

- Extraction quality depends on document text quality and the model response; all generated events should be reviewed before export.
- Scanned PDFs without selectable text are not OCR'd yet. Upload page images or paste the text as a workaround.
- The calendar is a review surface, not a two-way sync with Google Calendar or Apple Calendar. Exported `.ics` files must be imported by the user.
- The app currently supports English OCR and English-focused extraction prompts.

## Hackathon Demo Flow

1. Start with **Try a demo syllabus** to introduce the review and calendar experience.
2. Upload a real text-based syllabus to demonstrate AI extraction.
3. Edit one extracted event to demonstrate student control over AI output.
4. Create an account and upload another course to show multi-course storage.
5. Open **Calendar**, hover an event to show its details, then export the combined schedule.
