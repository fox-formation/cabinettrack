# CLAUDE.md — CabinetTrack · Instructions pour Claude Code

> Ce fichier est lu automatiquement par Claude à chaque session dans ce projet.
> Il contient les données réelles du **cabinet pilote** (Fiduciaire + Finatec) extraites
> de `SUIVI_2026.xlsx`, les règles métier déduites, et les règles d'architecture SaaS.
> ⚠️ Le produit final est un SaaS multi-cabinets : aucune donnée du cabinet pilote
> ne doit être hard-codée dans le code.

---

## 🎯 Contexte du projet

**CabinetTrack** est une application SaaS **multi-cabinets** destinée à être commercialisée
auprès de n'importe quel cabinet d'expertise comptable français.

### Cabinet pilote (données réelles de développement)
Le cabinet pilote qui sert de base au développement est composé de deux entités :
- **Fiduciaire** — 99 dossiers actifs
- **Finatec** — 71 dossiers actifs (170 dossiers total)

Les données de ce cabinet sont utilisées pour :
- alimenter les seeds de base de données en développement
- valider le script d'import `scripts/import-excel.ts`
- tester les règles métier (clôtures décalées, régimes TVA, etc.)

### Vision produit SaaS
Chaque nouveau cabinet qui souscrit dispose de son propre espace **totalement isolé**.
L'architecture doit être **multi-tenant dès le premier jour** :
- Chaque cabinet a son propre `tenant_id` (UUID)
- Toutes les données sont cloisonnées par `tenant_id` sans exception
- Un super-admin éditeur peut accéder à tous les tenants via un backoffice séparé
- Chaque cabinet configure ses propres collaborateurs, logiciels et préférences
- Les données du cabinet pilote (Fiduciaire/Finatec) ne sont **jamais** des valeurs
  hard-codées dans le code — elles sont en base comme n'importe quel autre cabinet

### Ce qui est universel (commun à tous les cabinets)
- Le référentiel des échéances fiscales françaises (`data/echeances_fiscales.json`)
- Les enums métier (FormeJuridique, RegimeFiscal, RegimeTVA, TypeMission...)
- Le moteur de calcul des échéances et le système d'alertes
- L'intégration Outlook + IA (chaque cabinet connecte son propre compte Azure AD)
- Les 4 rôles collaborateurs (Assistant, Confirmé, Superviseur, Expert-comptable)

### Ce qui est propre à chaque cabinet (configuré au onboarding)
- Nom du cabinet et noms des entités internes
- Liste des collaborateurs et leurs rôles
- Import du fichier Excel existant via `scripts/import-excel.ts`
- Compte Microsoft Azure AD pour l'intégration Outlook

---

## 🛠️ Stack technique

| Couche       | Technologie                                      |
|--------------|--------------------------------------------------|
| Frontend     | Next.js 14 (App Router) + TypeScript             |
| Styles       | TailwindCSS + shadcn/ui                          |
| Backend      | Node.js (Express) ou FastAPI (Python)            |
| Base données | PostgreSQL (Supabase) + Redis (alertes/cache)    |
| Auth         | NextAuth.js + Microsoft Azure AD (SSO)           |
| Email        | Microsoft Graph API (Outlook)                    |
| IA           | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Déploiement  | Vercel (front) + Railway (back)                  |

---

## 📁 Structure du projet

```
cabinet-expertise/
├── CLAUDE.md
├── .env.local
├── .env.example
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 ← tableau de bord
│   │   ├── dossiers/
│   │   ├── agenda/
│   │   ├── alertes/
│   │   ├── emails/
│   │   ├── collaborateurs/
│   │   └── stats/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── dossiers/
│       ├── echeances/
│       ├── alertes/
│       ├── emails/
│       ├── collaborateurs/
│       ├── stats/
│       └── webhooks/outlook/
├── components/
│   ├── ui/                          ← shadcn/ui (ne pas modifier)
│   ├── dossiers/
│   ├── echeances/
│   ├── alertes/
│   ├── emails/
│   └── stats/
├── lib/
│   ├── db/schema.prisma
│   ├── graph/                       ← Microsoft Graph API
│   ├── ai/                          ← Claude API
│   ├── echeances/generator.ts
│   └── alertes/scheduler.ts
├── data/
│   ├── echeances_fiscales.json
│   ├── echeances_sociales.json
│   └── echeances_juridiques.json
├── prompts/
│   ├── resume_email.md
│   ├── classification_email.md
│   └── alerte_echeance.md
├── scripts/
│   └── import-excel.ts              ← ⚠️ PRIORITÉ PHASE 1
└── types/
    ├── dossier.ts
    ├── echeance.ts
    └── collaborateur.ts
```

---

## 👥 Collaborateurs réels — À créer en base au setup initial

Extraits du fichier `SUIVI_2026.xlsx`. Ces prénoms sont les seules identités dans Excel.

| Prénom      | Cabinet principal    | Rôle app suggéré  | Dossiers (col.1) | Dossiers (col.2) |
|-------------|----------------------|-------------------|------------------|------------------|
| Souhila     | Fiduciaire + Finatec | Confirmé          | 43 Fidu + 17 Finatec | secondaire  |
| Kadija      | Fiduciaire           | Confirmé          | 40 Fiduciaire    | secondaire       |
| Cassandre   | Finatec + Fiduciaire | Confirmé          | 34 Finatec + 3 Fidu | secondaire  |
| Shaïnas     | Finatec + Fiduciaire | Confirmé          | 13 Fidu + 5 Finatec | secondaire  |
| Quentin     | Finatec              | Assistant         | —                | secondaire       |
| Pierre      | Finatec              | Assistant         | —                | secondaire       |
| Manal       | Fiduciaire           | Assistant         | —                | secondaire       |

> Règle : `Collaborateur 1` = référent principal. `Collaborateur 2` = support, peut être `"-"` = NULL.

---

## 🏛️ Enums et valeurs réelles

### Cabinets
```typescript
enum Cabinet { FIDUCIAIRE = "Fiduciaire", FINATEC = "Finatec" }
```

