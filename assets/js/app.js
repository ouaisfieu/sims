/* ============================================================
   app.js — orchestration et interface du conclave.
   ============================================================ */
import * as M from "./moteur.js";
import * as S from "./stockage.js";
import * as P from "./partage.js";

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, p = {}, ...enfants) => {
  const n = Object.assign(document.createElement(t), p);
  for (const e of enfants.flat()) if (e != null) n.append(e.nodeType ? e : document.createTextNode(e));
  return n;
};
const echapper = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let D = null;        /* donnees */
let E = null;        /* etat */
let carteCourante = null;
let horloge = null;
let veille = null;
let ACTIFS = new Set(S.prefs().codes ?? []);   /* codes secrets actifs */
const actif = (c) => ACTIFS.has(c);

/* ============ atmosphere : son et vibration ============ */
let audio = null;
const son = (freq, duree = 0.08, type = "sine", vol = 0.06) => {
  if (!S.prefs().son) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duree);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + duree);
  } catch {}
};
const vibrer = (motif) => { if (S.prefs().vibration) try { navigator.vibrate?.(motif); } catch {} };

/* ============ navigation entre ecrans ============ */
function montrer(id) {
  const bascule = () => {
    for (const s of $$(".ecran")) s.toggleAttribute("data-actif", s.id === id);
    window.scrollTo(0, 0);
  };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    document.startViewTransition(bascule);
  else bascule();
}

