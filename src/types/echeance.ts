export interface EcheanceCalculee {
  libelle: string
  type: "FISCALE" | "SOCIALE" | "JURIDIQUE"
  dateEcheance: Date
  cleChamp?: string
}
