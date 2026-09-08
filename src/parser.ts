import type { Course, EventType, SyllabusEvent } from './types'

const monthNumbers: Record<string, string> = { jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03', apr: '04', april: '04', may: '05', jun: '06', june: '06', jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09', oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12' }
const datePattern = /(?:(?:mon|tues?|wed(?:nesday)?|thu(?:rs)?|fri|sat(?:urday)?|sun(?:day)?)\w*\s*,?\s*)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,?\s*(20\d{2}))?/gi
const eventPattern = /\b(?:assignment|homework|hw\s*\d|quiz|midterm|final(?:\s+exam)?|exam|project|presentation|lab|reading|reflection|paper|report|proposal|deliverable)\b/gi
const weekdayPattern = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i
const dayCodes: Record<string, string> = { monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH', friday: 'FR', saturday: 'SA', sunday: 'SU' }

function normalize(text: string) {
  return text.replace(/\r/g, '').replace(/[\u2013\u2014]/g, '-').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim()
}

function isoDate(month: string, day: string, explicitYear: string | undefined, year: string) {
  const key = month.toLowerCase().replace('.', '')
  return `${explicitYear || year}-${monthNumbers[key]}-${day.padStart(2, '0')}`
}

function inferType(value: string): EventType {
  const text = value.toLowerCase()
  if (/\bquiz\b/.test(text)) return 'quiz'
  if (/\b(midterm|final\s*exam|exam)\b/.test(text)) return 'exam'
  if (/\b(project|proposal|presentation|deliverable)\b/.test(text)) return 'project'
  if (/\b(reading|reflection)\b/.test(text)) return 'reading'
  if (/\b(lab|assignment|homework|hw\s*\d|paper|report)\b/.test(text)) return 'assignment'
  return 'other'
}

function parseTimes(text: string) {
  const matches = [...text.matchAll(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/gi)]
  const convert = (match: RegExpMatchArray) => {
    let hour = Number(match[1]); const meridiem = match[3]?.replace(/\./g, '').toLowerCase()
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${match[2]}`
  }
  return { startTime: matches[0] ? convert(matches[0]) : undefined, endTime: matches[1] ? convert(matches[1]) : undefined }
}

function cleanTitle(raw: string, dateText: string) {
  return raw
    .replace(dateText, ' ')
    .replace(/\b(?:due|on|by|at|from|for)\s*$/i, '')
    .replace(/\b(?:due|on|by|at|from)\b\s*(?=$)/i, '')
    .replace(/\s*(?:-|:|,|;|\.)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function courseMetadata(text: string, year: string): Course {
  const code = text.match(/\b[A-Z]{2,5}\s*-?\s*\d{3,4}\b/)?.[0]?.replace(/\s*-\s*/, ' ').replace(/\s+/g, ' ') || 'Course'
  const term = text.match(/\b(Fall|Winter|Spring|Summer)\s+20\d{2}\b/i)?.[0] || `Fall ${year}`
  const instructor = text.match(/(?:instructor|professor|prof\.)\s*[:\-]?\s*([^\n]{2,90})/i)?.[1]
    ?.split(/\b(?:email|office|phone|class information|prerequisite)\b/i)[0].trim() || 'Instructor not listed'
  const courseMatch = text.match(/(?:course|class)\s*(?:title|name)?\s*[:\-]\s*([^\n]{2,120})/i)
  let name = courseMatch?.[1]?.split(/\b(?:instructor|professor|email|office|class information|prerequisite)\b/i)[0].trim()
  if (!name || /^(?:dr\.?|prof\.?|instructor\b)/i.test(name)) {
    const codeIndex = text.indexOf(code)
    const nearby = codeIndex >= 0 ? text.slice(Math.max(0, codeIndex - 90), codeIndex + 90) : ''
    name = nearby.match(/(?:title|course)\s*[:\-]?\s*([^\n-]{3,80})/i)?.[1]?.trim() || 'Imported syllabus'
  }
  return { name: name.replace(/^[-:\s]+|[-:\s]+$/g, ''), code, instructor, term }
}

function officeHours(text: string, year: string, courseCode: string): SyllabusEvent[] {
  const match = text.match(/office\s+hours?\s*[:\-]?\s*([^\n.]{0,140})/i)
  if (!match) return []
  const details = match[1]; const weekday = details.match(weekdayPattern)?.[1]?.toLowerCase()
  const times = parseTimes(details)
  if (!weekday || !times.startTime) return []
  const start = new Date(`${year}-08-24T12:00:00`)
  const wanted = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekday)
  start.setDate(start.getDate() + ((wanted - start.getDay() + 7) % 7))
  const date = start.toISOString().slice(0, 10)
  return [{ id: crypto.randomUUID(), title: 'Instructor Office Hours', type: 'office_hours', date, startTime: times.startTime, endTime: times.endTime, allDay: false, description: `Recurring ${weekday} office hours. Extracted from: Office Hours: ${details.trim()}`, courseCode, confidence: 'medium', selected: true, recurring: { frequency: 'weekly', daysOfWeek: [dayCodes[weekday]], until: `${year}-12-15` } }]
}

function tableScheduleEvents(text: string, year: string, courseCode: string): SyllabusEvent[] {
  let month = 8
  const events: SyllabusEvent[] = []
  const rows = text.split('\n')
  for (const row of rows) {
    const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean)
    if (!cells.length || !/^(?:M|T|W|Th|F|Mon|Tue|Wed|Thu|Fri)\b/i.test(cells[0])) continue
    const match = cells[0].match(/^(?:M|T|W|Th|F|Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?)\s+(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+)?(\d{1,2})\b\s*(.*)$/i)
    if (!match) continue
    if (match[1]) month = Number(monthNumbers[match[1].toLowerCase().replace('.', '')])
    const date = `${year}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`
    const topic = match[3].trim()
    const candidates = [topic, ...cells.slice(1)]
    for (const candidate of candidates) {
      const title = candidate.replace(/\bdue\b/gi, '').replace(/\s+/g, ' ').trim()
      if (!title || /^(?:PLAI|reading|other)$/i.test(title) || /(?:no class|thanksgiving)/i.test(title)) continue
      const isAssignmentCell = /^A\d+\b/i.test(title)
      const isLab = /^Lab\s*\d+/i.test(title)
      const isDatedEvent = isAssignmentCell || isLab || /\b(?:quiz|midterm|final|exam|presentation|project|paper|report|proposal)\b/i.test(title)
      if (!isDatedEvent) continue
      events.push({
        id: crypto.randomUUID(),
        title,
        type: isLab || isAssignmentCell ? 'assignment' : inferType(title),
        date,
        allDay: true,
        description: `Schedule table row: ${row.replace(/\s+/g, ' ').trim()}`,
        courseCode,
        confidence: /\btba\b/i.test(title) ? 'medium' : 'high',
        selected: true,
      })
    }
  }
  return events
}

export function parseSyllabus(rawText: string): { course: Course; events: SyllabusEvent[] } {
  const text = normalize(rawText)
  const year = text.match(/\b(20\d{2})\b/)?.[1] || String(new Date().getFullYear())
  const course = courseMetadata(text, year)
  const events: SyllabusEvent[] = []
  events.push(...tableScheduleEvents(text, year, course.code))
  const dates = [...text.matchAll(datePattern)]
  const hasScheduleTable = events.length > 0
  if (!hasScheduleTable) dates.forEach((dateMatch, index) => {
    const dateIndex = dateMatch.index || 0; const dateText = dateMatch[0]
    const windowStart = Math.max(0, dateIndex - 220); const windowEnd = Math.min(text.length, (dates[index + 1]?.index || text.length))
    const context = text.slice(windowStart, windowEnd)
    const candidates = [...context.matchAll(eventPattern)]
    if (!candidates.length) return
    const nearest = candidates.reduce((best, current) => {
      const absolute = windowStart + (current.index || 0)
      return Math.abs(absolute - dateIndex) < Math.abs((windowStart + (best.index || 0)) - dateIndex) ? current : best
    })
    const keywordIndex = windowStart + (nearest.index || 0)
    const modifier = text.slice(Math.max(windowStart, keywordIndex - 35), keywordIndex).match(/\b(?:group|final|midterm|individual|term)\s*$/i)?.[0]
    const titleStart = modifier ? keywordIndex - modifier.length : keywordIndex
    const titleEnd = keywordIndex <= dateIndex ? dateIndex + dateText.length : Math.min(text.length, keywordIndex + 120)
    const rawTitle = text.slice(titleStart, titleEnd).split(/\n|(?<=[.!?])\s/)[0]
    const title = cleanTitle(rawTitle, dateText)
    if (!title || /(?:class information|prerequisite|office hours)/i.test(title)) return
    const surroundingStart = Math.max(windowStart, Math.min(keywordIndex, dateIndex))
    const surroundingEnd = Math.min(text.length, Math.max(keywordIndex, dateIndex + dateText.length) + 140)
    const surrounding = text.slice(surroundingStart, surroundingEnd)
    const times = parseTimes(surrounding)
    events.push({ id: crypto.randomUUID(), title, type: inferType(title), date: isoDate(dateMatch[1], dateMatch[2], dateMatch[3], year), startTime: times.startTime, endTime: times.endTime, allDay: !times.startTime, description: surrounding.replace(/\s+/g, ' ').trim(), courseCode: course.code, confidence: 'high', selected: true })
  })
  const deduped = new Map<string, SyllabusEvent>()
  for (const event of events) {
    const key = `${event.date}-${event.title.toLowerCase()}`
    if (!deduped.has(key)) deduped.set(key, event)
  }
  for (const officeHour of officeHours(text, year, course.code)) deduped.set(`${officeHour.date}-${officeHour.title}`, officeHour)
  return { course, events: [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date)) }
}
