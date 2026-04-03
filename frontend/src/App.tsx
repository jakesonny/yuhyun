import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { mockDashboardAdapter } from '@/adapters/mockDashboardAdapter'

export default function App() {
  return <DashboardPage adapter={mockDashboardAdapter} />
}
