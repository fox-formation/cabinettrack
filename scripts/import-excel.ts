/**
 * scripts/import-excel.ts
 *
 * Import SUIVI_2026.xlsx into PostgreSQL via Prisma.
 * Creates tenant, cabinets, collaborateurs, then imports all 170 dossiers.
 *
 * Usage: npx ts-node scripts/import-excel.ts [path-to-xlsx]
 * Default path: ./SUIVI 2026.xlsx
 */

import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import * as path from "path"

const prisma = new PrismaClient()

// ──────────────────────────────────────────────
// Mapping helpers
// ──────────────────────────────────────────────

const FORME_JURIDIQUE_MAP: Record<string, string> = {
  SAS: "SAS",
  SCI: "SCI",
  SARL: "SARL",
  EURL: "EURL",
  SASU: "SASU",
  EI: "EI",
  BNC: "BNC",
  LMNP: "LMNP",
  SNC: "SNC",
  SEP: "SEP",
  SC: "SC",
  "Société Civile": "SOCIETE_CIVILE",
  Association: "ASSOCIATION",
  "Auto-Entrepreneur": "AUTO_ENTREPRENEUR",
}

const REGIME_TVA_MAP: Record<string, string> = {
  RM: "RM",
  ST: "ST",
  RT: "RT",
  Exonéré: "EXONERE",
  "Exoneré": "EXONERE",
}

const TYPE_MISSION_MAP: Record<string, string> = {
  Saisie: "SAISIE",
  "Saisie mensuelle": "SAISIE_MENSUELLE",
  "Saisie trimestrielle": "SAISIE_TRIMESTRIELLE",
  "Saisie semestrielle": "SAISIE_SEMESTRIELLE",
  "Saisie annuelle": "SAISIE_ANNUELLE",
  Révision: "REVISION",
}

const LOGICIEL_MAP: Record<string, string> = {
  ACD: "ACD",
  Pennylane: "PENNYLANE",
  Sage: "SAGE",
  Quadra: "QUADRA",
  Tiime: "TIIME",
  Axonaut: "AXONAUT",
  July: "JULY",
}

const MOIS_COLONNES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Décembre",
]

// Excel serial date → JS Date
function excelDateToJSDate(serial: number): Date {
  // Excel epoch: 1900-01-01, with the 1900 leap year bug
  const utcDays = Math.floor(serial - 25569)
  return new Date(utcDays * 86400 * 1000)
}

function parseExcelDate(val: unknown): Date | null {
  if (val == null || val === "" || val === "-") return null
  if (typeof val === "number") return excelDateToJSDate(val)
  if (val instanceof Date) return val
  // Try string parse
  const str = String(val).trim()
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function cleanString(val: unknown): string | null {
  if (val == null || val === "") return null
  const s = String(val).trim()
  return s || null
}

function parseSuiviEtape(val: unknown): "EFFECTUE" | "EN_COURS" | null {
  const s = cleanString(val)
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower === "effectué" || lower === "effectue" || lower === "fait") return "EFFECTUE"
  if (lower === "en cours") return "EN_COURS"
  return null
}

function parseTvaMois(val: unknown): string | null {
  if (val == null || val === "") return null
  const s = String(val).trim()
  if (!s) return null
  // Normalize
  if (s === "x" || s === "X") return "x"
  if (s.toLowerCase() === "client" || s === "FAIT PAR CLIENT") return "client"
  if (s === "-") return "-"
  return s
}

function parseRegimeFiscal(val: unknown): "IS" | "IR" | null {
  const s = cleanString(val)
  if (!s) return null
  const trimmed = s.trim().toUpperCase()
  if (trimmed === "IS") return "IS"
  if (trimmed === "IR") return "IR"
  return null
}

// ──────────────────────────────────────────────
// Main import
// ──────────────────────────────────────────────

interface ExcelRow {
  [key: string]: unknown
}

