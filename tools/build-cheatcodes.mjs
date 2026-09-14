#!/usr/bin/env node
/**
 * build-cheatcodes.mjs — construit la page des combinaisons résolues.
 *
 * Lit assets/data/combinaisons.json, produit conclave/cheatcodes/index.html.
 * Comme le reste du dépôt, la page est commitée telle quelle : rien n'est
 * exécuté au déploiement.
 *
 * Zéro dépendance. Usage : node tools/build-cheatcodes.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://ouaisfieu.github.io/sims";
const URL_PAGE = `${SITE}/conclave/cheatcodes/`;

const C = JSON.parse(readFileSync(join(ROOT, "assets/data/combinaisons.json"), "utf8"));
const jeu = JSON.parse(readFileSync(join(ROOT, "assets/data/jeu.json"), "utf8"));

const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const md = (m) => `${(m / 1000).toFixed(2).replace(".", ",")} Md€`;
const pc = (x) => `${Math.round(x * 100)} %`;
const nomParti = (p) => jeu.partis[p]?.nom ?? p;

const PLUME = `<svg viewBox="0 0 40 64" aria-hidden="true" focusable="false" fill="currentColor"><circle cx="20" cy="57" r="4"/><circle cx="23" cy="47" r="5.5"/><circle cx="16" cy="37" r="6.5"/><circle cx="24" cy="27" r="7.5"/><circle cx="15" cy="18" r="7"/><circle cx="23" cy="9" r="6"/></svg>`;

/* ------------------------------------------------------------------ */
/*  Textes éditoriaux attachés à chaque combinaison                     */
/* ------------------------------------------------------------------ */
const TEXTES = {
  plancher: {
    nom: "Le plancher",
    accroche: "La fumée blanche la plus rapide possible.",
    lecture:
      "Trois mesures suffisent à franchir la barre des dix milliards. Deux d'entre elles sont des cessions d'actifs, c'est-à-dire un stock que l'on confond avec un flux, et la troisième porte le chiffrage le plus fragile du corpus. Le résultat est un accord annoncé en une nuit dont il subsiste un euro sur huit. C'est la démonstration la plus courte de ce que le jeu cherche à rendre sensible : atteindre le chiffre n'est pas le problème.",
  },
  reference: {
    nom: "La combinaison de référence",
    accroche: "Le meilleur rendement réellement constaté, coalition intacte.",
    lecture:
      "C'est la meilleure réponse que la recherche trouve à la question posée. Elle tient en quatorze actions, dont sept ne rapportent pas un euro : ce sont des réformes de méthode, et ce sont elles qui font passer la part réalisée de cinquante à soixante-seize pour cent. Aucun parti ne descend sous quatre-vingt-huit de cohésion, ce qui laisse toute la marge nécessaire aux événements. Le cœur budgétaire tient en deux blocs — la rémunération alternative et la TVA — c'est-à-dire précisément les deux lignes rouges du MR.",
  },
  "sans-ligne-rouge": {
    nom: "Sans franchir une ligne rouge",
    accroche: "Dix milliards sans froisser personne : c'est possible.",
    lecture:
      "En n'utilisant que des mesures qui ne constituent la ligne rouge d'aucun parti, on atteint douze milliards et demi. C'est une nuance importante par rapport au diagnostic courant : le blocage n'est pas arithmétique à l'échelle de dix milliards. Il le redevient à vingt-trois, et il se déplace immédiatement du montant vers la qualité — cette combinaison réclame dix-huit actions, soit toutes les nuits du conclave, pour un rendement réel inférieur d'un cinquième à celui de la combinaison de référence.",
  },
  fidelite: {
    nom: "La plus fidèle",
    accroche: "La part réalisée la plus élevée que le corpus permette.",
    lecture:
      "Quatre-vingts pour cent de l'annonce se retrouvent en mars 2027. C'est le plafond : au-delà, il faudrait des mesures dont le chiffrage soit à la fois robuste, immédiat, sans transfert de charge et sans risque juridique, et le corpus n'en contient pas assez. Retenez le rapport : sur dix milliards affichés, le mieux que l'on puisse espérer est huit.",
  },
  facade: {
    nom: "L'accord de façade",
    accroche: "Onze milliards et demi annoncés, trois cent cinquante millions constatés.",
    lecture:
      "Le solveur cherche ici l'écart maximal entre l'annonce et le constat. Il produit un accord qui franchit la barre, brûle les cinq bilatérales, et ne laisse subsister que trois pour cent du montant affiché. On y retrouve, empilés, tous les procédés que la Cour des comptes documente exercice après exercice : cessions d'actifs, contributions patrimoniales à chiffrage incertain, réduction des dotations aux Communautés qui déplace la charge sans la supprimer, et mesures d'indexation temporaires présentées comme structurelles. Ce n'est pas une caricature : c'est la limite mathématique d'une méthode réellement employée.",
  },
  marge: {
    nom: "Avec la marge",
    accroche: "Viser douze milliards et demi, parce que la barre monte pendant la nuit.",
    lecture:
      "Les événements du conclave relèvent l'objectif : révision du Comité de monitoring, remontée des taux, rallonge de la Défense, dégradation de notation. Sur une partie complète, la barre finit rarement à dix milliards. Cette combinaison vise d'emblée douze et demi et y parvient sans qu'aucun parti ne passe sous soixante-trois. C'est la version prudente de la combinaison de référence, et la plus sûre à jouer réellement.",
  },
  "vingt-trois": {
    nom: "Les vingt-trois milliards",
    accroche: "L'écart réel, en franchissant quatre lignes rouges sur cinq.",
    lecture:
      "Vingt-sept milliards annoncés, seize et huit constatés, en vingt-trois actions et huit nuits. La combinaison franchit une ligne rouge du MR à deux reprises, une de la N-VA, une de Vooruit et une du CD&V. Seuls Les Engagés n'ont rien à abandonner, parce qu'ils n'ont rien posé. C'est exactement la conclusion à laquelle aboutit l'analyse écrite : le scénario à base large n'existe que si chaque parti cède sur un point.",
  },
  "vingt-trois-sans-ligne-rouge": {
    nom: "Vingt-trois milliards sans ligne rouge",
    accroche: "Le même total affiché. Un quart seulement se réalise.",
    lecture:
      "La recherche y arrive : vingt-sept milliards annoncés sans qu'aucune ligne rouge ne soit franchie, en vingt-deux actions. Pour y parvenir, elle empile les deux cessions d'actifs, trois variantes de la même taxation des plus-values — donc trois doubles comptages —, la réduction des dotations aux Communautés, le report d'une partie de l'effort à 2031 et la prolongation du centim'index. La crédibilité tombe à un. Il en reste sept milliards.",
  },
};

