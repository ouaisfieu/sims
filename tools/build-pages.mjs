#!/usr/bin/env node
/**
 * build-pages.mjs — genere l'encyclopedie statique a partir de corpus.json.
 *
 * Une page par mesure, plus l'index filtrable, plus le plan du site.
 * Les fichiers produits sont commites tels quels : le depot se deploie
 * sans rien executer. Ce script n'est qu'un outil de maintenance, a relancer
 * si le Bureau du Plan publie une nouvelle version de son inventaire.
 *
 * Zero dependance. Usage : node tools/build-pages.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://ouaisfieu.github.io/sims";
const SORTIE = join(ROOT, "conclave", "mesures");

const corpus = JSON.parse(readFileSync(join(ROOT, "assets/data/corpus.json"), "utf8"));
const jeu = JSON.parse(readFileSync(join(ROOT, "assets/data/jeu.json"), "utf8"));
const cartes = new Map(jeu.cartes.map((c) => [c.id, c]));

const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (m) =>
  m == null ? null
  : Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(Math.abs(m) < 10000 ? 2 : 1).replace(".", ",")} Md€`
  : `${m} M€`;

const PLUME = `<svg viewBox="0 0 40 64" aria-hidden="true" focusable="false" fill="currentColor"><circle cx="20" cy="57" r="4"/><circle cx="23" cy="47" r="5.5"/><circle cx="16" cy="37" r="6.5"/><circle cx="24" cy="27" r="7.5"/><circle cx="15" cy="18" r="7"/><circle cx="23" cy="9" r="6"/></svg>`;

const tete = ({ titre, description, url, extraLd = "", css = "corpus" }) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(titre)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(url)}">
<link rel="alternate" hreflang="fr" href="${e(url)}">
<link rel="alternate" hreflang="x-default" href="${e(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Ouaisfieu · sims">
<meta property="og:locale" content="fr_BE">
<meta property="og:title" content="${e(titre)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${SITE}/assets/img/partage.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0A0C11">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="icon" href="../../assets/img/icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../../assets/img/icone-180.png">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="stylesheet" href="../../assets/css/base.css">
<link rel="stylesheet" href="../../assets/css/${css}.css">
${extraLd}
</head>
<body>
<a class="saut-contenu" href="#contenu">Aller au contenu</a>
<header class="entete-site">
  <div class="enveloppe entete-site__barre">
    <a class="marque" href="../../">${PLUME}<span>Ouaisfieu · sims</span></a>
    <nav aria-label="Principale">
      <a href="../">Le simulateur</a>
      <a href="./">Les mesures</a>
      <a href="../cheatcodes/">Cheatcodes</a>
      <a href="../methodologie.html">Méthodologie</a>
    </nav>
  </div>
</header>`;

const pied = `<footer class="pied enveloppe">
  <p><strong>Ouaisfieu · sims</strong> — projet citoyen de veille et de contre-analyse des politiques publiques belges. Code et données ouverts, aucun traceur.</p>
  <p>Source primaire : Bureau fédéral du Plan, <a href="https://www.plan.be/sites/default/files/documents/REP_BUDGET2027_13320_FR.pdf" rel="noopener">Options de politiques pour l'élaboration du budget 2027</a>, 1<sup>er</sup> juin 2026. Ce site n'émane ni du Bureau fédéral du Plan, ni d'aucune institution publique. Les traductions françaises des intitulés néerlandais, ainsi que toute appréciation de faisabilité, sont le fait d'Ouaisfieu.</p>
</footer>
</body>
</html>`;

const fil = (entrees) => `<nav class="fil enveloppe" aria-label="Fil d'Ariane"><ol>${
  entrees.map((x, i) =>
    `<li>${i < entrees.length - 1 ? `<a href="${e(x.href)}">${e(x.nom)}</a>` : `<span aria-current="page">${e(x.nom)}</span>`}</li>`
  ).join("")}</ol></nav>`;

const filLd = (entrees, base) => ({
  "@type": "BreadcrumbList",
  itemListElement: entrees.map((x, i) => ({
    "@type": "ListItem", position: i + 1, name: x.nom, item: base + x.abs,
  })),
});

const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o, null, 0)}</script>`;

const DELAIS = { immediat: "immédiate", court: "1 à 2 ans", moyen: "2 à 3 ans", long: "4 à 6 ans" };
const RISQUES = ["nul", "faible", "réel", "élevé"];

/* ---------------- page d'une mesure ---------------- */
function pageMesure(m, index) {
  const c = cartes.get(m.ref);
  const url = `${SITE}/conclave/mesures/${m.slug}.html`;
  const montant = fmt(m.montant);
  const resume = m.montant != null
    ? `${m.titre}. ${montant} par an selon ${m.provenance === "bfp" ? "le chiffrage du Bureau fédéral du Plan" : "l'analyse Ouaisfieu"}. Catégorie : ${m.categorie}.`
    : `${m.titre}. Proposition inventoriée par le Bureau fédéral du Plan dans les options de politiques pour le budget 2027, sans chiffrage. Catégorie : ${m.categorie}.`;

  const voisines = index
    .filter((x) => x.ref !== m.ref && x.categorie === m.categorie)
    .sort((a, b) => (b.montant ?? -1) - (a.montant ?? -1))
    .slice(0, 6);
  const jumelles = (c?.chevauche ?? [])
    .map((r) => index.find((x) => x.ref === r)).filter(Boolean);

  const champs = [];
  champs.push(["Catégorie", e(m.categorie)]);
  if (m.sousCategorie) champs.push(["Sous-catégorie", e(m.sousCategorie)]);
  if (m.parti) champs.push(["Chiffrage électoral de référence", e(m.parti)]);
  champs.push(["Référence dans le classeur", e(m.ref)]);
  if (c) {
    if (c.delai) champs.push(["Mise en œuvre", DELAIS[c.delai] ?? c.delai]);
    if (c.type === "mesure") {
      champs.push(["Robustesse du chiffrage", `${c.credibilite} sur 5 <span class="sourdine petit">(appréciation Ouaisfieu)</span>`]);
      if (c.risqueJuridique) champs.push(["Risque juridique", `${RISQUES[c.risqueJuridique]} <span class="sourdine petit">(appréciation Ouaisfieu)</span>`]);
      if (c.transfertE2) champs.push(["Charge transférée", `${Math.round(c.transfertE2 * 100)} % aux entités fédérées ou aux CPAS`]);
      if (c.effetRetour) champs.push(["Effet retour", "le rendement suppose un changement de comportement"]);
      if (!c.structurel) champs.push(["Effet structurel", "non, mesure temporaire ou one-shot"]);
      if (c.montantHorizon !== c.montant) champs.push(["À l'horizon 2029", fmt(c.montantHorizon)]);
    }
    if (c.ligneRouge?.length)
      champs.push(["Ligne rouge", c.ligneRouge.map((p) => e(jeu.partis[p].nom)).join(", ")]);
  }

  const corps = `
${fil([
  { nom: "sims", href: "../../" }, { nom: "Fumée blanche", href: "../" },
  { nom: "Les mesures", href: "./" }, { nom: m.titreCourt ?? m.titre },
])}
<main class="corps enveloppe" id="contenu">
<article>
  <h1>${e(m.titre)}</h1>
  <p class="chapo">${m.montant != null
      ? `Impulsion budgétaire annuelle estimée à <strong>${montant}</strong>.`
      : `Proposition inventoriée sans chiffrage.`} ${e(m.categorie)}${m.sousCategorie ? ` · ${e(m.sousCategorie)}` : ""}.</p>

  <div class="cartouche">
    <div>
      <p class="cartouche__md chiffre" style="margin:0">${montant ?? "Non chiffrée"}</p>
      <p class="cartouche__unite" style="margin:0">${m.montant != null ? "par an, à plein régime" : "le classeur ne fournit pas d'estimation"}</p>
    </div>
    <div class="cartouche__badges">
      ${m.provenance === "bfp" ? '<span class="etiquette etiquette--bfp">chiffré par le Bureau du Plan</span>' : ""}
      ${m.provenance === "analyse" ? '<span class="etiquette etiquette--analyse">montant issu de l\'analyse</span>' : ""}
      ${m.parti ? `<span class="etiquette">${e(m.parti)}</span>` : ""}
      ${m.jouable ? '<span class="etiquette">jouable</span>' : ""}
      ${m.methode ? '<span class="etiquette etiquette--bfp">réforme de méthode</span>' : ""}
    </div>
  </div>

  <dl class="champs">${champs.map(([d, v]) => `<dt>${d}</dt><dd>${v}</dd>`).join("")}</dl>

  ${m.langueOriginal === "nl" ? `<section class="bloc">
    <h2>Intitulé original</h2>
    <p class="original" lang="nl">${e(m.titreOriginal)}</p>
    <p class="petit sourdine" style="margin:8px 0 0">Traduction française : Ouaisfieu. Le classeur du Bureau fédéral du Plan est bilingue selon la langue de la proposition d'origine.</p>
  </section>` : ""}

  ${m.modalites ? `<section class="bloc">
    <h2>Modalités techniques</h2>
    <p class="original"${/[^\x00-\x7F]/.test("") ? "" : ""} lang="${nlProbable(m.modalites) ? "nl" : "fr"}">${e(m.modalites)}</p>
    <p class="petit sourdine" style="margin:10px 0 0">Texte reproduit tel qu'il figure au classeur.</p>
  </section>` : ""}

  ${m.motivation ? `<section class="bloc">
    <h2>Motivation</h2>
    <p class="original" lang="${nlProbable(m.motivation) ? "nl" : "fr"}">${e(m.motivation)}</p>
  </section>` : ""}

  ${m.note ? `<section class="bloc bloc--note">
    <h2>Lecture critique</h2>
    <p>${e(m.note)}</p>
    <p class="petit sourdine" style="margin:10px 0 0">Appréciation éditoriale d'Ouaisfieu, distincte du travail du Bureau fédéral du Plan. Voir la <a href="../methodologie.html">méthodologie</a>.</p>
  </section>` : ""}

  ${jumelles.length ? `<section>
    <h2 style="font-size:1.05rem;margin-top:26px">Assiette partagée</h2>
    <p class="petit sourdine">Ces mesures portent en partie sur la même base. Les additionner produit un double comptage.</p>
    <ul class="voisines">${jumelles.map((v) =>
      `<li><a href="${e(v.slug)}.html"><span>${e(v.titreCourt ?? v.titre)}</span>${v.montant != null ? `<b>${fmt(v.montant)}</b>` : ""}</a></li>`).join("")}</ul>
  </section>` : ""}

  ${m.jouable ? `<aside class="appel">
    <h2>Cette mesure est dans le jeu</h2>
    <p>Posez-la sur la table du conclave et voyez comment les cinq partis réagissent, puis ce qu'il en reste au rapport du Comité de monitoring de mars 2027.</p>
    <p style="margin:0"><a class="bouton bouton--premier" href="../">Ouvrir le simulateur</a></p>
  </aside>` : ""}

  <section class="bloc bloc--source">
    <h2>Source</h2>
    <p style="margin:0">Bureau fédéral du Plan, <em>Options de politiques pour l'élaboration du budget 2027</em>, 1<sup>er</sup> juin 2026, ligne ${e(m.ref.replace("BFP-", ""))} du classeur de données annexé. <a href="https://www.plan.be/sites/default/files/documents/REP_BUDGET2027_13320_FR.pdf" rel="noopener">Rapport complet</a>${m.sourceUrl ? ` · <a href="${e(m.sourceUrl)}" rel="noopener nofollow">chiffrage électoral d'origine</a>` : ""}.</p>
  </section>

  ${voisines.length ? `<section>
    <h2 style="font-size:1.05rem;margin-top:26px">Autres mesures de la même catégorie</h2>
    <ul class="voisines">${voisines.map((v) =>
      `<li><a href="${e(v.slug)}.html"><span>${e(v.titreCourt ?? v.titre)}</span>${v.montant != null ? `<b>${fmt(v.montant)}</b>` : ""}</a></li>`).join("")}</ul>
    <p style="margin-top:14px"><a href="./">Voir les 263 mesures →</a></p>
  </section>` : ""}
</article>
</main>`;

  const schema = ld({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: m.titre,
        description: resume,
        inLanguage: "fr-BE",
        url,
        isPartOf: { "@id": `${SITE}/conclave/mesures/#dataset` },
        about: { "@type": "Thing", name: m.categorie },
        citation: {
          "@type": "CreativeWork",
          name: "Options de politiques pour l'élaboration du budget 2027",
          author: { "@type": "GovernmentOrganization", name: "Bureau fédéral du Plan" },
          datePublished: "2026-06-01",
          url: "https://www.plan.be/sites/default/files/documents/REP_BUDGET2027_13320_FR.pdf",
        },
        publisher: { "@type": "Organization", name: "Ouaisfieu", url: `${SITE}/` },
      },
      filLd([
        { nom: "sims", abs: "/" }, { nom: "Fumée blanche", abs: "/conclave/" },
        { nom: "Les mesures", abs: "/conclave/mesures/" }, { nom: m.titreCourt ?? m.titre, abs: `/conclave/mesures/${m.slug}.html` },
      ], SITE),
    ],
  });

  return tete({ titre: `${m.titreCourt ?? tronque(m.titre, 62)} — les 263 mesures du budget 2027 | Ouaisfieu`, description: tronque(resume, 300), url, extraLd: schema }) + corps + pied;
}