/* ============ panneau ============ */
function panneau(titre, contenu, actions = []) {
  const boite = $("#panneau-contenu");
  boite.replaceChildren();
  boite.append(el("h2", { id: "panneau-titre", style: "font-size:1.25rem" }, titre));
  boite.append(contenu);
  if (actions.length) {
    const pied = el("p", { style: "display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 0" });
    for (const a of actions) {
      const b = el("button", { type: "button", className: `bouton ${a.premier ? "bouton--premier" : ""}` }, a.texte);
      b.onclick = () => { a.action?.(); if (a.ferme !== false) fermerPanneau(); };
      pied.append(b);
    }
    boite.append(pied);
  }
  const p = $("#panneau");
  p.hidden = false;
  p.querySelector("button, [tabindex]")?.focus();
}
const fermerPanneau = () => { $("#panneau").hidden = true; };
$("#panneau").addEventListener("click", (e) => { if (e.target.id === "panneau") fermerPanneau(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") fermerPanneau(); });

/* ============ accueil ============ */
function rendreModes() {
  const boite = $("#modes");
  boite.replaceChildren();
  for (const m of Object.values(M.MODES)) {
    const b = el("button", { className: "mode", type: "button" },
      el("b", {}, m.nom), el("span", {}, m.accroche));
    b.setAttribute("aria-pressed", m.id === "conclave" ? "true" : "false");
    b.dataset.mode = m.id;
    b.onclick = () => {
      for (const a of $$(".mode")) a.setAttribute("aria-pressed", String(a === b));
      son(440, 0.05, "triangle");
    };
    boite.append(b);
  }
}

function demarrer(options = {}) {
  const mode = options.mode ?? $('.mode[aria-pressed="true"]')?.dataset.mode ?? "conclave";
  E = M.nouvellePartie(D, { mode, graine: options.graine, codes: [...ACTIFS] });
  if (options.adoptees) {
    /* Les bilatérales d'abord : elles n'adoucissent une ligne rouge que pour
       ce qui vient après, exactement comme en partie. */
    E.lignesAssouplies = options.lignesAssouplies ?? [];
    for (const id of options.adoptees) M.adopter(E, id, D);
    E.nuit = Math.max(1, options.nuit ?? 1);
    E.actions = M.actionsDeBase(E, D);
  }
  M.distribuer(E, D);
  S.effacerEnCours();
  demanderVeille();
  montrer("ecran-jeu");
  rendre();
  lancerHorloge();
  son(330, 0.18, "sine", 0.05);
}

/* ============ veille ============ */
async function demanderVeille() {
  try { veille = await navigator.wakeLock?.request("screen"); } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && E?.statut === "en-cours") demanderVeille();
});

/* ============ horloge des interets ============ */
function lancerHorloge() {
  clearInterval(horloge);
  horloge = setInterval(() => {
    if (!E || E.statut !== "en-cours") return clearInterval(horloge);
    $("#interets").textContent = M.fmtEuros(M.interetsDepuis(E.debut, D));
  }, 120);
}

/* ============ rendu du bandeau ============ */
function rendreHUD() {
  const b = M.bilan(E, D);
  $("#nuit-num").textContent = Math.min(E.nuit, E.nuitsTotal);
  $("#nuit-total").textContent = E.nuitsTotal > 50 ? "∞" : E.nuitsTotal;
  $("#total").textContent = M.fmt(b.affiche);
  $("#objectif").textContent = M.fmt(E.objectif);
  $("#credibilite").textContent = Math.round(E.credibilite);
  $("#rue").textContent = Math.round(E.rue);
  $("#nb-table").textContent = E.adoptees.length;

  /* KERN : le montant réellement constaté, affiché en direct */
  const vueReel = $("#reel-direct");
  vueReel.hidden = !actif("KERN");
  if (actif("KERN")) {
    vueReel.textContent = `réel ≈ ${M.fmt(b.reel)}`;
    vueReel.className = `compteur__reel chiffre ${b.reel / Math.max(1, b.affiche) > 0.7 ? "positif" : "negatif"}`;
  }

  const part = Math.min(100, (b.affiche / E.objectif) * 100);
  const j = $("#jauge-total");
  j.style.width = `${Math.max(0, part)}%`;
  j.toggleAttribute("data-atteint", part >= 100);

  const jetons = $("#jetons");
  jetons.replaceChildren();
  const total = M.actionsDeBase(E, D) + E.actionsBonus;
  for (let i = 0; i < total; i++) {
    const p = el("span", { className: "jeton" });
    if (i >= E.actions) p.setAttribute("data-vide", "");
    jetons.append(p);
  }
  jetons.setAttribute("aria-label", `${E.actions} action${E.actions > 1 ? "s" : ""} restante${E.actions > 1 ? "s" : ""} sur ${total}`);

  const boite = $("#partis");
  boite.replaceChildren();
  if (M.MODES[E.mode].coalition.length) {
    for (const p of M.PARTIS) {
      const v = Math.max(0, E.cohesion[p]);
      const btn = el("button", { className: "parti", type: "button" },
        el("span", { className: "parti__nom" }, D.partis[p].nom),
        el("span", { className: "parti__barre" },
          el("span", {
            className: "parti__part",
            style: `width:${v}%;background:${v <= 0 ? "var(--rouge)" : D.partis[p].couleur};color:${D.partis[p].couleur}`,
          })));
      if (v < 30) btn.setAttribute("data-peril", "");
      btn.setAttribute("aria-label", `${D.partis[p].nomLong} : cohésion ${Math.round(v)} sur 100`);
      btn.onclick = () => fichePartis(p);
      boite.append(btn);
    }
  }

  const peut = M.peutSceller(E, D);
  $("#btn-sceller").hidden = !peut;
  if (peut) $("#btn-sceller").classList.add("lien-action");
}

function fichePartis(p) {
  const q = D.partis[p];
  const c = el("div", { className: "fiche" });
  c.innerHTML =
    `<p style="color:var(--craie-2)">${echapper(q.position)}</p>` +
    `<dl><dt>Cohésion</dt><dd>${Math.round(E.cohesion[p])} / 100</dd>` +
    `<dt>Représenté par</dt><dd>${echapper(q.figure)}</dd>` +
    `<dt>Ligne rouge</dt><dd style="color:var(--rouge)">${echapper(q.ligneRouge)}</dd>` +
    `<dt>Marge réelle</dt><dd>${echapper(q.marge)}</dd></dl>` +
    `<p class="fiche__note">${E.lignesAssouplies.includes(p)
      ? "Une bilatérale a déjà été menée. La pénalité de ligne rouge est réduite de moitié pour ce partenaire."
      : "Une bilatérale coûte une action et réduit de moitié la pénalité de ligne rouge de ce partenaire pour le reste du conclave."}</p>` +
    `<p class="petit sourdine" style="margin-top:12px">Position documentée. Source : ${echapper(q.source)}.</p>`;
  panneau(q.nomLong, c);
}

/* ============ la pile de cartes ============ */
const SIGNE = (v) => (v > 0 ? `+${v}` : String(v));
const COULEUR_REACTION = (v) => (v >= 2 ? "var(--vert)" : v > 0 ? "#8FCBB4" : v === 0 ? "var(--craie-3)" : v > -3 ? "#F0A093" : "var(--rouge)");

function construireCarte(c) {
  const n = el("article", { className: `carte carte--${c.type}`, tabIndex: 0 });
  n.dataset.id = c.id;
  n.setAttribute("aria-label", `${c.titre}. ${c.montantHorizon ? M.fmt(c.montantHorizon) : "aucun rendement direct"}.`);

  const haut = el("div", { className: "carte__haut" });
  if (c.parti) haut.append(el("span", { className: "etiquette" }, `Proposé par ${c.parti}`));
  if (c.provenance === "bfp") haut.append(el("span", { className: "etiquette etiquette--bfp" }, "chiffré BFP"));
  else if (c.provenance === "analyse") haut.append(el("span", { className: "etiquette etiquette--analyse" }, "analyse"));
  if (c.type === "methode") haut.append(el("span", { className: "etiquette etiquette--bfp" }, "méthode"));
  if (c.type === "artifice") haut.append(el("span", { className: "etiquette etiquette--rouge" }, "artifice"));
  n.append(haut);

  n.append(el("h3", { className: "carte__titre" }, c.titre));
  n.append(el("p", { className: "carte__cat" }, [c.categorie, c.sousCategorie].filter(Boolean).join(" · ")));

  const mt = el("div", { className: "carte__montant" });
  if (c.type === "methode") {
    mt.append(el("p", { className: "carte__md chiffre", style: "font-size:1.7rem;color:var(--vert)" }, `+${c.gainCredibilite} crédibilité`));
    mt.append(el("p", { className: "carte__horizon" }, "Aucun euro. Décide de la part de votre annonce qui survivra à mars 2027."));
  } else {
    const v = (c.montantHorizon ?? 0) * (c.sens ?? 1);
    mt.append(el("p", { className: "carte__md chiffre", style: v < 0 ? "color:var(--rouge)" : "" }, M.fmt(v)));
    mt.append(el("p", { className: "carte__horizon" }, v < 0 ? "de dépense supplémentaire, à l'horizon 2029" : "à l'horizon 2029"));
    if (c.montant !== c.montantHorizon)
      mt.append(el("p", { className: "carte__regime" }, el("b", {}, M.fmt(c.montant * (c.sens ?? 1))), " à plein régime"));
  }
  n.append(mt);

  if (M.MODES[E.mode].coalition.length && c.reactions) {
    const r = el("div", { className: "carte__reactions" });
    for (const p of M.PARTIS) {
      const v = c.reactions[p] ?? 0;
      const rouge = c.ligneRouge.includes(p);
      r.append(el("div", { className: "reaction", style: rouge ? "border-color:var(--rouge)" : "" },
        el("div", { className: "reaction__nom" }, D.partis[p].nom.replace(/^Les /, "")),
        el("div", { className: "reaction__val", style: `color:${rouge ? "var(--rouge)" : COULEUR_REACTION(v)}` }, rouge ? "✕" : SIGNE(v))));
    }
    n.append(r);
    if (c.ligneRouge.length) {
      const noms = c.ligneRouge.map((p) => D.partis[p].nom).join(" et ");
      n.append(el("p", { className: "carte__alerte" }, `Ligne rouge pour ${noms}.`));
    }
  }
  if (c.avertissement) n.append(el("p", { className: "carte__alerte carte__alerte--jaune" }, c.avertissement));
  else if (c.type === "mesure" && !c.structurel && !c.avertissement)
    n.append(el("p", { className: "carte__alerte carte__alerte--jaune" }, "Sans effet sur le solde structurel."));

  /* ARIZONA : l'assiette déjà servie est nommée */
  if (actif("ARIZONA") && c.type === "mesure") {
    const jumelle = E.adoptees
      .map((id) => D.cartes.find((x) => x.id === id))
      .find((x) => x && x.famille === c.famille);
    if (jumelle)
      n.append(el("p", { className: "carte__alerte carte__alerte--jaune" },
        `Même assiette que « ${jumelle.titre} », déjà sur la table. La moitié du rendement sera retirée en mars.`));
  }

  /* MONITORING : ce qu'il en restera, avant même de la poser */
  if (actif("MONITORING") && c.type !== "methode") {
    const dejaVue = E.adoptees.some((id) => D.cartes.find((x) => x.id === id)?.famille === c.famille);
    const reste = M.reelAttendu(c, D, dejaVue);
    const brut = (c.montantHorizon ?? 0) * (c.sens ?? 1);
    n.append(el("p", { className: "carte__alerte carte__alerte--jaune" },
      brut > 0
        ? `En mars 2027, il en restera environ ${M.fmt(reste)} sur ${M.fmt(brut)}.`
        : "Mesure de dépense : elle creuse le solde, elle ne le comble pas."));
  }

  const pied = el("div", { className: "carte__pied" });
  const traits = [];
  if (c.credibilite && c.type === "mesure") traits.push(`chiffrage ${"◆".repeat(c.credibilite)}${"◇".repeat(5 - c.credibilite)}`);
  if (c.effetRetour) traits.push("effet retour");
  if (c.transfertE2 >= 0.3) traits.push("transfert aux entités");
  if (c.chevauche?.length) traits.push("assiette partagée");
  pied.append(el("span", {}, traits.join(" · ") || "—"));
  const d = el("button", { className: "carte__detail", type: "button" }, "Détail");
  d.onclick = (e) => { e.stopPropagation(); detailCarte(c); };
  pied.append(d);
  n.append(pied);

  n.append(el("span", { className: "estampille estampille--oui" }, "Adoptée"));
  n.append(el("span", { className: "estampille estampille--non" }, "Écartée"));
  return n;
}

function rendrePile() {
  const pile = $("#pile");
  pile.replaceChildren();
  const ids = E.main.slice(0, 3);
  if (!ids.length) {
    carteCourante = null;
    pile.append(el("div", { className: "vide-pile", style: "position:absolute;inset:0;display:grid;place-items:center" },
      el("p", {}, "Plus rien à examiner cette nuit."),
    ));
    majBoutons();
    return;
  }
  for (let i = ids.length - 1; i >= 0; i--) {
    const c = D.cartes.find((x) => x.id === ids[i]);
    if (!c) continue;
    const n = construireCarte(c);
    if (i > 0) {
      n.setAttribute("data-dessous", "");
      n.style.transform = `translateY(${i * 8}px) scale(${1 - i * 0.03})`;
      n.style.opacity = String(1 - i * 0.3);
      n.setAttribute("aria-hidden", "true");
      n.tabIndex = -1;
    } else {
      carteCourante = c;
      brancherGlissement(n, c);
    }
    pile.append(n);
  }
  majBoutons();
}

function majBoutons() {
  const rien = !carteCourante || E.statut !== "en-cours";
  $("#btn-ecarter").disabled = rien;
  $("#btn-detail").disabled = rien;
  $("#btn-adopter").disabled = rien || E.actions <= 0;
  $("#btn-adopter").title = E.actions <= 0 ? "Plus d'action cette nuit" : "";
}

/* ---------- glisser ---------- */
function brancherGlissement(n, c) {
  let x0 = 0, y0 = 0, dx = 0, actif = false;
  const oui = n.querySelector(".estampille--oui"), non = n.querySelector(".estampille--non");

  const debut = (e) => {
    if (e.target.closest("button")) return;
    actif = true; x0 = e.clientX; y0 = e.clientY; dx = 0;
    n.setPointerCapture?.(e.pointerId);
    n.style.transition = "none";
  };
  const bouge = (e) => {
    if (!actif) return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (Math.abs(dy) > Math.abs(dx) * 1.8 && Math.abs(dx) < 12) return;
    n.style.transform = `translate(${dx}px, ${dy * 0.12}px) rotate(${dx * 0.045}deg)`;
    oui.style.opacity = String(Math.max(0, Math.min(1, dx / 90)));
    non.style.opacity = String(Math.max(0, Math.min(1, -dx / 90)));
  };
  const fin = () => {
    if (!actif) return;
    actif = false;
    n.style.transition = "transform .3s cubic-bezier(.2,.9,.3,1), opacity .3s";
    const seuil = Math.min(115, n.offsetWidth * 0.32);
    if (dx > seuil && E.actions > 0) return envoler(n, 1, () => adopter(c));
    if (dx < -seuil) return envoler(n, -1, () => ecarter(c));
    n.style.transform = "";
    oui.style.opacity = non.style.opacity = "0";
  };
  n.addEventListener("pointerdown", debut);
  n.addEventListener("pointermove", bouge);
  n.addEventListener("pointerup", fin);
  n.addEventListener("pointercancel", fin);
  n.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" && E.actions > 0) { e.preventDefault(); envoler(n, 1, () => adopter(c)); }
    if (e.key === "ArrowLeft") { e.preventDefault(); envoler(n, -1, () => ecarter(c)); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); detailCarte(c); }
  });
}