const ORDRE = ["reference", "marge", "fidelite", "sans-ligne-rouge", "plancher", "facade",
  "vingt-trois", "vingt-trois-sans-ligne-rouge"];

/* ------------------------------------------------------------------ */
/*  Codes secrets                                                       */
/* ------------------------------------------------------------------ */
const CODES = [
  { code: "KERN", nom: "Mode analyste",
    effet: "Le bandeau affiche en permanence le montant réellement constaté à côté du montant annoncé. C'est le code le plus utile : il rend visible, pendant la partie, l'écart que le jeu ne révèle normalement qu'en mars 2027." },
  { code: "MONITORING", nom: "Décote apparente",
    effet: "Chaque carte indique ce qu'il restera de son montant après les décotes. Les one-shots affichent zéro avant même d'être posés." },
  { code: "ARIZONA", nom: "Assiettes révélées",
    effet: "Les chevauchements d'assiette sont signalés sur la carte, avec le nom de la mesure déjà posée qui la recoupe. Fin du double comptage involontaire." },
  { code: "HUISCLOS", nom: "Une action de plus",
    effet: "Quatre actions par nuit au lieu de trois, en hommage à la proposition de négocier sans téléphones. Vingt-quatre actions au total : de quoi jouer les combinaisons longues de cette page." },
  { code: "BOULEDENEIGE", nom: "Mode difficile",
    effet: "L'objectif monte de quatre cents millions à chaque nuit, en plus des événements. La charge d'intérêts passe de 12,2 à près de 21 milliards entre 2026 et 2030 : ce code vous fait négocier contre elle." },
  { code: "FUMEEBLANCHE", nom: "La combinaison de référence",
    effet: "Charge directement sur la table la combinaison calculée sur cette page. Le code qui porte bien son nom." },
];

