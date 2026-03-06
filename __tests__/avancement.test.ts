import { describe, it, expect } from "vitest"
import { calculerAvancement, detailAvancement, ETAPES_BILAN } from "@/lib/dossiers/avancement"
import { makeDossier } from "./helpers"

describe("ETAPES_BILAN", () => {
  it("contient 14 étapes", () => {
    expect(ETAPES_BILAN).toHaveLength(14)
  })

  it("les poids des étapes actives totalisent 100", () => {
    const totalPoids = ETAPES_BILAN.filter((e) => e.poids > 0).reduce((s, e) => s + e.poids, 0)
    expect(totalPoids).toBe(100)
  })

  it("les étapes hasNote ont poids 0", () => {
    ETAPES_BILAN.filter((e) => e.hasNote).forEach((e) => {
      expect(e.poids).toBe(0)
    })
  })

  it("les étapes hasNote ont un noteField", () => {
    ETAPES_BILAN.filter((e) => e.hasNote).forEach((e) => {
      expect(e.noteField).toBeDefined()
    })
  })
})

describe("calculerAvancement", () => {
  it("retourne 0% pour un dossier tout null", () => {
    expect(calculerAvancement(makeDossier())).toBe(0)
  })

  it("retourne 100% pour un dossier tout effectué", () => {
    const dossier = makeDossier({
      statutCourantSaisie: "EFFECTUE",
      statutRevisionFaite: "EFFECTUE",
      statutOdInventaire: "EFFECTUE",
      statutEtatsFinanciers: "EFFECTUE",
      statutLiasseFiscale: "EFFECTUE",
      statutSignatureAssocie: "EFFECTUE",
      statutEnvoiClient: "EFFECTUE",
      statutTeledeclaration: "EFFECTUE",
      statut2572: "EFFECTUE",
      statutDas2: "EFFECTUE",
      statutVerifEnvoi: "EFFECTUE",
      statutAgo: "EFFECTUE",
    })
    expect(calculerAvancement(dossier)).toBe(100)
  })

  it("retourne 50% pour courant saisie seul (poids 50)", () => {
    const dossier = makeDossier({ statutCourantSaisie: "EFFECTUE" })
    expect(calculerAvancement(dossier)).toBe(50)
  })

  it("retourne poids × 0.75 pour étapes EN_COURS", () => {
    const dossier = makeDossier({
      statutCourantSaisie: "EN_COURS", // 50 × 0.75 = 37.5
    })
    expect(calculerAvancement(dossier)).toBe(37.5)
  })

  it("retourne poids × 0.5 pour étapes DEMI", () => {
    const dossier = makeDossier({
      statutCourantSaisie: "DEMI", // 50 × 0.5 = 25
    })
    expect(calculerAvancement(dossier)).toBe(25)
  })

  it("retourne poids × 0.25 pour étapes QUART", () => {
    const dossier = makeDossier({
      statutCourantSaisie: "QUART", // 50 × 0.25 = 12.5
    })
    expect(calculerAvancement(dossier)).toBe(12.5)
  })

  it("ignore les étapes hasNote (poids 0) dans le calcul", () => {
    const dossier = makeDossier({
      statutManquantSaisie: "EFFECTUE",
      statutManquantRevision: "EFFECTUE",
    })
    expect(calculerAvancement(dossier)).toBe(0)
  })

  it("combine effectué et en cours correctement", () => {
    const dossier = makeDossier({
      statutCourantSaisie: "EFFECTUE",   // 50
      statutRevisionFaite: "EN_COURS",   // 10 × 0.75 = 7.5
      statutOdInventaire: "EFFECTUE",    // 15
    })
    expect(calculerAvancement(dossier)).toBe(72.5)
  })
})

describe("detailAvancement", () => {
  it("retourne 14 étapes", () => {
    const etapes = detailAvancement(makeDossier())
    expect(etapes).toHaveLength(14)
  })

  it("inclut hasNote et noteField pour les étapes manquants", () => {
    const etapes = detailAvancement(makeDossier())
    const manquantSaisie = etapes.find((e) => e.cle === "statutManquantSaisie")
    expect(manquantSaisie?.hasNote).toBe(true)
    expect(manquantSaisie?.noteField).toBe("noteManquantSaisie")
  })

  it("retourne la noteValue quand elle existe", () => {
    const etapes = detailAvancement(makeDossier({ noteManquantSaisie: "Pièces manquantes" }))
    const manquantSaisie = etapes.find((e) => e.cle === "statutManquantSaisie")
    expect(manquantSaisie?.noteValue).toBe("Pièces manquantes")
  })

  it("marque les étapes null comme non_demarre", () => {
    const etapes = detailAvancement(makeDossier())
    etapes.forEach((e) => {
      expect(e.statut).toBe("non_demarre")
    })
  })

  it("marque EFFECTUE correctement", () => {
    const etapes = detailAvancement(makeDossier({ statutAgo: "EFFECTUE" }))
    const ago = etapes.find((e) => e.label === "AGO")
    expect(ago?.statut).toBe("effectue")
  })

  it("marque EN_COURS correctement", () => {
    const etapes = detailAvancement(makeDossier({ statutAgo: "EN_COURS" }))
    const ago = etapes.find((e) => e.label === "AGO")
    expect(ago?.statut).toBe("en_cours")
  })

  it("marque DEMI correctement", () => {
    const etapes = detailAvancement(makeDossier({ statutAgo: "DEMI" }))
    const ago = etapes.find((e) => e.label === "AGO")
    expect(ago?.statut).toBe("demi")
  })

  it("marque QUART correctement", () => {
    const etapes = detailAvancement(makeDossier({ statutAgo: "QUART" }))
    const ago = etapes.find((e) => e.label === "AGO")
    expect(ago?.statut).toBe("quart")
  })
})