function envoler(n, sens, apres) {
  n.style.transition = "transform .3s cubic-bezier(.3,.8,.4,1), opacity .3s";
  n.style.transform = `translate(${sens * 620}px, -40px) rotate(${sens * 26}deg)`;
  n.style.opacity = "0";
  setTimeout(apres, 190);
}

/* ---------- decisions ---------- */
function adopter(c) {
  if (E.actions <= 0) return;
  const avant = { ...E.cohesion };
  M.adopter(E, c.id, D);
  son(c.type === "methode" ? 660 : 520, 0.1, "triangle");
  const rupture = M.PARTIS.find((p) => avant[p] > 0 && E.cohesion[p] <= 0);
  if (c.ligneRouge?.length) { vibrer([28, 55, 28]); son(160, 0.24, "sawtooth", 0.05); }
  else vibrer(14);
  S.sauverEnCours(E);
  if (E.statut !== "en-cours") return finir();
  if (rupture) return finir();
  rendre();
}

function ecarter(c) {
  M.ecarter(E, c.id);
  son(280, 0.05, "sine", 0.035);
  vibrer(8);
  S.sauverEnCours(E);
  rendre();
}

function rendre() { rendreHUD(); rendrePile(); }

/* ---------- detail d'une mesure ---------- */
function detailCarte(c) {
  const boite = el("div", { className: "fiche" });
  const l = [];
  if (c.type !== "methode") {
    l.push(["À l'horizon 2029", M.fmt((c.montantHorizon ?? 0) * (c.sens ?? 1))]);
    l.push(["À plein régime", M.fmt((c.montant ?? 0) * (c.sens ?? 1))]);
  } else l.push(["Crédibilité", `+${c.gainCredibilite} points`]);
  l.push(["Catégorie", [c.categorie, c.sousCategorie].filter(Boolean).join(" · ")]);
  if (c.delai) l.push(["Mise en œuvre", { immediat: "immédiate", court: "1 à 2 ans", moyen: "2 à 3 ans", long: "4 à 6 ans" }[c.delai]]);
  if (c.type === "mesure") {
    l.push(["Robustesse du chiffrage", `${c.credibilite} sur 5`]);
    if (c.risqueJuridique) l.push(["Risque juridique", ["nul", "faible", "réel", "élevé"][c.risqueJuridique]]);
    if (c.transfertE2) l.push(["Charge transférée", `${Math.round(c.transfertE2 * 100)} % aux entités fédérées ou aux CPAS`]);
    if (c.effetRetour) l.push(["Effet retour", "oui, donc décoté"]);
    if (!c.structurel) l.push(["Effet structurel", "non"]);
  }
  l.push(["Provenance du montant", c.provenance === "bfp" ? "Bureau fédéral du Plan" : c.provenance === "analyse" ? "analyse Ouaisfieu" : "artifice budgétaire"]);
  if (c.parti) l.push(["Chiffrage électoral", c.parti]);

  boite.innerHTML =
    `<dl>${l.map(([d, v]) => `<dt>${echapper(d)}</dt><dd>${echapper(v)}</dd>`).join("")}</dl>` +
    (c.note ? `<p class="fiche__note">${echapper(c.note)}</p>` : "") +
    (c.chevauche?.length ? `<p class="petit" style="color:var(--or);margin-top:12px">Assiette partagée avec ${c.chevauche.length} autre${c.chevauche.length > 1 ? "s" : ""} mesure${c.chevauche.length > 1 ? "s" : ""} du jeu. Les cumuler produit un double comptage, que vous ne découvrirez qu'en mars 2027.</p>` : "") +
    (c.slug ? `<p class="petit" style="margin-top:14px"><a href="mesures/${c.slug}.html">Fiche complète et texte original de la mesure →</a></p>` : "");

  panneau(c.titre, boite);
}