/* ------------------------------------------------------------------ */
const tete = () => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Cheatcodes — les combinaisons qui passent le conclave budgétaire | Ouaisfieu</title>
<meta name="description" content="Nous avons résolu le jeu par recherche exhaustive. Les combinaisons de mesures qui atteignent dix milliards sans faire tomber le gouvernement, celles qui n'en laissent rien, le coût en cohésion de chaque milliard, et six codes secrets à taper dans le simulateur.">
<link rel="canonical" href="${URL_PAGE}">
<link rel="alternate" hreflang="fr" href="${URL_PAGE}">
<link rel="alternate" hreflang="x-default" href="${URL_PAGE}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Ouaisfieu · sims">
<meta property="og:locale" content="fr_BE">
<meta property="og:title" content="Cheatcodes — les combinaisons qui passent le conclave">
<meta property="og:description" content="Vingt-trois milliards sans froisser personne : possible sur le papier, il en reste sept. Le jeu, résolu par recherche exhaustive.">
<meta property="og:url" content="${URL_PAGE}">
<meta property="og:image" content="${SITE}/assets/img/partage.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0A0C11">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="keywords" content="conclave budgétaire, combinaisons gagnantes, budget fédéral belge, lignes rouges, coalition Arizona, solveur, cheatcodes">
<link rel="icon" href="../../assets/img/icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../../assets/img/icone-180.png">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="stylesheet" href="../../assets/css/base.css">
<link rel="stylesheet" href="../../assets/css/corpus.css">
<link rel="stylesheet" href="../../assets/css/cheatcodes.css">
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${URL_PAGE}#article`,
      headline: "Cheatcodes — les combinaisons qui passent le conclave budgétaire",
      description: "Résolution par recherche exhaustive du simulateur du conclave budgétaire fédéral belge : combinaisons de mesures atteignant l'objectif sans rupture de coalition, coût en cohésion par milliard, déperdition par mesure, et codes secrets du simulateur.",
      inLanguage: "fr-BE",
      url: URL_PAGE,
      datePublished: C.genere,
      dateModified: C.genere,
      publisher: { "@type": "Organization", name: "Ouaisfieu", url: `${SITE}/` },
      isPartOf: { "@id": `${SITE}/conclave/#app` },
      about: [
        { "@type": "Thing", name: "Budget fédéral belge" },
        { "@type": "Thing", name: "Conclave budgétaire 2026" },
      ],
    },
    {
      "@type": "HowTo",
      "@id": `${URL_PAGE}#howto`,
      name: "Atteindre dix milliards sans faire tomber la coalition",
      inLanguage: "fr-BE",
      description: "La combinaison de référence, calculée par recherche exhaustive sur les 76 cartes du simulateur.",
      step: (C.combinaisons.reference?.cartes ?? []).map((m, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: m.titre,
        url: m.slug ? `${SITE}/conclave/mesures/${m.slug}.html` : URL_PAGE,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${URL_PAGE}#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "Peut-on trouver dix milliards sans franchir aucune ligne rouge ?",
          acceptedAnswer: { "@type": "Answer", text: `Oui. La recherche atteint ${md(C.combinaisons["sans-ligne-rouge"]?.affiche ?? 0)} annoncés en n'utilisant que des mesures qui ne constituent la ligne rouge d'aucun parti de la coalition, mais il faut dix-huit actions, soit toutes les nuits du conclave, et la part réellement constatée tombe à ${pc(C.combinaisons["sans-ligne-rouge"]?.partRealisee ?? 0)}.` },
        },
        {
          "@type": "Question",
          name: "Et vingt-trois milliards sans franchir de ligne rouge ?",
          acceptedAnswer: { "@type": "Answer", text: `Possible à l'affichage : ${md(C.combinaisons["vingt-trois-sans-ligne-rouge"]?.affiche ?? 0)} en vingt-deux actions. Mais il n'en reste que ${md(C.combinaisons["vingt-trois-sans-ligne-rouge"]?.reel ?? 0)} au rapport de mars 2027, soit ${pc(C.combinaisons["vingt-trois-sans-ligne-rouge"]?.partRealisee ?? 0)}, contre ${pc(C.combinaisons["vingt-trois"]?.partRealisee ?? 0)} pour la combinaison qui franchit quatre lignes rouges sur cinq.` },
        },
        {
          "@type": "Question",
          name: "Quelle est la meilleure stratégie dans le simulateur ?",
          acceptedAnswer: { "@type": "Answer", text: "Consacrer la moitié de ses actions à des réformes de méthode, qui ne rapportent aucun euro mais déterminent la part du montant annoncé qui survivra au Comité de monitoring. Dans la combinaison de référence, sept actions sur quatorze ne rapportent rien, et ce sont elles qui portent la part réalisée de cinquante à soixante-seize pour cent." },
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "sims", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Fumée blanche", item: `${SITE}/conclave/` },
        { "@type": "ListItem", position: 3, name: "Cheatcodes", item: URL_PAGE },
      ],
    },
  ],
})}
</script>
</head>
<body>
<a class="saut-contenu" href="#contenu">Aller au contenu</a>
<header class="entete-site">
  <div class="enveloppe entete-site__barre">
    <a class="marque" href="../../">${PLUME}<span>Ouaisfieu · sims</span></a>
    <nav aria-label="Principale">
      <a href="../">Le simulateur</a>
      <a href="../mesures/">Les mesures</a>
      <a href="./" aria-current="page">Cheatcodes</a>
      <a href="../methodologie.html">Méthodologie</a>
    </nav>
  </div>
