"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

interface SidebarProps {
  alertesCount: number
  emailsNonLus: number
}

export default function Sidebar({ alertesCount, emailsNonLus }: SidebarProps) {
  const pathname = usePathname()
  const [showHelp, setShowHelp] = useState(false)

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Tableau de bord",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: "/dossiers",
      label: "Dossiers",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
    {
      href: "/agenda",
      label: "Agenda",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: "/alertes",
      label: "Alertes",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      badge: alertesCount,
    },
    {
      href: "/emails",
      label: "Emails",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      badge: emailsNonLus,
    },
    {
      href: "/stats/avancement",
      label: "Statistiques",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      href: "/collaborateurs",
      label: "Collaborateurs",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: "/archives",
      label: "Archives",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
  ]

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col"
      style={{
        backgroundColor: "var(--sidebar-bg, #E8936A)",
        color: "var(--sidebar-text, #ffffff)",
        transition: "background-color 0.3s ease",
      }}
    >
      {/* Logo header */}
      <div
        className="flex h-16 items-center gap-3 px-6"
        style={{
          backgroundColor: "var(--accent, #D4724A)",
          transition: "background-color 0.3s ease",
        }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">
          CT
        </div>
        <span className="text-lg font-bold">CabinetTrack</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
              style={{
                backgroundColor: active ? "rgba(255,255,255,0.2)" : "transparent",
                color: "var(--sidebar-text, #ffffff)",
                opacity: active ? 1 : 0.85,
                transition: "background-color 0.2s ease, opacity 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Settings link */}
      <div className="px-3 pb-2">
        <Link
          href="/parametres"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
          style={{
            color: "var(--sidebar-text, #ffffff)",
            opacity: pathname === "/parametres" ? 1 : 0.7,
            backgroundColor: pathname === "/parametres" ? "rgba(255,255,255,0.2)" : "transparent",
            transition: "background-color 0.2s ease, opacity 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (pathname !== "/parametres") e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"
          }}
          onMouseLeave={(e) => {
            if (pathname !== "/parametres") e.currentTarget.style.backgroundColor = "transparent"
          }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Paramètres</span>
        </Link>
      </div>

      {/* Aide button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowHelp(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
          style={{
            color: "var(--sidebar-text, #ffffff)",
            opacity: 0.7,
            backgroundColor: "transparent",
            transition: "background-color 0.2s ease, opacity 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.opacity = "1" }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.opacity = "0.7" }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Aide</span>
        </button>
      </div>

      {/* User footer */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-medium">
            U
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Utilisateur</p>
            <p className="truncate text-xs" style={{ opacity: 0.7 }}>Cabinet</p>
          </div>
        </div>
      </div>

      {/* Panneau Aide */}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </aside>
  )
}

// ──────────────────────────────────────────────
// Panneau d'aide
// ──────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    title: "Tableau de bord",
    content: `Le tableau de bord affiche une vue d'ensemble de votre cabinet : avancement global des bilans, dossiers en retard, alertes actives et statistiques cl\u00e9s.`,
  },
  {
    title: "Dossiers",
    items: [
      { label: "Onglet Bilan", desc: "Liste de tous les dossiers avec avancement, \u00e9tapes et commentaires. Cliquez sur les indicateurs color\u00e9s pour changer le statut d'une \u00e9tape." },
      { label: "Onglet Courant", desc: "Suivi mensuel de la saisie comptable courante pour chaque dossier." },
      { label: "Onglet R\u00e9vision", desc: "Dossiers en r\u00e9vision annuelle avec suivi des contacts client." },
      { label: "Onglet T\u00e2ches", desc: "T\u00e2ches exceptionnelles ponctuelles hors bilan/courant." },
    ],
  },
  {
    title: "Raccourcis clavier (tableau Bilan)",
    items: [
      { label: "\u2191 \u2193", desc: "Naviguer entre les dossiers" },
      { label: "\u2190 \u2192", desc: "Se d\u00e9placer entre les \u00e9tapes" },
      { label: "0 / 1 / 2 / 3 / 4", desc: "D\u00e9finir le niveau (0%, 25%, 50%, 75%, 100%)" },
      { label: "Entr\u00e9e", desc: "Ouvrir le panneau d'\u00e9tapes complet" },
      { label: "Echap", desc: "Quitter le mode navigation" },
    ],
  },
  {
    title: "Fiche dossier",
    items: [
      { label: "G\u00e9n\u00e9ral", desc: "Informations du dossier, contacts, collaborateurs, adresses email." },
      { label: "Comptabilit\u00e9", desc: "D\u00e9tails comptables, logiciel utilis\u00e9, p\u00e9riodicit\u00e9 de saisie." },
      { label: "Bilan & \u00c9tapes", desc: "14 \u00e9tapes pond\u00e9r\u00e9es du bilan avec barre d'avancement." },
      { label: "TVA", desc: "Grille mensuelle color\u00e9e du suivi TVA (vert = fait, bleu = client, gris = N/A)." },
      { label: "IS & Imp\u00f4ts", desc: "Acomptes IS, CFE, CVAE, TVS, taxe fonci\u00e8re et soldes." },
      { label: "\u00c9ch\u00e9ances", desc: "Liste des \u00e9ch\u00e9ances fiscales et juridiques calcul\u00e9es automatiquement." },
      { label: "Historique \u00e9changes", desc: "Tableau des appels et contacts avec le client (sens, sujet, r\u00e9sum\u00e9)." },
      { label: "Travaux", desc: "Outils IA : agent d'analyse de balance par cycle comptable." },
      { label: "Notes", desc: "Notes par cycle comptable (11 cycles) + commentaires g\u00e9n\u00e9raux." },
    ],
  },
  {
    title: "Indicateurs d'avancement",
    items: [
      { label: "Carr\u00e9 gris clair", desc: "Non commenc\u00e9 (0%)" },
      { label: "Carr\u00e9 gris fonc\u00e9", desc: "D\u00e9marr\u00e9 (25%)" },
      { label: "Carr\u00e9 gris moyen", desc: "En cours (50%)" },
      { label: "Carr\u00e9 orange", desc: "Avanc\u00e9 (75%)" },
      { label: "Carr\u00e9 vert", desc: "Termin\u00e9 (100%)" },
      { label: "Carr\u00e9 jaune", desc: "\u00c9tape note / commentaire (non compt\u00e9 dans le %)" },
    ],
  },
  {
    title: "\u00c9changes client",
    content: `Depuis le tableau Bilan, cliquez sur l'ic\u00f4ne t\u00e9l\u00e9phone pour enregistrer un \u00e9change. Indiquez le sens (sortant = vous avez appel\u00e9, entrant = le client a appel\u00e9), le sujet, un r\u00e9sum\u00e9, le statut (RAS / Demande client / Action requise) et la date du prochain contact pr\u00e9vu.`,
  },
  {
    title: "Alertes",
    content: `La page Alertes affiche un tableau de toutes les \u00e9ch\u00e9ances en retard ou \u00e0 venir. Les colonnes repr\u00e9sentent les types d'obligation (TVA, IS, AGO...). Cliquez sur le bouton \"\u2713 Fait\" pour marquer une \u00e9ch\u00e9ance comme r\u00e9alis\u00e9e.`,
  },
  {
    title: "Notes par cycle",
    content: `Chaque dossier poss\u00e8de 11 espaces de notes organis\u00e9s par cycle comptable : G\u00e9n\u00e9ral, Tr\u00e9sorerie, Achats/Fournisseurs, Charges Externes, Ventes/Clients, Stock, Immobilisations, Social/Paie, \u00c9tat, Capitaux Propres, Autres. Acc\u00e9dez-y via l'ic\u00f4ne crayon dans le tableau ou l'onglet Notes de la fiche dossier.`,
  },
  {
    title: "Agenda",
    content: `L'agenda affiche vos \u00e9ch\u00e9ances dans un calendrier mensuel. Les pastilles color\u00e9es indiquent le type (\ud83d\udfe2 fait, \ud83d\udfe1 \u00e0 venir, \ud83d\udd34 en retard). Cliquez sur un jour pour voir le d\u00e9tail.`,
  },
  {
    title: "Statistiques",
    content: `La page Statistiques pr\u00e9sente l'avancement global par collaborateur, par cabinet et par p\u00e9riode. Utilisez les filtres pour affiner la vue.`,
  },
]

function HelpPanel({ onClose }: { onClose: () => void }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Aide</h2>
                <p className="text-xs text-gray-500">Guide d&apos;utilisation CabinetTrack</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-1">
          {HELP_SECTIONS.map((section, idx) => {
            const isOpen = expandedIdx === idx
            return (
              <div key={idx} className="rounded-lg border border-gray-200">
                <button
                  onClick={() => setExpandedIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  <span>{section.title}</span>
                  <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t px-4 py-3">
                    {section.content && (
                      <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
                    )}
                    {section.items && (
                      <ul className="space-y-2">
                        {section.items.map((item, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium text-gray-800">{item.label}</span>
                            <span className="text-gray-500"> — {item.desc}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <p className="text-xs text-gray-400 text-center">
            CabinetTrack v1.0 — Logiciel de gestion pour cabinets d&apos;expertise comptable
          </p>
        </div>
      </div>
    </div>
  )
}
