const usableScanStatuses = new Set(['clean', 'disabled'])
const knownScanStatuses = new Set(['disabled', 'pending', 'clean', 'blocked', 'failed'])

function getInitialScanState(scanner = 'disabled') {
  const normalized = String(scanner || 'disabled').trim().toLowerCase()
  if (normalized === 'disabled') {
    return {
      status: 'disabled',
      message: 'Malware scanning is not configured for this environment.',
      scannedAt: null,
    }
  }

  return {
    status: 'pending',
    message: `Waiting for the ${normalized} malware scanner adapter.`,
    scannedAt: null,
  }
}

function normalizeScanStatus(value) {
  const normalized = String(value || 'disabled').trim().toLowerCase()
  return knownScanStatuses.has(normalized) ? normalized : 'failed'
}

function isAssetUsable(asset) {
  return Boolean(asset && asset.status === 'active' && usableScanStatuses.has(normalizeScanStatus(asset.scan_status)))
}

function assertAssetUsable(asset) {
  if (!asset || asset.status !== 'active') {
    const error = new Error('Active asset not found.')
    error.statusCode = 404
    throw error
  }

  const status = normalizeScanStatus(asset.scan_status)
  if (!usableScanStatuses.has(status)) {
    const error = new Error(status === 'blocked'
      ? 'This asset was blocked by the security scan.'
      : 'This asset is not available until its security scan is complete.')
    error.statusCode = 423
    throw error
  }

  return asset
}

module.exports = {
  assertAssetUsable,
  getInitialScanState,
  isAssetUsable,
  knownScanStatuses,
  normalizeScanStatus,
  usableScanStatuses,
}