### Rôles utilisateur (4 niveaux)
```typescript
enum Role {
  ASSISTANT        = "ASSISTANT",
  CONFIRME         = "CONFIRME",
  SUPERVISEUR      = "SUPERVISEUR",
  EXPERT_COMPTABLE = "EXPERT_COMPTABLE"
}
```

### Formes juridiques — répartition réelle des 170 dossiers
```typescript
enum FormeJuridique {
  SAS               = "SAS",              // 52 dossiers ← forme majoritaire
  SCI               = "SCI",              // 36 dossiers
  SARL              = "SARL",             // 35 dossiers
  EURL              = "EURL",             // 14 dossiers
  SASU              = "SASU",             //  7 dossiers
  EI                = "EI",               //  4 dossiers
  BNC               = "BNC",              //  4 dossiers
  LMNP              = "LMNP",             //  3 dossiers
  SNC               = "SNC",              //  2 dossiers
  SEP               = "SEP",              //  2 dossiers
  SC                = "SC",               //  1 dossier
  SOCIETE_CIVILE    = "Société Civile",   //  1 dossier
  ASSOCIATION       = "Association",      //  1 dossier
  AUTO_ENTREPRENEUR = "Auto-Entrepreneur" //  1 dossier
}
```

### Régime fiscal
```typescript
enum RegimeFiscal {
  IS = "IS",  // 117 dossiers (69%)
  IR = "IR"   //  45 dossiers (26%)
  // ~8 dossiers sans régime renseigné
}
// ⚠️ NORMALISATION : le fichier Excel contient "IS " (avec espace) → toujours trim() à l'import
```

### Régime TVA — répartition réelle
```typescript
enum RegimeTVA {
  RM      = "RM",      // Réel mensuel        — 106 dossiers (62%)
  EXONERE = "Exonéré", // Exonéré de TVA      —  17 dossiers (10%)
  ST      = "ST",      // Simplifié           —  12 dossiers  (7%)
  RT      = "RT"       // Réel trimestriel    —  10 dossiers  (6%)
  // ~25 dossiers sans régime TVA renseigné
}
```

### Date limite de dépôt TVA (jour du mois M+1)
```typescript
type DateLimiteTVA = 16 | 19 | 21 | 24
// 24 = valeur la plus fréquente (EDI standard)
// Si non renseigné → défaut : 24
```

### Type de mission
```typescript
enum TypeMission {
  SAISIE               = "Saisie",
  SAISIE_MENSUELLE     = "Saisie mensuelle",
  SAISIE_TRIMESTRIELLE = "Saisie trimestrielle",
  SAISIE_SEMESTRIELLE  = "Saisie semestrielle",
  SAISIE_ANNUELLE      = "Saisie annuelle",
  REVISION             = "Révision"
}
```

### Logiciel comptable du client
```typescript
enum LogicielComptable {
  ACD       = "ACD",
  PENNYLANE = "Pennylane",
  SAGE      = "Sage",
  QUADRA    = "Quadra",
  TIIME     = "Tiime",
  AXONAUT   = "Axonaut",
  JULY      = "July"
}
```

### Statuts des étapes bilan (colonnes : Signature Associé, Télédéclaration, 2572, Das 2, verif JDC, AGO)
```typescript
type SuiviEtape = "Effectué" | "En Cours" | null
// null = non démarré
```

### Statuts TVA mensuel (cases Janvier → Décembre)
```typescript
type SuiviTVAMois = "x" | "X" | "-" | "client" | "FAIT PAR CLIENT" | null
// Normaliser à l'affichage :
// "x" | "X"                   → FAIT (cabinet) → vert
// "client" | "FAIT PAR CLIENT" → CLIENT          → bleu
// "-"                          → N/A             → gris
// null                         → À FAIRE         → blanc (ou rouge si retard)
```

### Statuts acomptes IS
```typescript
type SuiviAcompteIS =
  | "x" | "X"   // Payé par le cabinet → normaliser en "x"
  | "-"          // Non applicable ce trimestre
  | "<3000€"     // Dispensé : IS exercice précédent < 3 000 € (Art. 1668 CGI)
  | "Néant"      // Aucun acompte (1ère année ou résultat nul)
  | "Déficit"    // Exercice déficitaire, pas d'acompte dû
  | "client"     // Payé directement par le client
  | null         // À faire
```

### Statuts CFE
```typescript
type SuiviCFE = "PE" | "PH" | "PM" | "-" | null
// PE = Prélèvement à l'échéance (automatique impôts)
// PH = Prélèvement à l'horizon (date personnalisée)
// PM = Mensualisation
```

### CVAE
```typescript
type SuiviCVAE = "-" | "A FAIRE" | "non" | null
```

### TVS (Taxe sur les véhicules de société)
```typescript
type SuiviTVS = "-" | "x" | string | null
// Champ semi-libre : peut contenir des notes (ex: "à transmettre à Laurence")
```

### 2561 (IFU — déclaration revenus de capitaux mobiliers)
```typescript
type Suivi2561 = "x" | string | null
// Peut contenir "attente retour juridique"
```

### Taxe foncière — champ totalement libre
```typescript
// Stocker comme texte. Valeurs observées (non exhaustif) :
// "PE" | "PH" | "PM" | "-" | "NEANT" | "CLT A PREV" | "OK PRLV"
// "PREL A ECHEANCE ACTIF" | "MENSUALISE ET PAYE" | "PAS DE TF SUR IMPOT GOUV"
// "PAS D'HABILITATION" | "IMPORTANT - A DEMANDER AU CLIENT"
```

---

## 📋 Mapping complet colonnes Excel → Champs base de données

### Table `dossiers`

