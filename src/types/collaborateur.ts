export interface CollaborateurSeed {
  prenom: string
  role: "ASSISTANT" | "CONFIRME" | "SUPERVISEUR" | "EXPERT_COMPTABLE"
}

export const COLLABORATEURS_PILOTE: CollaborateurSeed[] = [
  { prenom: "Souhila", role: "CONFIRME" },
  { prenom: "Kadija", role: "CONFIRME" },
  { prenom: "Cassandre", role: "CONFIRME" },
  { prenom: "Shaïnas", role: "CONFIRME" },
  { prenom: "Quentin", role: "ASSISTANT" },
  { prenom: "Pierre", role: "ASSISTANT" },
  { prenom: "Manal", role: "ASSISTANT" },
]
