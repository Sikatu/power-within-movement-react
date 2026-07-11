import { useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  archiveAdminLearningCourse,
  createAdminLearningCourse,
  createAdminLearningLesson,
  createAdminLearningModule,
  deleteAdminLearningCourse,
  deleteAdminLearningLesson,
  deleteAdminLearningModule,
  getAdminLearningCourse,
  getAdminLearningLibrary,
  publishAdminLearningCourse,
  updateAdminLearningAccess,
  updateAdminLearningCourse,
  updateAdminLearningLesson,
  updateAdminLearningModule,
} from '../../lib/nativeApi'

import './Admin.css'
import './LearningLibrary.css'

const emptyCourseForm = {
  title: '',
  description: '',
  category: 'Personal Growth',
  coverImageUrl: '',
  estimatedMinutes: 30,
  accessMode: 'assigned_clients',
}

const emptyLessonForm = {
  title: '',
  lessonType: 'text',
  content: '',
  externalUrl: '',
  estimatedMinutes: 5,
  isPreview: false,
  position: 0,
  status: 'draft',
}

function clientName(client) {
  return (
    [client?.first_name, client?.last_name].filter(Boolean).join(' ') ||
    client?.email ||
    'Client'
  )
}

function formatStatus(value) {
  const labels = {
    draft: 'Draft',
    published: 'Live',
    archived: 'Archived',
  }

  return labels[value] || 'Draft'
}

function formatLessonType(value) {
  const labels = {
    text: 'Reading',
    video: 'Video',
    download: 'Download',
    reflection: 'Reflection',
  }

  return labels[value] || 'Lesson'
}

function ModuleEditor({ module, onSave, onDelete, onAddLesson, onEditLesson }) {
  const [draft, setDraft] = useState({
    title: module.title || '',
    description: module.description || '',
    position: module.position || 0,
    status: module.status || 'draft',
  })
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)

    try {
      await onSave(module.id, draft)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="learning-module-card">
      <div className="learning-module-card__heading">
        <div>
          <span>Module {Number(module.position || 0) + 1}</span>
          <strong>{module.title}</strong>
          <small>{module.lessons?.length || 0} lessons</small>
        </div>
        <button type="button" onClick={() => onAddLesson(module.id)}>
          Add lesson
        </button>
      </div>

      <details>
        <summary>Edit module details</summary>
        <div className="learning-inline-form">
          <label>
            <span>Module title</span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              rows="3"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <div className="learning-form-row">
            <label>
              <span>Order</span>
              <input
                type="number"
                min="0"
                value={draft.position}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    position: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="learning-form-actions">
            <button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save module'}
            </button>
            <button
              className="is-danger"
              type="button"
              onClick={() => onDelete(module.id)}
            >
              Delete module
            </button>
          </div>
        </div>
      </details>

      <div className="learning-lesson-list">
        {(module.lessons || []).length === 0 ? (
          <p className="learning-empty-copy">No lessons yet. Add the first step for this module.</p>
        ) : (
          module.lessons.map((lesson) => (
            <button
              className="learning-lesson-row"
              key={lesson.id}
              type="button"
              onClick={() => onEditLesson(module.id, lesson)}
            >
              <span>{Number(lesson.position || 0) + 1}</span>
              <div>
                <strong>{lesson.title}</strong>
                <small>
                  {formatLessonType(lesson.lesson_type)} · {lesson.estimated_minutes || 5} min ·{' '}
                  {formatStatus(lesson.status)}
                </small>
              </div>
              <em>Edit</em>
            </button>
          ))
        )}
      </div>
    </article>
  )
}

