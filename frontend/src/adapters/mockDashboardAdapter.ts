import type { DashboardAdapter, DashboardSnapshot, TreeNode } from './dashboard.types'
import { MOCK_DASHBOARDS, MOCK_TREE } from '@/mocks/dashboardSeed'

function firstLeafId(nodes: TreeNode[]): string | null {
  for (const n of nodes) {
    if (n.children?.length) {
      const inner = firstLeafId(n.children)
      if (inner) return inner
    } else {
      return n.id
    }
  }
  return null
}

export const mockDashboardAdapter: DashboardAdapter = {
  getTreeRoots: () => MOCK_TREE,
  getDashboard: (siteId: string): DashboardSnapshot | null =>
    MOCK_DASHBOARDS[siteId] ?? null,
  resolveDefaultSiteId: (roots: TreeNode[]) => firstLeafId(roots),
}
