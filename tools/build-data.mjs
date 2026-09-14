#!/usr/bin/env node
/**
 * build-data.mjs — fusionne le corpus du Bureau du Plan et la couche editoriale
 * en deux fichiers servis tels quels par le site.
 *
 *   assets/data/corpus.json  les 263 mesures, pour l'encyclopedie et la recherche
 *   assets/data/jeu.json     le paquet jouable, pour le simulateur
 *
 * Zero dependance. Node 18+.  Usage : node tools/build-data.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const brut     = lire("tools/source/mesures-brut.json");
const enrichi  = lire("tools/enrichissement-mesures.json");
const extra    = lire("tools/cartes-extra.json");
const trad     = lire("tools/traductions.json").titres;
const config   = lire("tools/enrichissement.json");

/* Categories du classeur, en francais. Traduction Ouaisfieu. */
const CATEGORIES = {
  "Meerdere categorieën: diverse heffingen": "Prélèvements divers",
  "Meerdere categorieën: diverse heffingen ": "Prélèvements divers",
  "Langere termijn hervormingen": "Réformes de long terme",
  "Personenbelasting": "Impôt des personnes physiques",
  "Geneeskundige verzorging": "Soins de santé",
  "Overdrachten naar gewesten, gemeenschappen en anderen": "Transferts aux entités fédérées",
  "Sociale bijdragen": "Cotisations sociales",
  "Sociale bijdragen ": "Cotisations sociales",
  "Roerende voorheffing": "Précompte mobilier",
  "Lonen en Werking": "Rémunérations et fonctionnement",
  "Lonen en werking": "Rémunérations et fonctionnement",
  "Vennootschapsbelasting": "Impôt des sociétés",
  "Subsidies": "Subsides",
  "BTW": "TVA",
  "Meerdere categorieën: indexering": "Indexation",
  "Meerdere categorieën: diverse sociale uitkeringen": "Prestations sociales",
  "Overdrachten naar EU": "Transferts à l'Union européenne",
  "Pensioenen": "Pensions",
  "Ziekte- en invaliditeitsuitkering": "Maladie et invalidité",
  "Ziekte- en invaliditeitsuitkering ": "Maladie et invalidité",
  "Werkloosheid": "Chômage",
  "Niet-fiscale ontvangsten": "Recettes non fiscales",
  "Investeringen": "Investissements",
};

const SOUS_CATEGORIES = {
  "Aanpassen of schrappen van (para)fiscale niches / uitzonderingsregimes": "Niches et régimes dérogatoires",
  "Begrotingsproces / Management": "Processus budgétaire",
  "Efficiëntie-Effectiviteit": "Efficience et effectivité",
  "Arbeidsmarkt/Productiviteit": "Marché du travail et productivité",
  "Verbreding aanslagbasis": "Élargissement de la base imposable",
  "Aanpassing tariefstructuur": "Structure des taux",
  "Aanpassing tariefstructuur ": "Structure des taux",
  "Belastingverschuiving": "Glissement fiscal",
  "BFW hervormen": "Réforme de la loi de financement",
  "Globalisering": "Globalisation des revenus",
  "Ombouw/afbouw fossiele brandstofsubsidies": "Subsides aux énergies fossiles",
  "Huurinkomsten": "Revenus locatifs",
  "Geplande verlaging herzien": "Révision des baisses programmées",
  "Strijd tegen fraude": "Lutte contre la fraude",
  "Herziening loonsubsidies": "Révision des subventions salariales",
  "Meerwaardebelasting": "Taxation des plus-values",
  "Groeinorm": "Norme de croissance",
  "Efficiëntie-Effectiviteit belastinginning": "Efficience de la perception",
  "Bijdrage G&G en lokale overheden": "Contribution des entités et pouvoirs locaux",
  "Beleid op EU-niveau": "Politique au niveau européen",
  "Vermogensbelasting": "Impôt sur le patrimoine",
  "Financiële operatie": "Opération financière",
  "Herziening inkomenstoetsing": "Conditions de ressources",
  "kapitaal- en vermogensinkomsten - Dual income": "Revenus du capital, dual income",
  "Remgeld": "Ticket modérateur",
  "Managementvennootschappen": "Sociétés de management",
  "Betere coördinatie / minder complexiteit": "Coordination et complexité",
  "DBI": "Revenus définitivement taxés",
  "Migratie en ontwikkelingssamenwerking": "Migration et coopération",
  "Besparing": "Économie",
  "Plafonnering sociale bijdragen": "Plafonnement des cotisations",
  "Forfaitaire besparing maatregelen": "Économies forfaitaires",
  "Evaluatie kost vs maatschappelijke voordeel": "Coût contre bénéfice social",
  "Hervorming index": "Réforme de l'index",
  "Bankentaks": "Taxe bancaire",
  "Belastingcoördinatie": "Coordination fiscale",
  "Herziening centenindex": "Révision du centim'index",
  "Politieke mandatarissen": "Mandataires politiques",
  "Beperkte accumulatie van uitkeringen": "Cumul d'allocations",
  "Indexsprong met loonmatigingsbijdrage": "Saut d'index",
  "Meer PPS": "Partenariats public-privé",
  "Overige": "Divers",
  "Caymantaks": "Taxe Caïman",
  "Effectentaks": "Taxe sur les comptes-titres",
};

