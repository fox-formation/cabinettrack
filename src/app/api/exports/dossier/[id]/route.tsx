import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { calculerAvancement, detailAvancement } from "@/lib/dossiers/avancement"
import React from "react"
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

export const dynamic = "force-dynamic"

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8, color: "#1f2937", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 150, color: "#6b7280" },
  value: { flex: 1, fontFamily: "Helvetica-Bold", color: "#111827" },
  etapeRow: { flexDirection: "row", marginBottom: 4, alignItems: "center" },
  etapeLabel: { width: 160, fontSize: 10 },
  etapePoids: { width: 40, fontSize: 9, color: "#9ca3af", textAlign: "right" as const },
  etapeStatut: { flex: 1, fontSize: 9, marginLeft: 8 },
  tvaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tvaCell: { width: 60, height: 24, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, justifyContent: "center", alignItems: "center" },
  echeanceRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 3 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: "#e5e7eb", marginTop: 4, marginBottom: 8 },
  progressFill: { height: 8, borderRadius: 4 },
})

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

// GET /api/exports/dossier/[id]?format=pdf
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: params.id },
    include: {
      cabinet: { select: { nom: true } },
      collaborateurPrincipal: { select: { prenom: true } },
      echeances: {
        where: { dateEcheance: { gte: new Date() } },
        orderBy: { dateEcheance: "asc" },
        take: 5,
      },
    },
  })

  if (!dossier) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 })
  }

  const avancement = calculerAvancement(dossier)
  const etapes = detailAvancement(dossier)
  const tvaSuivi = (dossier.tvaSuivi as Record<string, string | null> | null) ?? {}

  const barColor = avancement >= 100 ? "#16a34a" : avancement > 50 ? "#f97316" : "#dc2626"

  const tvaColor = (val: string | null | undefined): string => {
    if (!val) return "#ffffff"
    const v = val.toLowerCase()
    if (v === "x") return "#dcfce7"
    if (v === "client") return "#dbeafe"
    if (v === "-") return "#f3f4f6"
    return "#ffffff"
  }

  const tvaText = (val: string | null | undefined): string => {
    if (!val) return "-"
    const v = val.toLowerCase()
    if (v === "x") return "Fait"
    if (v === "client") return "Client"
    if (v === "-") return "N/A"
    return val
  }

  const pdfDoc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{dossier.raisonSociale}</Text>
          <Text style={styles.subtitle}>
            Cabinet {dossier.cabinet.nom} — {dossier.formeJuridique ?? "N/R"} — {dossier.regimeFiscal ?? "N/R"}
          </Text>
          <Text style={styles.subtitle}>
            Fiche générée le {new Date().toLocaleDateString("fr-FR")}
          </Text>
        </View>

        {/* Identité */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identité</Text>
          <View style={styles.row}>
            <Text style={styles.label}>SIREN</Text>
            <Text style={styles.value}>{dossier.siren ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Collaborateur</Text>
            <Text style={styles.value}>{dossier.collaborateurPrincipal?.prenom ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Type mission</Text>
            <Text style={styles.value}>{dossier.typeMission ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Logiciel comptable</Text>
            <Text style={styles.value}>{dossier.logicielComptable ?? "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date clôture exercice</Text>
            <Text style={styles.value}>
              {dossier.dateClotureExercice ? new Date(dossier.dateClotureExercice).toLocaleDateString("fr-FR") : "—"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Contact</Text>
            <Text style={styles.value}>{dossier.nomContact ?? "—"} {dossier.emailContact ? `(${dossier.emailContact})` : ""}</Text>
          </View>
        </View>

        {/* Avancement bilan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avancement bilan — {avancement}%</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${avancement}%`, backgroundColor: barColor }]} />
          </View>
          {etapes.map((etape) => (
            <View key={etape.label} style={styles.etapeRow}>
              <Text style={styles.etapeLabel}>{etape.label}</Text>
              <Text style={styles.etapePoids}>{etape.poids}%</Text>
              <Text style={[styles.etapeStatut, {
                color: etape.statut === "effectue" ? "#16a34a" : etape.statut === "en_cours" ? "#f59e0b" : "#9ca3af",
              }]}>
                {etape.statut === "effectue" ? "Effectué" : etape.statut === "en_cours" ? "En cours" : "Non démarré"}
              </Text>
            </View>
          ))}
        </View>

        {/* TVA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suivi TVA — {dossier.regimeTva ?? "N/R"}</Text>
          <View style={styles.tvaGrid}>
            {MOIS_LABELS.map((mois, i) => {
              const key = String(i + 1).padStart(2, "0")
              const val = tvaSuivi[key]
              return (
                <View key={key} style={[styles.tvaCell, { backgroundColor: tvaColor(val) }]}>
                  <Text style={{ fontSize: 8, color: "#6b7280" }}>{mois}</Text>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold" }}>{tvaText(val)}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Prochaines échéances */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5 prochaines échéances</Text>
          {dossier.echeances.length === 0 ? (
            <Text style={{ color: "#9ca3af" }}>Aucune échéance à venir</Text>
          ) : (
            dossier.echeances.map((e) => (
              <View key={e.id} style={styles.echeanceRow}>
                <Text style={{ width: 80 }}>{new Date(e.dateEcheance).toLocaleDateString("fr-FR")}</Text>
                <Text style={{ flex: 1 }}>{e.libelle}</Text>
                <Text style={{ width: 60, color: "#6b7280" }}>{e.type}</Text>
                <Text style={{ width: 60, color: e.statut === "FAIT" ? "#16a34a" : "#f59e0b" }}>{e.statut}</Text>
              </View>
            ))
          )}
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(pdfDoc)
  const uint8 = new Uint8Array(buffer)

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${dossier.raisonSociale.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
    },
  })
}
