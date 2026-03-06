"use client"

import Sidebar from "./Sidebar"
import { ToastProvider } from "@/components/ui/Toast"
import ThemeProvider from "@/components/ThemeProvider"

interface DashboardShellProps {
  children: React.ReactNode
  alertesCount: number
  emailsNonLus: number
}

export default function DashboardShell({ children, alertesCount, emailsNonLus }: DashboardShellProps) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen" style={{ backgroundColor: "#F9F7F4" }}>
          <Sidebar alertesCount={alertesCount} emailsNonLus={emailsNonLus} />
          <div className="pl-64">
            {children}
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  )
}