const fr = (map, v) => map[v] ?? map[String(v ?? "").trim()] ?? (v || null);

/* Adresse lisible, construite sur l'intitule FRANCAIS : c'est lui que l'on
   cherche, et c'est lui qui doit figurer dans l'URL. La numerotation du
   classeur ("3. Prevoir davantage de...") est retiree. */
const vus = new Map();
function adresse(titre) {
  let s = titre
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*\(?[A-Za-z]{0,3}\)?\s*\d+[a-z]?[.)]\s*/, "")
    .replace(/^\s*\((?:KT|LT)\)\s*/i, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > 68) s = s.slice(0, 68).replace(/-[^-]*$/, "");
  if (!s) s = "mesure";
  const n = (vus.get(s) ?? 0) + 1;
  vus.set(s, n);
  return n === 1 ? s : `${s}-${n}`;
}

/* Part du rendement a regime effectivement atteinte a l'horizon 2029.
   Une reforme qui demande cinq ans de transition ne rapporte pas son plein
   montant dans la fenetre du plan budgetaire. Hypothese editoriale. */
const HORIZON = { immediat: 1, court: 0.9, moyen: 0.7, long: 0.4 };

/* ---------- corpus ---------- */
const corpus = brut.mesures.map((m) => {
  const e = enrichi[m.ref] ?? extra.mesures[m.ref] ?? null;
  const meth = extra.methode[m.ref] ?? null;
  const traduction = trad[m.ref] ?? null;

  const titreFr = traduction ?? m.titre;
  return {
    ref: m.ref,
    slug: adresse(e?.titreJeu ?? meth?.titreJeu ?? titreFr),
    titreOriginal: m.titre,
    langueOriginal: traduction ? "nl" : "fr",
    titre: traduction ?? m.titre,
    titreCourt: e?.titreJeu ?? meth?.titreJeu ?? null,
    categorie: fr(CATEGORIES, m.categorie),
    categorieOriginal: m.categorie || null,
    sousCategorie: m.sousCategorie ? fr(SOUS_CATEGORIES, m.sousCategorie) : null,
    modalites: m.modalites || null,
    motivation: m.motivation || null,
    montant: m.montant ?? e?.montant ?? null,
    provenance: m.montant != null ? "bfp" : (e?.provenance ?? null),
    parti: m.parti,
    sourceUrl: m.sourceUrl,
    jouable: Boolean(e?.jouable),
    methode: Boolean(meth),
    note: e?.note ?? meth?.note ?? null,
  };
});