</header>
<nav class="fil enveloppe" aria-label="Fil d'Ariane"><ol>
  <li><a href="../../">sims</a></li><li><a href="../">Fumée blanche</a></li><li><span aria-current="page">Cheatcodes</span></li>
</ol></nav>`;

const pied = `<footer class="pied enveloppe">
  <p><strong>Ouaisfieu · sims</strong> — projet citoyen de veille et de contre-analyse des politiques publiques belges. Code et données ouverts, aucun traceur.</p>
  <p>Les combinaisons de cette page sont calculées par <code>tools/solveur.mjs</code> et republiées à chaque évolution des données. Elles décrivent le comportement d'un modèle, documenté sur la <a href="../methodologie.html">page méthodologie</a>, et non une prévision budgétaire.</p>
</footer>
</body>
</html>`;

/* ------------------------------------------------------------------ */
function blocCombinaison(cle) {
  const c = C.combinaisons[cle];
  if (!c) return "";
  const t = TEXTES[cle] ?? { nom: cle, accroche: "", lecture: "" };
  const objectif = c.objectifVise ?? C.objectifParDefaut;
  const mesures = c.cartes.filter((m) => m.type !== "methode");
  const methodes = c.cartes.filter((m) => m.type === "methode");
  const part = c.partRealisee;
  const ton = part >= 0.7 ? "bon" : part >= 0.45 ? "moyen" : "mauvais";

  const ligne = (m) => `<li>
      <span class="recette__md chiffre">${m.type === "methode" ? "méthode" : md(m.montantHorizon)}</span>
      <span class="recette__nom">${m.slug ? `<a href="../mesures/${e(m.slug)}.html">${e(m.titre)}</a>` : e(m.titre)}</span>
      <span class="recette__tags">${[
        m.provenance === "analyse" ? '<span class="etiquette etiquette--analyse">analyse</span>' : "",
        m.ligneRouge.length ? `<span class="etiquette etiquette--rouge">ligne rouge ${m.ligneRouge.map(nomParti).join(" et ")}</span>` : "",
      ].filter(Boolean).join("")}</span>
    </li>`;

  const v = c.validation;

  return `