export default function AdminLearningLibrary() {
  const [courses, setCourses] = useState([])
  const [clients, setClients] = useState([])
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [courseForm, setCourseForm] = useState(emptyCourseForm)
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [moduleDraft, setModuleDraft] = useState({ title: '', description: '' })
  const [lessonEditor, setLessonEditor] = useState(null)
  const [accessMode, setAccessMode] = useState('assigned_clients')
  const [selectedClientIds, setSelectedClientIds] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const filteredCourses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return courses.filter((course) => {
      if (statusFilter !== 'all' && course.status !== statusFilter) return false

      if (!normalizedSearch) return true

      return [course.title, course.description, course.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [courses, search, statusFilter])

  const metrics = useMemo(
    () => ({
      live: courses.filter((course) => course.status === 'published').length,
      draft: courses.filter((course) => course.status === 'draft').length,
      lessons: courses.reduce((total, course) => total + Number(course.lesson_count || 0), 0),
      learners: courses.reduce((total, course) => total + Number(course.access_count || 0), 0),
    }),
    [courses],
  )

  async function loadLibrary(preferredCourseId = selectedCourseId) {
    const response = await getAdminLearningLibrary()
    const nextCourses = response.courses || []

    setCourses(nextCourses)
    setClients(response.clients || [])
    setFeatureEnabled(response.featureEnabled !== false)

    const nextSelectedId =
      preferredCourseId && nextCourses.some((course) => course.id === preferredCourseId)
        ? preferredCourseId
        : nextCourses[0]?.id || ''

    setSelectedCourseId(nextSelectedId)

    if (nextSelectedId) {
      await loadCourse(nextSelectedId)
    } else {
      setSelectedCourse(null)
      setCourseForm(emptyCourseForm)
    }
  }

  async function loadCourse(courseId) {
    const response = await getAdminLearningCourse(courseId)
    const course = response.course

    setSelectedCourse(course)
    setCourseForm({
      title: course.title || '',
      description: course.description || '',
      category: course.category || 'Personal Growth',
      coverImageUrl: course.cover_image_url || '',
      estimatedMinutes: course.estimated_minutes || 30,
      accessMode: course.access_mode || 'assigned_clients',
    })
    setAccessMode(course.access_mode || 'assigned_clients')
    setSelectedClientIds(
      (course.access || [])
        .filter((item) => item.access_status === 'active')
        .map((item) => item.client_profile_id),
    )
    setLessonEditor(null)
  }

  useEffect(() => {
    let mounted = true

    async function start() {
      try {
        setIsLoading(true)
        await loadLibrary('')
      } catch (loadError) {
        if (mounted) setError(loadError.message || 'The Learning Library could not load.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    start()

    return () => {
      mounted = false
    }
    // loadLibrary intentionally runs once against the mounted admin workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runAction(action, successMessage, preferredCourseId = selectedCourseId) {
    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await action()
      setNotice(response?.message || successMessage)
      await loadLibrary(preferredCourseId)
      return response
    } catch (actionError) {
      setError(actionError.message || 'The Learning Library could not save this change.')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateCourse(event) {
    event.preventDefault()

    if (!newCourseTitle.trim()) return

    const response = await runAction(
      () =>
        createAdminLearningCourse({
          title: newCourseTitle,
          description: '',
          category: 'Personal Growth',
          estimatedMinutes: 30,
          accessMode: 'assigned_clients',
        }),
      'Learning program created.',
      '',
    )

    if (response?.course?.id) {
      setNewCourseTitle('')
      setSelectedCourseId(response.course.id)
      await loadLibrary(response.course.id)
      setActiveTab('overview')
    }
  }

  function selectCourse(courseId) {
    setSelectedCourseId(courseId)
    setActiveTab('overview')
    setError('')
    setNotice('')
    loadCourse(courseId).catch((loadError) => {
      setError(loadError.message || 'The learning program could not load.')
    })
  }

  async function handleSaveCourse(event) {
    event.preventDefault()

    await runAction(
      () => updateAdminLearningCourse(selectedCourseId, courseForm),
      'Learning program saved.',
    )
  }

  async function handlePublish() {
    await runAction(
      () => publishAdminLearningCourse(selectedCourseId),
      'Learning program published.',
    )
  }

  async function handleArchive() {
    if (!window.confirm('Archive this learning program and remove it from client view?')) return

    await runAction(
      () => archiveAdminLearningCourse(selectedCourseId),
      'Learning program archived.',
    )
  }

  async function handleDeleteCourse() {
    if (!window.confirm('Permanently delete this learning program and all of its lessons?')) return

    const response = await runAction(
      () => deleteAdminLearningCourse(selectedCourseId),
      'Learning program deleted.',
      '',
    )

    if (response?.ok) {
      setSelectedCourseId('')
      await loadLibrary('')
    }
  }

  async function handleAddModule(event) {
    event.preventDefault()

    if (!moduleDraft.title.trim()) return

    const response = await runAction(
      () => createAdminLearningModule(selectedCourseId, moduleDraft),
      'Module added.',
    )

    if (response?.ok) setModuleDraft({ title: '', description: '' })
  }

  async function handleSaveModule(moduleId, payload) {
    await runAction(
      () => updateAdminLearningModule(moduleId, payload),
      'Module saved.',
    )
  }

  async function handleDeleteModule(moduleId) {
    if (!window.confirm('Delete this module and every lesson inside it?')) return

    await runAction(() => deleteAdminLearningModule(moduleId), 'Module deleted.')
  }

  function openNewLesson(moduleId) {
    const module = selectedCourse.modules.find((item) => item.id === moduleId)
    const nextPosition = module?.lessons?.length || 0

    setLessonEditor({
      mode: 'create',
      moduleId,
      lessonId: '',
      form: { ...emptyLessonForm, position: nextPosition },
    })
  }

  function openEditLesson(moduleId, lesson) {
    setLessonEditor({
      mode: 'edit',
      moduleId,
      lessonId: lesson.id,
      form: {
        title: lesson.title || '',
        lessonType: lesson.lesson_type || 'text',
        content: lesson.content_html || '',
        externalUrl: lesson.external_url || lesson.video_url || '',
        estimatedMinutes: lesson.estimated_minutes || 5,
        isPreview: Boolean(lesson.is_preview),
        position: lesson.position || 0,
        status: lesson.status || 'draft',
      },
    })
  }

  async function handleLessonSave(event) {
    event.preventDefault()

    if (!lessonEditor) return

    const action =
      lessonEditor.mode === 'create'
        ? () => createAdminLearningLesson(lessonEditor.moduleId, lessonEditor.form)
        : () => updateAdminLearningLesson(lessonEditor.lessonId, lessonEditor.form)

    const response = await runAction(action, 'Lesson saved.')

    if (response?.ok) setLessonEditor(null)
  }

  async function handleDeleteLesson() {
    if (!lessonEditor?.lessonId) return
    if (!window.confirm('Permanently delete this lesson?')) return

    const response = await runAction(
      () => deleteAdminLearningLesson(lessonEditor.lessonId),
      'Lesson deleted.',
    )

    if (response?.ok) setLessonEditor(null)
  }

  async function handleSaveAccess() {
    await runAction(
      () =>
        updateAdminLearningAccess(selectedCourseId, {
          accessMode,
          clientProfileIds: accessMode === 'assigned_clients' ? selectedClientIds : [],
        }),
      'Learning audience saved.',
    )
  }

  function toggleClient(clientId) {
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId],
    )
  }

  return (
    <AdminFrame>
      <section className="learning-library-admin">
        <header className="learning-library-header">
          <div>
            <p className="eyebrow">Programs</p>
            <h1>Learning Library</h1>
            <p>
              Build guided learning experiences, choose who receives them, and follow client progress.
            </p>
          </div>
          <div className="learning-library-header__status">
            <span>{featureEnabled ? 'Client access is live' : 'Client access is paused'}</span>
            <small>Controlled from the Developer Control Center</small>
          </div>
        </header>

        {!featureEnabled && (
          <div className="learning-library-alert is-warning">
            The Courses feature flag is off. You can continue building, but clients will not see the library until it is enabled.
          </div>
        )}

        {error && <div className="learning-library-alert is-error">{error}</div>}
        {notice && <div className="learning-library-alert is-success">{notice}</div>}

        <div className="learning-library-metrics">
          <article><span>Live programs</span><strong>{metrics.live}</strong></article>
          <article><span>Drafts</span><strong>{metrics.draft}</strong></article>
          <article><span>Total lessons</span><strong>{metrics.lessons}</strong></article>
          <article><span>Client assignments</span><strong>{metrics.learners}</strong></article>
        </div>

        <div className="learning-library-layout">
          <aside className="learning-library-sidebar">
            <form className="learning-library-create" onSubmit={handleCreateCourse}>
              <label>
                <span>Start a new program</span>
                <input
                  placeholder="Example: Rebuilding Self-Trust"
                  value={newCourseTitle}
                  onChange={(event) => setNewCourseTitle(event.target.value)}
                />
              </label>
              <button type="submit" disabled={isSaving || !newCourseTitle.trim()}>
                Create draft
              </button>
            </form>

            <div className="learning-library-filters">
              <input
                aria-label="Search learning programs"
                placeholder="Search programs"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="published">Live</option>
                <option value="draft">Drafts</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="learning-library-course-list">
              {isLoading ? (
                <p>Loading the library...</p>
              ) : filteredCourses.length === 0 ? (
                <p>No learning programs match this view.</p>
              ) : (
                filteredCourses.map((course) => (
                  <button
                    className={course.id === selectedCourseId ? 'is-active' : ''}
                    key={course.id}
                    type="button"
                    onClick={() => selectCourse(course.id)}
                  >
                    <span>{formatStatus(course.status)}</span>
                    <strong>{course.title}</strong>
                    <small>
                      {course.lesson_count || 0} lessons · {course.access_count || 0} assigned
                    </small>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="learning-library-workspace">
            {!selectedCourse ? (
              <div className="learning-library-empty">
                <strong>Create your first guided learning program.</strong>
                <p>Start with a title, then add modules, lessons, and the clients who should receive it.</p>
              </div>
            ) : (
              <>
                <header className="learning-course-heading">
                  <div>
                    <span className={`learning-status is-${selectedCourse.status}`}>
                      {formatStatus(selectedCourse.status)}
                    </span>
                    <h2>{selectedCourse.title}</h2>
                    <p>
                      {selectedCourse.lessonCount || 0} lessons · {selectedCourse.estimated_minutes || 30} minutes
                    </p>
                  </div>
                  <div>
                    {selectedCourse.status !== 'published' && (
                      <button type="button" onClick={handlePublish} disabled={isSaving}>
                        Publish program
                      </button>
                    )}
                    {selectedCourse.status === 'published' && (
                      <button type="button" onClick={handleArchive} disabled={isSaving}>
                        Archive
                      </button>
                    )}
                    {selectedCourse.status !== 'published' && (
                      <button
                        className="is-danger"
                        type="button"
                        onClick={handleDeleteCourse}
                        disabled={isSaving}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </header>

                <nav className="learning-library-tabs" aria-label="Learning program sections">
                  {[
                    ['overview', 'Overview'],
                    ['curriculum', 'Modules & Lessons'],
                    ['access', 'Client Access'],
                  ].map(([key, label]) => (
                    <button
                      className={activeTab === key ? 'is-active' : ''}
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                {activeTab === 'overview' && (
                  <form className="learning-course-form" onSubmit={handleSaveCourse}>
                    <label>
                      <span>Program title</span>
                      <input
                        value={courseForm.title}
                        onChange={(event) =>
                          setCourseForm((current) => ({ ...current, title: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>What will this help the client do?</span>
                      <textarea
                        rows="5"
                        value={courseForm.description}
                        onChange={(event) =>
                          setCourseForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="learning-form-row">
                      <label>
                        <span>Category</span>
                        <input
                          value={courseForm.category}
                          onChange={(event) =>
                            setCourseForm((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Estimated total minutes</span>
                        <input
                          type="number"
                          min="5"
                          value={courseForm.estimatedMinutes}
                          onChange={(event) =>
                            setCourseForm((current) => ({
                              ...current,
                              estimatedMinutes: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label>
                      <span>Optional cover image URL</span>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={courseForm.coverImageUrl}
                        onChange={(event) =>
                          setCourseForm((current) => ({
                            ...current,
                            coverImageUrl: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save overview'}
                    </button>
                  </form>
                )}

                {activeTab === 'curriculum' && (
                  <div className="learning-curriculum">
                    <form className="learning-add-module" onSubmit={handleAddModule}>
                      <div>
                        <p className="eyebrow">Next Section</p>
                        <h3>Add a module</h3>
                      </div>
                      <label>
                        <span>Module title</span>
                        <input
                          placeholder="Example: Returning to Your Voice"
                          value={moduleDraft.title}
                          onChange={(event) =>
                            setModuleDraft((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Short description</span>
                        <input
                          value={moduleDraft.description}
                          onChange={(event) =>
                            setModuleDraft((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button type="submit" disabled={!moduleDraft.title.trim() || isSaving}>
                        Add module
                      </button>
                    </form>

                    {(selectedCourse.modules || []).length === 0 ? (
                      <div className="learning-library-empty is-small">
                        <strong>No modules yet.</strong>
                        <p>Add a module, then place readings, videos, downloads, or reflections inside it.</p>
                      </div>
                    ) : (
                      <div className="learning-module-list">
                        {selectedCourse.modules.map((module) => (
                          <ModuleEditor
                            key={`${module.id}-${module.updated_at}`}
                            module={module}
                            onSave={handleSaveModule}
                            onDelete={handleDeleteModule}
                            onAddLesson={openNewLesson}
                            onEditLesson={openEditLesson}
                          />
                        ))}
                      </div>
                    )}

                    {lessonEditor && (
                      <form className="learning-lesson-editor" onSubmit={handleLessonSave}>
                        <header>
                          <div>
                            <p className="eyebrow">
                              {lessonEditor.mode === 'create' ? 'New Lesson' : 'Edit Lesson'}
                            </p>
                            <h3>
                              {lessonEditor.mode === 'create'
                                ? 'Add a meaningful next step'
                                : lessonEditor.form.title}
                            </h3>
                          </div>
                          <button type="button" onClick={() => setLessonEditor(null)}>
                            Close
                          </button>
                        </header>
                        <label>
                          <span>Lesson title</span>
                          <input
                            value={lessonEditor.form.title}
                            onChange={(event) =>
                              setLessonEditor((current) => ({
                                ...current,
                                form: { ...current.form, title: event.target.value },
                              }))
                            }
                            required
                          />
                        </label>
                        <div className="learning-form-row">
                          <label>
                            <span>Lesson type</span>
                            <select
                              value={lessonEditor.form.lessonType}
                              onChange={(event) =>
                                setLessonEditor((current) => ({
                                  ...current,
                                  form: { ...current.form, lessonType: event.target.value },
                                }))
                              }
                            >
                              <option value="text">Reading</option>
                              <option value="video">Video</option>
                              <option value="download">Download</option>
                              <option value="reflection">Reflection</option>
                            </select>
                          </label>
                          <label>
                            <span>Estimated minutes</span>
                            <input
                              type="number"
                              min="1"
                              value={lessonEditor.form.estimatedMinutes}
                              onChange={(event) =>
                                setLessonEditor((current) => ({
                                  ...current,
                                  form: {
                                    ...current.form,
                                    estimatedMinutes: Number(event.target.value),
                                  },
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Order</span>
                            <input
                              type="number"
                              min="0"
                              value={lessonEditor.form.position}
                              onChange={(event) =>
                                setLessonEditor((current) => ({
                                  ...current,
                                  form: {
                                    ...current.form,
                                    position: Number(event.target.value),
                                  },
                                }))
                              }
                            />
                          </label>
                        </div>
                        <label>
                          <span>Lesson content or reflection prompt</span>
                          <textarea
                            rows="9"
                            value={lessonEditor.form.content}
                            onChange={(event) =>
                              setLessonEditor((current) => ({
                                ...current,
                                form: { ...current.form, content: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Optional video, download, or supporting link</span>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={lessonEditor.form.externalUrl}
                            onChange={(event) =>
                              setLessonEditor((current) => ({
                                ...current,
                                form: { ...current.form, externalUrl: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <div className="learning-form-row">
                          <label>
                            <span>Status</span>
                            <select
                              value={lessonEditor.form.status}
                              onChange={(event) =>
                                setLessonEditor((current) => ({
                                  ...current,
                                  form: { ...current.form, status: event.target.value },
                                }))
                              }
                            >
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                              <option value="archived">Archived</option>
                            </select>
                          </label>
                          <label className="learning-checkbox-label">
                            <input
                              type="checkbox"
                              checked={lessonEditor.form.isPreview}
                              onChange={(event) =>
                                setLessonEditor((current) => ({
                                  ...current,
                                  form: { ...current.form, isPreview: event.target.checked },
                                }))
                              }
                            />
                            <span>Mark as a preview lesson</span>
                          </label>
                        </div>
                        <div className="learning-form-actions">
                          <button type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save lesson'}
                          </button>
                          {lessonEditor.mode === 'edit' && (
                            <button
                              className="is-danger"
                              type="button"
                              onClick={handleDeleteLesson}
                            >
                              Delete lesson
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {activeTab === 'access' && (
                  <div className="learning-access-panel">
                    <div className="learning-access-choice">
                      <label className={accessMode === 'all_clients' ? 'is-active' : ''}>
                        <input
                          type="radio"
                          name="accessMode"
                          value="all_clients"
                          checked={accessMode === 'all_clients'}
                          onChange={() => setAccessMode('all_clients')}
                        />
                        <span>
                          <strong>All active clients</strong>
                          <small>Every client with an active portal can open this program.</small>
                        </span>
                      </label>
                      <label className={accessMode === 'assigned_clients' ? 'is-active' : ''}>
                        <input
                          type="radio"
                          name="accessMode"
                          value="assigned_clients"
                          checked={accessMode === 'assigned_clients'}
                          onChange={() => setAccessMode('assigned_clients')}
                        />
                        <span>
                          <strong>Only selected clients</strong>
                          <small>Choose exactly who should receive this program.</small>
                        </span>
                      </label>
                    </div>

                    {accessMode === 'assigned_clients' && (
                      <div className="learning-client-picker">
                        <div>
                          <strong>{selectedClientIds.length} clients selected</strong>
                          <button
                            type="button"
                            onClick={() => setSelectedClientIds(clients.map((client) => client.id))}
                          >
                            Select all
                          </button>
                          <button type="button" onClick={() => setSelectedClientIds([])}>
                            Clear
                          </button>
                        </div>
                        <div className="learning-client-picker__list">
                          {clients.map((client) => (
                            <label key={client.id}>
                              <input
                                type="checkbox"
                                checked={selectedClientIds.includes(client.id)}
                                onChange={() => toggleClient(client.id)}
                              />
                              <span>
                                <strong>{clientName(client)}</strong>
                                <small>
                                  {client.email || 'No portal email'} · {client.account_status || 'No account'}
                                </small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <button type="button" onClick={handleSaveAccess} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save client access'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </section>
    </AdminFrame>
  )
}