/* ---------- la table ---------- */
function voirTable() {
  const b = M.bilan(E, D);
  const boite = el("div");
  if (!E.adoptees.length) boite.append(el("p", { className: "sourdine" }, "Rien sur la table pour l'instant."));
  else {
    const ul = el("ul", { className: "liste-table" });
    for (const l of b.lignes) {
      const c = l.carte;
      const ligne = el("li", { className: "ligne-table" },
        el("div", { className: "ligne-table__corps" },
          el("div", { className: "ligne-table__titre" }, c.titre),
          el("div", { className: "ligne-table__meta" }, [c.categorie, c.parti && `chiffrage ${c.parti}`].filter(Boolean).join(" · "))),
        el("div", { className: "ligne-table__md chiffre" }, c.type === "methode" ? `+${c.gainCredibilite}` : M.fmt(l.brut)));
      const r = el("button", { className: "retirer", type: "button", title: "Retirer de la table", "aria-label": `Retirer ${c.titre}` }, "↩");
      r.onclick = () => { M.retirer(E, c.id, D); S.sauverEnCours(E); fermerPanneau(); rendre(); voirTable(); };
      ligne.append(r);
      ul.append(ligne);
    }
    boite.append(ul);
    boite.append(el("p", { className: "petit sourdine" },
      `Annoncé ${M.fmt(b.affiche)}. Objectif ${M.fmt(E.objectif)}. Le montant réellement constaté ne sera connu qu'en mars 2027.`));
  }
  panneau(`La table · nuit ${E.nuit}`, boite);
}

