import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute, PublicRoute } from '@/components/layout/ProtectedRoute'
import { PageSkeleton } from '@/components/shared'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import { ForgotPasswordPage, ResetPasswordPage, StaffSetupPage } from '@/pages/auth/OtherAuthPages'
import { useAuthStore } from './stores'
import { getRoleDashboard } from './lib/utils'

// ── Public
const ExplorePage        = lazy(() => import('@/pages/public/ExplorePage'))
const BusinessPublicPage = lazy(() => import('@/pages/public/BusinessPublicPage'))
const LandingPage        = lazy(() => import('@/pages/public/LandingPage'))
const NotFoundPage       = lazy(() => import('@/pages/public/NotFoundPage'))
const UnauthorizedPage   = lazy(() => import('@/pages/public/UnauthorizedPage'))

// ── Customer
const CustomerDashboard      = lazy(() => import('@/pages/customer/CustomerDashboard'))
const CustomerExplore        = lazy(() => import('@/pages/customer/CustomerExplore'))
const CustomerBusinessDetail = lazy(() => import('@/pages/customer/CustomerBusinessDetail'))
const BookingFlow            = lazy(() => import('@/pages/customer/BookingFlow'))
const MyBookings             = lazy(() => import('@/pages/customer/MyBookings'))
const BookingDetail          = lazy(() => import('@/pages/customer/BookingDetail'))
const CustomerReviews        = lazy(() => import('@/pages/customer/CustomerReviews'))
const CustomerNotifications  = lazy(() => import('@/pages/customer/CustomerNotifications'))
const CustomerProfile        = lazy(() => import('@/pages/customer/CustomerProfile'))

// ── Staff
const StaffDashboard     = lazy(() => import('@/pages/staff/StaffDashboard'))
const StaffQueue         = lazy(() => import('@/pages/staff/StaffQueue'))
//const StaffScan          = lazy(() => import('@/pages/staff/StaffScan'))
const StaffBookings      = lazy(() => import('@/pages/staff/StaffBookings'))
const StaffBookingDetail = lazy(() => import('@/pages/staff/StaffBookings').then(m => ({ default: m.StaffBookingDetail })))
const StaffProfile       = lazy(() => import('@/pages/staff/StaffProfile'))
const StaffLeave         = lazy(() => import('@/pages/staff/StaffOtherPages').then(m => ({ default: m.StaffLeave })))
const StaffHolidays      = lazy(() => import('@/pages/staff/StaffOtherPages').then(m => ({ default: m.StaffHolidays })))
const StaffReviews       = lazy(() => import('@/pages/staff/StaffOtherPages').then(m => ({ default: m.StaffReviews })))
const StaffNotifications = lazy(() => import('@/pages/staff/StaffOtherPages').then(m => ({ default: m.StaffNotifications })))


// ── Owner core
const OwnerDashboard     = lazy(() => import('@/pages/owner/OwnerDashboard'))
const OwnerBusinesses    = lazy(() => import('@/pages/owner/OwnerBusinesses'))
const CreateBusiness     = lazy(() => import('@/pages/owner/CreateBusiness'))
const EditBusiness       = lazy(() => import('@/pages/owner/CreateBusiness').then(m => ({ default: m.EditBusiness })))
const OwnerStaff         = lazy(() => import('@/pages/owner/OwnerStaff'))
const OwnerLeave         = lazy(() => import('@/pages/owner/OwnerLeave'))
const OwnerBookings      = lazy(() => import('@/pages/owner/OwnerBookings'))
//const OwnerBookingDetail = lazy(() => import('@/pages/owner/OwnerBookings').then(m => ({ default: m.OwnerBookingDetail })))
const OwnerReviews       = lazy(() => import('@/pages/owner/OwnerReviews'))
const OwnerNotifications = lazy(() => import('@/pages/owner/OwnerNotifications'))  // FIXED: uncommented
const OwnerProfile       = lazy(() => import('@/pages/owner/OwnerProfile'))
const OwnerHoliday       = lazy(() => import('@/pages/owner/OwnerHoliday'))


// ── Admin
const AdminDashboard        = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminBusinesses       = lazy(() => import('@/pages/admin/AdminBusinesses'))
const AdminBusinessDetail   = lazy(() => import('@/pages/admin/AdminBusinesses').then(m => ({ default: m.AdminBusinessDetail })))
const AdminOwners           = lazy(() => import('@/pages/admin/AdminOwners'))
const AdminOwnerDetail      = lazy(() => import('@/pages/admin/AdminOwners').then(m => ({ default: m.AdminOwnerDetail })))
const AdminCustomers        = lazy(() => import('@/pages/admin/AdminOwners').then(m => ({ default: m.AdminCustomers })))
const AdminCustomerDetail   = lazy(() => import('@/pages/admin/AdminOwners').then(m => ({ default: m.AdminCustomerDetail })))
const AdminStaff            = lazy(() => import('@/pages/admin/AdminOwners').then(m => ({ default: m.AdminStaff })))
const AdminStaffDetail      = lazy(() => import('@/pages/admin/AdminOwners').then(m => ({ default: m.AdminStaffDetail })))
const AdminPlatformServices = lazy(() => import('@/pages/admin/AdminPlatformServices'))
const AdminProfile          = lazy(() => import('@/pages/admin/AdminPlatformServices').then(m => ({ default: m.AdminProfile })))

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
}

function AutoRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated || !user) return <S><LandingPage /></S>
  return <Navigate to={getRoleDashboard(user.role)} replace />
}

const router = createBrowserRouter([
  { element: <PublicRoute />, children: [
    { path: '/login',           element: <LoginPage /> },
    { path: '/register',        element: <RegisterPage /> },
    { path: '/forgot-password', element: <ForgotPasswordPage /> },
    { path: '/reset-password',  element: <ResetPasswordPage /> },
  ]},

  { path: '/staff/setup', element: <StaffSetupPage /> },
  { path: '/',                 element: <AutoRedirect /> },
  { path: '/explore',          element: <S><ExplorePage /></S> },
  { path: '/businesses/:slug', element: <S><BusinessPublicPage /></S> },
  { path: '/unauthorized',     element: <S><UnauthorizedPage /></S> },
  { path: '/404',              element: <S><NotFoundPage /></S> },

  // ── CUSTOMER
  { element: <ProtectedRoute roles={['CUSTOMER']} />, children: [{ element: <AppShell />, children: [
    { path: '/customer/dashboard',        element: <S><CustomerDashboard /></S> },
    { path: '/customer/explore',          element: <S><CustomerExplore /></S> },
    { path: '/customer/business/:slug',   element: <S><CustomerBusinessDetail /></S> },
    { path: '/customer/book/:businessId', element: <S><BookingFlow /></S> },
    { path: '/customer/bookings',         element: <S><MyBookings /></S> },
    { path: '/customer/bookings/:id',     element: <S><BookingDetail /></S> },
    { path: '/customer/reviews',          element: <S><CustomerReviews /></S> },
    { path: '/customer/notifications',    element: <S><CustomerNotifications /></S> },
    { path: '/customer/profile',          element: <S><CustomerProfile /></S> },
    { path: '/customer', element: <Navigate to="/customer/dashboard" replace /> },
  ]}]},

  // ── STAFF
  { element: <ProtectedRoute roles={['STAFF']} />, children: [{ element: <AppShell />, children: [
    { path: '/staff/dashboard',           element: <S><StaffDashboard /></S> },
    { path: '/staff/queue',               element: <S><StaffQueue /></S> },
    //{ path: '/staff/scan',                element: <S><StaffScan /></S> },
    { path: '/staff/bookings',            element: <S><StaffBookings /></S> },
    { path: '/staff/bookings/:bookingId', element: <S><StaffBookingDetail /></S> },
    { path: '/staff/leave',               element: <S><StaffLeave /></S> },
    { path: '/staff/holidays',            element: <S><StaffHolidays /></S> },
    { path: '/staff/reviews',             element: <S><StaffReviews /></S> },
    { path: '/staff/notifications',       element: <S><StaffNotifications /></S> },
    { path: '/staff/profile',             element: <S><StaffProfile /></S> },
    { path: '/staff', element: <Navigate to="/staff/dashboard" replace /> },
  ]}]},

  // ── OWNER
  { element: <ProtectedRoute roles={['OWNER']} />, children: [{ element: <AppShell />, children: [
    // Owner core
    { path: '/owner/dashboard',                    element: <S><OwnerDashboard /></S> },
    { path: '/owner/businesses',                   element: <S><OwnerBusinesses /></S> },
    { path: '/owner/businesses/new',               element: <S><CreateBusiness /></S> },
    { path: '/owner/businesses/:id/edit',          element: <S><EditBusiness /></S> },
    { path: '/owner/staff',                        element: <S><OwnerStaff /></S> },
    { path: '/owner/leave',                        element: <S><OwnerLeave /></S> },
    { path: '/owner/bookings',                     element: <S><OwnerBookings /></S> },
    //{ path: '/owner/bookings/:bookingId',          element: <S><OwnerBookingDetail /></S> },
    { path: '/owner/reviews',                      element: <S><OwnerReviews /></S> },
    { path: '/owner/notifications',                element: <S><OwnerNotifications /></S> },
    { path: '/owner/profile',                      element: <S><OwnerProfile /></S> },
    { path: '/owner/holidays',                     element: <S><OwnerHoliday /></S> },

  

    { path: '/owner', element: <Navigate to="/owner/dashboard" replace /> },
  ]}]},

  // ── ADMIN
  { element: <ProtectedRoute roles={['ADMIN']} />, children: [{ element: <AppShell />, children: [
    { path: '/admin/dashboard',                    element: <S><AdminDashboard /></S> },
    { path: '/admin/businesses',                   element: <S><AdminBusinesses /></S> },
    { path: '/admin/businesses/:businessId',       element: <S><AdminBusinessDetail /></S> },
    { path: '/admin/users/owners',                 element: <S><AdminOwners /></S> },
    { path: '/admin/users/owners/:ownerId',        element: <S><AdminOwnerDetail /></S> },
    { path: '/admin/users/customers',              element: <S><AdminCustomers /></S> },
    { path: '/admin/users/customers/:customerId',  element: <S><AdminCustomerDetail /></S> },
    { path: '/admin/users/staff',                  element: <S><AdminStaff /></S> },
    { path: '/admin/users/staff/:staffId',         element: <S><AdminStaffDetail /></S> },
    { path: '/admin/platform-services',            element: <S><AdminPlatformServices /></S> },
    { path: '/admin/profile',                      element: <S><AdminProfile /></S> },
    { path: '/admin', element: <Navigate to="/admin/dashboard" replace /> },
  ]}]},

  { path: '*', element: <S><NotFoundPage /></S> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
