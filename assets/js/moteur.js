/* ============================================================
   moteur.js — logique du conclave. Aucune dependance, aucun DOM.
   Tout est deterministe a partir d'une graine, pour qu'un budget
   partage se rejoue a l'identique.
   ============================================================ */

/* ---------- alea reproductible (mulberry32) ---------- */
export function graineDepuis(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function des(graine) {
  let a = graine >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const borne = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
export const PARTIS = ["nva", "mr", "vooruit", "cdv", "le"];

/* ---------- modes ---------- */
export const MODES = {
  conclave: {
    id: "conclave",
    nom: "Le conclave",
    accroche: "10 milliards d'ici 2029. La coalition Arizona. Six nuits.",
    objectif: 10000, nuits: 6, coalition: PARTIS,
    detail:
      "Le montant sur lequel le gouvernement s'est engagé le 10 juillet 2026, alors que le Comité de monitoring fixait un plancher à 7,7 milliards et la Banque nationale un minimum à 11.",
  },
  honnete: {
    id: "honnete",
    nom: "Vingt-trois milliards",
    accroche: "L'écart réel, horizon 2031. Presque impossible.",
    objectif: 23000, nuits: 8, coalition: PARTIS,
    detail:
      "L'effort annoncé dans l'accord de gouvernement du 31 janvier 2025, et l'écart arithmétique entre la trajectoire à politique inchangée et l'objectif de 3 % du PIB. Dix-neuf mois plus tard, il n'a pas bougé.",
  },
  bac: {
    id: "bac",
    nom: "Bac à sable",
    accroche: "Aucun parti, aucune ligne rouge. Construisez.",
    objectif: 23000, nuits: 99, coalition: [],
    detail:
      "Pour comprendre l'arithmétique sans la contrainte politique. Rien ne vous arrête, et c'est précisément ce qui n'existe pas.",
  },
};

/* ---------- codes ---------- */
/* Six codes, décrits sur /conclave/cheatcodes/. Deux d'entre eux seulement
   changent la difficulté ; les quatre autres ne font qu'afficher ce que le
   moteur savait déjà. Aucun ne touche aux données ni au calcul du réel. */
export const CODES = ["KERN", "MONITORING", "ARIZONA", "HUISCLOS", "BOULEDENEIGE", "FUMEEBLANCHE"];
export const aCode = (etat, code) => Boolean(etat?.codes?.includes(code));

export const actionsDeBase = (etat, donnees) =>
  donnees.bareme.actionsParNuit + (aCode(etat, "HUISCLOS") ? 1 : 0);

/* ---------- creation ---------- */
export function nouvellePartie(donnees, { mode = "conclave", graine = null, codes = [] } = {}) {
  const m = MODES[mode];
  const g = graine ?? (Date.now() % 1e9);
  const cohesion = {};
  for (const p of PARTIS) cohesion[p] = donnees.bareme.cohesionDepart;

  return {
    version: 1,
    mode, graine: g,
    objectif: m.objectif,
    nuitsTotal: m.nuits,
    nuit: 1,
    codes: [...codes],
    actions: donnees.bareme.actionsParNuit + (codes.includes("HUISCLOS") ? 1 : 0),
    actionsBonus: 0,
    cohesion,
    lignesAssouplies: [],
    credibilite: donnees.bareme.credibiliteDepart,
    rue: donnees.bareme.rueDepart,
    adoptees: [],
    ecartees: [],
    main: [],
    journal: [],
    evenements: [],
    debut: Date.now(),
    statut: "en-cours",   // en-cours | fumee-blanche | rupture | douziemes | greve
    cause: null,
  };
}

/* ---------- distribution de la main ---------- */
export function distribuer(etat, donnees, taille = 7) {
  const r = des(etat.graine + etat.nuit * 7919);
  const vus = new Set([...etat.adoptees, ...etat.ecartees, ...etat.main]);
  const dispo = donnees.cartes.filter((c) => !vus.has(c.id));

  /* On melange en assurant une variete de familles et un artifice tentant. */
  const melange = dispo
    .map((c) => ({ c, k: r() - (c.type === "methode" ? 0.12 : 0) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);

  const main = [];
  const familles = new Set();
  for (const c of melange) {
    if (main.length >= taille) break;
    if (familles.has(c.famille) && r() > 0.35) continue;
    familles.add(c.famille);
    main.push(c.id);
  }
  for (const c of melange) {
    if (main.length >= taille) break;
    if (!main.includes(c.id)) main.push(c.id);
  }
  etat.main = main;
  return etat;
}

/* ---------- effets d'une carte ---------- */
function appliquerReactions(etat, carte, donnees, sens = 1) {
  const b = donnees.bareme;
  if (!MODES[etat.mode].coalition.length) return;
  for (const p of PARTIS) {
    let d = (carte.reactions?.[p] ?? 0) * b.impactReaction;
    if (carte.ligneRouge?.includes(p)) {
      const facteur = etat.lignesAssouplies.includes(p) ? 0.5 : 1;
      d -= b.impactLigneRouge * facteur;
    }
    etat.cohesion[p] = borne(etat.cohesion[p] + d * sens);
  }
}

export function adopter(etat, id, donnees) {
  if (etat.statut !== "en-cours") return etat;
  if (etat.adoptees.includes(id)) return etat;
  const carte = donnees.cartes.find((c) => c.id === id);
  if (!carte) return etat;

  etat.adoptees.push(id);
  etat.main = etat.main.filter((x) => x !== id);
  etat.actions -= 1;

  appliquerReactions(etat, carte, donnees, 1);

  let dc = carte.gainCredibilite || 0;
  if (carte.type === "mesure") {
    if (carte.credibilite <= 2) dc -= 3;
    if (carte.effetRetour) dc -= 4;
    if (!carte.structurel) dc -= 6;
    if (carte.transfertE2 >= 0.5) dc -= 5;
  }
  etat.credibilite = borne(etat.credibilite + dc);

  const dr = (carte.rue || 0) + Math.max(0, -(carte.impactSocial || 0)) * 4;
  etat.rue = borne(etat.rue + dr);

  etat.journal.push({ nuit: etat.nuit, type: "adoption", id, dc, dr });
  return verifierFin(etat, donnees);
}

export function ecarter(etat, id) {
  etat.main = etat.main.filter((x) => x !== id);
  if (!etat.ecartees.includes(id)) etat.ecartees.push(id);
  return etat;
}

export function retirer(etat, id, donnees) {
  if (!etat.adoptees.includes(id)) return etat;
  const carte = donnees.cartes.find((c) => c.id === id);
  etat.adoptees = etat.adoptees.filter((x) => x !== id);
  appliquerReactions(etat, carte, donnees, -1);
  etat.actions += 1;
  etat.journal.push({ nuit: etat.nuit, type: "retrait", id });
  return etat;
}

/* ---------- bilaterale ---------- */
export function bilaterale(etat, parti, donnees) {
  if (etat.actions <= 0 || etat.statut !== "en-cours") return etat;
  etat.actions -= 1;
  etat.cohesion[parti] = borne(etat.cohesion[parti] + 16);
  if (!etat.lignesAssouplies.includes(parti)) etat.lignesAssouplies.push(parti);
  /* Une attention concentree sur un partenaire se paie aupres des autres. */
  for (const p of PARTIS) if (p !== parti) etat.cohesion[p] = borne(etat.cohesion[p] - 4);
  etat.credibilite = borne(etat.credibilite - 2);
  etat.journal.push({ nuit: etat.nuit, type: "bilaterale", parti });
  return etat;
}

/* ---------- evenements ---------- */
export const EVENEMENTS = [
  {
    id: "conseil-etat", titre: "Avis du Conseil d'État",
    texte: "La plus haute juridiction administrative étrille une mesure de votre table, jugée particulièrement alambiquée. Précédent : la réforme TVA du 1er mars 2026, retirée après un avis du même ordre, avait ouvert un trou de plusieurs centaines de millions dans un budget déjà voté.",
    condition: (e, d) => cartesDe(e, d).some((c) => c.risqueJuridique >= 2),
    effet: (e, d, r) => {
      const exposees = cartesDe(e, d).filter((c) => c.risqueJuridique >= 2);
      const c = exposees[Math.floor(r() * exposees.length)];
      e.adoptees = e.adoptees.filter((x) => x !== c.id);
      e.credibilite = borne(e.credibilite - 8);
      return `« ${c.titre} » est retirée. Vous perdez ${fmt(c.montantHorizon ?? c.montant)} et huit points de crédibilité.`;
    },
  },
  {
    id: "notation", titre: "Une agence de notation s'impatiente",
    texte: "Moody's a retiré le double A à la Belgique le 17 avril 2026, S&P a suivi le 24. Le motif tenait en une phrase : la conviction que le gouvernement ne sera pas en mesure de mettre en œuvre des mesures suffisantes pour stabiliser le poids de la dette.",
    condition: (e) => e.credibilite < 42,
    effet: (e) => {
      e.objectif += 400;
      for (const p of PARTIS) e.cohesion[p] = borne(e.cohesion[p] - 5);
      return "Le refinancement coûte plus cher. L'objectif monte de 400 millions et la table se crispe.";
    },
  },
  {
    id: "olo", titre: "L'OLO à dix ans repasse au-dessus de 3,7 %",
    texte: "L'écart avec l'Allemagne s'établit autour de soixante points de base. La Belgique emprunte plus cher que le Portugal, et plus cher que la Grèce. La charge d'intérêts passe de 12,2 milliards en 2026 à près de 21 en 2030.",
    condition: () => true,
    effet: (e) => { e.objectif += 300; return "L'objectif monte de 300 millions. La charge d'intérêts ne négocie pas."; },
  },
  {
    id: "greve", titre: "Manifestation nationale",
    texte: "Les trois syndicats appellent ensemble. La dernière manifestation de cette ampleur, le 31 mars 2026, avait réuni plus de trente-cinq mille personnes.",
    condition: (e) => e.rue > 58,
    effet: (e) => {
      e.cohesion.vooruit = borne(e.cohesion.vooruit - 12);
      e.cohesion.cdv = borne(e.cohesion.cdv - 8);
      e.rue = borne(e.rue + 8);
      return "Vooruit et le CD&V encaissent le choc devant leur base.";
    },
  },
  {
    id: "sondage-vb", titre: "Sondage : le Vlaams Belang à 26,6 % en Flandre",
    texte: "L'extrême droite indépendantiste distance nettement la N-VA du Premier ministre, à 22,3 %. Faire chuter son propre gouvernement reviendrait, pour Bart De Wever, à avouer l'impuissance du modèle fédéral.",
    condition: (e) => e.nuit >= 2,
    effet: (e) => { e.cohesion.nva = borne(e.cohesion.nva - 9); return "La N-VA durcit sa position d'un cran."; },
  },
  {
    id: "sondage-ps", titre: "Sondage : le PS repasse devant le MR en Wallonie",
    texte: "Vingt-neuf pour cent contre vingt. Pour Georges-Louis Bouchez, céder sur une nouvelle taxe équivaudrait à un suicide politique face à un PS revigoré.",
    condition: (e) => e.nuit >= 2,
    effet: (e) => { e.cohesion.mr = borne(e.cohesion.mr - 9); return "Le MR se raidit sur la fiscalité."; },
  },
  {
    id: "cpas", titre: "La Fédération des CPAS publie ses chiffres",
    texte: "La limitation du chômage à vingt-quatre mois devrait coûter près d'un milliard aux CPAS d'ici 2029, sans compensation fédérale. La norme européenne de dépenses nettes étant consolidée, ces transferts ne réduisent l'écart d'aucun euro.",
    condition: (e, d) => cartesDe(e, d).some((c) => c.transfertE2 >= 0.3),
    effet: (e) => {
      e.credibilite = borne(e.credibilite - 9);
      e.rue = borne(e.rue + 10);
      return "Votre effort est requalifié en transfert de charges. Neuf points de crédibilité en moins.";
    },
  },
  {
    id: "monitoring", titre: "Le Comité de monitoring révise ses estimations",
    texte: "Entre mars et juillet 2026, l'effort résiduel annoncé est passé de 4,9 à 7,7 milliards sans qu'aucune décision politique nouvelle ne soit intervenue.",
    condition: (e) => e.nuit >= 3,
    effet: (e) => { e.objectif += 600; return "L'objectif monte de 600 millions. Le sol se dérobe pendant que vous négociez."; },
  },
  {
    id: "defense", titre: "La Défense demande une rallonge",
    texte: "Le Comité de monitoring relève que la ciblé de 2 % du PIB risque de ne pas être tenue en 2031, à 544 millions près, alors que l'horizon OTAN est fixe à 3,5 % en 2035.",
    condition: (e) => e.nuit >= 2,
    effet: (e) => { e.objectif += 188; return "Rallonge de 188 millions, comme en mai 2026. Personne n'ose arbitrer contre ce poste."; },
  },
  {
    id: "fuite", titre: "Fuite dans la presse",
    texte: "Une mesure de votre table se retrouve en une avant même d'être arbitrée. Le conclave est censé se tenir à huis clos.",
    condition: (e, d) => cartesDe(e, d).some((c) => c.ligneRouge.length),
    effet: (e, d, r) => {
      const exposees = cartesDe(e, d).filter((c) => c.ligneRouge.length);
      const c = exposees[Math.floor(r() * exposees.length)];
      for (const p of c.ligneRouge) e.cohesion[p] = borne(e.cohesion[p] - 10);
      return `« ${c.titre} » fuite. Le parti concerné doit réagir publiquement.`;
    },
  },
  {
    id: "telephones", titre: "Maxime Prévot fait ramasser les téléphones",
    texte: "Le président des Engagés avait proposé de négocier l'esprit ouvert, et sans téléphones. La proposition est suivie.",
    condition: (e) => e.nuit >= 2,
    effet: (e) => {
      e.actionsBonus += 1;
      for (const p of PARTIS) e.cohesion[p] = borne(e.cohesion[p] + 4);
      return "Une action supplémentaire la nuit prochaine, et un peu d'air autour de la table.";
    },
  },
  {
    id: "roi", titre: "Le Roi recoit le Premier ministre",
    texte: "Audience au Palais. Rien n'en filtre, comme d'habitude, et chacun revient à la table avec la conscience de ce qu'un échec coûterait.",
    condition: (e) => e.nuit >= 3,
    effet: (e) => {
      for (const p of PARTIS) e.cohesion[p] = borne(e.cohesion[p] + 7);
      return "Sept points de cohésion pour chacun. Le poids de l'institution, faute d'accord sur le fond.";
    },
  },
];

export function tirerEvenement(etat, donnees) {
  const r = des(etat.graine + etat.nuit * 104729);
  const vus = new Set(etat.evenements.map((e) => e.id));
  const possibles = EVENEMENTS.filter((e) => !vus.has(e.id) && e.condition(etat, donnees));
  if (!possibles.length) return null;
  const ev = possibles[Math.floor(r() * possibles.length)];
  const consequence = ev.effet(etat, donnees, r);
  const entree = { id: ev.id, nuit: etat.nuit, titre: ev.titre, texte: ev.texte, consequence };
  etat.evenements.push(entree);
  verifierFin(etat, donnees);
  return entree;
}

/* ---------- progression ---------- */
export function nuitSuivante(etat, donnees) {
  etat.nuit += 1;
  /* La nuit porte conseil : un partenaire au bord de la rupture retrouve un peu
     d'air, parce que sortir coute plus cher que rester. Les autres ne gagnent rien. */
  const b = donnees.bareme;
  for (const p of PARTIS)
    if (etat.cohesion[p] > 0 && etat.cohesion[p] < b.seuilReprise)
      etat.cohesion[p] = borne(etat.cohesion[p] + b.repriseNuit);
  etat.actions = actionsDeBase(etat, donnees) + etat.actionsBonus;
  etat.actionsBonus = 0;
  /* Boule de neige : la charge d'intérêts ne négocie pas, et ici elle avance. */
  if (aCode(etat, "BOULEDENEIGE")) etat.objectif += 400;
  if (etat.nuit > etat.nuitsTotal && etat.statut === "en-cours") conclure(etat, donnees);
  return etat;
}

function verifierFin(etat, donnees) {
  if (etat.statut !== "en-cours") return etat;
  if (MODES[etat.mode].coalition.length) {
    for (const p of PARTIS) {
      if (etat.cohesion[p] <= 0) {
        etat.statut = "rupture";
        etat.parti = p;
        etat.cause = `${donnees.partis[p].nom} quitte la table. Le gouvernement tombe, et l'écart de 23 milliards passe au suivant, augmente de deux années d'intérêts.`;
        return etat;
      }
    }
    if (etat.rue >= 100) {
      etat.statut = "greve";
      etat.cause = "Grève générale reconductible. Le conclave est suspendu, le pays à l'arrêt.";
      return etat;
    }
  }
  return etat;
}

/* Atteindre l'objectif ne met pas fin au conclave : il ouvre la possibilite
   de sceller. Rien n'empeche de continuer a negocier pour consolider. */
export function peutSceller(etat, donnees) {
  return etat.statut === "en-cours" && bilan(etat, donnees).affiche >= etat.objectif;
}

export function sceller(etat, donnees) {
  if (!peutSceller(etat, donnees)) return etat;
  etat.statut = "fumee-blanche";
  etat.cause = null;
  etat.nuitScellee = etat.nuit;
  return etat;
}

export function conclure(etat, donnees) {
  if (etat.statut !== "en-cours") return etat;
  etat.statut = bilan(etat, donnees).affiche >= etat.objectif ? "fumee-blanche" : "douziemes";
  if (etat.statut === "douziemes")
    etat.cause = "Aucun accord au terme du conclave. Le pays repart en douzièmes provisoires, comme fin 2025.";
  return etat;
}

/* ---------- bilan ---------- */
const cartesDe = (etat, donnees) =>
  etat.adoptees.map((id) => donnees.cartes.find((c) => c.id === id)).filter(Boolean);

/* Ce qu'une carte laissera en mars 2027, en esperance : la loterie du recours
   est remplacee par sa valeur moyenne. Sert au code MONITORING et au solveur. */
export function reelAttendu(carte, donnees, dejaVue = false) {
  const b = donnees.bareme;
  let r = (carte.montantHorizon ?? 0) * (carte.sens ?? 1);
  if (r <= 0) return r;
  if (carte.type === "artifice" || (!carte.structurel && carte.famille === "one-shot")) return 0;
  if (!carte.structurel) r *= 0.4;
  r *= b.facteurCredibilite[Math.max(0, Math.min(4, (carte.credibilite || 3) - 1))];
  r *= 1 - (carte.transfertE2 || 0);
  if (carte.effetRetour) r *= 1 - b.penaliteEffetRetour;
  if (dejaVue) r *= b.penaliteChevauchement;
  r *= 1 - Math.min(1, (carte.risqueJuridique || 0) * 0.16);
  return r;
}

export function bilan(etat, donnees) {
  const cartes = cartesDe(etat, donnees);
  const b = donnees.bareme;
  const r = des(etat.graine + 31337);

  let affiche = 0;
  const lignes = [];
  const famillesVues = new Map();

  for (const c of cartes) {
    /* On compte ce que la mesure rapporte DANS la fenetre du plan, pas a regime. */
    const brut = (c.montantHorizon ?? c.montant ?? 0) * (c.sens ?? 1);
    affiche += brut;

    let reel = brut;
    const retraits = [];

    if (brut < 0) { lignes.push({ carte: c, brut, reel: brut, retraits: [] }); continue; }

    if (c.type === "artifice" || (!c.structurel && c.famille === "one-shot")) {
      retraits.push(["one-shot ou artifice, sans effet sur le solde structurel", reel]);
      reel = 0;
    } else {
      if (!c.structurel) { const p = reel * 0.6; retraits.push(["mesure temporaire, non structurelle", p]); reel -= p; }
      const fc = b.facteurCredibilite[Math.max(0, Math.min(4, (c.credibilite || 3) - 1))];
      if (fc < 1) { const p = reel * (1 - fc); retraits.push(["décote de chiffrage", p]); reel -= p; }
      if (c.transfertE2 > 0) { const p = reel * c.transfertE2; retraits.push(["charge transférée aux entités fédérées ou aux CPAS", p]); reel -= p; }
      if (c.effetRetour) { const p = reel * b.penaliteEffetRetour; retraits.push(["effet retour non constaté", p]); reel -= p; }

      const cle = c.famille;
      if (famillesVues.has(cle)) {
        const p = reel * b.penaliteChevauchement;
        retraits.push([`double comptage avec « ${famillesVues.get(cle)} »`, p]);
        reel -= p;
      } else famillesVues.set(cle, c.titre);

      if (c.risqueJuridique > 0 && r() < c.risqueJuridique * 0.16) {
        retraits.push(["annulée après recours", reel]); reel = 0;
      }
    }
    lignes.push({ carte: c, brut, reel, retraits });
  }

  const facteurGlobal = 0.75 + 0.25 * (etat.credibilite / 100);
  const reelBrut = lignes.reduce((s, l) => s + l.reel, 0);
  const reel = Math.max(0, reelBrut * facteurGlobal);

  return {
    affiche, reel, reelBrut, facteurGlobal, lignes,
    ecart: affiche - reel,
    couverture: etat.objectif ? reel / etat.objectif : 0,
    couvertureAffichee: etat.objectif ? affiche / etat.objectif : 0,
    nbMesures: cartes.filter((c) => c.type === "mesure").length,
    nbMethode: cartes.filter((c) => c.type === "methode").length,
    partRecettes: part(cartes, "recette"),
    partDepenses: part(cartes, "depense"),
    partOneShot: part(cartes, "oneshot"),
  };
}

function part(cartes, nature) {
  const val = (c) => Math.max(0, (c.montantHorizon ?? c.montant ?? 0) * (c.sens ?? 1));
  const total = cartes.reduce((s, c) => s + val(c), 0);
  if (!total) return 0;
  return cartes.filter((c) => c.nature === nature).reduce((s, c) => s + val(c), 0) / total;
}

/* ---------- interets ---------- */
export function interetsDepuis(debut, donnees) {
  const parSeconde = (donnees.bareme.interetsParAn * 1e6) / (365 * 24 * 3600);
  return ((Date.now() - debut) / 1000) * parSeconde;
}

/* ---------- epilogue ---------- */
export function epilogue(etat, donnees) {
  const b = bilan(etat, donnees);
  const actes = [];

  actes.push({
    date: "13 octobre 2026", titre: "Déclaration de politique fédérale",
    texte:
      b.affiche >= etat.objectif
        ? `Vous annoncez ${fmt(b.affiche)} d'effort. Le chiffre tient la une jusqu'au soir.`
        : `Vous annoncez ${fmt(b.affiche)}, en deçà de l'objectif de ${fmt(etat.objectif)}. L'opposition n'a pas besoin d'attendre mars.`,
    verdict: b.affiche >= etat.objectif ? "bon" : "mauvais",
    complement:
      etat.rue > 65
        ? "Les syndicats annoncent une manifestation nationale pour la semaine suivante."
        : etat.rue < 35
        ? "La réaction sociale reste mesurée."
        : "Les syndicats réservent leur réponse.",
  });

  const conforme = b.couverture > 0.55 && etat.credibilite > 45;
  actes.push({
    date: "15 octobre 2026", titre: "Transmission du projet de plan budgétaire à la Commission",
    texte: conforme
      ? "La trajectoire de dépenses nettes passe le premier examen. Le plafond de croissance est de 2,5 % pour 2026-2027, puis 2,1 % ensuite."
      : "La trajectoire de dépenses nettes ne convainc pas. La norme porte sur l'ensemble des administrations publiques : un dépassement régional compte comme un dépassement belge.",
    verdict: conforme ? "bon" : "mauvais",
    complement: "La Belgique bénéficie d'un étalement sur sept ans, jusqu'en 2029, en échange d'engagements de réforme.",
  });

  actes.push({
    date: "mars 2027", titre: "Comité de monitoring et Cour des comptes",
    texte: `Sur les ${fmt(b.affiche)} annoncés, ${fmt(b.reel)} sont constatés. L'écart est de ${fmt(b.ecart)}.`,
    verdict: b.ecart / Math.max(1, b.affiche) < 0.25 ? "bon" : "mauvais",
    complement: "Le détail ligne par ligne figure ci-dessous.",
    detail: b.lignes,
  });

  const note = noteSouveraine(b, etat);
  actes.push({
    date: "printemps 2027", titre: "Agences de notation",
    texte: note.texte, verdict: note.verdict, complement: note.complement, note: note.note,
  });

  return { actes, bilan: b, mention: mention(b, etat) };
}

function noteSouveraine(b, etat) {
  const s = b.couverture * 60 + (etat.credibilite / 100) * 40;
  if (s > 72) return { note: "AA−", verdict: "bon", texte: "La perspective est relevée à stable. L'écart entre l'annonce et la réalisation est jugé maîtrisé.", complement: "Les agences sanctionnent l'écart entre l'annonce et la réalisation, pas l'ambition modérée tenue." };
  if (s > 55) return { note: "A1", verdict: "moyen", texte: "La note est confirmée, la perspective reste négative. L'effort est réel, sa vérifiabilité discutée.", complement: "Un accord à faible crédibilité tient jusqu'au rapport suivant." };
  if (s > 38) return { note: "A2", verdict: "mauvais", texte: "Nouvelle dégradation d'un cran. Le motif reprend celui d'avril 2026, presque mot pour mot.", complement: "Chaque dégradation renchérit le refinancement, donc l'effort de l'année suivante." };
  return { note: "A3", verdict: "mauvais", texte: "Dégradation de deux crans. L'effet boule de neige, annoncé par l'Agence fédérale de la dette pour 2031, est avancé.", complement: "La charge d'intérêts devient le premier poste de croissance du budget." };
}

function mention(b, etat) {
  if (etat.statut === "rupture")   return { lettre: "F", titre: "Rupture", texte: "Le gouvernement est tombe." };
  if (etat.statut === "greve")     return { lettre: "F", titre: "Blocage", texte: "Le pays est a l'arret." };
  if (etat.statut === "douziemes") return { lettre: "E", titre: "Douzièmes provisoires", texte: "Aucun accord. Le budget est reconduit par douzième." };
  const s = b.couverture * 55 + (etat.credibilite / 100) * 30 + (1 - Math.min(1, b.ecart / Math.max(1, b.affiche))) * 15;
  if (s > 82) return { lettre: "A", titre: "Accord a base large", texte: "Annonce et réalisation coincident. C'est rare, et c'est tout ce qui compte." };
  if (s > 68) return { lettre: "B", titre: "Accord crédible", texte: "L'essentiel de ce que vous avez annoncé s'est réalisé." };
  if (s > 52) return { lettre: "C", titre: "Accord tenable", texte: "L'écart existe, il reste explicable." };
  if (s > 36) return { lettre: "D", titre: "Accord de façade", texte: "Le chiffre a tenu jusqu'en mars. Pas au-delà." };
  return { lettre: "E", titre: "Accord démonté", texte: "Le rendement réel est sans rapport avec l'annonce." };
}

/* ---------- format ---------- */
export function fmt(millions) {
  const v = Math.round(millions);
  if (Math.abs(v) >= 1000) {
    const md = v / 1000;
    return `${md.toFixed(Math.abs(md) < 10 ? 2 : 1).replace(".", ",")} Md€`;
  }
  return `${v} M€`;
}
export function fmtEuros(x) {
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 }).format(Math.round(x)) + " €";
}
