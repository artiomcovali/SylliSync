import type { Course, EventType, SyllabusEvent } from './types'

const months: Record<string, string> = { jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03', apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12' }

function inferType(title: string): EventType {
  const text = title.toLowerCase()
  if (text.includes('quiz')) return 'quiz'
  if (text.includes('midterm') || text.includes('final exam') || text.includes('exam')) return 'exam'
  if (text.includes('project') || text.includes('proposal')) return 'project'
  if (text.includes('reading')) return 'reading'
  if (text.includes('office hour')) return 'office_hours'
  if (text.includes('assignment') || text.includes('homework') || text.includes('lab')) return 'assignment'
  return 'other'
}

function parseDate(line: string, year: string) {
  const match = line.match(/(?:due\s*)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/i)
  if (!match) return undefined
  return `${match[3] || year}-${months[match[1].toLowerCase().replace('.', '')]}-${match[2].padStart(2, '0')}`
}

export function parseSyllabus(text: string): { course: Course; events: SyllabusEvent[] } {
  const year = text.match(/\b(20\d{2})\b/)?.[1] || '2026'
  const code = text.match(/\b[A-Z]{2,4}\s?\d{3}\b/)?.[0] || 'Course'
  const title = text.match(/(?:course|class)\s*[:\-]\s*(.+)/i)?.[1]?.trim() || 'Imported syllabus'
  const course: Course = { name: title, code, instructor: text.match(/instructor\s*[:\-]\s*(.+)/i)?.[1]?.trim() || 'Instructor not listed', term: text.match(/(Fall|Winter|Spring|Summer)\s+20\d{2}/i)?.[0] || `Fall ${year}` }
  const events = text.split(/\n+/).flatMap((line, index) => {
    const date = parseDate(line, year)
    if (!date) return []
    const titlePart = line.split(/[—–:-]/)[0].replace(/^\s*(due\s*)?/i, '').trim()
    if (!titlePart || !/(assignment|homework|project|quiz|exam|midterm|final|reading|lab|presentation|due)/i.test(line)) return []
    const time = line.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i)
    let startTime: string | undefined
    if (time) { let hour = Number(time[1]); if (time[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12; if (time[3]?.toLowerCase() === 'am' && hour === 12) hour = 0; startTime = `${String(hour).padStart(2, '0')}:${time[2]}` }
    return [{ id: `${Date.now()}-${index}`, title: titlePart, type: inferType(line), date, startTime, allDay: !startTime, description: line.trim(), courseCode: code, confidence: 'medium' as const, selected: true }]
  }).sort((a, b) => a.date.localeCompare(b.date))
  return { course, events }
}
