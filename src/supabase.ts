import { createClient } from '@supabase/supabase-js'
import type { Course, SyllabusEvent } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null

type CourseRow = { id: string; name: string; code: string; instructor: string; term: string }
type EventRow = { id: string; course_id: string; title: string; type: SyllabusEvent['type']; date: string; start_time: string | null; end_time: string | null; all_day: boolean; description: string | null; confidence: SyllabusEvent['confidence']; selected: boolean; recurring: SyllabusEvent['recurring'] | null }

const toCourse = (row: CourseRow): Course => ({ id: row.id, name: row.name, code: row.code, instructor: row.instructor, term: row.term })
const toEvent = (row: EventRow, courseCode: string): SyllabusEvent => ({ id: row.id, title: row.title, type: row.type, date: row.date, startTime: row.start_time || undefined, endTime: row.end_time || undefined, allDay: row.all_day, description: row.description || undefined, confidence: row.confidence, selected: row.selected, recurring: row.recurring || undefined, courseCode, courseId: row.course_id })

export async function loadSchedule(userId: string) {
  if (!supabase) return { courses: [] as Course[], events: [] as SyllabusEvent[] }
  const { data: courseRows, error: courseError } = await supabase.from('courses').select('*').eq('user_id', userId).order('created_at')
  if (courseError) throw courseError
  const courses = (courseRows as CourseRow[]).map(toCourse)
  if (!courses.length) return { courses, events: [] }
  const { data: eventRows, error: eventError } = await supabase.from('syllabus_events').select('*').in('course_id', courses.map((course) => course.id))
  if (eventError) throw eventError
  const codes = new Map(courses.map((course) => [course.id, course.code]))
  return { courses, events: (eventRows as EventRow[]).map((event) => toEvent(event, codes.get(event.course_id) || 'Course')) }
}

export async function saveCourseWithEvents(userId: string, course: Course, events: SyllabusEvent[]) {
  if (!supabase) return undefined
  const { data: courseRow, error: courseError } = await supabase.from('courses').insert({ user_id: userId, name: course.name, code: course.code, instructor: course.instructor, term: course.term }).select().single()
  if (courseError) throw courseError
  const courseId = (courseRow as CourseRow).id
  if (events.length) {
    const { error: eventError } = await supabase.from('syllabus_events').insert(events.map((event) => ({ id: event.id, course_id: courseId, title: event.title, type: event.type, date: event.date, start_time: event.startTime || null, end_time: event.endTime || null, all_day: event.allDay, description: event.description || null, confidence: event.confidence, selected: event.selected, recurring: event.recurring || null })))
    if (eventError) throw eventError
  }
  return { ...course, id: courseId }
}

export async function updateStoredEvent(courseId: string, event: SyllabusEvent) {
  if (!supabase) return
  const { error } = await supabase.from('syllabus_events').upsert({ id: event.id, course_id: courseId, title: event.title, type: event.type, date: event.date, start_time: event.startTime || null, end_time: event.endTime || null, all_day: event.allDay, description: event.description || null, confidence: event.confidence, selected: event.selected, recurring: event.recurring || null })
  if (error) throw error
}

export async function deleteStoredEvent(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('syllabus_events').delete().eq('id', id)
  if (error) throw error
}

export async function updateStoredCourse(course: Course) {
  if (!supabase || !course.id) return
  const { error } = await supabase
    .from('courses')
    .update({ name: course.name, code: course.code, instructor: course.instructor, term: course.term })
    .eq('id', course.id)
  if (error) throw error
}

export async function deleteStoredCourse(id: string) {
  if (!supabase) return
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}
