#!/usr/bin/env node
/**
 * solveur.mjs — cherche les combinaisons de mesures qui passent le conclave.
 *
 * Recherche par faisceau sur les 76 cartes et les cinq bilatérales, sous la
 * contrainte des actions disponibles et de la survie des cinq partis. Le
 * rendement réel est calculé en espérance : la loterie du recours juridique
 * est remplacée par son espérance, pour que les résultats publiés ne dépendent
 * pas d'un tirage.
 *
 * Hypothèse volontairement prudente : la reprise nocturne de cohésion, qui
 * rend quatre points par nuit à un partenaire sous 58, n'est PAS comptée. Les
 * combinaisons publiées sont donc plus sûres en jeu qu'à l'écran.
 *
 * Zéro dépendance. Usage : node tools/solveur.mjs
 * Sortie : assets/data/combinaisons.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const D = JSON.parse(readFileSync(join(ROOT, "assets/data/jeu.json"), "utf8"));
const B = D.bareme;
const PARTIS = ["nva", "mr", "vooruit", "cdv", "le"];
const borne = (v) => Math.max(0, Math.min(100, v));

/* ---------- précalcul : tout ce qui ne dépend pas de l'ordre ---------- */
const CARTES = D.cartes;
const IDX = new Map(CARTES.map((c, i) => [c.id, i]));
const FAMILLES = [...new Set(CARTES.map((c) => c.famille))];
const FAM = new Map(FAMILLES.map((f, i) => [f, i]));

/* rendement réel d'une carte, hors chevauchement et hors facteur global */
function unitaire(c) {
  let r = (c.montantHorizon ?? 0) * (c.sens ?? 1);
  if (r < 0) return r;
  if (c.type === "artifice" || (!c.structurel && c.famille === "one-shot")) return 0;
  if (!c.structurel) r *= 0.4;
  r *= B.facteurCredibilite[Math.max(0, Math.min(4, (c.credibilite || 3) - 1))];
  r *= 1 - (c.transfertE2 || 0);
  if (c.effetRetour) r *= 1 - B.penaliteEffetRetour;
  r *= 1 - Math.min(1, (c.risqueJuridique || 0) * 0.16);
  return r;
}

const PRE = CARTES.map((c) => {
  const dCoh = PARTIS.map((p) => {
    let d = (c.reactions?.[p] ?? 0) * B.impactReaction;
    return { normal: d - (c.ligneRouge?.includes(p) ? B.impactLigneRouge : 0),
             assoupli: d - (c.ligneRouge?.includes(p) ? B.impactLigneRouge * 0.5 : 0) };
  });
  let dc = c.gainCredibilite || 0;
  if (c.type === "mesure") {
    if (c.credibilite <= 2) dc -= 3;
    if (c.effetRetour) dc -= 4;
    if (!c.structurel) dc -= 6;
    if (c.transfertE2 >= 0.5) dc -= 5;
  }
  return {
    c, dCoh, dCred: dc,
    dRue: (c.rue || 0) + Math.max(0, -(c.impactSocial || 0)) * 4,
    aff: (c.montantHorizon ?? 0) * (c.sens ?? 1),
    reel: unitaire(c),
    fam: FAM.get(c.famille),
    ligneRouge: (c.ligneRouge ?? []).map((p) => PARTIS.indexOf(p)),
  };
});

/* ---------- état compact ---------- */
const etatVide = () => ({
  c0: 70, c1: 70, c2: 70, c3: 70, c4: 70,
  cred: B.credibiliteDepart, rue: B.rueDepart,
  aff: 0, reel: 0,
  m0: 0, m1: 0,        // masque des cartes, 2 × 32 bits
  fam: 0n,             // masque des familles déjà servies
  bi: 0,               // masque des bilatérales
  n: 0,                // nombre d'actions
  liste: [],
});

const aCarte = (e, i) => (i < 32 ? (e.m0 >>> i) & 1 : (e.m1 >>> (i - 32)) & 1);