const tronque = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s\S*$/, "") + "…");
const nlProbable = (t) =>
  (t.match(/\b(van|het|een|worden|wordt|voor|naar|met|door|bij|aan|niet|meer|wij|we|de)\b/gi) || []).length >
  (t.match(/\b(le|la|les|des|une|un|pour|dans|sur|avec|par|aux|nous|est|sont|et|du)\b/gi) || []).length;

/* ---------------- index ---------------- */
function pageIndex(index) {
  const url = `${SITE}/conclave/mesures/`;
  const cats = [...new Set(index.map((m) => m.categorie))].sort((a, b) => a.localeCompare(b, "fr"));
  const partis = [...new Set(index.map((m) => m.parti).filter(Boolean))].sort();
  const chiffrees = index.filter((m) => m.montant != null).length;

  const items = index.map((m) => `<li class="item" data-cat="${e(m.categorie)}" data-parti="${e(m.parti ?? "")}" data-chiffree="${m.montant != null}" data-cle="${e((m.titre + " " + m.titreOriginal + " " + m.categorie + " " + (m.sousCategorie ?? "")).toLowerCase())}">
  <div class="item__t">
    <a href="${e(m.slug)}.html">${e(m.titreCourt ?? m.titre)}</a>
    ${m.montant != null ? `<span class="item__md chiffre">${fmt(m.montant)}</span>` : '<span class="item__md item__md--vide">non chiffrée</span>'}
  </div>
  <p class="item__meta">${[
    e(m.categorie), m.sousCategorie && e(m.sousCategorie),
    m.parti && `chiffrage ${e(m.parti)}`,
    m.provenance === "analyse" && "montant d'analyse",
    m.jouable && "dans le jeu",
  ].filter(Boolean).join("</span><span>").replace(/^/, "<span>").replace(/$/, "</span>")}</p>
</li>`).join("\n");

  const corps = `
${fil([{ nom: "sims", href: "../../" }, { nom: "Fumée blanche", href: "../" }, { nom: "Les mesures" }])}
<main class="corps enveloppe" id="contenu">
  <h1>Les 263 mesures du budget fédéral 2027</h1>
  <p class="chapo">L'inventaire complet publié par le Bureau fédéral du Plan le 1<sup>er</sup> juin 2026, à la demande du ministre du Budget, avec plus de quarante experts universitaires et institutionnels. ${chiffrees} de ces mesures portent un montant ; les autres sont des propositions sans chiffrage, souvent des réformes de méthode.</p>

  <p class="petit sourdine">Les montants sont des impulsions budgétaires annuelles brutes, à modalités non précisées. <strong>Ils ne s'additionnent pas</strong> : plusieurs mesures portent sur la même assiette. Le classeur ne donne pas non plus le sens de chaque mesure ; quand nous l'indiquons, c'est une lecture éditoriale, signalée comme telle.</p>

  <form class="filtres" role="search" onsubmit="return false">
    <label class="visuellement-cache" for="q" style="position:absolute;left:-9999px">Rechercher une mesure</label>
    <input class="champ-rech" type="search" id="q" placeholder="Rechercher : TVA, pensions, voitures de société…" autocomplete="off">
    <div class="selects">
      <label class="visuellement-cache" for="f-cat" style="position:absolute;left:-9999px">Catégorie</label>
      <select id="f-cat"><option value="">Toutes les catégories</option>${cats.map((c) => `<option>${e(c)}</option>`).join("")}</select>
      <label class="visuellement-cache" for="f-parti" style="position:absolute;left:-9999px">Chiffrage électoral</label>
      <select id="f-parti"><option value="">Tous les chiffrages</option>${partis.map((p) => `<option>${e(p)}</option>`).join("")}</select>
      <label class="visuellement-cache" for="f-chiffree" style="position:absolute;left:-9999px">Chiffrage</label>
      <select id="f-chiffree"><option value="">Chiffrées et non chiffrées</option><option value="true">Chiffrées seulement</option><option value="false">Non chiffrées seulement</option></select>
    </div>
  </form>
  <p class="compte" id="compte" aria-live="polite">263 mesures</p>

  <ul class="liste-mesures" id="liste">
${items}
  </ul>

  <aside class="appel">
    <h2>Composez votre propre budget</h2>
    <p>Le simulateur reprend ces mesures et y ajoute ce que le classeur ne dit pas : les lignes rouges des cinq partis, la robustesse des chiffrages, et ce qu'il en reste au rapport du Comité de monitoring de mars 2027.</p>
    <p style="margin:0"><a class="bouton bouton--premier" href="../">Ouvrir le simulateur</a> <a class="bouton bouton--discret" href="../../assets/data/corpus.json" download>Télécharger les données</a></p>
  </aside>
</main>
<script type="module" src="../../assets/js/corpus.js"></script>`;

  const schema = ld({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        "@id": `${url}#dataset`,
        name: "Options de politiques pour l'élaboration du budget fédéral belge 2027 — 263 mesures",
        description: "Inventaire des 263 mesures budgétaires recensées par le Bureau fédéral du Plan pour l'élaboration du budget fédéral belge 2027, dont 39 chiffrées, avec traduction française des intitulés néerlandais et enrichissement éditorial Ouaisfieu.",
        url,
        inLanguage: ["fr-BE", "nl-BE"],
        license: "https://creativecommons.org/licenses/by/4.0/",
        isAccessibleForFree: true,
        keywords: ["budget fédéral belge", "conclave budgétaire", "Bureau fédéral du Plan", "assainissement budgétaire", "coalition Arizona", "finances publiques"],
        creator: { "@type": "GovernmentOrganization", name: "Bureau fédéral du Plan", url: "https://www.plan.be/" },
        publisher: { "@type": "Organization", name: "Ouaisfieu", url: `${SITE}/` },
        datePublished: "2026-06-01",
        variableMeasured: "Impulsion budgétaire annuelle, en millions d'euros",
        distribution: [{
          "@type": "DataDownload",
          encodingFormat: "application/json",
          contentUrl: `${SITE}/assets/data/corpus.json`,
        }],
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: "Les 263 mesures du budget fédéral 2027",
        url, inLanguage: "fr-BE",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: index.length,
          itemListElement: index.slice(0, 100).map((m, i) => ({
            "@type": "ListItem", position: i + 1, name: m.titreCourt ?? m.titre,
            url: `${SITE}/conclave/mesures/${m.slug}.html`,
          })),
        },
      },
      filLd([
        { nom: "sims", abs: "/" }, { nom: "Fumée blanche", abs: "/conclave/" }, { nom: "Les mesures", abs: "/conclave/mesures/" },
      ], SITE),
    ],
  });

  return tete({
    titre: "Les 263 mesures du budget fédéral belge 2027 — inventaire du Bureau du Plan | Ouaisfieu",
    description: "L'inventaire complet des 263 mesures budgétaires recensées par le Bureau fédéral du Plan pour le budget 2027, dont 39 chiffrées : montants, catégories, modalités et lecture critique. Recherche et filtres.",
    url, extraLd: schema,
  }) + corps + pied;
}

