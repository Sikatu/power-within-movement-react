import { createContext, useContext } from 'react'

export const AdminConfirmContext = createContext(null)

export function useAdminConfirm() {
  const confirm = useContext(AdminConfirmContext)

  if (!confirm) {
    throw new Error('useAdminConfirm must be used inside AdminConfirmProvider.')
  }

  return confirm
}