function poserCarte(e, i) {
  const P = PRE[i];
  const assoupli = P.ligneRouge.length && P.ligneRouge.every((k) => (e.bi >> k) & 1);
  const d = P.dCoh;
  const n = {
    c0: borne(e.c0 + (((e.bi >> 0) & 1) ? d[0].assoupli : d[0].normal)),
    c1: borne(e.c1 + (((e.bi >> 1) & 1) ? d[1].assoupli : d[1].normal)),
    c2: borne(e.c2 + (((e.bi >> 2) & 1) ? d[2].assoupli : d[2].normal)),
    c3: borne(e.c3 + (((e.bi >> 3) & 1) ? d[3].assoupli : d[3].normal)),
    c4: borne(e.c4 + (((e.bi >> 4) & 1) ? d[4].assoupli : d[4].normal)),
    cred: borne(e.cred + P.dCred),
    rue: borne(e.rue + P.dRue),
    aff: e.aff + P.aff,
    reel: e.reel + (P.reel > 0 && (e.fam >> BigInt(P.fam)) & 1n ? P.reel * B.penaliteChevauchement : P.reel),
    m0: i < 32 ? e.m0 | (1 << i) : e.m0,
    m1: i >= 32 ? e.m1 | (1 << (i - 32)) : e.m1,
    fam: e.fam | (1n << BigInt(P.fam)),
    bi: e.bi, n: e.n + 1, liste: e.liste.concat(i),
  };
  return n;
}

function poserBilaterale(e, k) {
  const n = { ...e, liste: e.liste.slice() };
  const cle = ["c0", "c1", "c2", "c3", "c4"];
  n[cle[k]] = borne(e[cle[k]] + 16);
  for (let j = 0; j < 5; j++) if (j !== k) n[cle[j]] = borne(n[cle[j]] - 4);
  n.cred = borne(n.cred - 2);
  n.bi = e.bi | (1 << k);
  n.n = e.n + 1;
  return n;
}

const cohMin = (e) => Math.min(e.c0, e.c1, e.c2, e.c3, e.c4);
const survit = (e, marge) => cohMin(e) >= marge && e.rue < 100;
const facteurGlobal = (cred) => 0.75 + 0.25 * (cred / 100);
const reelFinal = (e) => Math.max(0, e.reel * facteurGlobal(e.cred));

function mention(e, objectif) {
  const reel = reelFinal(e);
  const couv = reel / objectif;
  const ecart = e.aff - reel;
  const s = couv * 55 + (e.cred / 100) * 30 + (1 - Math.min(1, ecart / Math.max(1, e.aff))) * 15;
  return { s, lettre: s > 82 ? "A" : s > 68 ? "B" : s > 52 ? "C" : s > 36 ? "D" : "E" };
}

/* ---------- recherche par faisceau ---------- */
function faisceau({ objectif, actionsMax, score, filtre = () => true, largeur = 900, margeCohesion = 8, affMax = Infinity }) {
  const pool = [];
  for (let i = 0; i < CARTES.length; i++) if (filtre(CARTES[i])) pool.push(i);
  let front = [etatVide()];
  const atteints = [];

  for (let pas = 0; pas < actionsMax; pas++) {
    const vus = new Set();
    const suivant = [];
    for (const e of front) {
      for (const i of pool) {
        if (aCarte(e, i)) continue;
        const n = poserCarte(e, i);
        if (!survit(n, margeCohesion) || n.aff > affMax) continue;
        const cle = `${n.m0}:${n.m1}:${n.bi}`;
        if (vus.has(cle)) continue;
        vus.add(cle); suivant.push(n);
      }
      for (let k = 0; k < 5; k++) {
        if ((e.bi >> k) & 1) continue;
        const n = poserBilaterale(e, k);
        if (!survit(n, margeCohesion)) continue;
        const cle = `${n.m0}:${n.m1}:${n.bi}`;
        if (vus.has(cle)) continue;
        vus.add(cle); suivant.push(n);
      }
    }
    if (!suivant.length) break;
    suivant.sort((a, b) => score(b, objectif) - score(a, objectif));
    front = suivant.slice(0, largeur);
    for (const e of front) if (e.aff >= objectif) atteints.push(e);
  }
  return atteints;
}

/* ---------- objectifs ---------- */
const OBJ = 10000;
const PLAFOND = 13000;          /* on cherche une trajectoire, pas une surenchère */

const recettes = [];
const garder = (cle, liste, tri, objectif = OBJ) => {
  const e = liste.filter((x) => cohMin(x) >= 12).sort(tri)[0] ?? liste.sort(tri)[0];
  if (e) recettes.push({ cle, etat: e, objectif });
};