/* ---------- bilaterale ---------- */
function voirBilaterale() {
  if (E.actions <= 0) return panneau("Bilatérale", el("p", {}, "Plus d'action disponible cette nuit."));
  const boite = el("div");
  boite.append(el("p", { className: "sourdine petit" },
    "Une bilatérale coûte une action. Elle rend seize points de cohésion au partenaire choisi et réduit de moitié la pénalité de sa ligne rouge pour le reste du conclave. Les quatre autres en perdent quatre, et votre crédibilité deux : la méthode consiste à laisser chacun puiser dans une liste, ce qui produit une somme de mesures indolores plutôt qu'une trajectoire."));
  const g = el("div", { style: "display:grid;gap:8px;margin-top:14px" });
  for (const p of M.PARTIS) {
    const fait = E.lignesAssouplies.includes(p);
    const b = el("button", { className: "mode", type: "button", disabled: fait },
      el("b", {}, D.partis[p].nom),
      el("span", {}, fait ? "Bilatérale déjà menée." : `Cohésion ${Math.round(E.cohesion[p])}. Ligne rouge : ${D.partis[p].ligneRouge}`));
    b.onclick = () => {
      M.bilaterale(E, p, D);
      son(392, 0.14, "triangle"); vibrer(18);
      S.sauverEnCours(E); fermerPanneau(); rendre();
    };
    g.append(b);
  }
  boite.append(g);
  panneau("Mener une bilatérale", boite);
}

/* ---------- fin de nuit ---------- */
function cloreNuit() {
  for (const id of [...E.main]) M.ecarter(E, id);
  const ev = M.tirerEvenement(E, D);
  S.sauverEnCours(E);
  if (E.statut !== "en-cours") return finir();
  if (ev) {
    $("#ev-date").textContent = `Après la nuit ${E.nuit}`;
    $("#ev-titre").textContent = ev.titre;
    $("#ev-texte").textContent = ev.texte;
    $("#ev-csq").textContent = ev.consequence;
    son(220, 0.3, "sine", 0.05); vibrer([20, 40, 20]);
    montrer("ecran-evenement");
    return;
  }
  passerNuit();
}

function passerNuit() {
  M.nuitSuivante(E, D);
  if (E.statut !== "en-cours") return finir();
  M.distribuer(E, D);
  S.sauverEnCours(E);
  montrer("ecran-jeu");
  rendre();
}

/* ============ fin de partie ============ */
async function finir() {
  clearInterval(horloge);
  try { veille?.release(); } catch {}
  M.conclure(E, D);
  S.effacerEnCours();
  const r = M.epilogue(E, D);
  S.archiver({ mode: E.mode, statut: E.statut, affiche: r.bilan.affiche, reel: r.bilan.reel, mention: r.mention.lettre, graine: E.graine, adoptees: E.adoptees });
  try { navigator.clearAppBadge?.(); } catch {}

  if (E.statut === "fumee-blanche") { son(523, 0.5, "sine", 0.07); setTimeout(() => son(784, 0.7, "sine", 0.06), 180); vibrer([30, 60, 30, 60, 90]); }
  else { son(110, 0.7, "sawtooth", 0.07); vibrer([90, 50, 160]); }

  rendreFin(r);
  montrer("ecran-fin");
}

