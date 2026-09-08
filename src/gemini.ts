import type { Course, EventType, SyllabusEvent } from './types'

const eventTypes = new Set<EventType>(['assignment', 'quiz', 'exam', 'project', 'reading', 'office_hours', 'other'])

function normalize(payload: unknown): { course: Course; events: SyllabusEvent[] } | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as { course?: Partial<Course>; events?: Array<Partial<SyllabusEvent>> }
  if (!data.course || !Array.isArray(data.events)) return null
  const course: Course = { name: data.course.name?.trim() || 'Imported syllabus', code: data.course.code?.trim() || 'Course', instructor: data.course.instructor?.trim() || 'Instructor not listed', term: data.course.term?.trim() || '' }
  const events: SyllabusEvent[] = data.events.flatMap((event) => {
    if (!event.title?.trim() || !event.date || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !event.type || !eventTypes.has(event.type)) return []
    const validTime = (value: unknown) => typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : undefined
    const confidence: SyllabusEvent['confidence'] = event.confidence === 'high' || event.confidence === 'low' ? event.confidence : 'medium'
    return [{ id: crypto.randomUUID(), title: event.title.trim(), type: event.type, date: event.date, startTime: validTime(event.startTime), endTime: validTime(event.endTime), allDay: event.allDay !== false, description: event.description?.trim(), courseCode: course.code, confidence, selected: true, recurring: event.recurring?.frequency === 'weekly' && Array.isArray(event.recurring.daysOfWeek) ? event.recurring as SyllabusEvent['recurring'] : undefined }]
  })
  return { course, events: events.sort((left, right) => left.date.localeCompare(right.date)) }
}

export async function extractWithGemini(text: string): Promise<{ course: Course; events: SyllabusEvent[] }> {
  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? (payload as { error?: unknown }).error
      : null
    throw new Error(typeof message === 'string' ? `Gemini could not extract this syllabus: ${message}` : 'Gemini could not extract this syllabus. Check the server console.')
  }

  const extraction = normalize(payload)
  if (!extraction) {
    throw new Error('Gemini returned an invalid extraction. Try uploading the PDF again.')
  }
  return extraction
}
