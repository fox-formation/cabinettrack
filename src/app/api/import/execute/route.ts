import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getTenantId } from "@/lib/tenant"
import * as XLSX from "xlsx"

export const dynamic = "force-dynamic"

// ── Mapping helpers ──────────────────────────────

const FORME_JURIDIQUE_MAP: Record<string, string> = {
  SAS: "SAS", SARL: "SARL", SCI: "SCI", EURL: "EURL", SASU: "SASU",
  EI: "EI", BNC: "BNC", LMNP: "LMNP", SNC: "SNC", SEP: "SEP", SC: "SC",
  "SOCIÉTÉ CIVILE": "SOCIETE_CIVILE", "SOCIETE CIVILE": "SOCIETE_CIVILE",
  ASSOCIATION: "ASSOCIATION", "AUTO-ENTREPRENEUR": "AUTO_ENTREPRENEUR",
  "AUTO ENTREPRENEUR": "AUTO_ENTREPRENEUR",
}

const REGIME_FISCAL_MAP: Record<string, string> = {
  IS: "IS", IR: "IR",
}

const REGIME_TVA_MAP: Record<string, string> = {
  RM: "RM", ST: "ST", RT: "RT",
  "EXONÉRÉ": "EXONERE", EXONERE: "EXONERE", "EXONERÉ": "EXONERE",
}

const TYPE_MISSION_MAP: Record<string, string> = {
  SAISIE: "SAISIE",
  "SAISIE MENSUELLE": "SAISIE_MENSUELLE",
  "SAISIE TRIMESTRIELLE": "SAISIE_TRIMESTRIELLE",
  "SAISIE SEMESTRIELLE": "SAISIE_SEMESTRIELLE",
  "SAISIE ANNUELLE": "SAISIE_ANNUELLE",
  RÉVISION: "REVISION", REVISION: "REVISION",
}

const LOGICIEL_MAP: Record<string, string> = {
  ACD: "ACD", PENNYLANE: "PENNYLANE", SAGE: "SAGE", QUADRA: "QUADRA",
  TIIME: "TIIME", AXONAUT: "AXONAUT", JULY: "JULY",
}

const TVA_MOIS_FIELDS = [
  "tvaJanvier", "tvaFevrier", "tvaMars", "tvaAvril", "tvaMai", "tvaJuin",
  "tvaJuillet", "tvaAout", "tvaSeptembre", "tvaOctobre", "tvaNovembre", "tvaDecembre",
]

function str(val: unknown): string {
  if (val == null || val === "") return ""
  return String(val).trim()
}

/** Vérifie si la valeur indique une suppression explicite */
function isDeleteMarker(val: unknown): boolean {
  if (val == null || val === "") return false
  const v = String(val).trim().toLowerCase()
  return v === "a supprimer" || v === "à supprimer" || v === "a_supprimer" || v === "supprimer"
}

/** Retourne true si la cellule Excel est vide (= ne pas toucher la donnée existante) */
function isEmpty(val: unknown): boolean {
  return val == null || val === "" || (typeof val === "string" && val.trim() === "")
}

function parseDate(val: unknown): Date | null {
  if (val == null || val === "" || val === "-") return null
  if (typeof val === "number") {
    // Excel serial date
    const utcDays = Math.floor(val - 25569)
    return new Date(utcDays * 86400 * 1000)
  }
  const s = String(val).trim()
  // DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (ddmmyyyy) {
    return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]))
  }
  // YYYY-MM-DD
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function parseSuiviEtape(val: unknown): string | null {
  const v = str(val).toUpperCase()
  if (!v) return null
  if (v === "EFFECTUÉ" || v === "EFFECTUE" || v === "FAIT" || v === "OK") return "EFFECTUE"
  if (v === "EN COURS" || v === "EN_COURS" || v === "EC") return "EN_COURS"
  return null
}

function parseTvaMois(val: unknown): string | null {
  const v = str(val).toLowerCase()
  if (!v) return null
  if (["x", "fait", "ok", "oui", "déclaré", "declaré"].includes(v)) return "x"
  if (["-", "n/a", "na", "néant", "neant"].includes(v)) return "-"
  if (["client", "fait par client", "clt"].includes(v)) return "client"
  return null
}

function mapEnum(val: unknown, mapping: Record<string, string>): string | null {
  const v = str(val).toUpperCase()
  if (!v) return null
  return mapping[v] ?? null
}

