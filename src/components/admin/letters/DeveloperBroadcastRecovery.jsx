import { useState } from 'react'
import { processDueLetterBroadcasts } from '../../../lib/nativeApi.js'

export default function DeveloperBroadcastRecovery({
  adminUser,
  capabilities,
  onComplete,
  onError,
}) {
  const [working, setWorking] = useState(false)

  if (adminUser?.role !== 'developer' || capabilities?.recovery !== true) return null

  async function handleRecoveryCheck() {
    setWorking(true)
    try {
      const response = await processDueLetterBroadcasts()
      await onComplete?.(response)
    } catch (error) {
      onError?.(error)
    } finally {
      setWorking(false)
    }
  }

  return (
    <button type="button" onClick={handleRecoveryCheck} disabled={working}>
      {working ? 'Checking…' : 'Run recovery check'}
    </button>
  )
}