| Colonne Excel (SUIVI_2026.xlsx)  | Champ DB                      | Type            | Notes importantes                               |
|----------------------------------|-------------------------------|-----------------|------------------------------------------------|
| Cabinet                          | `cabinet_id`                  | FK Cabinet      | "Fiduciaire" ou "Finatec "  (trim !)          |
| Nom du Collaborateur 1           | `collaborateur_principal_id`  | FK users        | Prénom seul → faire matching sur `prenom`      |
| Nom du Collaborateur 2           | via `collaborateurs_dossier`  | relation        | "-" → NULL, pas de 2ème collab                |
| Nom du dossier                   | `raison_sociale`              | string          | Certains ont " - retard" en suffix → à garder |
| Activités                        | `activite`                    | string          |                                                |
| Nom contact                      | `nom_contact`                 | string          |                                                |
| MAIL CONTACT                     | `email_contact`               | string          | Utilisé pour matching emails entrants          |
| Téléphone                        | `telephone_contact`           | string          |                                                |
| logiciel                         | `logiciel_comptable`          | LogicielComptable| Peut être null                               |
| Commentaire                      | `commentaire_interne`         | text            | Notes longues importantes sur le dossier       |
| Révision ou Saisie               | `type_mission`                | TypeMission     |                                                |
| Forme                            | `forme_juridique`             | FormeJuridique  | Peut être null (~5 dossiers)                  |
| Régime ( IR/IS)                  | `regime_fiscal`               | RegimeFiscal    | ⚠️ Toujours `.trim()` à l'import              |
| SIREN                            | `siren`                       | string(9)       | ⚠️ Jamais integer (zéros initiaux)            |
| Date de Cloture                  | `date_cloture_exercice`       | date            | 133 au 31/12 + 37 clôtures décalées           |
| Date prev arreté bilan           | `date_prevue_arrete_bilan`    | date            | Deadline livraison bilan au client             |
| COMM BILAN EN COURS              | `commentaire_bilan`           | text            | Ex: "Liasse a teledéclarer"                   |
| Date arrêté bilan                | `date_arrete_bilan`           | date            | Date effective d'arrêté des comptes            |
| Signature Associé                | `statut_signature_associe`    | SuiviEtape      |                                                |
| Télédéclaration                  | `statut_teledeclaration`      | SuiviEtape      |                                                |
| 2572                             | `statut_2572`                 | SuiviEtape      | Déclaration IS                                |
| Das 2                            | `statut_das2`                 | SuiviEtape      |                                                |
| verif JDC                        | `statut_verif_jdc`            | SuiviEtape      | Journaux de clôture                           |
| AGO                              | `statut_ago`                  | SuiviEtape      | Assemblée Générale Ordinaire                  |
| Régime de TVA                    | `regime_tva`                  | RegimeTVA       |                                                |
| Date limite de TVA               | `date_limite_tva`             | integer         | Valeurs : 16 / 19 / 21 / 24                   |
| Janvier → Décembre               | `tva_suivi`                   | JSONB           | `{"01":"x","02":null,...,"12":"-"}`           |
| TF                               | `taxe_fonciere_note`          | text            | Champ libre                                   |
| CFE                              | `suivi_cfe`                   | string          | PE / PH / PM / -                              |
| CVAE                             | `suivi_cvae`                  | string          |                                                |
| TVS                              | `suivi_tvs`                   | string          |                                                |
| Taxe Foncière (col. détail)      | `taxe_fonciere_detail`        | string          |                                                |
| acpt is 1 → Acpt IS 4           | `acomptes_is`                 | JSONB           | `{"1":"x","2":"-","3":null,"4":null}`         |
| Solde IS                         | `solde_is`                    | string          |                                                |
| Acompte IS N+1                   | `acompte_is_n1`               | string          |                                                |
| Acompte CVAE 06                  | `acompte_cvae_06`             | string          |                                                |
| Acompte CVAE 09                  | `acompte_cvae_09`             | string          |                                                |
| Solde CVAE                       | `solde_cvae`                  | string          |                                                |
| 2561                             | `statut_2561`                 | string          |                                                |

---

## 📅 Dossiers à clôture décalée (37 sur 170)

⚠️ Ces dossiers ont leurs échéances IS/liasse/AG calculées différemment.
Le moteur doit impérativement calculer depuis `date_cloture_exercice` et non depuis le 31/12.

| Mois clôture | Nb  | Dossiers réels                                                                    |
|--------------|-----|-----------------------------------------------------------------------------------|
| Janvier      | 3   | FINANCIERE GIRARD, GIRARD, SCI GIRARD Fréres                                     |
| Mars         | 9   | AMBULANCES TASSINOISES, HBI TECH, LA PLACE COIFFURE, MOHA COIFFURE, ORANGE TRADE, REROLLED STUDIO, SEVEN FOOD, TN CONCEPT, TOTO |
| Juin         | 11  | AFFICHE, GHA NETTOYAGE, ARTS PRO CARRELAGE, N.E.C.H, PPCRS, SH TRADING LTD, SCI IRTIGO KOVACEVIC, JUGO, JULIAND, LA VILLA POM'S D'AMOUR |
| Juillet      | 2   | COLIS COURSES, LESSENTIELLE                                                      |
| Août         | 1   | HOLISTAIA                                                                        |
| Septembre    | 10  | AFFRETEMENT TRANSPORTS ET DISTRIBUTION, AMSV, BUREAU ECOLOGIE, CALM, GC2E, LA MECA, OBRECHT CONSULTING, ODG INVEST, SARL L.A. BROC, VILLETTE VITRERIE |
| Octobre      | 1   | STA SERVICES                                                                     |

---

## 📅 Moteur d'échéances — Règles métier complètes

### TVA

```typescript
function calculerEcheancesTVA(dossier: Dossier): Echeance[] {
  if (!dossier.regime_tva || dossier.regime_tva === "Exonéré") return []

  const j = dossier.date_limite_tva ?? 24 // défaut EDI = 24

  switch (dossier.regime_tva) {
    case "RM":
      // CA3 mensuelle : 1 échéance par mois, le jour j du mois M+1
      return Array.from({ length: 12 }, (_, i) => ({
        libelle: `TVA CA3 ${MOIS[i]}`,
        date: setDate(addMonths(new Date(annee, i, 1), 1), j),
        type: "FISCALE"
      }))

    case "RT":
      // CA3 trimestrielle : le jour j du mois suivant chaque fin de trimestre
      // T1 fin mars → dépôt en avril | T2 fin juin → juillet | T3 sept → oct | T4 déc → janv
      return [3, 6, 9, 12].map(moisFin => ({
        libelle: `TVA CA3 T${moisFin/3}`,
        date: setDate(addMonths(new Date(annee, moisFin - 1, 1), 1), j),
        type: "FISCALE"
      }))

    case "ST":
      // Simplifié : 2 acomptes + 1 solde annuel (CA12)
      return [
        { libelle: "Acompte TVA Juillet (55%)", date: setDate(new Date(annee, 6, 1), j) },
        { libelle: "Acompte TVA Décembre (40%)", date: setDate(new Date(annee, 11, 1), j) },
        { libelle: "CA12 — Solde TVA annuel", date: setDate(new Date(annee + 1, 4, 1), j) }
      ]
  }
}
```

