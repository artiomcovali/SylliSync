const eventTypes = ['assignment', 'quiz', 'exam', 'project', 'reading', 'office_hours', 'other'];
const schema = { type: 'OBJECT', properties: { course: { type: 'OBJECT', properties: { name: { type: 'STRING' }, code: { type: 'STRING' }, instructor: { type: 'STRING' }, term: { type: 'STRING' } }, required: ['name', 'code', 'instructor', 'term'] }, events: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, type: { type: 'STRING', enum: eventTypes }, date: { type: 'STRING' }, startTime: { type: 'STRING' }, endTime: { type: 'STRING' }, allDay: { type: 'BOOLEAN' }, description: { type: 'STRING' }, confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }, recurring: { type: 'OBJECT' } }, required: ['title', 'type', 'date', 'allDay', 'confidence'] } } }, required: ['course', 'events'] };
const prompt = (text) => `Extract a course and calendar events from this syllabus. Return only JSON matching the response schema. Extract assignments, quizzes, exams, projects, presentations, dated labs, and dated readings. Never invent dates/times. For schedule tables, carry omitted month names forward from prior rows and create separate events for Assignment Due and Lab cells. Use allDay true when no time is stated. Do not create events for routine lectures, contact information, prerequisites, or no-class holidays.\n\nSYLLABUS TEXT:\n${text.slice(0, 60000)}`;

export async function extractWithGemini(text, apiKey, model = 'gemini-3.5-flash-lite') {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt(text) }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema } }) });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    const message = failure?.error?.message;
    throw new Error(message ? `Gemini extraction failed (${response.status}): ${message}` : `Gemini extraction failed (${response.status})`);
  }
  const data = await response.json(); const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Gemini returned no extraction');
  return JSON.parse(content);
}
