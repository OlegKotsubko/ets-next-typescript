export type ThemeColor = { name: string; code: string }

export type Theme = {
  id: number
  projectId: number
  name: string
  isActive: boolean
  colors: ThemeColor[]
  assetIds: number[]
}
