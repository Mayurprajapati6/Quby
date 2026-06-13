import { usePageTitle } from '@/hooks'
import { NotificationsPage } from '@/components/shared/NotificationsPage'

export default function OwnerNotifications() {
  usePageTitle('Notifications')
  return (
    <NotificationsPage
      role="owner"
      title="Notifications"
      description="Booking alerts, payments, leaves & updates"
    />
  )
}