/* A — le plancher : le moins d'actions possible pour la fumée blanche */
garder("plancher", faisceau({
  objectif: OBJ, actionsMax: 12, margeCohesion: 18, largeur: 900, affMax: PLAFOND,
  score: (e) => (e.aff >= OBJ ? 100 : e.aff / 1000 * 8) - e.n * 2.5 + cohMin(e) * 0.08,
}), (a, b) => a.n - b.n || cohMin(b) - cohMin(a));

/* B — la combinaison de référence : meilleur rendement réellement constaté */
garder("reference", faisceau({
  objectif: OBJ, actionsMax: 18, margeCohesion: 14, largeur: 1400, affMax: PLAFOND,
  score: (e) => reelFinal(e) / 1000 * 14 + Math.min(e.aff, OBJ) / 1000 * 3 + e.cred * 0.12 + cohMin(e) * 0.06,
}), (a, b) => reelFinal(b) - reelFinal(a));

/* C — sans franchir une seule ligne rouge */
garder("sans-ligne-rouge", faisceau({
  objectif: OBJ, actionsMax: 18, margeCohesion: 16, largeur: 1200, affMax: PLAFOND,
  filtre: (c) => !c.ligneRouge?.length,
  score: (e) => reelFinal(e) / 1000 * 12 + Math.min(e.aff, OBJ) / 1000 * 4 + e.cred * 0.12,
}), (a, b) => reelFinal(b) - reelFinal(a));

/* D — la part réalisée la plus élevée, quel que soit le total */
garder("fidelite", faisceau({
  objectif: OBJ, actionsMax: 18, margeCohesion: 14, largeur: 1400, affMax: PLAFOND,
  score: (e) => (e.aff ? reelFinal(e) / e.aff : 0) * 90 + Math.min(e.aff, OBJ) / 1000 * 3 + e.cred * 0.1,
}), (a, b) => (reelFinal(b) / Math.max(1, b.aff)) - (reelFinal(a) / Math.max(1, a.aff)));

/* E — l'accord de façade : l'écart maximal, à objectif tout juste atteint */
garder("facade", faisceau({
  objectif: OBJ, actionsMax: 18, margeCohesion: 8, largeur: 1200, affMax: 11500,
  score: (e) => (e.aff >= OBJ ? (e.aff - reelFinal(e)) / 1000 * 12 : e.aff / 1000 * 4) - e.n * 0.3,
}), (a, b) => (b.aff - reelFinal(b)) - (a.aff - reelFinal(a)));

/* F — les vingt-trois milliards, horizon 2031, huit nuits */
garder("vingt-trois", faisceau({
  objectif: 23000, actionsMax: 24, margeCohesion: 6, largeur: 1400, affMax: 27000,
  score: (e) => reelFinal(e) / 1000 * 10 + Math.min(e.aff, 23000) / 1000 * 5 + e.cred * 0.1 + cohMin(e) * 0.1,
}), (a, b) => reelFinal(b) - reelFinal(a), 23000);

/* G — la marge : viser 12,5 Md€, parce que les événements font monter la barre */
garder("marge", faisceau({
  objectif: 12500, actionsMax: 18, margeCohesion: 12, largeur: 1400, affMax: 15000,
  score: (e) => reelFinal(e) / 1000 * 12 + Math.min(e.aff, 12500) / 1000 * 4 + e.cred * 0.1,
}), (a, b) => reelFinal(b) - reelFinal(a), 12500);

/* H — la thèse mise à l'épreuve : 23 milliards sans franchir une ligne rouge */
{
  const r = faisceau({
    objectif: 23000, actionsMax: 24, margeCohesion: 6, largeur: 1400, affMax: 27000,
    filtre: (c) => !c.ligneRouge?.length,
    score: (e) => e.aff / 1000 * 9 + reelFinal(e) / 1000 * 4 + cohMin(e) * 0.08,
  });
  const tous = r.length ? r : null;
  recettes.push({ cle: "vingt-trois-sans-ligne-rouge",
    etat: tous ? tous.sort((a, b) => b.aff - a.aff)[0] : null, objectif: 23000,
    /* si aucun état n'atteint 23 000, on publie le plafond réellement atteignable */
    plafond: true });
}

