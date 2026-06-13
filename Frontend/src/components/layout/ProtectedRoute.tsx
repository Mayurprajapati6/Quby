import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores'
import { getRoleDashboard } from '@/lib/utils'
import type { UserRole } from '@/types'
import { PageSkeleton } from '@/components/shared'

const UnauthorizedPage = lazy(() => import('@/pages/public/UnauthorizedPage'))

interface ProtectedRouteProps {
  roles?: UserRole[] // ✅ support multiple roles
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  // 🔐 NOT LOGGED IN → go to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // 🚫 WRONG ROLE → show unauthorized page
  if (roles && !roles.includes(user.role)) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <UnauthorizedPage />
      </Suspense>
    )
  }

  // ✅ ACCESS GRANTED
  return <Outlet />
}

// 🌐 PUBLIC ROUTE (login/register pages)
export function PublicRoute() {
  const { isAuthenticated, user } = useAuthStore()

  if (isAuthenticated && user) {
    return <Navigate to={getRoleDashboard(user.role)} replace />
  }

  return <Outlet />
}