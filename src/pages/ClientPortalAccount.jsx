import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
import {
  changeClientPortalPassword,
  getClientPortalMe,
  getClientPortalOnboarding,
  logoutClientPortal,
  saveClientPortalOnboarding,
  submitClientPortalOnboarding,
  updateClientPortalProfile,
} from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'
import './ClientPortalAccount.css'

const editableOnboardingStatuses = new Set(['not_started', 'in_progress'])

function isAuthError(error) {
  return /login required|unauthorized|401/i.test(String(error?.message || error || ''))
}

function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach your private account. Please check the backend connection and try again.'
  return message || 'That change could not be saved yet.'
}

function readable(value, empty = 'Not started') {
  const text = String(value || '').replaceAll('_', ' ').trim().toLowerCase()
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : empty
}

function formatDate(value, empty = 'Not recorded') {
  if (!value) return empty
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'America/New_York',
    }).format(new Date(value))
  } catch {
    return empty
  }
}

function displayAnswer(value) {
  if (Array.isArray(value)) return value.join(', ') || 'Not answered'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '').trim() || 'Not answered'
}

function OnboardingField({ field, value, onChange, disabled }) {
  const inputId = `onboarding-${field.fieldKey}`
  const sharedInput = {
    id: inputId,
    disabled,
    required: Boolean(field.required),
    value: value || '',
    onChange: (event) => onChange(event.target.value),
  }

  if (field.fieldType === 'checkbox') {
    return (
      <label className="account-consent-field" htmlFor={inputId}>
        <input id={inputId} type="checkbox" checked={Boolean(value)} disabled={disabled} required={Boolean(field.required)} onChange={(event) => onChange(event.target.checked)} />
        <span><strong>{field.label}{field.required ? ' *' : ''}</strong>{field.helpText && <small>{field.helpText}</small>}</span>
      </label>
    )
  }

  if (field.fieldType === 'multiselect') {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset className="account-choice-field" disabled={disabled}>
        <legend>{field.label}{field.required ? ' *' : ''}</legend>
        {field.helpText && <p>{field.helpText}</p>}
        <div>
          {(field.options || []).map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  return (
    <label className="account-field" htmlFor={inputId}>
      <span>{field.label}{field.required ? ' *' : ''}</span>
      {field.helpText && <small>{field.helpText}</small>}
      {field.fieldType === 'long_text' ? (
        <textarea {...sharedInput} rows="5" maxLength="5000" placeholder={field.placeholder || ''} />
      ) : field.fieldType === 'select' ? (
        <select {...sharedInput}>
          <option value="">Choose one</option>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input
          {...sharedInput}
          type={{ email: 'email', phone: 'tel', date: 'date' }[field.fieldType] || 'text'}
          maxLength={field.fieldType === 'short_text' ? 500 : undefined}
          placeholder={field.placeholder || ''}
        />
      )}
    </label>
  )
}

function ClientPortalAccount() {
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [onboarding, setOnboarding] = useState({ available: false, onboarding: null, template: null })
  const [answers, setAnswers] = useState({})
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '', emergencyContactName: '', emergencyContactPhone: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [accountView, setAccountView] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getClientPortalMe(), getClientPortalOnboarding()])
      .then(([profileResponse, onboardingResponse]) => {
        if (!active) return
        const loadedClient = profileResponse.client || null
        setClient(loadedClient)
        setProfileForm({
          firstName: loadedClient?.firstName || '',
          lastName: loadedClient?.lastName || '',
          phone: loadedClient?.phone || '',
          emergencyContactName: loadedClient?.emergencyContactName || '',
          emergencyContactPhone: loadedClient?.emergencyContactPhone || '',
        })
        setOnboarding(onboardingResponse)
        setAnswers(onboardingResponse.onboarding?.answers || {})
        if (onboardingResponse.available && editableOnboardingStatuses.has(onboardingResponse.onboarding?.status)) setAccountView('onboarding')
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

  const onboardingFields = onboarding.template?.fields || []
  const answeredRequired = onboardingFields.filter((field) => {
    if (!field.required) return false
    const value = answers[field.fieldKey]
    return Array.isArray(value) ? value.length > 0 : typeof value === 'boolean' ? value : Boolean(String(value ?? '').trim())
  }).length
  const requiredCount = onboardingFields.filter((field) => field.required).length
  const onboardingEditable = onboarding.available && editableOnboardingStatuses.has(onboarding.onboarding?.status)

  const passwordChecks = [
    ['12+ characters', passwordForm.newPassword.length >= 12],
    ['Uppercase', /[A-Z]/.test(passwordForm.newPassword)],
    ['Lowercase', /[a-z]/.test(passwordForm.newPassword)],
    ['Number', /[0-9]/.test(passwordForm.newPassword)],
    ['Symbol', /[^A-Za-z0-9]/.test(passwordForm.newPassword)],
    ['Passwords match', Boolean(passwordForm.newPassword) && passwordForm.newPassword === passwordForm.confirmPassword],
  ]
  const passwordReady = passwordForm.currentPassword && passwordChecks.every(([, complete]) => complete)

  function startAction(name) {
    setBusyAction(name)
    setError('')
    setNotice('')
  }

  function finishAction() {
    setBusyAction('')
  }

  async function saveProfile(event) {
    event.preventDefault()
    startAction('profile')
    try {
      const response = await updateClientPortalProfile(profileForm)
      setClient(response.client || client)
      setNotice(response.message || 'Your profile details were saved.')
    } catch (saveError) {
      if (isAuthError(saveError)) return navigate('/client-portal/login', { replace: true })
      setError(friendlyError(saveError))
    } finally {
      finishAction()
    }
  }

  function applyOnboardingResponse(response) {
    setOnboarding(response)
    setAnswers(response.onboarding?.answers || answers)
  }

  async function saveOnboardingDraft() {
    startAction('onboarding-draft')
    try {
      const response = await saveClientPortalOnboarding(answers)
      applyOnboardingResponse(response)
      setNotice(response.message || 'Your onboarding progress was saved.')
    } catch (saveError) {
      if (isAuthError(saveError)) return navigate('/client-portal/login', { replace: true })
      setError(friendlyError(saveError))
    } finally {
      finishAction()
    }
  }

  async function submitOnboarding(event) {
    event.preventDefault()
    startAction('onboarding-submit')
    try {
      const response = await submitClientPortalOnboarding(answers)
      applyOnboardingResponse(response)
      setNotice(response.message || 'Your onboarding intake was submitted.')
    } catch (submitError) {
      if (isAuthError(submitError)) return navigate('/client-portal/login', { replace: true })
      setError(friendlyError(submitError))
    } finally {
      finishAction()
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    startAction('password')
    try {
      const response = await changeClientPortalPassword(passwordForm)
      setClient((current) => ({ ...current, passwordChangedAt: response.passwordChangedAt || current?.passwordChangedAt }))
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setNotice(response.message || 'Your password was changed successfully.')
    } catch (passwordError) {
      if (isAuthError(passwordError)) return navigate('/client-portal/login', { replace: true })
      setError(friendlyError(passwordError))
    } finally {
      finishAction()
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

  return (
    <main id="main-content" className="portal-workspace portal-account-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} onLogout={handleLogout} />

      <div className="portal-workspace-inner account-workspace">
        <header className="portal-page-intro account-page-intro">
          <p className="eyebrow">My Account</p>
          <h1>Your details, onboarding, and security.</h1>
          <p>Keep your care information current and your private portal protected.</p>
        </header>

        {(error || notice) && <div className={`portal-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}

        {loading ? (
          <div className="portal-loading" role="status">Opening your account…</div>
        ) : (
          <>
            <div className="portal-task-switcher account-task-switcher" role="group" aria-label="Account tasks">
              <button type="button" className={accountView === 'profile' ? 'is-active' : ''} aria-pressed={accountView === 'profile'} onClick={() => { setAccountView('profile'); setError(''); setNotice('') }}>Profile</button>
              <button type="button" className={accountView === 'onboarding' ? 'is-active' : ''} aria-pressed={accountView === 'onboarding'} onClick={() => { setAccountView('onboarding'); setError(''); setNotice('') }}>Onboarding{onboardingEditable && <span>{requiredCount ? `${answeredRequired}/${requiredCount}` : 'Open'}</span>}</button>
              <button type="button" className={accountView === 'security' ? 'is-active' : ''} aria-pressed={accountView === 'security'} onClick={() => { setAccountView('security'); setError(''); setNotice('') }}>Security</button>
            </div>

            {accountView === 'profile' && (
              <section className="portal-card account-panel">
                <header className="account-panel-heading"><div><p className="eyebrow">Profile</p><h2>How Power Within reaches you</h2><p>Update the contact and emergency details connected to your care.</p></div><span>{client?.portalStatus === 'active' ? 'Active account' : readable(client?.portalStatus)}</span></header>
                <form className="portal-form account-form-grid" onSubmit={saveProfile}>
                  <label><span>Email</span><input type="email" value={client?.email || ''} disabled /><small>Your sign-in email is managed securely by Power Within.</small></label>
                  <label><span>Phone <em>Optional</em></span><input type="tel" value={profileForm.phone} maxLength="40" onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                  <label><span>First name</span><input value={profileForm.firstName} maxLength="80" required onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))} /></label>
                  <label><span>Last name <em>Optional</em></span><input value={profileForm.lastName} maxLength="80" onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))} /></label>
                  <label><span>Emergency contact <em>Optional</em></span><input value={profileForm.emergencyContactName} maxLength="120" onChange={(event) => setProfileForm((current) => ({ ...current, emergencyContactName: event.target.value }))} /></label>
                  <label><span>Emergency contact phone <em>Optional</em></span><input type="tel" value={profileForm.emergencyContactPhone} maxLength="40" onChange={(event) => setProfileForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))} /></label>
                  <button className="portal-primary-button" type="submit" disabled={busyAction === 'profile'}>{busyAction === 'profile' ? 'Saving…' : 'Save Profile'}</button>
                </form>
              </section>
            )}

            {accountView === 'onboarding' && (
              <section className="portal-card account-panel account-onboarding-panel">
                {!onboarding.available ? (
                  <div className="account-empty"><p className="eyebrow">Onboarding</p><h2>Nothing is needed from you right now.</h2><p>If Power Within sends you a private intake or welcome form, it will appear here.</p></div>
                ) : !onboardingEditable ? (
                  <>
                    <header className="account-panel-heading"><div><p className="eyebrow">Onboarding</p><h2>{onboarding.template?.name || 'Your welcome intake'}</h2><p>{onboarding.onboarding?.completionMessage || 'Your responses are safely connected to your care team.'}</p></div><span>{readable(onboarding.onboarding?.status)}</span></header>
                    <dl className="account-response-review">
                      {onboardingFields.map((field) => <div key={field.fieldKey}><dt>{field.label}</dt><dd>{displayAnswer(answers[field.fieldKey])}</dd></div>)}
                    </dl>
                    <p className="account-private-note">{onboarding.onboarding?.submittedAt ? `Submitted ${formatDate(onboarding.onboarding.submittedAt)}` : `Status updated ${formatDate(onboarding.onboarding?.updatedAt)}`} · Contact Power Within through Messages if an answer needs attention.</p>
                  </>
                ) : (
                  <form className="portal-form account-onboarding-form" onSubmit={submitOnboarding}>
                    <header className="account-panel-heading"><div><p className="eyebrow">Onboarding</p><h2>{onboarding.template?.name || 'Your welcome intake'}</h2><p>{onboarding.onboarding?.clientWelcomeMessage || onboarding.template?.welcomeMessage || onboarding.template?.description || 'Share what will help Power Within care for you well.'}</p></div><span>{readable(onboarding.onboarding?.status)}</span></header>
                    <div className="account-onboarding-fields">
                      {onboardingFields.map((field) => <OnboardingField key={field.fieldKey} field={field} value={answers[field.fieldKey]} disabled={Boolean(busyAction)} onChange={(value) => setAnswers((current) => ({ ...current, [field.fieldKey]: value }))} />)}
                    </div>
                    <div className="account-form-actions">
                      <button type="button" onClick={saveOnboardingDraft} disabled={Boolean(busyAction)}>{busyAction === 'onboarding-draft' ? 'Saving…' : 'Save for Later'}</button>
                      <button className="portal-primary-button" type="submit" disabled={Boolean(busyAction)}>{busyAction === 'onboarding-submit' ? 'Submitting…' : 'Submit Onboarding'}</button>
                    </div>
                    <p className="account-private-note">Required fields are marked with *. Your draft stays private to your care team.</p>
                  </form>
                )}
              </section>
            )}

            {accountView === 'security' && (
              <section className="portal-card account-panel account-security-panel">
                <header className="account-panel-heading"><div><p className="eyebrow">Security</p><h2>Change your password</h2><p>Use a unique password you do not use anywhere else.</p></div><span>Last changed {formatDate(client?.passwordChangedAt)}</span></header>
                <form className="portal-form account-password-form" onSubmit={changePassword}>
                  <label><span>Current password</span><input type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} required /></label>
                  <label><span>New password</span><input type="password" autoComplete="new-password" value={passwordForm.newPassword} maxLength="128" onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} required /></label>
                  <label><span>Confirm new password</span><input type="password" autoComplete="new-password" value={passwordForm.confirmPassword} maxLength="128" onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} required /></label>
                  <div className="account-password-checks" aria-label="Password requirements">
                    {passwordChecks.map(([label, complete]) => <span className={complete ? 'is-complete' : ''} key={label}>{complete ? '✓' : '○'} {label}</span>)}
                  </div>
                  <button className="portal-primary-button" type="submit" disabled={busyAction === 'password' || !passwordReady}>{busyAction === 'password' ? 'Changing…' : 'Change Password'}</button>
                </form>
                <aside className="account-security-note"><strong>Your portal is private.</strong><p>Changing your password refreshes your secure session and protects the account from older sign-ins.</p></aside>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default ClientPortalAccount
