export type RundownItem = {
  id: string
  rundownId: string
  projectId: string
  titleKey: string
  label: string | null
  position: number
  data: Record<string, unknown>
}
