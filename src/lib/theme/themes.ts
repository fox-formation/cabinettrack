export interface Theme {
  sidebar: string
  sidebarText: string
  accent: string
}

export const THEMES: Record<string, Theme> = {
  orange: { sidebar: "#E8936A", sidebarText: "#ffffff", accent: "#D4724A" },
  slate:  { sidebar: "#4A5568", sidebarText: "#ffffff", accent: "#2D3748" },
  sage:   { sidebar: "#6B8F71", sidebarText: "#ffffff", accent: "#4A6B50" },
  taupe:  { sidebar: "#8B7355", sidebarText: "#ffffff", accent: "#6B5635" },
  navy:   { sidebar: "#2C3E6B", sidebarText: "#ffffff", accent: "#1A2A4A" },
  rose:   { sidebar: "#C4808A", sidebarText: "#ffffff", accent: "#A66070" },
}

export const THEME_LABELS: Record<string, string> = {
  orange: "Orange",
  slate:  "Ardoise",
  sage:   "Sauge",
  taupe:  "Taupe",
  navy:   "Marine",
  rose:   "Rose",
}

export const THEME_KEYS = Object.keys(THEMES) as (keyof typeof THEMES)[]

export const DEFAULT_THEME = "orange"

export const STORAGE_KEY = "cabinettrack-theme"