/* ---------------- ecriture ---------------- */
mkdirSync(SORTIE, { recursive: true });
for (const f of readdirSync(SORTIE)) if (f.endsWith(".html")) unlinkSync(join(SORTIE, f));

const index = corpus.mesures;
let n = 0;
for (const m of index) { writeFileSync(join(SORTIE, `${m.slug}.html`), pageMesure(m, index)); n++; }
writeFileSync(join(SORTIE, "index.html"), pageIndex(index));

/* ---------------- plan du site ---------------- */
const aujourdhui = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, p: "1.0", f: "monthly" },
  { loc: `${SITE}/conclave/`, p: "1.0", f: "weekly" },
  { loc: `${SITE}/conclave/mesures/`, p: "0.9", f: "weekly" },
  { loc: `${SITE}/conclave/cheatcodes/`, p: "0.9", f: "weekly" },
  { loc: `${SITE}/conclave/methodologie.html`, p: "0.7", f: "monthly" },
  ...index.map((m) => ({ loc: `${SITE}/conclave/mesures/${m.slug}.html`, p: m.montant != null ? "0.6" : "0.4", f: "monthly" })),
];
writeFileSync(join(ROOT, "sitemap.xml"),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${aujourdhui}</lastmod><changefreq>${u.f}</changefreq><priority>${u.p}</priority></url>`).join("\n")}
</urlset>
`);
writeFileSync(join(ROOT, "robots.txt"),
`User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`${n} fiches + l'index écrits dans conclave/mesures/\nsitemap.xml : ${urls.length} adresses`);
