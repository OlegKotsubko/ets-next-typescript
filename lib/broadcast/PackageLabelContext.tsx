'use client'

import { createContext, useContext } from 'react'

const PackageLabelContext = createContext<string | null>(null)

export function PackageLabelProvider({
  packageLabel, children,
}: { packageLabel: string; children: React.ReactNode }) {
  return (
    <PackageLabelContext.Provider value={packageLabel}>
      {children}
    </PackageLabelContext.Provider>
  )
}

export function usePackageLabel(): string {
  const value = useContext(PackageLabelContext)
  if (!value) throw new Error('usePackageLabel must be used within a PackageLabelProvider')
  return value
}
