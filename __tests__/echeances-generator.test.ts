import { describe, it, expect } from "vitest"
import {
  calculerEcheancesTVA,
  calculerEcheancesIS,
  calculerEcheancesJuridiques,
} from "@/lib/echeances/generator"
import { makeDossier } from "./helpers"

describe("calculerEcheancesTVA", () => {
  it("RM : génère 12 échéances mensuelles", () => {
    const dossier = makeDossier({ regimeTva: "RM", dateLimiteTva: 24 })
    const echeances = calculerEcheancesTVA(dossier, 2026)

    expect(echeances).toHaveLength(12)
    expect(echeances[0].libelle).toContain("Janvier")
    expect(echeances[11].libelle).toContain("Décembre")
    echeances.forEach((e) => expect(e.type).toBe("FISCALE"))
  })

  it("RM : les dates sont le jour j du mois M+1", () => {
    const dossier = makeDossier({ regimeTva: "RM", dateLimiteTva: 19 })
    const echeances = calculerEcheancesTVA(dossier, 2026)

    // Janvier 2026 → échéance le 19 février 2026
    expect(echeances[0].dateEcheance.getMonth()).toBe(1) // février = 1
    expect(echeances[0].dateEcheance.getDate()).toBe(19)

    // Décembre 2026 → échéance le 19 janvier 2027
    expect(echeances[11].dateEcheance.getMonth()).toBe(0) // janvier = 0
    expect(echeances[11].dateEcheance.getFullYear()).toBe(2027)
    expect(echeances[11].dateEcheance.getDate()).toBe(19)
  })

  it("RM : date limite par défaut = 24", () => {
    const dossier = makeDossier({ regimeTva: "RM", dateLimiteTva: null })
    const echeances = calculerEcheancesTVA(dossier, 2026)
    expect(echeances[0].dateEcheance.getDate()).toBe(24)
  })

  it("RT : génère 4 échéances trimestrielles", () => {
    const dossier = makeDossier({ regimeTva: "RT", dateLimiteTva: 24 })
    const echeances = calculerEcheancesTVA(dossier, 2026)

    expect(echeances).toHaveLength(4)
    expect(echeances[0].libelle).toContain("T1")
    expect(echeances[3].libelle).toContain("T4")

    // T1 (fin mars) → échéance le 24 avril
    expect(echeances[0].dateEcheance.getMonth()).toBe(3) // avril
    expect(echeances[0].dateEcheance.getDate()).toBe(24)
  })

  it("ST : génère 3 échéances (2 acomptes + CA12)", () => {
    const dossier = makeDossier({ regimeTva: "ST", dateLimiteTva: 24 })
    const echeances = calculerEcheancesTVA(dossier, 2026)

    expect(echeances).toHaveLength(3)
    expect(echeances[0].libelle).toContain("Juillet")
    expect(echeances[1].libelle).toContain("Décembre")
    expect(echeances[2].libelle).toContain("CA12")

    // CA12 = mai N+1
    expect(echeances[2].dateEcheance.getFullYear()).toBe(2027)
    expect(echeances[2].dateEcheance.getMonth()).toBe(4) // mai
  })

  it("Exonéré : retourne 0 échéance", () => {
    const dossier = makeDossier({ regimeTva: "EXONERE" })
    expect(calculerEcheancesTVA(dossier, 2026)).toHaveLength(0)
  })

  it("Pas de régime TVA : retourne 0 échéance", () => {
    const dossier = makeDossier({ regimeTva: null })
    expect(calculerEcheancesTVA(dossier, 2026)).toHaveLength(0)
  })
})