<section class="recette recette--${ton}" id="${e(cle)}">
  <header class="recette__entete">
    <h3>${e(t.nom)}</h3>
    <p class="recette__accroche">${e(t.accroche)}</p>
  </header>

  <div class="recette__chiffres">
    <div><span class="k">Annoncé</span><b class="chiffre">${md(c.affiche)}</b></div>
    <div><span class="k">Constaté en mars 2027</span><b class="chiffre ${ton === "bon" ? "positif" : "negatif"}">${md(c.reel)}</b></div>
    <div><span class="k">Part réalisée</span><b class="chiffre">${pc(part)}</b></div>
    <div><span class="k">Actions</span><b class="chiffre">${c.actions}${objectif > 15000 ? " / 24" : " / 18"}</b></div>
    <div><span class="k">Crédibilité</span><b class="chiffre">${c.credibilite}</b></div>
    <div><span class="k">Cohésion la plus basse</span><b class="chiffre">${c.cohesionMin}</b></div>
  </div>

  <div class="barre-part" role="img" aria-label="${pc(part)} de l'annonce se réalise">
    <span style="width:${Math.max(1.5, Math.min(100, part * 100))}%"></span>
  </div>

  <p class="recette__lecture">${e(t.lecture)}</p>

  ${c.bilaterales.length ? `<p class="recette__bi">Bilatérales menées : <strong>${c.bilaterales.map(nomParti).join(", ")}</strong>.</p>` : ""}

  <details class="recette__detail">
    <summary>Les ${c.cartes.length} actions, dans l'ordre</summary>
    <ol class="recette__liste">
      ${mesures.map(ligne).join("\n")}
      ${methodes.length ? `<li class="recette__separateur">${methodes.length} réforme${methodes.length > 1 ? "s" : ""} de méthode, sans rendement direct</li>` : ""}
      ${methodes.map(ligne).join("\n")}
    </ol>
    <dl class="recette__cohesion">
      ${["nva", "mr", "vooruit", "cdv", "le"].map((p) => `<div><dt>${e(nomParti(p))}</dt><dd class="chiffre">${c.cohesion[p]}</dd></div>`).join("")}
    </dl>
    ${v ? `<p class="petit sourdine recette__valid">Rejoué ${v.tirages} fois dans le moteur du jeu, avec des graines différentes : rendement constaté entre <strong>${md(v.reelMin)}</strong> et <strong>${md(v.reelMax)}</strong>, médiane <strong>${md(v.reelMedian)}</strong>. ${v.ruptures ? `Rupture de coalition dans ${v.ruptures} cas sur ${v.tirages}.` : "Aucune rupture de coalition."} L'écart entre les tirages vient du risque juridique, qui est une loterie.</p>` : ""}
  </details>

  <p class="recette__jouer">
    <a class="bouton bouton--premier" href="../#budget=${e(c.lien)}">Rejouer cette combinaison</a>
  </p>