function rendreFin(r) {
  const b = r.bilan;
  const c = $("#fin-contenu");
  c.replaceChildren();
  const bon = ["A", "B"].includes(r.mention.lettre);
  const moyen = r.mention.lettre === "C";
  c.className = `enveloppe fin--${bon ? "bon" : moyen ? "moyen" : "mauvais"}`;

  const titres = {
    "fumee-blanche": "Fumée blanche", rupture: "Le gouvernement est tombé",
    douziemes: "Douzièmes provisoires", greve: "Le pays est à l'arrêt",
  };
  const entete = el("header", { className: "fin__entete" },
    el("div", { className: "fin__mention" }, r.mention.lettre),
    el("h2", { id: "fin-titre", style: "margin-bottom:4px" }, titres[E.statut] ?? "Conclave"),
    el("p", { className: "douce", style: "margin:0" }, E.cause ?? r.mention.texte));
  c.append(entete);

  const chiffres = el("div", { className: "resume-chiffres" });
  const bloc = (l, v, couleur) => el("div", { className: "bloc-chiffre" },
    el("div", { className: "bloc-chiffre__l" }, l),
    el("div", { className: "bloc-chiffre__v chiffre", style: couleur ? `color:${couleur}` : "" }, v));
  chiffres.append(
    bloc("Annoncé", M.fmt(b.affiche)),
    bloc("Retrouvé", M.fmt(b.reel), b.reel / Math.max(1, b.affiche) > 0.7 ? "var(--vert)" : "var(--rouge)"),
    bloc("Écart", M.fmt(b.ecart), "var(--rouge)"),
    bloc("Crédibilité", `${Math.round(E.credibilite)}`),
  );
  c.append(chiffres);

  c.append(el("h3", { style: "margin-top:8px" }, "Ce qui s'est passé ensuite"));
  for (const a of r.actes) {
    const n = el("div", { className: "acte" });
    n.dataset.verdict = a.verdict;
    n.append(el("p", { className: "acte__date", style: "margin:0" }, a.date));
    n.append(el("h4", { className: "acte__titre" }, a.titre));
    n.append(el("p", { className: "acte__texte", style: "margin:0 0 6px" }, a.texte));
    if (a.note) n.append(el("p", { className: "acte__note", style: "margin:0" }, a.note));
    if (a.complement) n.append(el("p", { className: "petit sourdine", style: "margin:6px 0 0" }, a.complement));
    if (a.detail) n.append(detailDeductions(a.detail));
    c.append(n);
  }

  /* apercu de la carte de partage */
  const canvas = P.dessinerCarte(E, D, r);
  const img = el("img", { className: "apercu-partage", alt: "Aperçu de votre carte de résultat", loading: "lazy" });
  img.src = canvas.toDataURL("image/png");
  c.append(el("h3", {}, "Partager votre budget"));
  c.append(img);
  c.append(el("p", { className: "petit sourdine", style: "margin-top:-6px" },
    "Le lien rejoue votre budget exact : celui qui l'ouvre reprend votre partie et tente de faire mieux."));

  const actions = el("p", { className: "rangee-actions" });
  const bPartage = el("button", { className: "bouton bouton--premier", type: "button" }, "Partager");
  bPartage.onclick = async () => {
    const issue = await P.partager(E, D, r);
    if (issue === "copie") bPartage.textContent = "Copié dans le presse-papiers";
    else if (issue === "echec") bPartage.textContent = "Partage indisponible";
    setTimeout(() => (bPartage.textContent = "Partager"), 2600);
  };
  const bImage = el("button", { className: "bouton", type: "button" }, "Enregistrer l'image");
  bImage.onclick = () => P.telechargerCarte(E, D, r);
  const bLien = el("button", { className: "bouton", type: "button" }, "Copier le lien");
  bLien.onclick = async () => {
    try { await navigator.clipboard.writeText(P.lienPartie(E)); bLien.textContent = "Lien copié"; }
    catch { bLien.textContent = "Copie impossible"; }
    setTimeout(() => (bLien.textContent = "Copier le lien"), 2600);
  };
  actions.append(bPartage, bImage, bLien);
  c.append(actions);

  const exports = el("p", { className: "rangee-actions rangee-actions--petite" });
  const tel = (nom, contenu, type) => {
    const a = el("a", { className: "bouton bouton--discret", download: nom }, nom.endsWith(".csv") ? "Exporter en CSV" : "Exporter en JSON");
    a.href = URL.createObjectURL(new Blob([contenu], { type }));
    return a;
  };
  exports.append(
    tel("budget-conclave.csv", P.exporterCSV(E, D, r), "text/csv;charset=utf-8"),
    tel("budget-conclave.json", JSON.stringify(P.exporterJSON(E, D, r), null, 2), "application/json"),
  );
  c.append(exports);

  const rejouer = el("p", { className: "rangee-actions", style: "margin-top:22px" });
  const b1 = el("button", { className: "bouton bouton--premier", type: "button" }, "Rejouer");
  b1.onclick = () => demarrer({ mode: E.mode });
  const b2 = el("a", { className: "bouton", href: "mesures/" }, "Parcourir les 263 mesures");
  const b3 = el("a", { className: "bouton bouton--discret", href: "methodologie.html" }, "Méthodologie");
  rejouer.append(b1, b2, b3);
  c.append(rejouer);

  c.append(el("footer", { className: "pied" },
    el("p", {}, "Ouaisfieu · sims — projet citoyen de veille des politiques publiques belges. Données : Bureau fédéral du Plan, Options de politiques pour l'élaboration du budget 2027, 1er juin 2026."),
  ));
}