// ── Header → field mapping ──────────────────────

const HEADER_MAP: Record<string, string> = {
  "raison sociale": "raisonSociale",
  "nom du dossier": "raisonSociale",
  cabinet: "cabinet",
  siren: "siren",
  activité: "activite",
  activite: "activite",
  "forme juridique": "formeJuridique",
  forme: "formeJuridique",
  "régime fiscal": "regimeFiscal",
  "regime fiscal": "regimeFiscal",
  "régime (ir/is)": "regimeFiscal",
  "regime (ir/is)": "regimeFiscal",
  "régime tva": "regimeTva",
  "regime tva": "regimeTva",
  "régime de tva": "regimeTva",
  "type mission": "typeMission",
  "révision ou saisie": "typeMission",
  "revision ou saisie": "typeMission",
  "logiciel comptable": "logicielComptable",
  logiciel: "logicielComptable",
  "commentaire interne": "commentaireInterne",
  commentaire: "commentaireInterne",
  "nom contact": "nomContact",
  "email contact": "emailContact",
  "mail contact": "emailContact",
  "téléphone contact": "telephoneContact",
  telephone: "telephoneContact",
  "collaborateur principal": "collaborateurPrincipal",
  "nom du collaborateur 1": "collaborateurPrincipal",
  "collaborateur 1": "collaborateurPrincipal",
  "collaborateur secondaire": "collaborateurSecondaire",
  "nom du collaborateur 2": "collaborateurSecondaire",
  "collaborateur 2": "collaborateurSecondaire",
  "date clôture exercice": "dateClotureExercice",
  "date cloture exercice": "dateClotureExercice",
  "date de cloture": "dateClotureExercice",
  "date de clôture": "dateClotureExercice",
  "date prévue arrêté bilan": "datePrevueArreteBilan",
  "date prev arreté bilan": "datePrevueArreteBilan",
  "date prev arrete bilan": "datePrevueArreteBilan",
  "date arrêté bilan": "dateArreteBilan",
  "date arrete bilan": "dateArreteBilan",
  "commentaire bilan": "commentaireBilan",
  "comm bilan en cours": "commentaireBilan",
  "courant saisie": "statutCourantSaisie",
  "manquant saisie": "statutManquantSaisie",
  "note manquant saisie": "noteManquantSaisie",
  "révision faite": "statutRevisionFaite",
  "revision faite": "statutRevisionFaite",
  "od inventaire": "statutOdInventaire",
  "manquant révision": "statutManquantRevision",
  "manquant revision": "statutManquantRevision",
  "note manquant révision": "noteManquantRevision",
  "note manquant revision": "noteManquantRevision",
  "états financiers": "statutEtatsFinanciers",
  "etats financiers": "statutEtatsFinanciers",
  "liasse fiscale": "statutLiasseFiscale",
  "signature associé": "statutSignatureAssocie",
  "signature associe": "statutSignatureAssocie",
  "envoi client": "statutEnvoiClient",
  télédéclaration: "statutTeledeclaration",
  teledeclaration: "statutTeledeclaration",
  "2572": "statut2572",
  "das 2": "statutDas2",
  "vérif envoi": "statutVerifEnvoi",
  "verif envoi": "statutVerifEnvoi",
  "verif jdc": "statutVerifEnvoi",
  ago: "statutAgo",
  "date limite tva": "dateLimiteTva",
  "date limite de tva": "dateLimiteTva",
  "tva janvier": "tvaJanvier",
  janvier: "tvaJanvier",
  "tva février": "tvaFevrier",
  février: "tvaFevrier",
  fevrier: "tvaFevrier",
  "tva mars": "tvaMars",
  mars: "tvaMars",
  "tva avril": "tvaAvril",
  avril: "tvaAvril",
  "tva mai": "tvaMai",
  mai: "tvaMai",
  "tva juin": "tvaJuin",
  juin: "tvaJuin",
  "tva juillet": "tvaJuillet",
  juillet: "tvaJuillet",
  "tva août": "tvaAout",
  "tva aout": "tvaAout",
  août: "tvaAout",
  aout: "tvaAout",
  "tva septembre": "tvaSeptembre",
  septembre: "tvaSeptembre",
  "tva octobre": "tvaOctobre",
  octobre: "tvaOctobre",
  "tva novembre": "tvaNovembre",
  novembre: "tvaNovembre",
  "tva décembre": "tvaDecembre",
  "tva decembre": "tvaDecembre",
  décembre: "tvaDecembre",
  decembre: "tvaDecembre",
  cfe: "suiviCfe",
  cvae: "suiviCvae",
  tvs: "suiviTvs",
  "taxe foncière note": "taxeFonciereNote",
  "taxe fonciere note": "taxeFonciereNote",
  tf: "taxeFonciereNote",
  "taxe foncière détail": "taxeFonciereDetail",
  "taxe fonciere detail": "taxeFonciereDetail",
  "acompte is 1": "acompteIs1",
  "acpt is 1": "acompteIs1",
  "acompte is 2": "acompteIs2",
  "acpt is 2": "acompteIs2",
  "acompte is 3": "acompteIs3",
  "acpt is 3": "acompteIs3",
  "acompte is 4": "acompteIs4",
  "acpt is 4": "acompteIs4",
  "solde is": "soldeIs",
  "acompte is n+1": "acompteIsN1",
  "acompte cvae 06": "acompteCvae06",
  "acompte cvae 09": "acompteCvae09",
  "solde cvae": "soldeCvae",
  "2561": "statut2561",
  "2561 (ifu)": "statut2561",
}