/* ---------- paquet jouable ---------- */
const index = new Map(corpus.map((m) => [m.ref, m]));
const carte = (ref, e, type) => {
  const m = index.get(ref);
  return {
    id: ref,
    slug: m.slug,
    type,
    titre: e.titreJeu,
    titreLong: m.titre,
    categorie: m.categorie,
    sousCategorie: m.sousCategorie,
    parti: m.parti,
    nature: e.type ?? "methode",
    montant: type === "methode" ? 0 : (m.montant ?? e.montant ?? 0),
    /* Un one-shot est un stock, pas un flux : meme affiche, il ne peut peser
       dans un effort annuel que pour une fraction etalee. */
    montantHorizon:
      type === "methode"
        ? 0
        : Math.round(
            (m.montant ?? e.montant ?? 0) *
              (e.type === "oneshot" ? 0.2 : HORIZON[e.delai ?? "moyen"] ?? 0.7)
          ),
    provenance: m.provenance ?? e.provenance ?? null,
    sens: e.sens ?? 1,
    sensCertitude: e.sensCertitude ?? "haute",
    credibilite: e.credibilite ?? 3,
    gainCredibilite: e.gainCredibilite ?? 0,
    rue: e.rue ?? 0,
    delai: e.delai ?? null,
    risqueJuridique: e.risqueJuridique ?? 0,
    transfertE2: e.transfertE2 ?? 0,
    effetRetour: Boolean(e.effetRetour),
    structurel: e.structurel !== false,
    impactSocial: e.impactSocial ?? 0,
    reactions: e.reactions,
    ligneRouge: e.ligneRouge ?? [],
    chevauche: e.chevauche ?? [],
    famille: e.famille ?? "methode",
    note: e.note,
  };
};

const paquet = [
  ...Object.entries(enrichi).map(([ref, e]) => carte(ref, e, "mesure")),
  ...Object.entries(extra.mesures).map(([ref, e]) => carte(ref, e, "mesure")),
  ...Object.entries(extra.methode).map(([ref, e]) => carte(ref, e, "methode")),
  ...extra.artifices.map((a) => ({
    id: a.id, slug: null, type: "artifice", titre: a.titreJeu, titreLong: a.titreJeu,
    categorie: "Artifice budgétaire", sousCategorie: null, parti: null,
    nature: "artifice",
    montant: a.montant, montantHorizon: a.montant, provenance: a.provenance,
    sens: 1, sensCertitude: "haute",
    credibilite: a.credibilite, gainCredibilite: a.gainCredibilite, rue: 0,
    delai: "immediat", risqueJuridique: 0, transfertE2: 0, effetRetour: true,
    structurel: false, impactSocial: 0, reactions: a.reactions, ligneRouge: [],
    chevauche: [], famille: a.famille, note: a.note, avertissement: a.avertissement,
  })),
];

/* chevauchement symetrique : si A recoupe B, B recoupe A */
const parId = new Map(paquet.map((c) => [c.id, c]));
for (const c of paquet)
  for (const autre of c.chevauche) {
    const b = parId.get(autre);
    if (b && !b.chevauche.includes(c.id)) b.chevauche.push(c.id);
  }

const ecrire = (p, o) => writeFileSync(join(ROOT, p), JSON.stringify(o, null, 1) + "\n");

ecrire("assets/data/corpus.json", {
  source: brut.source,
  avertissement:
    "Les montants marques bfp proviennent du classeur du Bureau federal du Plan. Les montants marques analyse proviennent de l'analyse Ouaisfieu Trouver 23 milliards. Le reste de la fiche (faisabilite, credibilite, reactions) est editorial.",
  mesures: corpus,
});
ecrire("assets/data/jeu.json", {
  version: 1,
  partis: config.partis,
  bareme: config.bareme,
  cartes: paquet,
});

const n = (f) => paquet.filter(f).length;
console.log(
  `corpus.json  ${corpus.length} mesures (${corpus.filter((m) => m.montant != null).length} chiffrees, ${corpus.filter((m) => m.langueOriginal === "nl").length} traduites)\n` +
  `jeu.json     ${paquet.length} cartes : ${n((c) => c.type === "mesure")} mesures, ${n((c) => c.type === "methode")} methode, ${n((c) => c.type === "artifice")} artifices\n` +
  `             ${paquet.filter((c) => c.ligneRouge.length).length} franchissent une ligne rouge, ` +
  `${paquet.filter((c) => c.chevauche.length).length} presentent un risque de double comptage`
);
