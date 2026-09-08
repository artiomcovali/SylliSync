# Build Prompt: SylliSync

Build a polished, full-stack web app named **SylliSync** for a Cal Poly hackathon.

## Product

SylliSync turns a course syllabus (PDF, image, or pasted text) into an organized semester plan. A student uploads a syllabus, reviews the extracted events, edits anything that is incorrect, and exports the selected items to their calendar.

Elevator pitch: **Turn your syllabus into a synced semester plan in seconds.**

This project belongs to the **“10 Minutes Back”** track. The core problem is that students repeatedly spend 15–45 minutes manually hunting through each syllabus and creating calendar events for assignments, quizzes, exams, office hours, and deadlines.

## Primary user flow

1. Landing page explains the value proposition and includes a clear **Upload syllabus** CTA.
2. Student uploads a PDF, JPG, PNG, or HEIC file; optionally they can paste syllabus text instead.
3. App shows a processing state, then extracts course details and time-sensitive items.
4. Student lands on a review dashboard with all detected events in a clean, editable table or cards.
5. Student can edit event title, date, time, type, description, and confidence; delete bad extractions; or add a missing event.
6. Student selects individual events or selects all.
7. Student exports the selected events by either:
   - downloading an `.ics` calendar file (required), and/or
   - using a Google Calendar export/integration flow (nice-to-have if credentials are available).
8. App displays an export confirmation and offers **Upload another syllabus**.

## Core requirements (must build)

### Upload and input

- Accept PDF, PNG, JPG/JPEG, and pasted plain text.
- Validate file types and show friendly errors for unsupported or unreadable files.
- Show the uploaded filename and allow removing/replacing it before extraction.
- Keep the demo reliable: include a **Try a demo syllabus** button that loads a realistic pre-seeded extraction result if document parsing fails or external AI credentials are unavailable.

### Extraction

Extract and normalize these fields when present:

- Course name and course code (example: CPE 357)
- Instructor name
- Academic term/year if shown
- Assignments / homework / projects
- Quizzes
- Midterms and final exam
- Readings only when they have a specific due date
- Presentations or labs with dates
- Office hours (as recurring weekly events when day/time are clear)
- Other dated deadlines

For every extracted item, use a normalized model similar to:

```ts
type SyllabusEvent = {
  id: string;
  title: string;
  type: 'assignment' | 'quiz' | 'exam' | 'project' | 'reading' | 'office_hours' | 'other';
  date: string;              // ISO YYYY-MM-DD
  startTime?: string;        // 24-hour HH:mm
  endTime?: string;
  allDay: boolean;
  description?: string;
  courseCode?: string;
  confidence: 'high' | 'medium' | 'low';
  selected: boolean;
  recurring?: { frequency: 'weekly'; daysOfWeek: string[]; until?: string };
};
```

Important extraction behavior:

- Do not invent a date. If the source is ambiguous, either omit the event or mark it low confidence and clearly explain why in the description.
- Preserve useful context in the description, such as “Submit on Canvas by 11:59 PM.”
- If a date is missing a year, infer it only from the supplied semester context. Make the assumption visible to the user.
- If no exact due time is provided, make it an all-day event rather than guessing 11:59 PM.
- If an event says “Week 3” without a known semester start date, do not silently convert it to a calendar date.

### Review dashboard

- Summary header: course name/code, number of events found, and high/medium/low confidence counts.
- Filter chips/tabs for All, Assignments, Quizzes, Exams, Projects, Office Hours, and Needs Review.
- Sort events chronologically.
- Each event must show its type, title, date/time, selected state, and confidence.
- Low-confidence items must be visually noticeable but not alarming.
- Provide inline edit, delete, and add-event actions.
- Provide select all / deselect all and a count of selected events.
- Use an empty state when no events are found, with a path to add events manually.

### Calendar export

- Generate a standards-compliant `.ics` file entirely client-side or through a small server endpoint.
- The `.ics` should preserve title, date/time, all-day status, description, and weekly recurrence for office hours where supported.
- Use an intelligible filename such as `CPE-357-Fall-2026-SylliSync.ics`.
- Include a short instruction after download: “Open the file to add these events to Apple Calendar, Outlook, or Google Calendar.”
- If implementing direct Google Calendar export, make it additive: the `.ics` export must still work without authentication.