### IS — Acomptes et liasse

```typescript
function calculerEcheancesIS(dossier: Dossier): Echeance[] {
  if (dossier.regime_fiscal !== "IS") return []

  const c = dossier.date_cloture_exercice
  // ⚠️ TOUTES les dates IS se calculent depuis la date de clôture, pas depuis le 01/01

  return [
    // Acompte 1 : 3ème mois + 15j après clôture
    { libelle: "Acompte IS n°1 (8.33%)",  date: addDays(addMonths(c, 3), 15),  cle: "acpt_is_1" },
    // Acompte 2 : 6ème mois + 15j
    { libelle: "Acompte IS n°2 (8.33%)",  date: addDays(addMonths(c, 6), 15),  cle: "acpt_is_2" },
    // Acompte 3 : 9ème mois + 15j
    { libelle: "Acompte IS n°3 (8.33%)",  date: addDays(addMonths(c, 9), 15),  cle: "acpt_is_3" },
    // Acompte 4 : 12ème mois + 15j
    { libelle: "Acompte IS n°4 (8.33%)",  date: addDays(addMonths(c, 12), 15), cle: "acpt_is_4" },
    // Solde IS + Liasse 2065 : 3 mois + 15j après clôture
    { libelle: "Solde IS + Liasse fiscale 2065", date: addDays(addMonths(c, 3), 15), cle: "solde_is" },
    // Acompte IS N+1 (1er acompte exercice suivant)
    { libelle: "Acompte IS N+1",          date: addDays(addMonths(c, 15), 15), cle: "acpt_is_n1" }
  ]
  // Ne PAS générer si dossier.acomptes_is contient "<3000€", "Néant", "Déficit"
}
```

### Juridique — AG et dépôt comptes

```typescript
function calculerEcheancesJuridiques(dossier: Dossier): Echeance[] {
  const c = dossier.date_cloture_exercice

  const echeances = [
    // AGO : dans les 6 mois suivant la clôture (Art. L223-26 et L225-100 C. com.)
    { libelle: "AGO — Approbation des comptes", date: addMonths(c, 6), cle: "statut_ago" },
    // Dépôt greffe : 1 mois après l'AGO
    { libelle: "Dépôt comptes au greffe du tribunal", date: addMonths(c, 7) }
  ]

  // DAS 2 si applicable : 15 mai N+1
  if (dossier.statut_das2 !== null) {
    echeances.push({
      libelle: "DAS 2 — Déclaration honoraires/commissions",
      date: new Date(c.getFullYear() + 1, 4, 15), // 15 mai
      cle: "statut_das2"
    })
  }

  return echeances
}
```

### CVAE (si applicable — CA > 500 000 €)
```typescript
// Acompte CVAE 06 : 15 juin → cle: "acompte_cvae_06"
// Acompte CVAE 09 : 15 septembre → cle: "acompte_cvae_09"
// Solde CVAE + 1330-CVAE : 2ème jour ouvré de mai → cle: "solde_cvae"
```

### CFE
```typescript
// Acompte CFE (si CFE > 3 000€) : 15 juin
// Solde CFE : 15 décembre
// Modes de paiement réels dans la base : PE / PH / PM
```

---

## 📊 Calcul de l'avancement d'un dossier

L'avancement est calculé en % sur 7 étapes, extraites directement du fichier Excel :

```typescript
const ETAPES_BILAN = [
  { cle: "date_arrete_bilan",        label: "Bilan arrêté",       poids: 25 },
  { cle: "statut_signature_associe", label: "Signature associé",  poids: 15 },
  { cle: "statut_teledeclaration",   label: "Télédéclaration",    poids: 20 },
  { cle: "statut_2572",              label: "2572",                poids: 10 },
  { cle: "statut_das2",              label: "DAS 2",               poids: 10 },
  { cle: "statut_verif_jdc",         label: "Vérif JDC",          poids: 10 },
  { cle: "statut_ago",               label: "AGO",                 poids: 10 },
]

function calculerAvancement(dossier: Dossier): number {
  return ETAPES_BILAN.reduce((total, etape) => {
    const val = dossier[etape.cle]
    if (val === "Effectué" || (etape.cle === "date_arrete_bilan" && val != null))
      return total + etape.poids
    if (val === "En Cours")
      return total + etape.poids * 0.5
    return total
  }, 0)
}
```

---

## 📧 Intégration Outlook (Microsoft Graph API)

### Flux complet
```
1. Webhook Graph (POST /api/webhooks/outlook) — nouveaux emails
2. Fetch contenu via Graph API
3. Claude → résumé 3 lignes + tag (FISCAL/SOCIAL/JURIDIQUE/ADMIN) + urgence + date éventuelle
4. Claude → suggestion dossier (matching : raison_sociale, siren, email_contact, nom_contact)
   → confiance HAUTE (>80%) : rattachement automatique
   → confiance MOYENNE/FAIBLE : file validation manuelle
5. Si date détectée → proposer création alerte
6. Upsert en base (clé unique : microsoft_message_id)
```

### Scopes requis
```
Mail.Read | Mail.ReadWrite | offline_access | User.Read
```

### Validation webhook
Répondre < 3 secondes. Retourner `validationToken` pour la souscription Graph.

---

## 🔔 Alertes automatiques

```typescript
// Scheduler cron — toutes les heures
const JALONS = [30, 15, 7, 1] // jours avant échéance

// Escalade automatique
// J-7 non acquittée après 48h → Superviseur
// J-1 non acquittée → Expert-comptable
```

