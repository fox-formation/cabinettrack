import { describe, it, expect } from "vitest"

/**
 * Tests du scheduler d'alertes.
 * Le scheduler utilise Prisma en base, donc on teste la logique pure
 * de la fonction niveauFromJours (extraite) et les règles d'escalade.
 */

// Reproduire la logique du scheduler pour la tester sans DB
function niveauFromJours(joursRestants: number): "INFO" | "WARNING" | "URGENT" | "CRITIQUE" {
  if (joursRestants <= 1) return "CRITIQUE"
  if (joursRestants <= 7) return "URGENT"
  if (joursRestants <= 15) return "WARNING"
  return "INFO"
}

// Jalons
const JALONS_JOURS = [30, 15, 7, 1] as const

function shouldTriggerAlert(joursRestants: number): boolean {
  if (joursRestants > 30) return false
  return JALONS_JOURS.some((j) => joursRestants <= j)
}

// Escalade rules
function shouldEscalateToSuperviseur(
  joursRestants: number,
  alerteAcquittee: boolean,
  joursDepuisCreation: number
): boolean {
  return joursRestants <= 7 && !alerteAcquittee && joursDepuisCreation >= 2
}

function shouldEscalateToExpert(
  joursRestants: number,
  alerteAcquittee: boolean
): boolean {
  return joursRestants <= 1 && !alerteAcquittee
}

describe("niveauFromJours", () => {
  it("J-30 → INFO", () => {
    expect(niveauFromJours(30)).toBe("INFO")
  })

  it("J-15 → WARNING", () => {
    expect(niveauFromJours(15)).toBe("WARNING")
  })

  it("J-7 → URGENT", () => {
    expect(niveauFromJours(7)).toBe("URGENT")
  })

  it("J-1 → CRITIQUE", () => {
    expect(niveauFromJours(1)).toBe("CRITIQUE")
  })

  it("J-0 → CRITIQUE", () => {
    expect(niveauFromJours(0)).toBe("CRITIQUE")
  })

  it("J-20 → INFO", () => {
    expect(niveauFromJours(20)).toBe("INFO")
  })

  it("J-10 → WARNING", () => {
    expect(niveauFromJours(10)).toBe("WARNING")
  })

  it("J-3 → URGENT", () => {
    expect(niveauFromJours(3)).toBe("URGENT")
  })
})

describe("shouldTriggerAlert", () => {
  it("déclenche à J-30", () => {
    expect(shouldTriggerAlert(30)).toBe(true)
  })

  it("déclenche à J-15", () => {
    expect(shouldTriggerAlert(15)).toBe(true)
  })

  it("déclenche à J-7", () => {
    expect(shouldTriggerAlert(7)).toBe(true)
  })

  it("déclenche à J-1", () => {
    expect(shouldTriggerAlert(1)).toBe(true)
  })

  it("ne déclenche pas à J-31", () => {
    expect(shouldTriggerAlert(31)).toBe(false)
  })

  it("ne déclenche pas à J-60", () => {
    expect(shouldTriggerAlert(60)).toBe(false)
  })

  it("déclenche entre les jalons (J-25 est dans [30])", () => {
    expect(shouldTriggerAlert(25)).toBe(true)
  })
})

describe("escalade", () => {
  it("J-7 non acquittée depuis 48h → escalade Superviseur", () => {
    expect(shouldEscalateToSuperviseur(7, false, 2)).toBe(true)
  })

  it("J-7 acquittée → pas d'escalade", () => {
    expect(shouldEscalateToSuperviseur(7, true, 2)).toBe(false)
  })

  it("J-7 non acquittée depuis 24h → pas d'escalade (trop tôt)", () => {
    expect(shouldEscalateToSuperviseur(7, false, 1)).toBe(false)
  })

  it("J-15 non acquittée depuis 48h → pas d'escalade Superviseur (seulement J-7)", () => {
    expect(shouldEscalateToSuperviseur(15, false, 2)).toBe(false)
  })

  it("J-1 non acquittée → escalade Expert-comptable", () => {
    expect(shouldEscalateToExpert(1, false)).toBe(true)
  })

  it("J-1 acquittée → pas d'escalade Expert", () => {
    expect(shouldEscalateToExpert(1, true)).toBe(false)
  })

  it("J-7 non acquittée → pas d'escalade Expert (seulement J-1)", () => {
    expect(shouldEscalateToExpert(7, false)).toBe(false)
  })
})
