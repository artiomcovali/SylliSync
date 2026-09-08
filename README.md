# SylliSync

SylliSync turns a course syllabus into an editable semester plan and exports selected events as an `.ics` calendar file.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Select **Try a demo syllabus** for the most reliable hackathon walkthrough, or paste syllabus text to exercise the local deterministic parser.

## Notes

- PDF and image selection is supported by the upload interface. Image OCR and PDF text extraction are intentionally mocked for the MVP and route to the dependable demo data after processing.
- Pasted text is parsed client-side with date and event-type patterns. No syllabus content leaves the browser.
- The `.ics` export is generated entirely in the browser, including weekly RRULE recurrence for office hours.
- A future OCR or AI integration belongs behind `src/parser.ts`, with credentials and document handling kept server-side.