---

## 🎨 UI — Fiche dossier (reproduit l'Excel)

La fiche dossier est organisée en **6 tabs** miroir des groupes de colonnes Excel :

| Tab          | Correspond à dans Excel                                      |
|--------------|--------------------------------------------------------------|
| **Identité** | Colonnes A→P (infos générales, collaborateurs, dates)        |
| **Bilan**    | Groupe "Suivi Liasse Fiscale" (7 checkpoints visuels)        |
| **TVA**      | Groupe "Suivi TVA 2026" (grille 12 mois colorée)             |
| **Taxes**    | Groupe "Taxes diverses" (CFE, CVAE, TF, TVS)                 |
| **IS**       | Groupe "Acompte IS" (4 acomptes + solde + N+1 + CVAE)        |
| **Emails**   | Emails rattachés + résumés IA                                |

### Code couleur TVA grille mensuelle
```
Vert   #16a34a → "x" / "X"   (fait par le cabinet)
Bleu   #2563eb → "client"    (fait par le client)
Gris   #9ca3af → "-"         (non applicable)
Rouge  #dc2626 → null + date dépassée (retard)
Jaune  #eab308 → null + échéance < 7 jours
Blanc           → null + échéance future (à faire)
```

### Statistiques globales (chiffres réels)
```
Total dossiers    : 170
  Fiduciaire      : 99
  Finatec         : 71
Régime IS         : 117 (69%)
Régime IR         : 45  (26%)
TVA réel mensuel  : 106 (62%)
Clôture décalée   : 37  (22%)
```

---

## 👥 Matrice des droits

| Action                       | Assistant | Confirmé | Superviseur | Expert-comptable |
|------------------------------|-----------|----------|-------------|------------------|
| Voir dossiers                | ✅        | ✅       | ✅          | ✅               |
| Créer un dossier             | ❌        | ✅       | ✅          | ✅               |
| Modifier un dossier          | ❌        | ✅       | ✅          | ✅               |
| Supprimer un dossier         | ❌        | ❌       | ✅          | ✅               |
| Gérer les échéances          | Lecture   | ✅       | ✅          | ✅               |
| Réassigner collaborateurs    | ❌        | ❌       | ✅          | ✅               |
| Voir stats cabinet           | ❌        | ❌       | ✅          | ✅               |
| Exporter données             | ❌        | ❌       | ✅          | ✅               |
| Paramétrer le cabinet        | ❌        | ❌       | ❌          | ✅               |
| Gérer les utilisateurs       | ❌        | ❌       | ❌          | ✅               |

---

## 🔑 Variables d'environnement

```env
ANTHROPIC_API_KEY=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
MICROSOFT_GRAPH_SCOPE=https://graph.microsoft.com/.default
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🤖 Claude API — Pattern d'appel

```typescript
// lib/ai/client.ts — toujours ce pattern
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",  // ← jamais changer ce modèle
  max_tokens: 1000,
  system: systemPrompt,               // ← chargé depuis /prompts/*.md
  messages: [{ role: "user", content: userContent }]
})
// Toujours parser JSON dans try/catch → null en cas d'erreur, ne jamais planter
```

---

---

## 📥 Système d'import Excel — Architecture flexible (multi-cabinet)

> Chaque cabinet arrive avec son propre fichier Excel, avec ses propres noms de colonnes.
> L'application ne doit JAMAIS supposer une structure fixe à l'import.
> Le mapping est configuré par l'utilisateur via une interface visuelle au onboarding.

---

### Flux d'import en 4 étapes

```
Étape 1 — UPLOAD
  Cabinet dépose son fichier .xlsx ou .xls ou .csv
  → Lecture des onglets disponibles
  → L'utilisateur choisit l'onglet principal (ex: "Suivi Dossier")
  → L'utilisateur choisit la ligne d'en-tête (ex: ligne 4 ou 5)

Étape 2 — DÉTECTION AUTOMATIQUE (IA)
  → Claude analyse les noms de colonnes détectés
  → Propose automatiquement un mapping colonne Excel → champ app
  → Score de confiance par suggestion (HAUTE / MOYENNE / FAIBLE)
  → Exemple : "Nom du dossier" → raison_sociale (confiance HAUTE)
  → Exemple : "Raison sociale" → raison_sociale (confiance HAUTE)
  → Exemple : "Client" → raison_sociale (confiance MOYENNE)