function detailDeductions(lignes) {
  const ul = el("ul", { className: "deduction" });
  for (const l of lignes) {
    if (l.carte.type === "methode") continue;
    const li = el("li");
    li.append(el("div", { className: "deduction__t" },
      el("span", { className: "deduction__nom" }, l.carte.titre),
      el("span", { className: "deduction__md chiffre" },
        el("span", { className: "sourdine" }, M.fmt(l.brut)),
        " → ",
        el("b", { className: l.reel < l.brut * 0.999 ? "negatif" : "positif" }, M.fmt(l.reel)))));
    if (l.retraits.length) {
      const d = el("div", { className: "deduction__r" });
      for (const [motif, montant] of l.retraits)
        d.append(el("span", {}, el("em", { style: "font-style:normal" }, motif), el("span", { className: "chiffre" }, `− ${M.fmt(montant)}`)));
      li.append(d);
    }
    ul.append(li);
  }
  if (!ul.children.length) return el("p", { className: "petit sourdine" }, "Aucune mesure chiffrée sur la table.");
  return ul;
}

/* ============ etat detaille ============ */
function voirEtat() {
  const b = M.bilan(E, D);
  const boite = el("div", { className: "fiche" });
  boite.innerHTML =
    `<dl>
      <dt>Annoncé</dt><dd>${M.fmt(b.affiche)} sur ${M.fmt(E.objectif)}</dd>
      <dt>Crédibilité</dt><dd>${Math.round(E.credibilite)} / 100</dd>
      <dt>Tension sociale</dt><dd>${Math.round(E.rue)} / 100</dd>
      <dt>Mesures sur la table</dt><dd>${b.nbMesures} mesures, ${b.nbMethode} réformes de méthode</dd>
      <dt>Part en recettes</dt><dd>${Math.round(b.partRecettes * 100)} %</dd>
      <dt>Part en dépenses</dt><dd>${Math.round(b.partDepenses * 100)} %</dd>
      ${b.partOneShot > 0 ? `<dt>Part en one-shots</dt><dd style="color:var(--rouge)">${Math.round(b.partOneShot * 100)} %</dd>` : ""}
    </dl>
    <p class="fiche__note">La crédibilité détermine la part de votre annonce qui survivra au Comité de monitoring de mars 2027. La tension sociale monte avec les mesures qui frappent les bas revenus ; à cent, le pays s'arrête. La charge d'intérêts, elle, court pendant que vous négociez : elle passe de 12,2 milliards en 2026 à près de 21 en 2030.</p>`;
  panneau("Où vous en êtes", boite);
}

/* ============ codes secrets ============ */
/* Décrits sur /conclave/cheatcodes/. Ils survivent aux parties, se retapent
   pour se désactiver, et ne modifient ni les données ni le calcul du réel. */
const NOMS_CODES = {
  KERN: "Mode analyste", MONITORING: "Décote apparente", ARIZONA: "Assiettes révélées",
  HUISCLOS: "Une action de plus", BOULEDENEIGE: "Mode difficile",
  FUMEEBLANCHE: "La combinaison de référence",
};

function majCodesActifs() {
  const p = $("#codes-actifs");
  if (!p) return;
  p.hidden = !ACTIFS.size;
  p.replaceChildren();
  for (const c of ACTIFS) p.append(el("span", { className: "etiquette etiquette--analyse" }, c));
}

async function chargerReference() {
  try {
    const r = await fetch("../assets/data/combinaisons.json", { cache: "force-cache" });
    const d = await r.json();
    return d?.combinaisons?.reference ?? null;
  } catch { return null; }
}

async function basculerCode(brut) {
  const code = String(brut || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!M.CODES.includes(code)) return null;

  if (ACTIFS.has(code)) {
    ACTIFS.delete(code);
    S.majPrefs({ codes: [...ACTIFS] });
    majCodesActifs();
    son(220, 0.1, "sine", 0.05);
    return { code, actif: false };
  }

  ACTIFS.add(code);
  S.majPrefs({ codes: [...ACTIFS] });
  majCodesActifs();
  son(660, 0.12, "triangle"); setTimeout(() => son(880, 0.16, "triangle"), 110);
  vibrer([16, 40, 16]);

  if (code === "FUMEEBLANCHE") {
    const ref = await chargerReference();
    if (ref) {
      demarrer({ mode: "conclave", adoptees: ref.cartes.map((c) => c.id), lignesAssouplies: ref.bilaterales });
      return { code, actif: true, charge: true };
    }
  }
  if (E?.statut === "en-cours") rendre();
  return { code, actif: true };
}

