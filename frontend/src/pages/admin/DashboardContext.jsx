import { createContext, useContext } from 'react'

/**
 * Shared state for the admin dashboard's tab bodies.
 *
 * The six tabs were previously inlined in AdminDashboard.jsx, reading directly
 * from the component's closure. Several of them touch 30+ bindings, so passing
 * those individually would have traded one large file for an unreadable prop
 * list. A context keeps each tab a plain component while leaving all state
 * owned by AdminDashboard, so this is a pure structural move: nothing about
 * where state lives or when it updates has changed.
 */
const DashboardContext = createContext(null)

export function DashboardProvider({ value, children }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within a DashboardProvider')
  return ctx
}

export default DashboardContext
