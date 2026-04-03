import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  DashboardAdapter,
  DashboardSnapshot,
  FeatureModalId,
  ModalSubTabId,
  TreeNode,
} from '@/adapters/dashboard.types'
import { FeatureModal } from '@/features/dashboard/FeatureModal'

const HEADER_TABS: { id: FeatureModalId; label: string }[] = [
  { id: 'users', label: '사용자관리' },
  { id: 'permissions', label: '권한' },
  { id: 'equipment', label: '장비설정' },
  { id: 'logs', label: '로그' },
]

function hasDashboardLeaf(id: string, adapter: DashboardAdapter): boolean {
  return adapter.getDashboard(id) !== null
}

function TreeList(props: {
  nodes: TreeNode[]
  depth: number
  expanded: Set<string>
  selectedId: string | null
  adapter: DashboardAdapter
  onToggle: (id: string) => void
  onSelectLeaf: (id: string) => void
}) {
  const { nodes, depth, expanded, selectedId, adapter, onToggle, onSelectLeaf } = props

  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'mt-0.5 space-y-0.5 border-l border-zinc-200/70 pl-2'}>
      {nodes.map((n) => {
        const hasChildren = Boolean(n.children?.length)
        const isOpen = expanded.has(n.id)
        const selected = selectedId === n.id
        const selectable = !hasChildren && hasDashboardLeaf(n.id, adapter)

        return (
          <li key={n.id}>
            <div className="flex items-center gap-1">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggle(n.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
                  aria-expanded={isOpen}
                >
                  <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                </button>
              ) : (
                <span className="inline-block w-7 shrink-0" />
              )}
              <button
                type="button"
                disabled={hasChildren}
                onClick={() => {
                  if (!hasChildren) onSelectLeaf(n.id)
                }}
                className={
                  selected
                    ? 'flex-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-left text-sm font-medium text-white'
                    : hasChildren
                      ? 'flex-1 cursor-default rounded-lg px-2 py-1.5 text-left text-sm font-medium text-zinc-800'
                      : selectable
                        ? 'flex-1 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100'
                        : 'flex-1 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-400 hover:bg-zinc-50'
                }
              >
                {n.label}
              </button>
            </div>
            {hasChildren && isOpen && n.children ? (
              <TreeList
                nodes={n.children}
                depth={depth + 1}
                expanded={expanded}
                selectedId={selectedId}
                adapter={adapter}
                onToggle={onToggle}
                onSelectLeaf={onSelectLeaf}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function toneBorder(t: DashboardSnapshot['kpis'][number]['tone']) {
  switch (t) {
    case 'success':
      return 'border-emerald-100 bg-emerald-50/60'
    case 'warning':
      return 'border-amber-100 bg-amber-50/60'
    case 'danger':
      return 'border-red-100 bg-red-50/60'
    default:
      return 'border-zinc-200 bg-white'
  }
}

function toneText(t: DashboardSnapshot['kpis'][number]['tone']) {
  switch (t) {
    case 'success':
      return 'text-emerald-900'
    case 'warning':
      return 'text-amber-950'
    case 'danger':
      return 'text-red-900'
    default:
      return 'text-zinc-900'
  }
}

function alertDot(level: DashboardSnapshot['alerts'][number]['level']) {
  switch (level) {
    case 'danger':
      return 'bg-red-500'
    case 'warning':
      return 'bg-amber-500'
    default:
      return 'bg-zinc-400'
  }
}

export function DashboardPage(props: { adapter: DashboardAdapter }) {
  const { adapter } = props
  const roots = useMemo(() => adapter.getTreeRoots(), [adapter])

  const defaultId = useMemo(() => adapter.resolveDefaultSiteId(roots) ?? null, [adapter, roots])

  const [selectedId, setSelectedId] = useState<string | null>(defaultId)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    s.add('sys-root')
    s.add('site-seocho')
    return s
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [modalFeature, setModalFeature] = useState<FeatureModalId>('users')
  const [modalSubTab, setModalSubTab] = useState<ModalSubTabId>('user')

  const [mediaIndex, setMediaIndex] = useState(0)

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement | null>(null)

  const snapshot = selectedId ? adapter.getDashboard(selectedId) : null

  const selectSite = (id: string) => {
    setSelectedId(id)
    setMediaIndex(0)
  }

  useEffect(() => {
    if (!notifOpen) return
    const onDown = (e: MouseEvent) => {
      const el = notifRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [notifOpen])

  const openFeature = (id: FeatureModalId) => {
    setModalFeature(id)
    setModalSubTab('user')
    setModalOpen(true)
    setNotifOpen(false)
  }

  const onLogout = () => {
    if (window.confirm('로그아웃할까요?')) {
      window.alert('(목업) 로그아웃 처리')
    }
  }

  const onExit = () => {
    if (window.confirm('프로그램을 종료할까요?')) {
      window.alert('(목업) 종료')
    }
  }

  return (
    <div className="flex min-h-dvh text-zinc-900">
      <aside className="hidden w-72 shrink-0 border-r border-zinc-200/80 bg-white/90 backdrop-blur md:block">
        <div className="border-b border-zinc-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">현장 선택</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">통합계측</p>
        </div>
        <div className="max-h-[calc(100dvh-64px)] overflow-auto px-3 py-3">
          <TreeList
            nodes={roots}
            depth={0}
            expanded={expanded}
            selectedId={selectedId}
            adapter={adapter}
            onToggle={(id) => {
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onSelectLeaf={selectSite}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-xs font-medium text-zinc-500">
                  프로젝트 <span className="text-zinc-800">· {snapshot?.projectName ?? '—'}</span>
                </p>
                <span className="hidden text-zinc-300 sm:inline">|</span>
                <p className="text-xs text-zinc-500">
                  갱신 <span className="text-zinc-800">{snapshot?.updatedAtLabel ?? '—'}</span>
                </p>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {HEADER_TABS.map((t) => {
                  const active = modalOpen && modalFeature === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openFeature(t.id)}
                      className={
                        active
                          ? 'rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm'
                          : 'rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50'
                      }
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>

              <h1 className="mt-3 truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                {snapshot?.siteTitle ?? '현장을 선택하세요'}
              </h1>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setNotifOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                    aria-expanded={notifOpen}
                  >
                    <span aria-hidden>🔔</span>
                    알림
                    {snapshot?.alerts?.length ? (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {snapshot.alerts.length}
                      </span>
                    ) : null}
                  </button>
                  {notifOpen ? (
                  <div className="absolute right-0 z-40 mt-2 w-[min(92vw,360px)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl shadow-zinc-900/10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">최근 알림</p>
                    <div className="mt-2 max-h-72 space-y-2 overflow-auto">
                      {(snapshot?.alerts ?? []).length ? (
                        snapshot!.alerts.map((a) => (
                          <div
                            key={a.id}
                            className="flex gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-2"
                          >
                            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${alertDot(a.level)}`} />
                            <div className="min-w-0">
                              <p className="text-xs text-zinc-500">{a.time}</p>
                              <p className="mt-0.5 text-sm text-zinc-900">{a.message}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">알림이 없습니다.</p>
                      )}
                    </div>
                  </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  로그아웃
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  종료
                </button>
              </div>

              <p className="text-right text-sm font-medium text-zinc-800 sm:max-w-[420px]">
                현장 <span className="text-zinc-900">{snapshot?.siteTitle ?? '—'}</span>
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-4 px-4 py-4 sm:px-6">
          {!snapshot ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-600">
              이 항목에는 대시보드 데이터가 없습니다. 하위 현장을 선택해 주세요.
            </div>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {snapshot.kpis.map((k) => (
                  <div
                    key={k.id}
                    className={`rounded-2xl border p-4 shadow-sm shadow-zinc-900/5 ${toneBorder(k.tone)}`}
                  >
                    <p className="text-xs font-medium text-zinc-500">{k.label}</p>
                    <p className={`mt-2 text-2xl font-semibold tracking-tight ${toneText(k.tone)}`}>
                      {k.value}
                    </p>
                  </div>
                ))}
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        현장 미디어
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        단일 이미지 또는 다중 탭(현장 설정에 따라 자동)
                      </p>
                    </div>
                    {snapshot.media.length > 1 ? (
                      <div className="flex flex-wrap gap-1">
                        {snapshot.media.map((m, idx) => {
                          const active =
                            idx === Math.min(mediaIndex, Math.max(0, snapshot.media.length - 1))
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setMediaIndex(idx)}
                              className={
                                active
                                  ? 'rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white'
                                  : 'rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50'
                              }
                            >
                              {m.title}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`mt-4 flex aspect-16/10 w-full items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 ${
                      snapshot.media[
                        Math.min(mediaIndex, Math.max(0, snapshot.media.length - 1))
                      ]?.previewClass ?? 'bg-zinc-100'
                    }`}
                  >
                    <p className="rounded-xl bg-white/70 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm">
                      {snapshot.media[
                        Math.min(mediaIndex, Math.max(0, snapshot.media.length - 1))
                      ]?.title ?? '미디어'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">이벤트</p>
                  <div className="mt-3 space-y-2">
                    {snapshot.alerts.map((a) => (
                      <div
                        key={a.id}
                        className="flex gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3"
                      >
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${alertDot(a.level)}`} />
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-500">{a.time}</p>
                          <p className="mt-1 text-sm text-zinc-900">{a.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm shadow-zinc-900/5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-900">시스템 로그</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      데이터 편집
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                    >
                      내보내기
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-zinc-100">
                  {snapshot.logLines.map((l, idx) => (
                    <div key={`${l.time}-${idx}`} className="flex gap-4 px-4 py-2 text-sm">
                      <span className="w-24 shrink-0 font-mono text-xs text-zinc-500">{l.time}</span>
                      <span className="text-zinc-800">{l.message}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <FeatureModal
        open={modalOpen}
        feature={modalFeature}
        subTab={modalSubTab}
        onClose={() => setModalOpen(false)}
        onSubTabChange={setModalSubTab}
      />

      {/* 모바일: 하단에서 트리 진입 */}
      <div className="fixed bottom-3 left-3 right-3 z-30 md:hidden">
        <details className="rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg shadow-zinc-900/10 backdrop-blur">
          <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">
            현장 목록 열기
          </summary>
          <div className="mt-3 max-h-56 overflow-auto pr-1">
            <TreeList
              nodes={roots}
              depth={0}
              expanded={expanded}
              selectedId={selectedId}
              adapter={adapter}
              onToggle={(id) => {
                setExpanded((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }}
              onSelectLeaf={selectSite}
            />
          </div>
        </details>
      </div>
    </div>
  )
}