## Design direction

Build a friendly, modern student product—not a generic admin dashboard.

- Clean layout with generous spacing and a focused single-column upload flow.
- Review page may use a two-column desktop layout: event list on the left and a small calendar/summary panel on the right. On mobile, stack vertically.
- Suggested visual style: warm off-white background, Cal Poly-inspired green accent, deep charcoal text, with a small yellow/gold accent for calls to action. Do not depend on official Cal Poly branding or imply affiliation.
- Use accessible color contrast, visible keyboard focus, labels for inputs, and semantic buttons.
- Make loading and errors feel reassuring and clear.
- Use simple icons sparingly (upload, calendar, edit, trash, check).

## Suggested pages/components

- `LandingPage`: product pitch, short “How it works” row, upload/paste entry point.
- `UploadPanel`: drag-and-drop upload, browse button, paste-text toggle, validation.
- `ProcessingState`: animated but subtle extraction progress.
- `ReviewDashboard`: extracted-events review experience.
- `EventRow` or `EventCard`: selectable, editable event presentation.
- `EventEditor`: modal/drawer/form for manual corrections and new items.
- `ExportPanel`: export controls, `.ics` download, success state.
- `DemoData`: a realistic Cal Poly-style sample syllabus/event set for judging.

## Technical implementation guidance

- First inspect the existing repository and preserve its established tooling, framework, and conventions.
- If starting from scratch, use React + TypeScript + Vite or Next.js with Tailwind CSS. Keep dependencies minimal.
- Separate parsing/extraction logic from UI components so it can later be swapped between rules, OCR, and an LLM.
- For a hackathon MVP, prioritize a robust demo experience over difficult backend infrastructure.
- Implement a deterministic fallback parser for pasted text or a demo result. Pattern-match common formats such as `Assignment 1 — Sept. 24`, `Midterm: October 16`, and `Final Exam: Dec 12, 7:10 PM`.
- If an AI extraction API is configured, send document text to it with a strict JSON schema and validate the returned data before displaying it. Never expose secret keys in the client.
- PDF text extraction may use a client-side library; image OCR can be optional, with an honest “image OCR is in beta” message if unsupported.
- Keep uploaded syllabus content local where possible. Include a short privacy note: “Your syllabus is used only to create your schedule.”

## Demo content

Seed the demo with approximately 8–12 events from one fictional course, including:

- Assignment 1 due on a specific date (all day)
- Quiz 1 at a specific time
- Midterm Exam at a specific time
- Group Project Proposal due
- Final Project due at 11:59 PM
- Final Exam at a specific time
- Weekly instructor office hours recurring on one weekday
- One intentionally low-confidence event to demonstrate review, such as “Reading reflection — date unclear”

Use dates that are internally consistent with a Fall semester and easy for a judge to understand.

## Non-goals for the MVP

- Do not build a full student portal, LMS, grade tracker, or social network.
- Do not require account creation.
- Do not scrape Canvas, Cal Poly systems, or private data.
- Do not claim perfect AI accuracy. The review step is a core feature, not a workaround.

## Quality bar and acceptance criteria

Before considering the build complete:

- A judge can upload or load the demo syllabus and reach an editable event list without confusion.
- The dashboard clearly displays extracted events and highlights uncertain data.
- Editing, deleting, adding, selecting, and filtering events work.
- Downloading an `.ics` file works and the generated file opens/imports in a calendar app.
- The interface works at mobile and desktop widths.
- There are no obvious console errors, broken buttons, or placeholder interactions.
- Include concise README instructions for local setup, how to run the demo, and where an AI/OCR integration could be configured.

## Delivery instructions

Implement the complete working application in the current repository. After implementation:

1. Run the appropriate build/lint/type-check command(s).
2. Fix issues that block normal use.
3. Summarize the final architecture, files changed, how to run it, and any intentionally mocked integrations.
4. Do not stop at a plan or partial UI—deliver the functioning end-to-end MVP.