/* ---------- sortie ---------- */
const idsDe = (e) => e.liste.map((i) => CARTES[i].id);
const biDe = (e) => PARTIS.filter((_, k) => (e.bi >> k) & 1);
const lien = (e, mode = "conclave") => {
  const charge = JSON.stringify({ m: mode, g: 2026, n: 1, a: idsDe(e), b: biDe(e) });
  return Buffer.from(charge, "utf8").toString("base64")
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const detail = (e, objectif) => {
  const cartes = e.liste.map((i) => CARTES[i]);
  const reel = reelFinal(e);
  const m = mention(e, objectif);
  return {
    actions: e.n,
    bilaterales: biDe(e),
    cartes: cartes.map((c) => ({
      id: c.id, slug: c.slug, titre: c.titre, type: c.type, famille: c.famille,
      montantHorizon: Math.round((c.montantHorizon ?? 0) * (c.sens ?? 1)),
      montant: Math.round((c.montant ?? 0) * (c.sens ?? 1)),
      provenance: c.provenance, parti: c.parti,
      credibilite: c.credibilite, ligneRouge: c.ligneRouge ?? [],
    })),
    affiche: Math.round(e.aff),
    reel: Math.round(reel),
    ecart: Math.round(e.aff - reel),
    partRealisee: e.aff ? reel / e.aff : 0,
    credibilite: Math.round(e.cred),
    rue: Math.round(e.rue),
    cohesion: { nva: Math.round(e.c0), mr: Math.round(e.c1), vooruit: Math.round(e.c2), cdv: Math.round(e.c3), le: Math.round(e.c4) },
    cohesionMin: Math.round(cohMin(e)),
    mention: m.lettre,
    nbMethode: cartes.filter((c) => c.type === "methode").length,
    nbMesures: cartes.filter((c) => c.type === "mesure").length,
    lien: lien(e, objectif > 15000 ? "honnete" : "conclave"),
  };
};

/* plafond absolu atteignable sans franchir aucune ligne rouge, 24 actions */
const sansLR = faisceau({
  objectif: 1e9, actionsMax: 24, margeCohesion: 4, largeur: 1400,
  filtre: (c) => !c.ligneRouge?.length,
  score: (e) => e.aff / 1000 * 10 + cohMin(e) * 0.05,
});
let meilleurSansLR = null;
{
  let front = [etatVide()];
  const pool = [];
  for (let i = 0; i < CARTES.length; i++) if (!CARTES[i].ligneRouge?.length) pool.push(i);
  for (let pas = 0; pas < 24; pas++) {
    const vus = new Set(); const suiv = [];
    for (const e of front) {
      for (const i of pool) {
        if (aCarte(e, i)) continue;
        const n = poserCarte(e, i);
        if (!survit(n, 4)) continue;
        const cle = `${n.m0}:${n.m1}:${n.bi}`;
        if (vus.has(cle)) continue; vus.add(cle); suiv.push(n);
      }
      for (let k = 0; k < 5; k++) {
        if ((e.bi >> k) & 1) continue;
        const n = poserBilaterale(e, k);
        if (!survit(n, 4)) continue;
        const cle = `${n.m0}:${n.m1}:${n.bi}`;
        if (vus.has(cle)) continue; vus.add(cle); suiv.push(n);
      }
    }
    if (!suiv.length) break;
    suiv.sort((a, b) => b.aff - a.aff);
    front = suiv.slice(0, 1400);
    if (!meilleurSansLR || front[0].aff > meilleurSansLR.aff) meilleurSansLR = front[0];
  }
}
const plafondSansLigneRouge = meilleurSansLR
  ? { affiche: Math.round(meilleurSansLR.aff), reel: Math.round(reelFinal(meilleurSansLR)),
      actions: meilleurSansLR.n, cohesionMin: Math.round(cohMin(meilleurSansLR)) }
  : null;

/* ---------- statistiques transverses ---------- */
const mesures = D.cartes.filter((c) => c.type === "mesure");
const stats = {
  lignesRougesParParti: Object.fromEntries(PARTIS.map((p) => [p,
    D.cartes.filter((c) => c.ligneRouge?.includes(p)).length])),
  hostiliteMoyenne: Object.fromEntries(PARTIS.map((p) => [p,
    +(mesures.reduce((s, c) => s + (c.reactions?.[p] ?? 0), 0) / mesures.length).toFixed(2)])),
  /* coût en cohésion de chaque milliard affiché, par mesure chiffrée */
  /* Les classements ne portent que sur les mesures qui AMÉLIORENT le solde :
     pour la seule carte de dépense du jeu, la notion de déperdition n'a pas de sens. */
  rendementCohesion: mesures
    .filter((c) => (c.montantHorizon ?? 0) > 0 && (c.sens ?? 1) > 0)
    .map((c) => {
      const cout = PARTIS.reduce((s, p) =>
        s + Math.max(0, -((c.reactions?.[p] ?? 0) * B.impactReaction
          - (c.ligneRouge?.includes(p) ? B.impactLigneRouge : 0))), 0);
      return { id: c.id, slug: c.slug, titre: c.titre,
               md: +(c.montantHorizon / 1000).toFixed(2),
               coutCohesion: Math.round(cout),
               parMilliard: Math.round(cout / (c.montantHorizon / 1000)),
               credibilite: c.credibilite, ligneRouge: c.ligneRouge ?? [] };
    })
    .sort((a, b) => a.parMilliard - b.parMilliard),
  /* écart type entre annonce et constat, mesure par mesure */
  deperdition: mesures
    .filter((c) => (c.montantHorizon ?? 0) > 0 && (c.sens ?? 1) > 0)
    .map((c) => {
      const brut = c.montantHorizon;
      const r = PRE[IDX.get(c.id)].reel;
      return { id: c.id, slug: c.slug, titre: c.titre,
               brut: Math.round(brut), reel: Math.round(r),
               perte: +(1 - r / brut).toFixed(3) };
    })
    .sort((a, b) => b.perte - a.perte),
};

/* ---------- validation dans le vrai moteur ---------- */
const MOT = await import("../assets/js/moteur.js");

function valider(det, mode) {
  const tirages = [];
  for (let g = 1; g <= 60; g++) {
    const e = MOT.nouvellePartie(D, { mode, graine: g });
    for (const p of det.bilaterales) MOT.bilaterale(e, p, D);
    for (const c of det.cartes) MOT.adopter(e, c.id, D);
    const b = MOT.bilan(e, D);
    tirages.push({ reel: b.reel, rupture: e.statut === "rupture" });
  }
  const reels = tirages.map((t) => t.reel).sort((a, b) => a - b);
  return {
    reelMedian: Math.round(reels[Math.floor(reels.length / 2)]),
    reelMin: Math.round(reels[0]),
    reelMax: Math.round(reels[reels.length - 1]),
    ruptures: tirages.filter((t) => t.rupture).length,
    tirages: tirages.length,
  };
}

const sortie = {
  genere: new Date().toISOString().slice(0, 10),
  methode: "Recherche par faisceau sur les 76 cartes et les cinq bilatérales. Rendement réel en espérance, loterie du recours remplacée par son espérance. Reprise nocturne de cohésion non comptée, par prudence.",
  objectifParDefaut: OBJ,
  combinaisons: Object.fromEntries(recettes.filter((r) => r.etat).map((r) => {
    const mode = (r.objectif ?? OBJ) > 15000 ? "honnete" : "conclave";
    const det = { ...detail(r.etat, r.objectif ?? OBJ), objectifVise: r.objectif ?? OBJ, mode };
    det.validation = valider(det, mode);
    return [r.cle, det];
  })),
  plafondSansLigneRouge,
  stats,
};

writeFileSync(join(ROOT, "assets/data/combinaisons.json"), JSON.stringify(sortie, null, 1) + "\n");

for (const [cle, c] of Object.entries(sortie.combinaisons)) {
  console.log(`\n=== ${cle} === ${c.actions} actions · annoncé ${(c.affiche/1000).toFixed(2)} Md€ · ` +
    `réel ${(c.reel/1000).toFixed(2)} Md€ (${Math.round(c.partRealisee*100)} %) · créd ${c.credibilite} · ` +
    `coh min ${c.cohesionMin} · ${c.mention}` + (c.bilaterales.length ? ` · bilatérales: ${c.bilaterales.join(",")}` : ""));
  for (const m of c.cartes)
    console.log(`   ${m.type === "methode" ? "  méth" : String((m.montantHorizon/1000).toFixed(2)).padStart(6)} ${m.titre}${m.ligneRouge.length ? "  ⛔" + m.ligneRouge.join("/") : ""}`);
}
console.log("\nplafond sans ligne rouge :", JSON.stringify(sortie.plafondSansLigneRouge));