function voirCodes() {
  const boite = el("div");
  boite.append(el("p", { className: "sourdine petit" },
    "Six codes existent. Ils restent actifs d'une partie à l'autre et se désactivent en les retapant. Au clavier, tapez-les simplement : le jeu écoute."));

  const form = el("form", { style: "display:flex;gap:8px;margin:14px 0 4px" });
  const champ = el("input", {
    type: "text", className: "champ-code", placeholder: "votre code",
    autocomplete: "off", autocapitalize: "characters", spellcheck: false,
    "aria-label": "Code secret",
  });
  const valider = el("button", { type: "submit", className: "bouton bouton--premier" }, "Entrer");
  form.append(champ, valider);
  const retour = el("p", { className: "petit", style: "min-height:1.4em;margin:8px 0 0" });
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const r = await basculerCode(champ.value);
    if (!r) { retour.textContent = "Ce code n'existe pas."; retour.style.color = "var(--craie-3)"; return; }
    if (r.charge) return fermerPanneau();
    retour.textContent = r.actif
      ? `${NOMS_CODES[r.code]} activé.`
      : `${NOMS_CODES[r.code]} désactivé.`;
    retour.style.color = r.actif ? "var(--vert)" : "var(--craie-3)";
    champ.value = "";
    listeCodes();
  };
  boite.append(form, retour);

  const liste = el("ul", { style: "list-style:none;margin:16px 0 0;padding:0;display:grid;gap:6px" });
  function listeCodes() {
    liste.replaceChildren();
    for (const c of M.CODES) {
      const on = ACTIFS.has(c);
      liste.append(el("li", {
        style: `display:flex;gap:10px;align-items:baseline;font-size:.85rem;color:${on ? "var(--craie)" : "var(--craie-3)"}`,
      },
        el("span", { style: `font-weight:800;letter-spacing:.04em;color:${on ? "var(--or)" : "var(--encre-4)"}` }, on ? "●" : "○"),
        el("span", {}, on ? NOMS_CODES[c] : "—————")));
    }
  }
  listeCodes();
  boite.append(liste);
  boite.append(el("p", { className: "petit", style: "margin:16px 0 0" },
    el("a", { href: "cheatcodes/" }, "Les codes, les combinaisons résolues et les techniques →")));

  panneau("Entrer un code", boite);
  setTimeout(() => champ.focus(), 60);
}

/* écoute clavier : on tape le code, sans champ */
let tampon = "";
addEventListener("keydown", (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
  if (!/^[a-zA-Z]$/.test(ev.key)) return;
  tampon = (tampon + ev.key.toUpperCase()).slice(-14);
  const trouve = M.CODES.find((c) => tampon.endsWith(c));
  if (!trouve) return;
  tampon = "";
  basculerCode(trouve).then((r) => {
    if (!r || r.charge) return;
    panneau(r.actif ? `${NOMS_CODES[r.code]} activé` : `${NOMS_CODES[r.code]} désactivé`,
      el("p", { className: "sourdine" }, r.actif
        ? "Le code reste actif d'une partie à l'autre. Retapez-le pour le désactiver."
        : "Le code est désactivé."),
      [{ texte: "Continuer", premier: true }]);
  });
});

/* ============ branchements ============ */
$("#commencer").onclick = () => demarrer();
$("#entrer-code").onclick = voirCodes;
$("#btn-adopter").onclick = () => { if (carteCourante) { const n = $(".carte:not([data-dessous])"); n ? envoler(n, 1, () => adopter(carteCourante)) : adopter(carteCourante); } };
$("#btn-ecarter").onclick = () => { if (carteCourante) { const n = $(".carte:not([data-dessous])"); n ? envoler(n, -1, () => ecarter(carteCourante)) : ecarter(carteCourante); } };
$("#btn-detail").onclick = () => carteCourante && detailCarte(carteCourante);
$("#btn-table").onclick = voirTable;
$("#btn-bilaterale").onclick = voirBilaterale;
$("#btn-nuit").onclick = cloreNuit;
$("#voir-etat").onclick = voirEtat;
$("#ev-suite").onclick = passerNuit;
$("#btn-sceller").onclick = () => {
  panneau("Sceller l'accord ?",
    el("p", {}, `Vous annoncez ${M.fmt(M.bilan(E, D).affiche)} d'effort. Continuer à négocier permettrait de consolider la crédibilité de ce chiffre, c'est-à-dire la part qui en subsistera en mars 2027.`),
    [{ texte: "Sceller", premier: true, action: () => { M.sceller(E, D); finir(); } }, { texte: "Continuer" }]);
};

/* ============ demarrage ============ */
(async function init() {
  rendreModes();
  majCodesActifs();
  try {
    D = await S.chargerDonnees("../assets/data/jeu.json");
  } catch {
    $("#commencer").disabled = true;
    $("#commencer").textContent = "Données indisponibles hors ligne";
    return;
  }

  /* budget partage dans l'adresse */
  const m = location.hash.match(/budget=([A-Za-z0-9_-]+)/);
  if (m) {
    const p = P.decoder(m[1]);
    if (p) {
      const b = el("div");
      b.append(el("p", {}, "Quelqu'un vous défie sur son budget. Vous reprenez sa table exacte, ses lignes assouplies et sa graine d'événements."));
      panneau("Un budget vous attend", b, [
        { texte: "Reprendre ce budget", premier: true, action: () => demarrer(p) },
        { texte: "Partir de zéro" },
      ]);
    }
  }

  const enCours = S.lireEnCours();
  if (enCours && !m) {
    const b = $("#reprendre");
    b.hidden = false;
    b.textContent = `Reprendre la partie de la nuit ${enCours.nuit}`;
    b.onclick = () => {
      E = enCours;
      if (!E.main?.length) M.distribuer(E, D);
      montrer("ecran-jeu"); rendre(); lancerHorloge(); demanderVeille();
    };
    try { navigator.setAppBadge?.(enCours.nuit); } catch {}
  }

})();

/* Enregistre hors du demarrage asynchrone : au moment ou celui-ci se termine,
   l'evenement load peut deja etre passe. */
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch(() => {});