</section>`;
}

/* ------------------------------------------------------------------ */
const s = C.stats;
const lr = s.lignesRougesParParti;
const ho = s.hostiliteMoyenne;
const sansLR = C.combinaisons["sans-ligne-rouge"];
const vt = C.combinaisons["vingt-trois"];
const vtSans = C.combinaisons["vingt-trois-sans-ligne-rouge"];
const ref = C.combinaisons.reference;

const corps = `
<main class="corps enveloppe" id="contenu">
<article>
  <h1>Cheatcodes</h1>
  <p class="chapo">Nous avons résolu le jeu. Une recherche par faisceau sur les 76 cartes et les cinq bilatérales, sous la contrainte des actions disponibles et de la survie des cinq partis, donne les combinaisons qui passent le conclave — et celles qui le passent pour rien. Six codes secrets, tapables dans le simulateur, sont au bas de la page.</p>

  <section class="trouvaille">
    <p class="trouvaille__sur">Ce que le calcul dit du budget</p>
    <h2>Vingt-trois milliards sans froisser personne, c'est possible. Il en reste un quart.</h2>
    <div class="trouvaille__paire">
      <div>
        <p class="k">En franchissant quatre lignes rouges sur cinq</p>
        <p class="trouvaille__md chiffre">${md(vt.affiche)} <span>annoncés</span></p>
        <p class="trouvaille__md trouvaille__md--reel chiffre positif">${md(vt.reel)} <span>constatés · ${pc(vt.partRealisee)}</span></p>
      </div>
      <div>
        <p class="k">Sans en franchir aucune</p>
        <p class="trouvaille__md chiffre">${md(vtSans.affiche)} <span>annoncés</span></p>
        <p class="trouvaille__md trouvaille__md--reel chiffre negatif">${md(vtSans.reel)} <span>constatés · ${pc(vtSans.partRealisee)}</span></p>
      </div>
    </div>
    <p>Le total affiché est le même à trente millions près. Ce qui change, c'est ce qu'il devient. La combinaison indolore n'y arrive qu'en empilant les deux cessions d'actifs, trois variantes de la même taxation des plus-values, la réduction des dotations aux Communautés et le report d'une partie de l'effort au-delà de l'horizon — autrement dit un one-shot, deux doubles comptages, un transfert de charge et un artifice.</p>
    <p style="margin:0">Poussée à son maximum, cette méthode plafonne à <strong class="chiffre">${md(C.plafondSansLigneRouge.affiche)}</strong> affichés pour <strong class="chiffre">${md(C.plafondSansLigneRouge.reel)}</strong> constatés. C'est, à peu de chose près, le plancher que le Comité de monitoring fixait en juillet 2026. La coïncidence ne démontre rien : elle situe l'ordre de grandeur.</p>
  </section>

  <h2>Les huit combinaisons</h2>
  <p>Chacune est rejouable : le lien charge la table exacte dans le simulateur. Les combinaisons longues supposent d'avoir toutes ses actions, ce qui n'arrive qu'en jouant les six nuits — ou en activant le code <code>HUISCLOS</code>.</p>

  ${ORDRE.map(blocCombinaison).join("\n")}

  <h2 id="techniques">Les techniques</h2>

  <ol class="techniques">
    <li>
      <h3>La moitié de vos actions ne doit rapporter aucun euro</h3>
      <p>Dans la combinaison de référence, <strong>${ref.nbMethode} actions sur ${ref.actions}</strong> sont des réformes de méthode : revues de dépenses, ancre de dette, clauses de caducité, hypothèses macro assumées. Elles ne déplacent pas le compteur d'un centime. Elles font passer la part réalisée de la moitié à <strong>${pc(ref.partRealisee)}</strong>, parce que la crédibilité multiplie le total final par un facteur qui va de 0,75 à 1,0. Un joueur qui ne pose que des mesures perd un quart de son résultat avant même les décotes.</p>
    </li>
    <li>
      <h3>Un one-shot vaut zéro</h3>
      <p>La vente des participations publiques affiche quinze milliards dans le classeur, trois à l'horizon du plan, et zéro au constat. Une cession d'actifs améliore la trésorerie d'une année et ne touche pas au solde structurel : la Commission et les agences la neutralisent. Elle reste la façon la plus rapide de franchir la barre, et la plus sûre de ne rien faire.</p>
    </li>
    <li>
      <h3>Ne jamais poser deux mesures de la même famille</h3>
      <p>La deuxième perd la moitié de son rendement, et vous ne l'apprenez qu'en mars 2027. Les familles piégeuses sont la globalisation des revenus, les plus-values — trois variantes au chiffrage identique de 2 889 millions —, le patrimoine, la norme de santé et les niches de rémunération alternative. Le code <code>ARIZONA</code> les signale sur la carte.</p>
    </li>
    <li>
      <h3>La bilatérale avant la ligne rouge, jamais après</h3>
      <p>Une bilatérale coûte une action, rend seize points au partenaire choisi et divise par deux la pénalité de sa ligne rouge <em>pour la suite</em>. Menée après avoir posé la mesure, elle répare la moitié du dégât au lieu de l'éviter entièrement. Elle coûte quatre points à chacun des quatre autres et deux points de crédibilité : au-delà de deux ou trois, le remède devient le mal.</p>
    </li>
    <li>
      <h3>Le MR est le goulot, Les Engagés sont la soupape</h3>
      <p><strong>${lr.mr} mesures</strong> du paquet constituent une ligne rouge pour le MR, contre ${lr.nva} pour la N-VA, ${lr.vooruit} pour Vooruit, ${lr.cdv} pour le CD&amp;V et <strong>${lr.le} pour Les Engagés</strong>. Sa réaction moyenne est de <strong>${ho.mr}</strong> quand celle de Vooruit est de <strong>+${ho.vooruit}</strong>. Concrètement : presque tout ce qui rapporte déplaît au MR et plaît à Vooruit, et c'est cette symétrie qui fait la difficulté du conclave. Les Engagés, qui n'ont posé aucune ligne rouge, absorbent sans se rompre — c'est le partenaire à ne pas gaspiller en bilatérale.</p>
    </li>
    <li>
      <h3>Visez douze milliards et demi, pas dix</h3>
      <p>Les événements relèvent l'objectif pendant la partie : révision du Comité de monitoring, remontée de l'OLO, rallonge de la Défense, dégradation de notation. Sur une partie complète, la barre finit rarement là où elle a commencé. La combinaison « avec la marge » vise d'emblée ${md(C.combinaisons.marge.affiche)} et garde toute la cohésion nécessaire.</p>
    </li>
    <li>
      <h3>Le meilleur rapport rendement sur cohésion</h3>
      <p>Certaines mesures ne coûtent rien à personne. Voici celles qui rapportent le plus par point de cohésion dépensé — le socle de n'importe quelle combinaison.</p>
      <div class="table-enroule">
        <table class="tableau">
          <caption class="visuellement-cache">Mesures classées par coût en cohésion par milliard annoncé</caption>
          <thead><tr><th scope="col">Mesure</th><th scope="col">À l'horizon</th><th scope="col">Coût en cohésion</th><th scope="col">Chiffrage</th></tr></thead>
          <tbody>
          ${s.rendementCohesion.filter((m) => m.md >= 0.4).slice(0, 12).map((m) => `<tr>
            <td><a href="../mesures/${e(m.slug)}.html">${e(m.titre)}</a>${m.ligneRouge.length ? ` <span class="etiquette etiquette--rouge">${m.ligneRouge.map(nomParti).join("/")}</span>` : ""}</td>
            <td class="chiffre">${m.md.toFixed(2).replace(".", ",")} Md€</td>
            <td class="chiffre">${m.parMilliard} pts/Md€</td>
            <td class="chiffre">${"◆".repeat(m.credibilite)}${"◇".repeat(5 - m.credibilite)}</td></tr>`).join("\n")}
          </tbody>
        </table>
      </div>
    </li>
    <li>
      <h3>Les mesures qui s'évaporent</h3>
      <p>À l'inverse, voici ce que chaque mesure perd entre l'annonce et le constat, décotes appliquées. Au-dessus de soixante pour cent de perte, une mesure sert à faire un titre, pas un budget.</p>
      <div class="table-enroule">
        <table class="tableau">
          <caption class="visuellement-cache">Mesures classées par déperdition entre le montant annoncé et le montant constaté</caption>
          <thead><tr><th scope="col">Mesure</th><th scope="col">Annoncé</th><th scope="col">Constaté</th><th scope="col">Perte</th></tr></thead>
          <tbody>
          ${s.deperdition.slice(0, 12).map((m) => `<tr>
            <td><a href="../mesures/${e(m.slug)}.html">${e(m.titre)}</a></td>
            <td class="chiffre">${md(m.brut)}</td>
            <td class="chiffre">${md(m.reel)}</td>
            <td class="chiffre negatif">−${Math.round(m.perte * 100)} %</td></tr>`).join("\n")}
          </tbody>
        </table>
      </div>
    </li>
    <li>
      <h3>Dépenser pour tenir</h3>
      <p>Une seule carte du jeu dégrade volontairement le solde : maintenir la norme de croissance des soins de santé à 2,5 %. Elle coûte 1,24 milliard et rend douze points à Vooruit et au CD&amp;V. Quand l'un des deux approche de la rupture et qu'il reste des nuits, c'est souvent moins cher qu'une bilatérale suivie d'un renoncement.</p>
    </li>
    <li>
      <h3>Ne scellez pas trop tôt</h3>
      <p>Atteindre l'objectif ouvre la possibilité de sceller, il ne l'impose pas. Chaque nuit supplémentaire passée à poser des réformes de méthode augmente la part de l'annonce qui survivra, sans rien ajouter au compteur. La combinaison de référence scelle à la fin, pas au moment où la barre est franchie.</p>
    </li>
  </ol>

  <h2 id="codes">Les codes</h2>
  <p>Ce sont de vrais codes, actifs dans le simulateur. Tapez-les au clavier depuis n'importe quel écran, ou touchez <strong>« entrer un code »</strong> sur l'écran d'accueil si vous jouez sur téléphone. Ils restent actifs d'une partie à l'autre, et se désactivent en les retapant.</p>

  <ul class="codes">
    ${CODES.map((c) => `<li class="code">
      <code class="code__mot">${e(c.code)}</code>
      <div><h3>${e(c.nom)}</h3><p>${e(c.effet)}</p></div>
    </li>`).join("\n")}
  </ul>

  <p class="petit sourdine">Aucun code ne modifie les données ni le calcul du montant réellement constaté. <code>HUISCLOS</code> et <code>BOULEDENEIGE</code> changent la difficulté ; les autres ne font qu'afficher ce que le moteur savait déjà.</p>

  <h2>Comment ces combinaisons sont calculées</h2>
  <p>Une recherche par faisceau parcourt les 76 cartes et les cinq bilatérales, action après action, en conservant à chaque étape les meilleures tables partielles selon l'objectif poursuivi. Sont rejetées d'emblée toutes celles où un parti tombe sous le seuil de sécurité, où la tension sociale atteint cent, ou dont le total dépasse largement la cible — un conclave cherche une trajectoire, pas une surenchère.</p>
  <p>Le rendement réellement constaté est calculé <strong>en espérance</strong> : la loterie du recours juridique, qui dans le jeu annule parfois une mesure entière, est remplacée par sa valeur moyenne, pour que les résultats publiés ne dépendent pas d'un tirage. Chaque combinaison est ensuite <strong>rejouée dans le moteur du jeu</strong> avec soixante graines différentes ; la fourchette obtenue figure dans le détail de chacune.</p>
  <p>Deux prudences sont prises. La reprise nocturne de cohésion, qui rend quatre points par nuit à un partenaire sous 58, n'est pas comptée : les combinaisons sont donc plus sûres en jeu qu'à l'écran. Et l'objectif est traité comme fixe, alors que les événements le font monter — d'où la combinaison « avec la marge ».</p>
  <p class="petit sourdine">Ces résultats décrivent le comportement d'un modèle dont les hypothèses sont écrites sur la <a href="../methodologie.html">page méthodologie</a>. Ils ne prédisent pas l'issue du conclave réel. Ce qu'ils montrent, en revanche, tient debout hors du jeu : le montant affiché et le montant réalisé ne sont pas la même grandeur, et l'écart se décide au moment de la composition, pas au moment du contrôle.</p>

  <aside class="appel">
    <h2>Le solveur est dans le dépôt</h2>
    <p><code>tools/solveur.mjs</code>, sans dépendance. Changez l'objectif, les contraintes ou la fonction de score, relancez, et republiez cette page avec <code>tools/build-cheatcodes.mjs</code>. Si vous trouvez mieux que ${pc(ref.partRealisee)} de part réalisée à dix milliards, ouvrez une issue.</p>
    <p style="margin:0"><a class="bouton" href="https://github.com/ouaisfieu/sims" rel="noopener">Le dépôt</a> <a class="bouton bouton--discret" href="../../assets/data/combinaisons.json" download>Télécharger les combinaisons</a> <a class="bouton bouton--premier" href="../">Jouer</a></p>
  </aside>
</article>
</main>`;

mkdirSync(join(ROOT, "conclave", "cheatcodes"), { recursive: true });
writeFileSync(join(ROOT, "conclave", "cheatcodes", "index.html"), tete() + corps + pied);
console.log(`conclave/cheatcodes/index.html écrit — ${Object.keys(C.combinaisons).length} combinaisons, ${CODES.length} codes`);
