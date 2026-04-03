export type FeatureModalId = 'users' | 'permissions' | 'equipment' | 'logs'

export type ModalSubTabId = 'user' | 'permission' | 'settings' | 'log'

export interface TreeNode {
  id: string
  label: string
  children?: TreeNode[]
}

export interface KpiCard {
  id: string
  label: string
  value: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}

export interface MediaSlide {
  id: string
  title: string
  /** placeholder gradient / solid; 추후 URL로 교체 */
  previewClass: string
}

export interface AlertItem {
  id: string
  time: string
  message: string
  level: 'info' | 'warning' | 'danger'
}

export interface LogLine {
  time: string
  message: string
}

export interface DashboardSnapshot {
  projectName: string
  siteTitle: string
  updatedAtLabel: string
  kpis: KpiCard[]
  media: MediaSlide[]
  alerts: AlertItem[]
  logLines: LogLine[]
}

export interface DashboardAdapter {
  getTreeRoots: () => TreeNode[]
  getDashboard: (siteId: string) => DashboardSnapshot | null
  resolveDefaultSiteId: (roots: TreeNode[]) => string | null
}
