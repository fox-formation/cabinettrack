import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

export const dynamic = "force-dynamic"

/**
 * GET /api/import/template
 * Generates and returns an Excel template with all dossier fields,
 * including data validation dropdowns for enum fields and example rows.
 */
export async function GET() {
  const wb = XLSX.utils.book_new()

  // ── Column definitions ──────────────────────────

  const columns = [
    // Identité
    { header: "Raison sociale *", field: "raisonSociale", example: "ACME SAS", note: "Obligatoire" },
    { header: "Cabinet", field: "cabinet", example: "Fiduciaire", note: "Nom du cabinet/entité" },
    { header: "SIREN", field: "siren", example: "123456789", note: "9 chiffres, toujours texte" },
    { header: "Activité", field: "activite", example: "Commerce de détail", note: "" },
    { header: "Forme juridique", field: "formeJuridique", example: "SAS", note: "SAS, SARL, SCI, EURL, SASU, EI, BNC, LMNP, SNC, SEP, SC, Société Civile, Association, Auto-Entrepreneur" },
    { header: "Régime fiscal", field: "regimeFiscal", example: "IS", note: "IS ou IR" },
    { header: "Régime TVA", field: "regimeTva", example: "RM", note: "RM, ST, RT, Exonéré" },
    { header: "Type mission", field: "typeMission", example: "Saisie", note: "Saisie, Saisie mensuelle, Saisie trimestrielle, Saisie semestrielle, Saisie annuelle, Révision" },
    { header: "Logiciel comptable", field: "logicielComptable", example: "ACD", note: "ACD, Pennylane, Sage, Quadra, Tiime, Axonaut, July" },
    { header: "Commentaire interne", field: "commentaireInterne", example: "", note: "Notes libres" },

    // Contact
    { header: "Nom contact", field: "nomContact", example: "Jean Dupont", note: "" },
    { header: "Email contact", field: "emailContact", example: "contact@acme.fr", note: "" },
    { header: "Téléphone contact", field: "telephoneContact", example: "01 23 45 67 89", note: "" },

    // Collaborateurs
    { header: "Collaborateur principal", field: "collaborateurPrincipal", example: "Souhila", note: "Prénom du collaborateur (doit exister dans l'app)" },
    { header: "Collaborateur secondaire", field: "collaborateurSecondaire", example: "Kadija", note: "Prénom — mettre '-' si aucun" },

    // Dates
    { header: "Date clôture exercice *", field: "dateClotureExercice", example: "31/12/2025", note: "Obligatoire — format JJ/MM/AAAA" },
    { header: "Date prévue arrêté bilan", field: "datePrevueArreteBilan", example: "30/04/2026", note: "Format JJ/MM/AAAA" },
    { header: "Date arrêté bilan", field: "dateArreteBilan", example: "", note: "Format JJ/MM/AAAA" },
    { header: "Commentaire bilan", field: "commentaireBilan", example: "", note: "Notes sur le bilan en cours" },

    // Suivi Liasse Fiscale (14 étapes)
    { header: "Courant saisie", field: "statutCourantSaisie", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Manquant saisie", field: "statutManquantSaisie", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Note manquant saisie", field: "noteManquantSaisie", example: "", note: "Texte libre" },
    { header: "Révision faite", field: "statutRevisionFaite", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "OD inventaire", field: "statutOdInventaire", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Manquant révision", field: "statutManquantRevision", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Note manquant révision", field: "noteManquantRevision", example: "", note: "Texte libre" },
    { header: "États financiers", field: "statutEtatsFinanciers", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Liasse fiscale", field: "statutLiasseFiscale", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Signature associé", field: "statutSignatureAssocie", example: "Effectué", note: "Effectué, En Cours, ou vide" },
    { header: "Envoi client", field: "statutEnvoiClient", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Télédéclaration", field: "statutTeledeclaration", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "2572", field: "statut2572", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "DAS 2", field: "statutDas2", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "Vérif envoi", field: "statutVerifEnvoi", example: "", note: "Effectué, En Cours, ou vide" },
    { header: "AGO", field: "statutAgo", example: "", note: "Effectué, En Cours, ou vide" },

    // TVA
    { header: "Date limite TVA", field: "dateLimiteTva", example: "24", note: "16, 19, 21 ou 24" },
    { header: "TVA Janvier", field: "tvaJanvier", example: "x", note: "x = fait, client = fait par client, - = N/A, vide = à faire" },
    { header: "TVA Février", field: "tvaFevrier", example: "", note: "" },
    { header: "TVA Mars", field: "tvaMars", example: "", note: "" },
    { header: "TVA Avril", field: "tvaAvril", example: "", note: "" },
    { header: "TVA Mai", field: "tvaMai", example: "", note: "" },
    { header: "TVA Juin", field: "tvaJuin", example: "", note: "" },
    { header: "TVA Juillet", field: "tvaJuillet", example: "", note: "" },
    { header: "TVA Août", field: "tvaAout", example: "", note: "" },
    { header: "TVA Septembre", field: "tvaSeptembre", example: "", note: "" },
    { header: "TVA Octobre", field: "tvaOctobre", example: "", note: "" },
    { header: "TVA Novembre", field: "tvaNovembre", example: "", note: "" },
    { header: "TVA Décembre", field: "tvaDecembre", example: "", note: "" },

    // Taxes
    { header: "CFE", field: "suiviCfe", example: "PE", note: "PE, PH, PM, - ou vide" },
    { header: "CVAE", field: "suiviCvae", example: "-", note: "" },
    { header: "TVS", field: "suiviTvs", example: "", note: "" },
    { header: "Taxe foncière note", field: "taxeFonciereNote", example: "", note: "Texte libre" },
    { header: "Taxe foncière détail", field: "taxeFonciereDetail", example: "", note: "" },

    // Acomptes IS
    { header: "Acompte IS 1", field: "acompteIs1", example: "x", note: "x = payé, - = N/A, <3000€, Néant, Déficit, client" },
    { header: "Acompte IS 2", field: "acompteIs2", example: "", note: "" },
    { header: "Acompte IS 3", field: "acompteIs3", example: "", note: "" },
    { header: "Acompte IS 4", field: "acompteIs4", example: "", note: "" },
    { header: "Solde IS", field: "soldeIs", example: "", note: "" },
    { header: "Acompte IS N+1", field: "acompteIsN1", example: "", note: "" },

    // CVAE détail
    { header: "Acompte CVAE 06", field: "acompteCvae06", example: "", note: "" },
    { header: "Acompte CVAE 09", field: "acompteCvae09", example: "", note: "" },
    { header: "Solde CVAE", field: "soldeCvae", example: "", note: "" },

    // IFU
    { header: "2561 (IFU)", field: "statut2561", example: "", note: "" },
  ]

  // ── Sheet 1: DOSSIERS (main import sheet) ────────

  const headers = columns.map((c) => c.header)
  const exampleRow = columns.map((c) => c.example)

  const wsData = [headers, exampleRow]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Set column widths
  ws["!cols"] = columns.map((c) => ({
    wch: Math.max(c.header.length, c.example.length, 16),
  }))

  XLSX.utils.book_append_sheet(wb, ws, "Dossiers")

  // ── Sheet 2: LÉGENDE (field descriptions) ────────

  const legendHeaders = ["Colonne", "Champ technique", "Obligatoire", "Valeurs acceptées / Format", "Exemple"]
  const legendRows = columns.map((c) => [
    c.header.replace(" *", ""),
    c.field,
    c.header.includes("*") ? "OUI" : "",
    c.note,
    c.example,
  ])
  const wsLegend = XLSX.utils.aoa_to_sheet([legendHeaders, ...legendRows])
  wsLegend["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 12 }, { wch: 60 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsLegend, "Légende")

  // ── Sheet 3: VALEURS ENUM (dropdown reference) ───

  const enumData = [
    ["Champ", "Valeurs acceptées"],
    ["Forme juridique", "SAS, SARL, SCI, EURL, SASU, EI, BNC, LMNP, SNC, SEP, SC, Société Civile, Association, Auto-Entrepreneur"],
    ["Régime fiscal", "IS, IR"],
    ["Régime TVA", "RM (Réel mensuel), ST (Simplifié), RT (Réel trimestriel), Exonéré"],
    ["Type mission", "Saisie, Saisie mensuelle, Saisie trimestrielle, Saisie semestrielle, Saisie annuelle, Révision"],
    ["Logiciel", "ACD, Pennylane, Sage, Quadra, Tiime, Axonaut, July"],
    ["Étapes bilan", "Effectué, En Cours, (vide = non démarré)"],
    ["TVA mensuelle", "x (fait cabinet), client (fait par client), - (N/A), (vide = à faire)"],
    ["Acomptes IS", "x (payé), - (N/A), <3000€, Néant, Déficit, client"],
    ["CFE", "PE (Prélèvement échéance), PH (Prélèvement horizon), PM (Mensualisation), -"],
    ["Date limite TVA", "16, 19, 21, 24 (jour du mois M+1)"],
  ]
  const wsEnum = XLSX.utils.aoa_to_sheet(enumData)
  wsEnum["!cols"] = [{ wch: 20 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsEnum, "Valeurs acceptées")

  // ── Generate buffer ──────────────────────────────

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=CabinetTrack_modele_import.xlsx",
    },
  })
}