// ── Main import handler ──────────────────────────

/**
 * POST /api/import/execute
 * Accepts multipart form data with an Excel file.
 * Imports dossiers into the tenant's database.
 */
export async function POST(req: NextRequest) {
  const tenantId = await getTenantId()

  const formData = await req.formData()
  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" })

  // Use first sheet
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return NextResponse.json({ error: "Empty workbook" }, { status: 400 })
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" })

  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found" }, { status: 400 })
  }

  // Map headers
  const rawHeaders = Object.keys(rows[0])
  const headerMapping: Record<string, string> = {}
  const unmappedHeaders: string[] = []
  for (const h of rawHeaders) {
    const normalized = h.toLowerCase().replace(/\s*\*\s*$/, "").trim()
    const field = HEADER_MAP[normalized]
    if (field) {
      headerMapping[h] = field
    } else {
      unmappedHeaders.push(h)
    }
  }

  // Fetch cabinets and collaborateurs for matching
  const [cabinets, collaborateurs] = await Promise.all([
    prisma.cabinet.findMany({ where: { tenantId } }),
    prisma.user.findMany({ where: { tenantId }, select: { id: true, prenom: true } }),
  ])

  const defaultCabinet = cabinets[0]
  if (!defaultCabinet) {
    return NextResponse.json({ error: "No cabinet found for this tenant. Create a cabinet first." }, { status: 400 })
  }

  const collabByPrenom = new Map(collaborateurs.map((c) => [c.prenom.toLowerCase(), c.id]))

  // Process rows
  const results: { line: number; raisonSociale: string; status: "ok" | "error"; error?: string }[] = []
  let imported = 0
  let errors = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineNum = i + 2 // 1-indexed, +1 for header

    // Map raw columns to fields
    const mapped: Record<string, unknown> = {}
    for (const [rawCol, fieldName] of Object.entries(headerMapping)) {
      mapped[fieldName] = row[rawCol]
    }

    const raisonSociale = str(mapped.raisonSociale)
    if (!raisonSociale) {
      results.push({ line: lineNum, raisonSociale: "(vide)", status: "error", error: "Raison sociale manquante" })
      errors++
      continue
    }

    try {
      // Find cabinet
      const cabinetName = str(mapped.cabinet)
      let cabinetId = defaultCabinet.id
      if (cabinetName) {
        const found = cabinets.find((c) => c.nom.toLowerCase() === cabinetName.toLowerCase().trim())
        if (found) cabinetId = found.id
      }

      // Find collaborateur principal
      let collaborateurPrincipalId: string | null = null
      const collabName = str(mapped.collaborateurPrincipal)
      if (collabName && collabName !== "-") {
        collaborateurPrincipalId = collabByPrenom.get(collabName.toLowerCase()) ?? null
      }

      // Parse dates
      const dateClotureExercice = parseDate(mapped.dateClotureExercice)
      const datePrevueArreteBilan = parseDate(mapped.datePrevueArreteBilan)
      const dateArreteBilan = parseDate(mapped.dateArreteBilan)

      // Parse enums
      const formeJuridique = mapEnum(mapped.formeJuridique, FORME_JURIDIQUE_MAP)
      const regimeFiscal = mapEnum(mapped.regimeFiscal, REGIME_FISCAL_MAP)
      const regimeTva = mapEnum(mapped.regimeTva, REGIME_TVA_MAP)
      const typeMission = mapEnum(mapped.typeMission, TYPE_MISSION_MAP)
      const logicielComptable = mapEnum(mapped.logicielComptable, LOGICIEL_MAP)

      // Parse TVA suivi
      const tvaSuivi: Record<string, string | null> = {}
      for (let m = 0; m < 12; m++) {
        const field = TVA_MOIS_FIELDS[m]
        tvaSuivi[String(m + 1).padStart(2, "0")] = parseTvaMois(mapped[field])
      }
      const hasTva = Object.values(tvaSuivi).some((v) => v !== null)

      // Parse acomptes IS
      const acomptesIs: Record<string, string | null> = {
        "1": str(mapped.acompteIs1) || null,
        "2": str(mapped.acompteIs2) || null,
        "3": str(mapped.acompteIs3) || null,
        "4": str(mapped.acompteIs4) || null,
      }
      const hasAcomptes = Object.values(acomptesIs).some((v) => v !== null)

      // Date limite TVA
      const dateLimiteTvaRaw = str(mapped.dateLimiteTva)
      const dateLimiteTva = dateLimiteTvaRaw ? parseInt(dateLimiteTvaRaw) || null : null

      // ── Helper: set a field only if Excel cell is non-empty ──
      // For updates: empty cells are SKIPPED (preserve existing data)
      // "a supprimer" → explicitly set to null (erase)
      // For creates: all fields are set (empty = null)

      // Find existing dossier by raison sociale within tenant
      const existing = await prisma.dossier.findFirst({
        where: { tenantId, raisonSociale },
        select: { id: true },
      })
      const isUpdate = !!existing

      /** Adds a string field to data, respecting update rules */
      const setField = (d: Record<string, unknown>, field: string, rawVal: unknown, parsed?: string | null) => {
        if (isDeleteMarker(rawVal)) { d[field] = null; return }
        if (isUpdate && isEmpty(rawVal)) return // skip empty on update
        d[field] = parsed !== undefined ? parsed : (str(rawVal) || null)
      }

      /** Adds a date field to data */
      const setDateField = (d: Record<string, unknown>, field: string, rawVal: unknown, parsed: Date | null) => {
        if (isDeleteMarker(rawVal)) { d[field] = null; return }
        if (isUpdate && isEmpty(rawVal)) return
        d[field] = parsed
      }

      /** Adds an enum field to data */
      const setEnumField = (d: Record<string, unknown>, field: string, rawVal: unknown, parsed: string | null) => {
        if (isDeleteMarker(rawVal)) { d[field] = null; return }
        if (isUpdate && isEmpty(rawVal)) return
        if (parsed) d[field] = parsed
      }

      // Build data object
      const data: Record<string, unknown> = {
        tenantId,
        cabinetId,
        raisonSociale,
      }

      // String fields — only set if Excel cell is non-empty (or "a supprimer")
      setField(data, "siren", mapped.siren)
      setField(data, "activite", mapped.activite)
      setField(data, "nomContact", mapped.nomContact)
      setField(data, "emailContact", mapped.emailContact)
      setField(data, "telephoneContact", mapped.telephoneContact)
      setField(data, "commentaireInterne", mapped.commentaireInterne)
      setField(data, "commentaireBilan", mapped.commentaireBilan)
      setField(data, "suiviCfe", mapped.suiviCfe)
      setField(data, "suiviCvae", mapped.suiviCvae)
      setField(data, "suiviTvs", mapped.suiviTvs)
      setField(data, "taxeFonciereNote", mapped.taxeFonciereNote)
      setField(data, "taxeFonciereDetail", mapped.taxeFonciereDetail)
      setField(data, "soldeIs", mapped.soldeIs)
      setField(data, "acompteIsN1", mapped.acompteIsN1)
      setField(data, "acompteCvae06", mapped.acompteCvae06)
      setField(data, "acompteCvae09", mapped.acompteCvae09)
      setField(data, "soldeCvae", mapped.soldeCvae)
      setField(data, "statut2561", mapped.statut2561)

      // Collaborateur principal
      if (isDeleteMarker(mapped.collaborateurPrincipal)) {
        data.collaborateurPrincipalId = null
      } else if (!isUpdate || !isEmpty(mapped.collaborateurPrincipal)) {
        data.collaborateurPrincipalId = collaborateurPrincipalId
      }

      // Dates
      setDateField(data, "dateClotureExercice", mapped.dateClotureExercice, dateClotureExercice)
      setDateField(data, "datePrevueArreteBilan", mapped.datePrevueArreteBilan, datePrevueArreteBilan)
      setDateField(data, "dateArreteBilan", mapped.dateArreteBilan, dateArreteBilan)

      // Enums
      setEnumField(data, "formeJuridique", mapped.formeJuridique, formeJuridique)
      setEnumField(data, "regimeFiscal", mapped.regimeFiscal, regimeFiscal)
      setEnumField(data, "regimeTva", mapped.regimeTva, regimeTva)
      setEnumField(data, "typeMission", mapped.typeMission, typeMission)
      setEnumField(data, "logicielComptable", mapped.logicielComptable, logicielComptable)

      // Date limite TVA
      if (isDeleteMarker(mapped.dateLimiteTva)) {
        data.dateLimiteTva = null
      } else if (!isUpdate || !isEmpty(mapped.dateLimiteTva)) {
        data.dateLimiteTva = dateLimiteTva
      }

      // TVA suivi — only set if at least one month has data
      if (hasTva) {
        data.tvaSuivi = tvaSuivi
      } else if (!isUpdate) {
        data.tvaSuivi = null
      }

      // Acomptes IS — only set if at least one trimester has data
      if (hasAcomptes) {
        data.acomptesIs = acomptesIs
      } else if (!isUpdate) {
        data.acomptesIs = null
      }

      // Suivi etape fields
      const etapeFields = [
        "statutCourantSaisie", "statutManquantSaisie", "statutRevisionFaite",
        "statutOdInventaire", "statutManquantRevision", "statutEtatsFinanciers",
        "statutLiasseFiscale", "statutSignatureAssocie", "statutEnvoiClient",
        "statutTeledeclaration", "statut2572", "statutDas2", "statutVerifEnvoi", "statutAgo",
      ]
      for (const f of etapeFields) {
        if (isDeleteMarker(mapped[f])) {
          data[f] = null
        } else if (!isEmpty(mapped[f])) {
          const val = parseSuiviEtape(mapped[f])
          if (val !== null) data[f] = val
        }
      }

      // Text note fields
      setField(data, "noteManquantSaisie", mapped.noteManquantSaisie)
      setField(data, "noteManquantRevision", mapped.noteManquantRevision)

      let dossierId: string
      if (existing) {
        const updateData = { ...data }
        delete updateData.tenantId
        delete updateData.cabinetId
        await prisma.dossier.update({
          where: { id: existing.id },
          data: updateData as Parameters<typeof prisma.dossier.update>[0]["data"],
        })
        dossierId = existing.id
      } else {
        const created = await prisma.dossier.create({
          data: data as Parameters<typeof prisma.dossier.create>[0]["data"],
        })
        dossierId = created.id
      }

      // Handle collaborateur secondaire
      const collabSecName = str(mapped.collaborateurSecondaire)
      if (collabSecName && collabSecName !== "-") {
        const secId = collabByPrenom.get(collabSecName.toLowerCase())
        if (secId) {
          await prisma.collaborateurDossier.upsert({
            where: { userId_dossierId: { userId: secId, dossierId } },
            create: { userId: secId, dossierId, roleOnDossier: "secondaire" },
            update: {},
          })
        }
      }

      results.push({ line: lineNum, raisonSociale, status: "ok" })
      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      results.push({ line: lineNum, raisonSociale, status: "error", error: msg })
      errors++
    }
  }

  // Save import history (with file data for re-download)
  const fileName = file instanceof File ? file.name : "import.xlsx"
  const fileBuffer = Buffer.from(arrayBuffer)
  await prisma.importHistory.create({
    data: {
      tenantId,
      fileName,
      fileData: fileBuffer,
      total: rows.length,
      imported,
      errors,
      unmappedHeaders,
      details: results,
    },
  })

  return NextResponse.json({
    total: rows.length,
    imported,
    errors,
    unmappedHeaders,
    results,
  })
}