async function main() {
  const xlsxPath = process.argv[2] || path.resolve(process.cwd(), "SUIVI 2026.xlsx")
  console.log(`📂 Reading Excel file: ${xlsxPath}`)

  const workbook = XLSX.readFile(xlsxPath)
  const sheet = workbook.Sheets["Suivi Dossier"]
  if (!sheet) {
    throw new Error("Sheet 'Suivi Dossier' not found in workbook")
  }

  // Parse with header row at index 4 (0-based)
  const rawRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { range: 4, defval: null })
  const rows = rawRows.filter((r) => {
    const nom = cleanString(r["Nom du dossier"])
    return nom !== null
  })

  console.log(`📊 Found ${rows.length} dossiers in Excel`)

  // ── Step 1: Create tenant ──
  console.log("\n🏢 Creating tenant...")
  const tenant = await prisma.tenant.create({
    data: { nom: "Cabinet Pilote (Fiduciaire + Finatec)" },
  })
  console.log(`   ✅ Tenant created: ${tenant.id}`)

  // ── Step 2: Create cabinets ──
  console.log("\n🏛️  Creating cabinets...")
  const cabinetNamesSet = new Set(rows.map((r) => String(r["Cabinet"] || "").trim()).filter(Boolean))
  const cabinetNames = Array.from(cabinetNamesSet)
  const cabinetMap: Record<string, string> = {}

  for (const name of cabinetNames) {
    const cab = await prisma.cabinet.create({
      data: { tenantId: tenant.id, nom: name },
    })
    cabinetMap[name] = cab.id
    console.log(`   ✅ Cabinet "${name}" → ${cab.id}`)
  }

  // ── Step 3: Create collaborateurs ──
  console.log("\n👥 Creating collaborateurs...")
  const collabPrenoms = new Set<string>()
  for (const row of rows) {
    const c1 = cleanString(row["Nom du Collaborateur 1"])
    const c2 = cleanString(row["Nom du Collaborateur 2"])
    if (c1 && c1 !== "-") collabPrenoms.add(c1)
    if (c2 && c2 !== "-") collabPrenoms.add(c2)
  }

  const ROLE_MAP: Record<string, "ASSISTANT" | "CONFIRME"> = {
    Souhila: "CONFIRME",
    Kadija: "CONFIRME",
    Cassandre: "CONFIRME",
    Shaïnas: "CONFIRME",
    Quentin: "ASSISTANT",
    Pierre: "ASSISTANT",
    Manal: "ASSISTANT",
  }

  const collabMap: Record<string, string> = {}
  for (const prenom of Array.from(collabPrenoms)) {
    const role = ROLE_MAP[prenom] || "ASSISTANT"
    // Reuse existing user if already present for this tenant (avoid duplicates)
    const existing = await prisma.user.findFirst({
      where: { tenantId: tenant.id, prenom },
    })
    const user = existing ?? await prisma.user.create({
      data: {
        tenantId: tenant.id,
        prenom,
        role,
      },
    })
    collabMap[prenom] = user.id
    console.log(`   ✅ ${prenom} (${role}) → ${user.id}${existing ? " (existant)" : ""}`)
  }

  // ── Step 4: Import dossiers ──
  console.log("\n📁 Importing dossiers...")
  let imported = 0
  let errors = 0

  for (const row of rows) {
    try {
      const cabinetName = String(row["Cabinet"] || "").trim()
      const cabinetId = cabinetMap[cabinetName]
      if (!cabinetId) {
        console.error(`   ❌ Unknown cabinet: "${cabinetName}" for dossier "${row["Nom du dossier"]}"`)
        errors++
        continue
      }

      // Collaborateurs
      const collab1Prenom = cleanString(row["Nom du Collaborateur 1"])
      const collab2Prenom = cleanString(row["Nom du Collaborateur 2"])
      const collabPrincipalId = collab1Prenom && collab1Prenom !== "-" ? collabMap[collab1Prenom] : null
      const collabSecondaireId = collab2Prenom && collab2Prenom !== "-" ? collabMap[collab2Prenom] : null

      // Forme juridique
      const formeRaw = cleanString(row["Forme"])
      const formeJuridique = formeRaw ? (FORME_JURIDIQUE_MAP[formeRaw] || null) : null

      // Régime fiscal — IMPORTANT: trim() pour "IS " → "IS"
      const regimeFiscal = parseRegimeFiscal(row["Régime ( IR/IS)"])

      // Régime TVA
      const regimeTvaRaw = cleanString(row["Régime de TVA"])
      const regimeTva = regimeTvaRaw ? (REGIME_TVA_MAP[regimeTvaRaw] || null) : null

      // Type mission
      const missionRaw = cleanString(row["Révision ou Saisie"])
      const typeMission = missionRaw ? (TYPE_MISSION_MAP[missionRaw] || null) : null

      // Logiciel
      const logRaw = cleanString(row["logiciel"])
      const logicielComptable = logRaw ? (LOGICIEL_MAP[logRaw] || null) : null

      // Date limite TVA
      const dateLimiteTvaRaw = row["Date limite de TVA"]
      const dateLimiteTva = dateLimiteTvaRaw ? parseInt(String(dateLimiteTvaRaw), 10) : null

      // TVA suivi mensuel → JSON
      const tvaSuivi: Record<string, string | null> = {}
      for (let i = 0; i < 12; i++) {
        const colName = MOIS_COLONNES[i]
        const key = String(i + 1).padStart(2, "0")
        tvaSuivi[key] = parseTvaMois(row[colName])
      }

      // Acomptes IS → JSON
      const acomptesIs: Record<string, string | null> = {
        "1": cleanString(row["acpt is 1"]),
        "2": cleanString(row["acpt is 2"]),
        "3": cleanString(row["Acpt IS 3"]),
        "4": cleanString(row["Acpt IS 4"]),
      }

      // SIREN — toujours string
      const sirenRaw = row["SIREN"]
      const siren = sirenRaw != null ? String(sirenRaw).trim() : null

      // Create dossier
      const dossier = await prisma.dossier.create({
        data: {
          tenantId: tenant.id,
          cabinetId,
          raisonSociale: String(row["Nom du dossier"]).trim(),
          activite: cleanString(row["Activités"]),
          nomContact: cleanString(row["Nom contact"]),
          emailContact: cleanString(row["MAIL CONTACT"]),
          telephoneContact: cleanString(row["Téléphone"]),
          siren,
          formeJuridique: formeJuridique as unknown as undefined,
          regimeFiscal: regimeFiscal as unknown as undefined,
          typeMission: typeMission as unknown as undefined,
          logicielComptable: logicielComptable as unknown as undefined,
          commentaireInterne: cleanString(row["Commentaire"]),

          collaborateurPrincipalId: collabPrincipalId || undefined,

          dateClotureExercice: parseExcelDate(row["Date de Cloture"]),
          datePrevueArreteBilan: parseExcelDate(row["Date prev arreté bilan"]),
          dateArreteBilan: parseExcelDate(row["Date arrêté bilan\r\n"]) || parseExcelDate(row["Date arrêté bilan"]),
          commentaireBilan: cleanString(row["COMM BILAN EN COURS"]),

          // Suivi liasse fiscale
          statutSignatureAssocie: parseSuiviEtape(row["Signature Associé \r\n"] ?? row["Signature Associé"]),
          statutTeledeclaration: parseSuiviEtape(row["Télédéclaration \r\n"] ?? row["Télédéclaration"]),
          statut2572: parseSuiviEtape(row["2572\r\n"] ?? row["2572"]),
          statutDas2: parseSuiviEtape(row["Das 2"]),
          statutVerifEnvoi: parseSuiviEtape(row["verif JDC"]),
          statutAgo: parseSuiviEtape(row["AGO"]),

          // TVA
          regimeTva: regimeTva as unknown as undefined,
          dateLimiteTva: dateLimiteTva && !isNaN(dateLimiteTva) ? dateLimiteTva : null,
          tvaSuivi,

          // Taxes
          taxeFonciereNote: cleanString(row["TF              -"] ?? row["TF"]),
          suiviCfe: cleanString(row["CFE                -"] ?? row["CFE"]),
          suiviCvae: cleanString(row["CVAE                -"] ?? row["CVAE"]),
          suiviTvs: cleanString(row["TVS                -"] ?? row["TVS"]),
          taxeFonciereDetail: cleanString(row["Taxe Foncière"]),

          // IS
          acomptesIs,
          soldeIs: cleanString(row["Solde IS"]),
          acompteIsN1: cleanString(row["Acompte IS  N+1"]),

          // CVAE
          acompteCvae06: cleanString(row["Acompte CVAE 06"]),
          acompteCvae09: cleanString(row["Acompte CVAE 09"]),
          soldeCvae: cleanString(row["Solde CVAE"]),

          // 2561
          statut2561: cleanString(row["2561"]),
        },
      })

      // Create collaborateur secondaire relation
      if (collabSecondaireId) {
        await prisma.collaborateurDossier.create({
          data: {
            userId: collabSecondaireId,
            dossierId: dossier.id,
            roleOnDossier: "secondaire",
          },
        })
      }

      imported++
    } catch (err) {
      const nom = row["Nom du dossier"] || "?"
      console.error(`   ❌ Error importing "${nom}":`, err instanceof Error ? err.message : err)
      errors++
    }
  }

  // ── Summary ──
  console.log("\n" + "═".repeat(50))
  console.log("📊 IMPORT SUMMARY")
  console.log("═".repeat(50))
  console.log(`   Tenant       : ${tenant.nom}`)
  console.log(`   Cabinets     : ${cabinetNames.join(", ")}`)
  console.log(`   Collaborateurs: ${Object.keys(collabMap).length}`)
  console.log(`   Dossiers     : ${imported} imported / ${errors} errors / ${rows.length} total`)
  console.log(`   Success rate : ${((imported / rows.length) * 100).toFixed(1)}%`)
  console.log("═".repeat(50))

  if (errors > 0) {
    console.log("\n⚠️  Some dossiers failed to import. Check errors above.")
    process.exit(1)
  } else {
    console.log("\n✅ All dossiers imported successfully!")
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
