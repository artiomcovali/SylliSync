import type { Course, SyllabusEvent } from './types'

export const demoCourse: Course = { name: 'Human-Computer Interaction', code: 'CPE 357', instructor: 'Dr. Maya Rodriguez', term: 'Fall 2026' }

export const demoEvents: SyllabusEvent[] = [
  { id: '1', title: 'Instructor Office Hours', type: 'office_hours', date: '2026-09-29', startTime: '14:00', endTime: '15:30', allDay: false, description: 'Weekly drop-in office hours in 14-234.', courseCode: 'CPE 357', confidence: 'high', selected: true, recurring: { frequency: 'weekly', daysOfWeek: ['TU'], until: '2026-12-08' } },
  { id: '2', title: 'Assignment 1: Interface Critique', type: 'assignment', date: '2026-10-02', allDay: true, description: 'Submit on Canvas. Choose and critique an everyday interface.', courseCode: 'CPE 357', confidence: 'high', selected: true },
  { id: '3', title: 'Quiz 1: Research Methods', type: 'quiz', date: '2026-10-08', startTime: '10:10', endTime: '10:30', allDay: false, description: 'In-class quiz covering modules 1-3.', courseCode: 'CPE 357', confidence: 'high', selected: true },
  { id: '4', title: 'Reading reflection', type: 'reading', date: '2026-10-12', allDay: true, description: 'Source says "around week 4"; verify the due date before exporting.', courseCode: 'CPE 357', confidence: 'low', selected: false },
  { id: '5', title: 'Group Project Proposal', type: 'project', date: '2026-10-23', allDay: true, description: 'One-page proposal and team roster due on Canvas.', courseCode: 'CPE 357', confidence: 'high', selected: true },
  { id: '6', title: 'Midterm Exam', type: 'exam', date: '2026-10-29', startTime: '10:10', endTime: '11:50', allDay: false, description: 'In-person, closed notes. Bring a pencil.', courseCode: 'CPE 357', confidence: 'high', selected: true },
  { id: '7', title: 'Usability Test Plan', type: 'assignment', date: '2026-11-13', allDay: true, description: 'Submit the participant script and test protocol.', courseCode: 'CPE 357', confidence: 'medium', selected: true },
  { id: '8', title: 'Final Project', type: 'project', date: '2026-12-04', startTime: '23:59', allDay: false, description: 'Final prototype, report, and presentation slides due on Canvas.', courseCode: 'CPE 357', confidence: 'high', selected: true },
  { id: '9', title: 'Final Exam', type: 'exam', date: '2026-12-10', startTime: '07:10', endTime: '10:00', allDay: false, description: 'Scheduled final exam period.', courseCode: 'CPE 357', confidence: 'high', selected: true }
]
