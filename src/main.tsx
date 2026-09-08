import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { demoCourse, demoEvents } from './demo';
import { calendarIcs } from './ics';
import { extractSyllabusText } from './extractor';
import { extractWithGemini } from './gemini';
import {
  deleteStoredEvent,
  deleteStoredCourse,
  loadSchedule,
  saveCourseWithEvents,
  supabase,
  updateStoredEvent,
  updateStoredCourse,
} from './supabase';
import type { Confidence, Course, EventType, SyllabusEvent } from './types';
import './styles.css';
import './workspace.css';
import './calendar.css';

type Screen = 'landing' | 'upload' | 'processing' | 'workspace';
type View = 'review' | 'calendar';
const types: EventType[] = [
  'assignment',
  'quiz',
  'exam',
  'project',
  'reading',
  'office_hours',
  'other',
];
const labels: Record<EventType, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  exam: 'Exam',
  project: 'Project',
  reading: 'Reading',
  office_hours: 'Office hours',
  other: 'Other',
};
const cloneDemo = () =>
  demoEvents.map((e) => ({ ...e, recurring: e.recurring ? { ...e.recurring } : undefined }));
const dateLabel = (date: string) =>
  new Date(`${date}T12:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const emptyCourse: Course = {
  name: 'No schedules yet',
  code: '',
  instructor: 'Upload a syllabus to create your first class.',
  term: '',
};

function App() {
  const [screen, setScreen] = useState<Screen>('landing'),
    [view, setView] = useState<View>('review'),
    [session, setSession] = useState<Session | null>(null);
  const [courses, setCourses] = useState<Course[]>([]),
    [active, setActive] = useState<Course>(demoCourse),
    [events, setEvents] = useState<SyllabusEvent[]>(cloneDemo);
  const [text, setText] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [paste, setPaste] = useState(false),
    [error, setError] = useState(''),
    [processingMessage, setProcessingMessage] = useState(
      'Finding dates, deadlines, and recurring class details.',
    ),
    [filter, setFilter] = useState('all'),
    [edit, setEdit] = useState<SyllabusEvent | null>(null),
    [courseEdit, setCourseEdit] = useState<Course | null>(null),
    [auth, setAuth] = useState<'signup' | 'signin' | null>(null);
  const input = useRef<HTMLInputElement>(null),
    demo = !active.id && !session;
  const activeEvents = useMemo(
    () => events.filter((event) => active.id ? event.courseId === active.id : event.courseCode === active.code),
    [events, active],
  );
  const selected = events.filter((e) => e.selected),
    shown = activeEvents.filter((e) =>
      filter === 'all' || filter === 'review'
        ? filter === 'all' || e.confidence === 'low'
        : e.type === filter,
    );
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return;
    loadSchedule(session.user.id)
      .then((data) => {
        setCourses(data.courses);
        setEvents(data.events);
        setActive(data.courses[0] || emptyCourse);
      })
      .catch(() => setError('Could not load saved schedules. Check Supabase setup.'));
  }, [session]);
  const demoLoad = () => {
    setActive(demoCourse);
    setEvents(cloneDemo());
    setView('review');
    setScreen('processing');
    setTimeout(() => setScreen('workspace'), 750);
  };
  const startNewSyllabus = () => {
    setText('');
    setFile(null);
    setError('');
    setPaste(false);
    setScreen('upload');
  };
  const persistSchedule = async (course: Course, incoming: SyllabusEvent[]) => {
    if (!session) return false;
    try {
      const saved = await saveCourseWithEvents(session.user.id, course, incoming);
      if (saved) {
        setActive(saved);
        setCourses((current) => [...current, saved]);
        setEvents((current) => [
          ...current,
          ...incoming.map((event) => ({ ...event, courseCode: saved.code, courseId: saved.id })),
        ]);
        return true;
      }
    } catch {
      setError('Could not save schedule. Run the Supabase SQL setup first.');
    }
    return false;
  };
  const extract = async () => {
    if (!file && !text.trim()) return setError('Add a file, paste syllabus text, or try the demo.');
    setError('');
    setProcessingMessage('Preparing your syllabus…');
    setScreen('processing');
    try {
      const source = text.trim() || (await extractSyllabusText(file!, setProcessingMessage));
      setProcessingMessage('Using AI to identify dates, deadlines, and course details…');
      const result = await extractWithGemini(source);
      if (session) {
        const saved = await persistSchedule(result.course, result.events);
        if (!saved) {
          setScreen('upload');
          return;
        }
      } else {
        setActive(result.course);
        setEvents(result.events);
      }
      setScreen('workspace');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'We could not read that file. Try pasting the syllabus text.',
      );
      setScreen('upload');
    }
  };
  const exportCal = () => {
    const b = new Blob([calendarIcs(selected, 'SylliSync')], { type: 'text/calendar' }),
      u = URL.createObjectURL(b),
      a = document.createElement('a');
    a.href = u;
    a.download = 'SylliSync-Semester-Plan.ics';
    a.click();
    URL.revokeObjectURL(u);
  };
  const save = async (event: SyllabusEvent) => {
    const next = { ...event, courseCode: active.code, courseId: active.id };
    setEvents((current) =>
      current.some((e) => e.id === next.id)
        ? current.map((e) => (e.id === next.id ? next : e))
        : [...current, next],
    );
    if (active.id)
      await updateStoredEvent(active.id, next).catch(() => setError('Could not save event.'));
    setEdit(null);
  };
  const remove = async (id: string) => {
    setEvents((current) => current.filter((e) => e.id !== id));
    if (active.id) await deleteStoredEvent(id).catch(() => setError('Could not delete event.'));
  };
  const setSelected = async (id: string, selected: boolean) => {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    const next = { ...event, selected };
    setEvents((current) => current.map((item) => (item.id === id ? next : item)));
    if (active.id)
      await updateStoredEvent(active.id, next).catch(() => setError('Could not save selection.'));
  };
  const selectAll = async () => {
    const nextSelected = !activeEvents.every((event) => event.selected);
    await Promise.all(activeEvents.map((event) => setSelected(event.id, nextSelected)));
  };
  const saveCourse = async () => {
    if (!session) return setAuth('signup');
    await persistSchedule(active, activeEvents);
  };
  const saveCourseDetails = async (course: Course) => {
    setActive(course);
    setCourses((current) => current.map((item) => (item.id === course.id ? course : item)));
    setEvents((current) =>
      current.map((event) =>
        event.courseId === course.id ? { ...event, courseCode: course.code } : event,
      ),
    );
    if (course.id) await updateStoredCourse(course).catch(() => setError('Could not update class.'));
    setCourseEdit(null);
  };
  const deleteCourse = async () => {
    if (!active.id || !window.confirm(`Delete ${active.code || active.name} and all of its events?`)) return;
    const courseId = active.id;
    try {
      await deleteStoredCourse(courseId);
      const remaining = courses.filter((course) => course.id !== courseId);
      setCourses(remaining);
      setEvents((current) => current.filter((event) => event.courseId !== courseId));
      setActive(remaining[0] || emptyCourse);
      setView('review');
    } catch {
      setError('Could not delete class.');
    }
  };
  if (screen === 'landing')
    return (
      <main className="landing">
        <nav>
          <Brand />
          <div className="nav-actions">
            <button
              className="text-button"
              onClick={() => (session ? setScreen('workspace') : setAuth('signin'))}
            >
              <LogIn size={16} /> {session ? 'Open schedules' : 'Sign in'}
            </button>
            <button className="text-button" onClick={startNewSyllabus}>
              Upload syllabus <ChevronRight size={17} />
            </button>
          </div>
        </nav>
        <section className="hero">
          <div className="eyebrow">A calmer semester starts here</div>
          <h1>
            Your syllabus,
            <br />
            <em>in sync.</em>
          </h1>
          <p>
            Turn scattered due dates, exams, and office hours into a clean semester plan in seconds.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={startNewSyllabus}>
              <Upload size={18} /> Upload syllabus
            </button>
            <button className="secondary" onClick={demoLoad}>
              Try a demo syllabus
            </button>
          </div>
        </section>
        <section className="steps">
          <Step n="01" h="Add your syllabus" p="Upload a document or paste in its text." />
          <Step n="02" h="Review what we found" p="Correct details and flag anything uncertain." />
          <Step n="03" h="See every class" p="Export one calendar for your whole term." />
        </section>
        {auth && (
          <Auth
            mode={auth}
            close={() => setAuth(null)}
            onSuccess={() => setScreen('workspace')}
            switchMode={() => setAuth(auth === 'signup' ? 'signin' : 'signup')}
          />
        )}
      </main>
    );
  if (screen === 'processing')
    return (
      <main className="processing">
        <Brand />
        <div className="spinner" />
        <h1>Building your semester plan</h1>
        <p>{processingMessage}</p>
        <div className="progress">
          <i />
        </div>
      </main>
    );
  if (screen === 'upload')
    return (
      <main className="upload-page">
        <nav>
          <Brand />
          <button className="text-button" onClick={() => setScreen('landing')}>
            Back home
          </button>
        </nav>
        <section className="upload-shell">
          <div className="eyebrow">New semester plan</div>
          <h1>Add your syllabus</h1>
          <div className="mode-toggle">
            <button className={!paste ? 'active' : ''} onClick={() => { setPaste(false); setText(''); }}>
              Upload file
            </button>
            <button className={paste ? 'active' : ''} onClick={() => { setPaste(true); setFile(null); }}>
              Paste text
            </button>
          </div>
          {paste ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                'Paste syllabus text here...\n\nAssignment 1 — Sept. 24\nMidterm: October 16, 10:10 AM'
              }
            />
          ) : (
            <>
              <input
                ref={input}
                hidden
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.heic"
                onChange={(e) => { setText(''); setFile(e.target.files?.[0] || null); }}
              />
              <button className="dropzone" onClick={() => input.current?.click()}>
                <Upload size={25} />
                <strong>{file?.name || 'Choose a syllabus file'}</strong>
                <small>PDF, DOCX, PNG, JPG, or HEIC</small>
              </button>
            </>
          )}
          <p className="file-note">Your syllabus stays local. Image OCR is currently in beta.</p>
          {error && <div className="error">{error}</div>}
          <button className="primary extract" onClick={extract}>
            Extract schedule <ChevronRight size={18} />
          </button>
          <button className="demo-link" onClick={demoLoad}>
            Or try a demo syllabus
          </button>
        </section>
      </main>
    );
  return (
    <main className="review">
      <header>
        <Brand />
        <div className="workspace-tabs">
          <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}>
            Schedule
          </button>
          <button
            className={view === 'calendar' ? 'active' : ''}
            onClick={() => setView('calendar')}
          >
            <CalendarDays size={15} /> Calendar
          </button>
        </div>
        <div className="header-actions">
          {session ? (
            <button className="text-button" onClick={() => supabase?.auth.signOut()}>
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <button className="text-button" onClick={() => setAuth('signin')}>
              <LogIn size={15} /> Sign in
            </button>
          )}
          <button className="primary compact" disabled={!selected.length} onClick={exportCal}>
            <Download size={16} /> Export calendar
          </button>
        </div>
      </header>
      <div className="workspace-layout">
        <aside className="course-rail">
          <div className="rail-heading">Your schedules</div>
          {courses.map((c) => (
            <button
              key={c.id}
              className={`course-choice ${c.id === active.id ? 'active' : ''}`}
              onClick={() => {
                setActive(c);
                setView('review');
              }}
            >
              <strong>{c.code}</strong>
              <span>{c.name}</span>
            </button>
          ))}
          {demo && (
            <button className="course-choice active">
              <strong>{active.code}</strong>
              <span>{active.name}</span>
            </button>
          )}
          <button className="new-course" onClick={startNewSyllabus}>
            <Plus size={16} /> Add class
          </button>
        </aside>
        <section className="workspace-content">
          {view === 'calendar' ? (
            <Calendar events={events} courseCount={courses.length || 1} onExport={exportCal} />
          ) : (
            <>
              <div className="course-head">
                <div>
                  <div className="eyebrow">{active.term}</div>
                  <h1>{active.name}</h1>
                  <p>
                    {active.code} · {active.instructor}
                  </p>
                </div>
                <div className="course-head-actions">
                  <div className="found">
                    <strong>{activeEvents.length}</strong>
                    <span>events found</span>
                  </div>
                  {active.id && (
                    <div className="class-actions">
                      <button title="Edit class" aria-label="Edit class" onClick={() => setCourseEdit(active)}>
                        <Pencil size={16} />
                      </button>
                      <button title="Delete class" aria-label="Delete class" onClick={() => void deleteCourse()}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {demo && (
                <div className="account-callout">
                  <div>
                    <strong>Create an account to make your own schedules.</strong>
                    <span>Save multiple classes and export one calendar for your semester.</span>
                  </div>
                  <button className="primary compact" onClick={() => setAuth('signup')}>
                    <UserPlus size={16} /> Create account
                  </button>
                </div>
              )}
              <div className="toolbar">
                <div className="filters">
                  {[
                    ['all', 'All'],
                    ['assignment', 'Assignments'],
                    ['quiz', 'Quizzes'],
                    ['exam', 'Exams'],
                    ['project', 'Projects'],
                    ['office_hours', 'Office hours'],
                    ['review', 'Needs review'],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      className={filter === v ? 'active' : ''}
                      onClick={() => setFilter(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button className="icon-text" onClick={() => void selectAll()}>
                  {activeEvents.every((e) => e.selected) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              {shown.map((event) => (
                <Event
                  key={event.id}
                  event={event}
                  toggle={() => void setSelected(event.id, !event.selected)}
                  edit={() => setEdit(event)}
                  remove={() => remove(event.id)}
                />
              ))}
              <button
                className="add-event"
                onClick={() =>
                  setEdit({
                    id: crypto.randomUUID(),
                    title: '',
                    type: 'assignment',
                    date: '2026-09-21',
                    allDay: true,
                    confidence: 'medium',
                    selected: true,
                    courseCode: active.code,
                    courseId: active.id,
                  })
                }
              >
                <Plus size={18} /> Add event
              </button>
              {!active.id && (
                <button className="save-schedule" onClick={saveCourse}>
                  Save this schedule
                </button>
              )}
            </>
          )}
        </section>
      </div>
      {edit && <Editor event={edit} close={() => setEdit(null)} save={save} />}
      {courseEdit && (
        <CourseEditor
          course={courseEdit}
          close={() => setCourseEdit(null)}
          save={saveCourseDetails}
        />
      )}
      {auth && (
        <Auth
          mode={auth}
          close={() => setAuth(null)}
          switchMode={() => setAuth(auth === 'signup' ? 'signin' : 'signup')}
        />
      )}
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <CalendarDays size={21} />
      </span>
      SylliSync
    </div>
  );
}
function Step({ n, h, p }: { n: string; h: string; p: string }) {
  return (
    <div>
      <span>{n}</span>
      <h2>{h}</h2>
      <p>{p}</p>
    </div>
  );
}
function Event({
  event,
  toggle,
  edit,
  remove,
}: {
  event: SyllabusEvent;
  toggle(): void;
  edit(): void;
  remove(): void;
}) {
  return (
    <article className={`event-row ${event.confidence === 'low' ? 'needs-review' : ''}`}>
      <input
        type="checkbox"
        aria-label={`Select ${event.title}`}
        checked={event.selected}
        onChange={toggle}
      />
      <div className={`type-icon ${event.type}`}>{labels[event.type][0]}</div>
      <div className="event-info">
        <div className="event-title">
          <h2>{event.title}</h2>
          {event.confidence === 'low' && <span className="review-badge">Needs review</span>}
        </div>
        <p>
          {dateLabel(event.date)} · {event.allDay ? 'All day' : event.startTime}
        </p>
        <small>{event.description}</small>
      </div>
      <span className={`pill ${event.type}`}>{labels[event.type]}</span>
      <div className="row-actions">
        <button onClick={edit} aria-label="Edit event">
          <Pencil size={16} />
        </button>
        <button onClick={remove} aria-label="Delete event">
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
function Calendar({
  events,
  courseCount,
  onExport,
}: {
  events: SyllabusEvent[];
  courseCount: number;
  onExport(): void;
}) {
  const [month, setMonth] = useState(events[0]?.date.slice(0, 7) || '2026-09');
  const first = new Date(`${month}-01T12:00`),
    days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(),
    blanks = first.getDay(),
    today = new Date().toLocaleDateString('en-CA');
  const changeMonth = (amount: number) => {
    const next = new Date(first.getFullYear(), first.getMonth() + amount, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <div className="calendar-view">
      <div className="calendar-title">
        <div>
          <div className="eyebrow">All your classes</div>
          <h1>Your semester</h1>
          <p>
            {courseCount} course{courseCount === 1 ? '' : 's'} · {events.length} events
          </p>
        </div>
        <button className="primary compact" onClick={onExport}>
          <Download size={16} /> Export calendar
        </button>
      </div>
      <section className="calendar-month">
        <div className="month-nav">
          <button aria-label="Previous month" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={19} />
          </button>
          <h2>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <button aria-label="Next month" onClick={() => changeMonth(1)}>
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="month-grid">
          {Array.from({ length: blanks }, (_, i) => (
            <div className="calendar-day muted" key={i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`,
              list = events.filter((e) => e.date === date);
            return (
              <div className="calendar-day" key={date}>
                <strong className={date === today ? 'today' : ''}>{i + 1}</strong>
                {list.slice(0, 3).map((e) => (
                  <div
                    className={`calendar-event ${e.type}`}
                  key={e.id}
                  tabIndex={0}
                  aria-label={`${e.title}, ${dateLabel(e.date)}`}
                  >
                    <span className="calendar-event-label">
                      {e.courseCode} · {e.title}
                    </span>
                    <div className="calendar-event-details" role="tooltip">
                      <strong>{e.title}</strong>
                      <span>
                        {e.courseCode || 'Course'} · {labels[e.type]}
                      </span>
                      <span>
                        {dateLabel(e.date)} ·{' '}
                        {e.allDay ? 'All day' : e.startTime || 'Time not listed'}
                      </span>
                      {e.description && <p>{e.description}</p>}
                    </div>
                  </div>
                ))}
                {list.length > 3 && <small>+{list.length - 3} more</small>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
function Editor({
  event,
  close,
  save,
}: {
  event: SyllabusEvent;
  close(): void;
  save(e: SyllabusEvent): void;
}) {
  const [d, setD] = useState(event);
  const set = <K extends keyof SyllabusEvent>(k: K, v: SyllabusEvent[K]) =>
    setD((x) => ({ ...x, [k]: v }));
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          save(d);
        }}
      >
        <div className="modal-head">
          <h2>{event.title ? 'Edit event' : 'Add event'}</h2>
          <button type="button" onClick={close}>
            <X size={19} />
          </button>
        </div>
        <label>
          Title
          <input required value={d.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            Type
            <select value={d.type} onChange={(e) => set('type', e.target.value as EventType)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {labels[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Confidence
            <select
              value={d.confidence}
              onChange={(e) => set('confidence', e.target.value as Confidence)}
            >
              {['high', 'medium', 'low'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={d.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label>
            Time
            <input
              type="time"
              disabled={d.allDay}
              value={d.startTime || ''}
              onChange={(e) => set('startTime', e.target.value || undefined)}
            />
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={d.allDay}
            onChange={(e) => set('allDay', e.target.checked)}
          />{' '}
          All-day event
        </label>
        <label>
          Description
          <textarea
            value={d.description || ''}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save event</button>
        </div>
      </form>
    </div>
  );
}
function CourseEditor({
  course,
  close,
  save,
}: {
  course: Course;
  close(): void;
  save(course: Course): void;
}) {
  const [draft, setDraft] = useState(course);
  const set = <K extends keyof Course>(key: K, value: Course[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        onSubmit={(event) => {
          event.preventDefault();
          save(draft);
        }}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">Class details</div>
            <h2>Edit class</h2>
          </div>
          <button type="button" aria-label="Close class editor" onClick={close}>
            <X size={19} />
          </button>
        </div>
        <label>
          Class name
          <input required value={draft.name} onChange={(event) => set('name', event.target.value)} />
        </label>
        <div className="form-grid">
          <label>
            Course code
            <input required value={draft.code} onChange={(event) => set('code', event.target.value)} />
          </label>
          <label>
            Term
            <input required value={draft.term} onChange={(event) => set('term', event.target.value)} />
          </label>
        </div>
        <label>
          Instructor
          <input value={draft.instructor} onChange={(event) => set('instructor', event.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save class</button>
        </div>
      </form>
    </div>
  );
}
function Auth({
  mode,
  close,
  onSuccess,
  switchMode,
}: {
  mode: 'signup' | 'signin';
  close(): void;
  onSuccess?(): void;
  switchMode(): void;
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [msg, setMsg] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase)
      return setMsg('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local first.');
    const r =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (r.error) return setMsg(r.error.message);
    if (mode === 'signin' || r.data.session) {
      close();
      onSuccess?.();
      return;
    }
    setMsg('Account created. You are signed in.');
  };
  return (
    <div className="modal-backdrop">
      <form className="modal auth-modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>{mode === 'signup' ? 'Save every schedule' : 'Welcome back'}</h2>
          <button type="button" onClick={close}>
            <X size={19} />
          </button>
        </div>
        <p>Keep every class together and export one semester calendar.</p>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {msg && <div className="auth-message">{msg}</div>}
        <button className="primary full">{mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        <button type="button" className="demo-link" onClick={switchMode}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
        </button>
      </form>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