Étape 3 — VALIDATION MANUELLE (interface visuelle)
  → Tableau de mapping : colonne Excel (gauche) ↔ champ app (droite)
  → Colonnes non mappées = ignorées (pas d'erreur)
  → Champs obligatoires marqués ★ : raison_sociale, date_cloture_exercice
  → Aperçu en temps réel des 5 premières lignes avec le mapping appliqué
  → Sauvegarde du mapping comme template réutilisable

Étape 4 — IMPORT ET NORMALISATION
  → Normalisation automatique des valeurs (trim, casse, enum matching)
  → Rapport d'import : X dossiers importés, Y lignes ignorées, Z erreurs
  → Erreurs détaillées par ligne (colonne manquante, valeur inconnue, SIREN invalide)
  → Possibilité de corriger et relancer
```

---

### Champs de l'application et leur priorité à l'import

#### Champs OBLIGATOIRES ★ (import bloqué si absent)
```typescript
const CHAMPS_OBLIGATOIRES = [
  { cle: "raison_sociale",         label: "Nom du dossier / Raison sociale" },
  { cle: "date_cloture_exercice",  label: "Date de clôture de l'exercice" }
]
```

#### Champs RECOMMANDÉS (warning si absent, import autorisé)
```typescript
const CHAMPS_RECOMMANDES = [
  { cle: "regime_fiscal",           label: "Régime fiscal (IS/IR)" },
  { cle: "regime_tva",              label: "Régime TVA" },
  { cle: "forme_juridique",         label: "Forme juridique" },
  { cle: "siren",                   label: "SIREN" },
  { cle: "collaborateur_principal", label: "Collaborateur / Gestionnaire" },
  { cle: "type_mission",            label: "Type de mission (saisie/révision)" }
]
```

#### Champs OPTIONNELS (ignorés silencieusement si absent)
```typescript
// Tous les autres champs : email_contact, telephone, logiciel,
// date_prevue_arrete_bilan, commentaire_interne, tva_suivi (mois),
// acomptes_is, statuts bilan, taxes annexes, etc.
```

---

### Normalisation automatique des valeurs à l'import

```typescript
// lib/import/normalizers.ts

const NORMALIZERS: Record<string, (val: string) => string | null> = {

  regime_fiscal: (val) => {
    const v = val.trim().toUpperCase()
    if (["IS", "I.S", "IMPOT SUR LES SOCIETES"].includes(v)) return "IS"
    if (["IR", "I.R", "IMPOT SUR LE REVENU"].includes(v)) return "IR"
    return null // valeur inconnue → warning
  },

  regime_tva: (val) => {
    const v = val.trim().toUpperCase()
    if (["RM", "REEL MENSUEL", "RÉEL MENSUEL", "CA3 MENSUEL"].includes(v)) return "RM"
    if (["RT", "REEL TRIMESTRIEL", "RÉEL TRIMESTRIEL"].includes(v)) return "RT"
    if (["ST", "SIMPLIFIE", "SIMPLIFIÉ", "CA12"].includes(v)) return "ST"
    if (["EXONERE", "EXONÉRÉ", "FRANCHISE", "TVA FRANCHISE", "HORS TAXE"].includes(v)) return "Exonéré"
    return null
  },

  forme_juridique: (val) => {
    const v = val.trim().toUpperCase()
    const MAP: Record<string, string> = {
      "SAS": "SAS", "S.A.S": "SAS", "S.A.S.": "SAS",
      "SARL": "SARL", "S.A.R.L": "SARL",
      "SCI": "SCI", "S.C.I": "SCI",
      "EURL": "EURL", "E.U.R.L": "EURL",
      "SASU": "SASU", "S.A.S.U": "SASU",
      "EI": "EI", "E.I": "EI", "ENTREPRENEUR INDIVIDUEL": "EI",
      "BNC": "BNC", "LIBERAL": "BNC", "LIBÉRAL": "BNC",
      "LMNP": "LMNP", "SNC": "SNC", "SEP": "SEP",
      "SC": "SC", "SOCIETE CIVILE": "Société Civile",
      "ASSOCIATION": "Association", "ASSO": "Association",
      "AUTO-ENTREPRENEUR": "Auto-Entrepreneur", "AE": "Auto-Entrepreneur",
      "MICRO-ENTREPRENEUR": "Auto-Entrepreneur"
    }
    return MAP[v] ?? null
  },

  suivi_tva_mois: (val) => {
    // Normalise les cases TVA mensuelles
    const v = val.trim().toLowerCase()
    if (["x", "✓", "fait", "ok", "oui", "declaré", "déclaré"].includes(v)) return "x"
    if (["-", "n/a", "na", "non applicable", "néant", "neant"].includes(v)) return "-"
    if (["client", "fait par client", "client déclare", "clt"].includes(v)) return "client"
    return null
  },

  suivi_acompte_is: (val) => {
    const v = val.trim().toLowerCase()
    if (["x", "✓", "payé", "paye", "fait", "ok"].includes(v)) return "x"
    if (["-", "n/a", "non applicable"].includes(v)) return "-"
    if (["<3000", "<3000€", "< 3000", "inf 3000", "dispense", "dispensé"].includes(v)) return "<3000€"
    if (["néant", "neant", "aucun", "0"].includes(v)) return "Néant"
    if (["deficit", "déficit", "perte", "resultat nul"].includes(v)) return "Déficit"
    if (["client", "payé par client"].includes(v)) return "client"
    return null
  },

  siren: (val) => {
    // Toujours string, jamais integer
    const v = val.toString().trim().replace(/\s/g, "")
    if (/^\d{9}$/.test(v)) return v
    if (/^\d{14}$/.test(v)) return v.substring(0, 9) // SIRET → prendre les 9 premiers
    return null // SIREN invalide → warning (pas bloquant)
  },

  date: (val) => {
    // Accepte : DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, numéro série Excel
    // Retourner ISO string YYYY-MM-DD ou null
  }
}
```

---

### Prompt IA pour la suggestion de mapping automatique

```markdown
# prompts/mapping_colonnes.md

## Système
Tu es un assistant pour cabinet d'expertise comptable.
Tu analyses des noms de colonnes d'un fichier Excel et proposes
un mapping vers les champs d'une application de gestion.

## Champs disponibles dans l'application
{{LISTE_CHAMPS_APP_JSON}}

## Colonnes détectées dans le fichier Excel du cabinet
{{COLONNES_EXCEL_JSON}}

## Ta mission
Pour chaque colonne Excel, propose le meilleur champ correspondant.
Si aucun champ ne correspond, retourne null.

## Réponse attendue (JSON strict)
{
  "mapping": [
    {
      "colonne_excel": "Nom du dossier",
      "champ_app": "raison_sociale",
      "confiance": "HAUTE",
      "raison": "correspondance sémantique directe"
    },
    {
      "colonne_excel": "Gestionnaire",
      "champ_app": "collaborateur_principal",
      "confiance": "MOYENNE",
      "raison": "terme générique pouvant correspondre au collaborateur principal"
    },
    {
      "colonne_excel": "Code interne",
      "champ_app": null,
      "confiance": "FAIBLE",
      "raison": "aucun champ correspondant dans l'application"
    }
  ]
}
```

---

### Interface visuelle de mapping (composant React)

```
┌─────────────────────────────────────────────────────────────────┐
│  📥 Import Excel — Étape 3/4 : Vérifiez le mapping              │
├────────────────────────────┬────────────────────────────────────┤
│  Vos colonnes Excel        │  Champs de l'application          │
├────────────────────────────┼────────────────────────────────────┤
│  Nom du dossier         ──▶│  ★ Raison sociale          [HAUTE] │
│  Date de Cloture        ──▶│  ★ Date de clôture         [HAUTE] │
│  Régime                 ──▶│  Régime fiscal (IS/IR)     [HAUTE] │
│  Gestionnaire           ──▶│  Collaborateur principal   [MOYEN] │
│  TVA                    ──▶│  Régime TVA                [MOYEN] │
│  Code agence            ──▶│  — Non mappé —             [dropdown▼] │
│  Janvier                ──▶│  TVA Janvier               [HAUTE] │
│  ...                       │  ...                               │
├────────────────────────────┴────────────────────────────────────┤
│  Aperçu (5 premières lignes)                                    │
│  ┌──────────────┬──────────────┬──────┬──────────────┐         │
│  │ Raison soc.  │ Date clôture │ IS/IR│ Collaborateur│         │
│  ├──────────────┼──────────────┼──────┼──────────────┤         │
│  │ 3KT          │ 31/12/2025   │ IS   │ Kadija       │         │
│  │ A.B SERVICE  │ 31/12/2025   │ IS   │ Souhila      │         │
│  └──────────────┴──────────────┴──────┴──────────────┘         │
│                                                                  │
│  💾 Sauvegarder ce mapping comme modèle réutilisable            │
│                                              [Importer →]       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Templates de mapping sauvegardables

```typescript
// Un cabinet peut sauvegarder son template pour réimporter chaque année
interface MappingTemplate {
  id: string
  tenant_id: string
  nom: string                      // ex: "Mon template Excel 2026"
  onglet_source: string            // ex: "Suivi Dossier"
  ligne_entete: number             // ex: 4
  colonnes: {
    colonne_excel: string          // ex: "Nom du dossier"
    champ_app: string | null       // ex: "raison_sociale"
    transformateur?: string        // ex: "normalizeRegimeFiscal"
  }[]
  created_at: Date
  derniere_utilisation: Date
}
```

---

### API Routes dédiées à l'import

```
POST /api/import/analyze          → Upload fichier, retourne onglets + colonnes détectées
POST /api/import/suggest-mapping  → Appel Claude pour suggestion de mapping automatique
POST /api/import/preview          → Applique le mapping, retourne aperçu 5 lignes
POST /api/import/execute          → Lance l'import complet avec le mapping validé
GET  /api/import/templates        → Liste les templates sauvegardés du cabinet
POST /api/import/templates        → Sauvegarde un nouveau template
GET  /api/import/history          → Historique des imports (date, nb dossiers, erreurs)
```

---

## ⭐ Système de notation de la difficulté des dossiers

> Chaque dossier reçoit une **note de difficulté globale** calculée à partir des évaluations
> individuelles de chaque collaborateur ayant travaillé dessus.
> L'objectif : aider à la répartition des dossiers, identifier les dossiers complexes,
> et adapter la charge de travail selon le niveau des collaborateurs.

---

### Principe de notation

Chaque collaborateur ayant accès au dossier peut noter **sa propre perception** de la
difficulté, selon son niveau. La note globale est une **moyenne pondérée** par niveau :
un Expert-comptable pèse plus lourd qu'un Assistant.

```typescript
// Chaque collaborateur note de 1 à 5
type NoteDifficulte = 1 | 2 | 3 | 4 | 5

// Signification des notes (affichée dans l'UI)
const ECHELLE_DIFFICULTE = {
  1: { label: "Très simple",  emoji: "🟢", description: "Dossier standard, aucune complexité" },
  2: { label: "Simple",       emoji: "🟡", description: "Quelques points à surveiller" },
  3: { label: "Modéré",       emoji: "🟠", description: "Nécessite de l'expérience" },
  4: { label: "Complexe",     emoji: "🔴", description: "Points techniques difficiles" },
  5: { label: "Très complexe",emoji: "⚫", description: "Dossier expert uniquement" },
}
```

---

### Poids par niveau de collaborateur

```typescript
const POIDS_PAR_ROLE: Record<Role, number> = {
  ASSISTANT:        0.5,  // Vision partielle du dossier
  CONFIRME:         1.0,  // Référence neutre
  SUPERVISEUR:      1.5,  // Vue d'ensemble + recul
  EXPERT_COMPTABLE: 2.0,  // Juge ultime de la complexité
}

function calculerNoteDifficulteGlobale(evaluations: Evaluation[]): number | null {
  if (evaluations.length === 0) return null

  const totalPoids = evaluations.reduce((sum, e) => sum + POIDS_PAR_ROLE[e.role], 0)
  const totalPondere = evaluations.reduce((sum, e) => sum + e.note * POIDS_PAR_ROLE[e.role], 0)

  return Math.round((totalPondere / totalPoids) * 10) / 10 // arrondi à 1 décimale
}
```

---

### Modèle de données

```typescript
// Table : dossier_evaluations
interface DossierEvaluation {
  id:              string        // UUID
  tenant_id:       string        // FK tenant
  dossier_id:      string        // FK dossier
  evaluateur_id:   string        // FK utilisateur
  role_evaluateur: Role          // Rôle au moment de l'évaluation (snapshot)
  note:            NoteDifficulte // 1 à 5
  axes: {
    comptable:     NoteDifficulte // Complexité comptable (opérations, volume)
    fiscal:        NoteDifficulte // Complexité fiscale (régimes, optimisation)
    relationnel:   NoteDifficulte // Relation client (réactivité, exigences)
    organisationnel: NoteDifficulte // Organisation interne (docs manquants, retards)
  }
  commentaire:     string | null  // Note libre optionnelle
  created_at:      Date
  updated_at:      Date
}

// Champ calculé sur la table dossiers (mise à jour automatique)
// dossier.note_difficulte_globale : number | null  (1.0 → 5.0)
// dossier.nb_evaluations          : number
// dossier.derniere_evaluation_at  : Date | null
```

---

### Les 4 axes d'évaluation

Chaque collaborateur note **4 dimensions** indépendantes (note 1→5 chacune) :

| Axe              | Ce que ça mesure                                                   | Visible par         |
|------------------|--------------------------------------------------------------------|---------------------|
| **Comptable**    | Volume d'opérations, opérations atypiques, qualité des pièces     | Tous                |
| **Fiscal**       | Régimes complexes, optimisation, TVA intracommunautaire, holding   | Confirmé+           |
| **Relationnel**  | Réactivité client, exigences, conflits, changements fréquents      | Tous                |
| **Organisationnel** | Documents manquants chroniques, retards, désorganisation client | Tous                |

> La note globale du dossier = moyenne pondérée de la note composite de chaque évaluateur.
> La note composite d'un évaluateur = moyenne simple de ses 4 axes.

---

### Règles d'accès à la notation

```typescript
// Qui peut noter ?
// → Tout collaborateur ayant travaillé sur le dossier (présent dans collaborateurs_dossier)
// → Un collaborateur ne peut pas noter un dossier auquel il n'est pas affecté

// Qui peut voir les notes individuelles ?
// → L'évaluateur voit sa propre note
// → Superviseur et Expert-comptable voient toutes les notes individuelles
// → Assistant et Confirmé voient uniquement la note globale (pas les détails par personne)

// Qui peut modifier/supprimer une note ?
// → L'évaluateur peut modifier sa propre note (historique conservé)
// → Expert-comptable peut supprimer n'importe quelle note abusive
```

---

### UI — Composant de notation `<NotationDifficulte />`

```
┌─────────────────────────────────────────────────────┐
│  Difficulté du dossier            Note globale: 3.4 🟠│
├─────────────────────────────────────────────────────┤
│  Votre évaluation                                    │
│                                                      │
│  Comptable      ○ ○ ● ○ ○   3/5                     │
│  Fiscal         ○ ○ ○ ● ○   4/5                     │
│  Relationnel    ○ ● ○ ○ ○   2/5                     │
│  Organisationnel○ ○ ● ○ ○   3/5                     │
│                                                      │
│  Commentaire (optionnel)                             │
│  ┌──────────────────────────────────────────────┐   │
│  │ Client très lent à envoyer les documents...  │   │
│  └──────────────────────────────────────────────┘   │
│                              [Enregistrer ma note]   │
├─────────────────────────────────────────────────────┤
│  Évaluations (3)           [visible Superviseur+]   │
│  Souhila (Confirmé)    ●●●○○  2.8  "Dossier dense"  │
│  Cassandre (Confirmé)  ●●●●○  3.8                   │
│  Pierre (Expert-EC)    ●●●●○  3.8  "Holding complexe"│
└─────────────────────────────────────────────────────┘
```

---

### Utilisation des notes dans le reste de l'app

```typescript
// 1. Répartition intelligente des dossiers
//    → Suggestions lors de l'affectation d'un collaborateur
//    → Alerte si Assistant affecté à un dossier noté 4 ou 5

// 2. Statistiques cabinet
//    → Distribution des dossiers par niveau de difficulté
//    → Charge pondérée par collaborateur (nb dossiers × note moyenne)

// 3. Tableau de charge réaliste
//    → Pas juste "nb dossiers" mais "nb dossiers × difficulté"
//    → Exemple : 20 dossiers à 2.0 = même charge que 10 dossiers à 4.0

// 4. Filtres et tris dans la liste des dossiers
//    → Trier par difficulté descendante
//    → Filtrer : dossiers complexes (>= 4) sans Expert-comptable affecté
```

---

### API Routes

```
POST /api/dossiers/:id/evaluations         → Créer/mettre à jour ma note
GET  /api/dossiers/:id/evaluations         → Lire les évaluations (droits selon rôle)
DELETE /api/dossiers/:id/evaluations/:evalId → Supprimer (Expert-comptable uniquement)
GET  /api/stats/difficulte                 → Distribution globale + charge pondérée
```

## 🚫 Ce que Claude NE doit JAMAIS faire

- ❌ Requête Prisma sans `WHERE tenant_id = ...` (isolation multi-tenant stricte)
- ❌ Hard-coder le nom "Fiduciaire" ou "Finatec" dans le code (ce sont des données en base, pas des constantes)
- ❌ Considérer les collaborateurs du cabinet pilote comme des utilisateurs système
- ❌ Hard-coder une date d'échéance — toujours calculer depuis `date_cloture_exercice`
- ❌ Stocker SIREN comme `integer` (perte des zéros initiaux)
- ❌ Oublier `.trim()` sur `regime_fiscal` à l'import (Excel contient "IS ")
- ❌ Traiter `"-"` comme un collaborateur réel (= NULL)
- ❌ Appeler `api.anthropic.com` depuis le frontend
- ❌ Inline un prompt IA dans le code — charger depuis `/prompts/`
- ❌ Utiliser `any` en TypeScript
- ❌ Ignorer les 37 dossiers à clôture décalée dans le moteur d'échéances
- ❌ Modifier le schéma Prisma sans créer une migration

---

## 🚀 Ordre de développement

| Phase | Session Claude Code | Contenu                                                                     |
|-------|---------------------|-----------------------------------------------------------------------------|
| **1** | Session 1 (2-4h)    | Auth Azure AD + Prisma schema + **script import SUIVI_2026.xlsx** + CRUD   |
| **2** | Session 2 (1-2h)    | Moteur échéances (TVA/IS/juridique) + scheduler alertes + agenda            |
| **3** | Session 3 (1-2h)    | Tableau de bord KPIs + fiche dossier 6 tabs + grille TVA colorée            |
| **4** | Session 4 (2-3h)    | Graph API Outlook + classification IA + résumés + file de traitement emails |
| **5** | Session 5 (1h)      | Stats cabinet + exports CSV/PDF + tableau de charge collaborateurs          |
| **6** | Session 6 (1-2h)    | Tests (Vitest + Playwright) + polish UI + déploiement Vercel/Railway        |

> L'intégralité du projet peut être livré en **1 à 2 jours** avec Claude Code.
> Chaque session correspond à une commande du type :
> `"Lis CLAUDE.md et réalise la Phase N : [contenu]"`

> ⚠️ **Priorité absolue Session 1** : le script `scripts/import-excel.ts` doit importer
> les 170 dossiers existants sans perte de données selon le mapping du tableau ci-dessus.
> C'est le test d'acceptation de la Phase 1.
