import { usePageTitle } from '@/hooks'
import { NotificationsPage } from '@/components/shared/NotificationsPage'

export default function CustomerNotifications() {
  usePageTitle('Notifications')
  return (
    <NotificationsPage
      role="customer"
      title="Notifications"
      description="Booking updates, payment receipts & reminders"
    />
  )
}
