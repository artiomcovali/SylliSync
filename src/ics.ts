import type { SyllabusEvent } from './types'

const escape = (text = '') => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateOnly = (date: string) => date.replace(/-/g, '')
const nextDay = (date: string) => {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

export function calendarIcs(events: SyllabusEvent[], courseCode: string) {
  const body = events.map((event) => {
    const lines = ['BEGIN:VEVENT', `UID:${event.id}@syllisync.local`, `DTSTAMP:${stamp()}`, `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `CATEGORIES:${event.type}`]
    if (event.allDay) lines.push(`DTSTART;VALUE=DATE:${dateOnly(event.date)}`, `DTEND;VALUE=DATE:${dateOnly(nextDay(event.date))}`)
    else lines.push(`DTSTART:${dateOnly(event.date)}T${(event.startTime || '00:00').replace(':', '')}00`, event.endTime ? `DTEND:${dateOnly(event.date)}T${event.endTime.replace(':', '')}00` : '')
    if (event.recurring) lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${event.recurring.daysOfWeek.join(',')}${event.recurring.until ? `;UNTIL=${dateOnly(event.recurring.until)}T235959` : ''}`)
    return lines.filter(Boolean).join('\r\n') + '\r\nEND:VEVENT'
  }).join('\r\n')
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SylliSync//Semester Plan//EN\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:${escape(courseCode)}\r\n${body}\r\nEND:VCALENDAR\r\n`
}