describe("calculerEcheancesIS", () => {
  it("IS clôture 31/12 : génère 4 acomptes + solde + N+1", () => {
    const dossier = makeDossier({
      regimeFiscal: "IS",
      dateClotureExercice: new Date("2025-12-31"),
    })
    const echeances = calculerEcheancesIS(dossier)

    expect(echeances).toHaveLength(6)
    expect(echeances.filter((e) => e.libelle.includes("Acompte IS n°"))).toHaveLength(4)
    expect(echeances.find((e) => e.libelle.includes("Solde IS"))).toBeTruthy()
    expect(echeances.find((e) => e.libelle.includes("N+1"))).toBeTruthy()
  })

  it("IS clôture 31/12 : dates correctes des acomptes", () => {
    const dossier = makeDossier({
      regimeFiscal: "IS",
      dateClotureExercice: new Date("2025-12-31"),
    })
    const echeances = calculerEcheancesIS(dossier)

    // Acompte 1 : 31/12 + 3 mois + 15j = 15 avril 2026
    const acompte1 = echeances.find((e) => e.cleChamp === "acpt_is_1")!
    expect(acompte1.dateEcheance.getFullYear()).toBe(2026)
    expect(acompte1.dateEcheance.getMonth()).toBe(3) // avril
    expect(acompte1.dateEcheance.getDate()).toBe(15)

    // Acompte 2 : 31/12 + 6 mois + 15j = 15 juillet 2026
    const acompte2 = echeances.find((e) => e.cleChamp === "acpt_is_2")!
    expect(acompte2.dateEcheance.getMonth()).toBe(6) // juillet
  })

  it("IS clôture décalée 31/03 : calcule depuis la clôture", () => {
    const dossier = makeDossier({
      regimeFiscal: "IS",
      dateClotureExercice: new Date("2026-03-31"),
    })
    const echeances = calculerEcheancesIS(dossier)

    // Acompte 1 : 31/03 + 3 mois + 15j = 15 juillet 2026
    const acompte1 = echeances.find((e) => e.cleChamp === "acpt_is_1")!
    expect(acompte1.dateEcheance.getMonth()).toBe(6) // juillet
    expect(acompte1.dateEcheance.getDate()).toBe(15)

    // Solde IS : 31/03 + 3 mois + 15j = 15 juillet 2026
    const solde = echeances.find((e) => e.cleChamp === "solde_is")!
    expect(solde.dateEcheance.getMonth()).toBe(6)
  })

  it('IS avec "<3000€" dans acomptes_is : 0 acompte, solde + N+1 seulement', () => {
    const dossier = makeDossier({
      regimeFiscal: "IS",
      dateClotureExercice: new Date("2025-12-31"),
      acomptesIs: { "1": "<3000€", "2": "-", "3": "-", "4": "-" },
    })
    const echeances = calculerEcheancesIS(dossier)

    // Pas d'acomptes, mais solde + N+1
    expect(echeances.filter((e) => e.libelle.includes("Acompte IS n°"))).toHaveLength(0)
    expect(echeances.find((e) => e.cleChamp === "solde_is")).toBeTruthy()
    expect(echeances.find((e) => e.cleChamp === "acpt_is_n1")).toBeTruthy()
    expect(echeances).toHaveLength(2)
  })

  it("IR : retourne 0 échéance", () => {
    const dossier = makeDossier({
      regimeFiscal: "IR",
      dateClotureExercice: new Date("2025-12-31"),
    })
    expect(calculerEcheancesIS(dossier)).toHaveLength(0)
  })

  it("Pas de date clôture : retourne 0 échéance", () => {
    const dossier = makeDossier({
      regimeFiscal: "IS",
      dateClotureExercice: null,
    })
    expect(calculerEcheancesIS(dossier)).toHaveLength(0)
  })
})

describe("calculerEcheancesJuridiques", () => {
  it("génère AGO + dépôt greffe", () => {
    const dossier = makeDossier({
      dateClotureExercice: new Date("2025-12-31"),
    })
    const echeances = calculerEcheancesJuridiques(dossier)

    expect(echeances.length).toBeGreaterThanOrEqual(2)

    const ago = echeances.find((e) => e.libelle.includes("AGO"))!
    expect(ago.type).toBe("JURIDIQUE")
    // AGO : 31/12 + 6 mois = 30 juin 2026
    expect(ago.dateEcheance.getMonth()).toBe(5) // juin
    expect(ago.dateEcheance.getFullYear()).toBe(2026)

    const greffe = echeances.find((e) => e.libelle.includes("greffe"))!
    // Greffe : 31/12 + 7 mois = 31 juillet 2026
    expect(greffe.dateEcheance.getMonth()).toBe(6) // juillet
  })

  it("AGO avec clôture décalée 30/06 : AGO le 31/12", () => {
    const dossier = makeDossier({
      dateClotureExercice: new Date("2026-06-30"),
    })
    const echeances = calculerEcheancesJuridiques(dossier)

    const ago = echeances.find((e) => e.libelle.includes("AGO"))!
    expect(ago.dateEcheance.getMonth()).toBe(11) // décembre
    expect(ago.dateEcheance.getFullYear()).toBe(2026)
  })

  it("DAS 2 : 15 mai N+1 si statutDas2 non null", () => {
    const dossier = makeDossier({
      dateClotureExercice: new Date("2025-12-31"),
      statutDas2: "EN_COURS",
    })
    const echeances = calculerEcheancesJuridiques(dossier)

    const das2 = echeances.find((e) => e.libelle.includes("DAS 2"))!
    expect(das2).toBeTruthy()
    expect(das2.dateEcheance.getMonth()).toBe(4) // mai
    expect(das2.dateEcheance.getDate()).toBe(15)
    expect(das2.dateEcheance.getFullYear()).toBe(2026)
  })

  it("pas de date clôture : retourne 0 échéance", () => {
    const dossier = makeDossier({ dateClotureExercice: null })
    expect(calculerEcheancesJuridiques(dossier)).toHaveLength(0)
  })
})
