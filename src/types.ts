export type EventType = 'assignment' | 'quiz' | 'exam' | 'project' | 'reading' | 'office_hours' | 'other'
export type Confidence = 'high' | 'medium' | 'low'

export type SyllabusEvent = {
  id: string
  title: string
  type: EventType
  date: string
  startTime?: string
  endTime?: string
  allDay: boolean
  description?: string
  courseCode?: string
  confidence: Confidence
  selected: boolean
  recurring?: { frequency: 'weekly'; daysOfWeek: string[]; until?: string }
}

export type Course = { id?: string; name: string; code: string; instructor: string; term: string }
