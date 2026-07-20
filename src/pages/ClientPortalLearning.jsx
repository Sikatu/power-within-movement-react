import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
import {
  getClientLearningLibrary,
  getClientPortalDashboard,
  logoutClientPortal,
  updateClientLearningProgress,
} from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'
import './ClientPortalLearningMembership.css'

const lessonLabels = {
  text: 'Reading',
  video: 'Video',
  download: 'Download',
  reflection: 'Reflection',
}

function lessonLabel(value) {
  return lessonLabels[value] || 'Lesson'
}

function safeUrl(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function isAuthError(error) {
  return /login required|unauthorized|401/i.test(String(error?.message || error || ''))
}

function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach your private learning library. Please check the backend connection and try again.'
  return message || 'Your Learning Library could not open yet.'
}

function ClientPortalLearning() {
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [courses, setCourses] = useState([])
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [activeCourseId, setActiveCourseId] = useState('')
  const [activeLessonId, setActiveLessonId] = useState('')
  const [notes, setNotes] = useState({})
  const [savingLessonId, setSavingLessonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getClientPortalDashboard(), getClientLearningLibrary()])
      .then(([dashboardResponse, learningResponse]) => {
        if (!active) return
        const loadedCourses = learningResponse.courses || []
        const loadedNotes = {}
        loadedCourses.forEach((course) => {
          ;(course.modules || []).forEach((module) => {
            ;(module.lessons || []).forEach((lesson) => {
              loadedNotes[lesson.id] = lesson.progress_notes || ''
            })
          })
        })
        setClient(dashboardResponse.client || null)
        setCourses(loadedCourses)
        setFeatureEnabled(learningResponse.featureEnabled !== false)
        setActiveCourseId(loadedCourses[0]?.id || '')
        setNotes(loadedNotes)
        setLoading(false)
      })
      .catch((loadError) => {
        if (!active) return
        if (isAuthError(loadError)) {
          navigate('/client-portal/login', { replace: true })
          return
        }
        setError(friendlyError(loadError))
        setLoading(false)
      })
    return () => { active = false }
  }, [navigate])

  const activeCourse = useMemo(() => courses.find((course) => course.id === activeCourseId) || courses[0] || null, [activeCourseId, courses])
  const activeLesson = useMemo(() => {
    if (!activeCourse) return null
    const lessons = (activeCourse.modules || []).flatMap((module) => module.lessons || [])
    return lessons.find((lesson) => lesson.id === activeLessonId)
      || lessons.find((lesson) => !lesson.completed_at)
      || lessons[0]
      || null
  }, [activeCourse, activeLessonId])
  const allLessons = useMemo(() => courses.flatMap((course) => (course.modules || []).flatMap((module) => module.lessons || [])), [courses])
  const totalCompleted = allLessons.filter((lesson) => lesson.completed_at).length
  const averageProgress = allLessons.length ? Math.round((totalCompleted / allLessons.length) * 100) : 0

  function updateLessonLocal(lessonId, changes) {
    setCourses((current) => current.map((course) => {
      let lessonUpdated = false
      const modules = (course.modules || []).map((module) => ({
        ...module,
        lessons: (module.lessons || []).map((lesson) => {
          if (lesson.id !== lessonId) return lesson
          lessonUpdated = true
          return { ...lesson, ...changes }
        }),
      }))
      if (!lessonUpdated) return course
      const lessons = modules.flatMap((module) => module.lessons || [])
      const completedCount = lessons.filter((lesson) => lesson.completed_at).length
      return {
        ...course,
        modules,
        lessonCount: lessons.length,
        completedCount,
        progressPercent: lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0,
      }
    }))
  }

  async function openLesson(courseId, lesson) {
    setActiveCourseId(courseId)
    setActiveLessonId(lesson.id)
    setError('')
    setNotice('')
    try {
      const response = await updateClientLearningProgress(lesson.id, {
        completed: Boolean(lesson.completed_at),
        notes: notes[lesson.id] || lesson.progress_notes || '',
      })
      updateLessonLocal(lesson.id, { last_viewed_at: response.progress?.last_viewed_at || new Date().toISOString() })
    } catch {
      // The lesson remains available if view tracking is briefly unavailable.
    }
  }

  async function saveProgress(lesson, completed) {
    setSavingLessonId(lesson.id)
    setError('')
    setNotice('')
    try {
      const response = await updateClientLearningProgress(lesson.id, {
        completed,
        notes: notes[lesson.id] || '',
      })
      updateLessonLocal(lesson.id, {
        completed_at: response.progress?.completed_at || null,
        last_viewed_at: response.progress?.last_viewed_at || new Date().toISOString(),
        progress_notes: response.progress?.notes || '',
      })
      setNotice(response.message || 'Your lesson progress was saved.')
    } catch (progressError) {
      if (isAuthError(progressError)) {
        navigate('/client-portal/login', { replace: true })
        return
      }
      setError(friendlyError(progressError))
    } finally {
      setSavingLessonId('')
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutClientPortal()
    } finally {
      navigate('/client-portal/login', { replace: true })
    }
  }

  const courseImage = safeUrl(activeCourse?.cover_image_url)
  const lessonResource = safeUrl(activeLesson?.external_url)

  return (
    <main id="main-content" className="portal-workspace portal-learning-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} onLogout={handleLogout} />

      <div className="portal-workspace-inner">
        <header className="portal-page-intro learning-page-intro">
          <p className="eyebrow">Learning Library</p>
          <h1>Keep learning at your pace.</h1>
          <p>Continue your current lesson or choose another private program.</p>
        </header>

        {(error || notice) && <div className={`portal-notice${error ? ' is-error' : ''}`} role="status">{error || notice}</div>}

        {loading ? (
          <div className="portal-loading" role="status">Preparing your learning path…</div>
        ) : !featureEnabled ? (
          <section className="learning-empty-state"><p className="eyebrow">Learning Library</p><h2>Your guided learning space is resting.</h2><p>Power Within will let you know when private programs become available again.</p></section>
        ) : courses.length === 0 ? (
          <section className="learning-empty-state"><p className="eyebrow">Your Learning Path</p><h2>Your first guided program will appear here.</h2><p>When Power Within selects an experience for your journey, its modules and lessons will be waiting in this private library.</p></section>
        ) : (
          <>
            <section className="learning-summary">
              <div><p className="eyebrow">Continue Learning</p><h2>{activeLesson?.title || activeCourse?.title}</h2><p>{activeCourse?.title}{activeLesson ? ` · ${lessonLabel(activeLesson.lesson_type)} · ${activeLesson.estimated_minutes || 5} min` : ''}</p><a href="#current-learning-lesson">Continue</a></div>
              <div className="learning-summary-progress"><strong>{averageProgress}%</strong><span>Overall completion</span><small>{totalCompleted} of {allLessons.length} lessons complete</small></div>
            </section>

            {courses.length > 1 && (
              <details className="learning-program-picker">
                <summary><div><span>Current program</span><strong>{activeCourse?.title}</strong></div><em>Choose program</em></summary>
                <div className="learning-course-tabs" aria-label="Learning programs">
                  {courses.map((course) => (
                    <button type="button" key={course.id} className={course.id === activeCourse?.id ? 'is-active' : ''} onClick={() => { setActiveCourseId(course.id); setActiveLessonId(''); setError(''); setNotice('') }}>
                      <span>{course.category || 'Personal Growth'}</span><strong>{course.title}</strong><small>{course.progressPercent || 0}% complete</small>
                    </button>
                  ))}
                </div>
              </details>
            )}

            {activeCourse && (
              <>
                <section className="learning-course-hero">
                  {courseImage && <img src={courseImage} alt="" />}
                  <div><p className="eyebrow">{activeCourse.category || 'Learning Program'}</p><h2>{activeCourse.title}</h2><p>{activeCourse.description || 'A guided experience selected for your personal growth.'}</p><div className="learning-course-meta"><span>{activeCourse.lessonCount || 0} lessons</span><span>{activeCourse.estimated_minutes || 30} minutes</span><span>{activeCourse.progressPercent || 0}% complete</span></div><div className="learning-progress-bar" aria-label={`${activeCourse.progressPercent || 0}% complete`}><span style={{ width: `${Math.min(100, activeCourse.progressPercent || 0)}%` }} /></div></div>
                </section>

                <div className="learning-workspace">
                  <aside className="learning-curriculum">
                    <div><p className="eyebrow">Your Path</p><h2>Modules &amp; Lessons</h2></div>
                    {(activeCourse.modules || []).map((module, moduleIndex) => (
                      <details key={module.id} open={moduleIndex === 0}>
                        <summary><span>{String(moduleIndex + 1).padStart(2, '0')}</span><div><strong>{module.title}</strong><small>{module.lessons?.length || 0} lessons</small></div></summary>
                        {module.description && <p>{module.description}</p>}
                        <div>
                          {(module.lessons || []).map((lesson, lessonIndex) => (
                            <button type="button" key={lesson.id} className={lesson.id === activeLesson?.id ? 'is-active' : ''} onClick={() => openLesson(activeCourse.id, lesson)}>
                              <span>{lesson.completed_at ? '✓' : lessonIndex + 1}</span><div><strong>{lesson.title}</strong><small>{lessonLabel(lesson.lesson_type)} · {lesson.estimated_minutes || 5} min</small></div>
                            </button>
                          ))}
                        </div>
                      </details>
                    ))}
                  </aside>

                  <article className="learning-lesson" id="current-learning-lesson">
                    {activeLesson ? (
                      <>
                        <header><div><span>{lessonLabel(activeLesson.lesson_type)}</span><h2>{activeLesson.title}</h2><small>{activeLesson.estimated_minutes || 5} minutes</small></div><em className={activeLesson.completed_at ? 'is-complete' : ''}>{activeLesson.completed_at ? 'Complete' : 'In Progress'}</em></header>
                        <div className="learning-lesson-copy">{activeLesson.content_html || 'Open the supporting resource below, then return whenever you are ready to reflect or continue.'}</div>
                        {lessonResource && <a className="learning-resource-link" href={lessonResource} target="_blank" rel="noreferrer">{activeLesson.lesson_type === 'video' ? 'Watch the Video' : activeLesson.lesson_type === 'download' ? 'Open the Download' : 'Open Supporting Resource'} <span aria-hidden="true">↗</span></a>}
                        <label className="learning-notes"><span>{activeLesson.lesson_type === 'reflection' ? 'Your private reflection' : 'Private notes for yourself'}</span><textarea rows="7" maxLength="5000" value={notes[activeLesson.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [activeLesson.id]: event.target.value }))} placeholder="Write anything you want to remember…" /><small>These notes stay inside your private client portal.</small></label>
                        <div className="learning-actions"><button type="button" onClick={() => saveProgress(activeLesson, Boolean(activeLesson.completed_at))} disabled={savingLessonId === activeLesson.id}>{savingLessonId === activeLesson.id ? 'Saving…' : 'Save My Notes'}</button><button className="is-primary" type="button" onClick={() => saveProgress(activeLesson, !activeLesson.completed_at)} disabled={savingLessonId === activeLesson.id}>{activeLesson.completed_at ? 'Mark as Incomplete' : 'Mark Lesson Complete'}</button></div>
                      </>
                    ) : (
                      <div className="learning-lesson-empty"><strong>This program is waiting for its first lesson.</strong><p>Power Within is still preparing the learning experience.</p></div>
                    )}
                  </article>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default ClientPortalLearning
