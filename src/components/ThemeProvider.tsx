"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { THEMES, DEFAULT_THEME, STORAGE_KEY, type Theme } from "@/lib/theme/themes"

interface ThemeContextValue {
  themeKey: string
  theme: Theme
  setTheme: (key: string) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  themeKey: DEFAULT_THEME,
  theme: THEMES[DEFAULT_THEME],
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

function applyThemeVars(theme: Theme) {
  const root = document.documentElement
  root.style.setProperty("--sidebar-bg", theme.sidebar)
  root.style.setProperty("--sidebar-text", theme.sidebarText)
  root.style.setProperty("--accent", theme.accent)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState(DEFAULT_THEME)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && THEMES[stored]) {
      setThemeKey(stored)
      applyThemeVars(THEMES[stored])
    } else {
      applyThemeVars(THEMES[DEFAULT_THEME])
    }
  }, [])

  const setTheme = useCallback((key: string) => {
    if (!THEMES[key]) return
    setThemeKey(key)
    localStorage.setItem(STORAGE_KEY, key)
    applyThemeVars(THEMES[key])
  }, [])

  const value: ThemeContextValue = {
    themeKey,
    theme: THEMES[themeKey] ?? THEMES[DEFAULT_THEME],
    setTheme,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
