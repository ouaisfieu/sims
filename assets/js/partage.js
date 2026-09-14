/* ============================================================
   partage.js — carte de resultat dessinee au canvas,
   feuille de partage native, et budget encode dans le lien.
   ============================================================ */
import { fmt } from "./moteur.js";

/* ---------- encodage du budget dans l'adresse ---------- */
export function encoder(etat) {
  const charge = { m: etat.mode, g: etat.graine, n: etat.nuit, a: etat.adoptees, b: etat.lignesAssouplies };
  const brut = JSON.stringify(charge);
  const octets = new TextEncoder().encode(brut);
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decoder(texte) {
  try {
    const b = atob(texte.replaceAll("-", "+").replaceAll("_", "/"));
    const octets = Uint8Array.from(b, (c) => c.charCodeAt(0));
    const o = JSON.parse(new TextDecoder().decode(octets));
    return { mode: o.m, graine: o.g, nuit: o.n, adoptees: o.a, lignesAssouplies: o.b || [] };
  } catch { return null; }
}

export const lienPartie = (etat) =>
  `${location.origin}${location.pathname}#budget=${encoder(etat)}`;

/* ---------- ligne d'emoji facon Wordle ---------- */
const PASTILLE = { nva: "🟧", mr: "🟦", vooruit: "🟥", cdv: "🟨", le: "🟩" };
export function bandeau(etat, donnees) {
  return ["nva", "mr", "vooruit", "cdv", "le"]
    .map((p) => (etat.cohesion[p] <= 0 ? "⬛" : etat.cohesion[p] < 35 ? "🟫" : PASTILLE[p]))
    .join("");
}

export function textePartage(etat, donnees, resultat) {
  const b = resultat.bilan;
  const l = [];
  l.push(`🇧🇪 FUMÉE BLANCHE — conclave 2026`);
  l.push(`Annoncé ${fmt(b.affiche)} · Retrouvé ${fmt(b.reel)}`);
  if (etat.statut === "rupture") l.push(`🚪 ${donnees.partis[etat.parti].nom} a claqué la porte, nuit ${etat.nuit}`);
  else if (etat.statut === "douziemes") l.push(`⏳ Douzièmes provisoires`);
  else if (etat.statut === "greve") l.push(`✊ Grève générale`);
  else l.push(`💨 Fumée blanche nuit ${etat.nuitScellee ?? etat.nuit}`);
  l.push(`Note souveraine ${resultat.actes[3].note} · Mention ${resultat.mention.lettre}`);
  l.push(bandeau(etat, donnees));
  l.push(``);
  l.push(`Fais mieux : ${lienPartie(etat)}`);
  return l.join("\n");
}

/* ---------- carte de resultat ---------- */
const CLR = {
  encre: "#0A0C11", encre2: "#12161F", trait: "#333D4E",
  craie: "#F2EFE8", craie2: "#B9C0CC", craie3: "#7A8494",
  or: "#E9B448", rouge: "#E24B3B", vert: "#45B58F",
};

export function dessinerCarte(etat, donnees, resultat) {
  const L = 1200, H = 630, r = 2;
  const c = document.createElement("canvas");
  c.width = L * r; c.height = H * r;
  const x = c.getContext("2d");
  x.scale(r, r);

  const police = (t, p = 600) =>
    `${p} ${t}px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

  /* fond */
  const g = x.createLinearGradient(0, 0, L, H);
  g.addColorStop(0, "#161C28"); g.addColorStop(1, CLR.encre);
  x.fillStyle = g; x.fillRect(0, 0, L, H);
  const halo = x.createRadialGradient(L * 0.82, 90, 10, L * 0.82, 90, 360);
  halo.addColorStop(0, "rgba(233,180,72,.20)"); halo.addColorStop(1, "transparent");
  x.fillStyle = halo; x.fillRect(0, 0, L, H);

  /* panache, en filigrane : la marque, sans encombrer la lecture */
  x.save();
  x.globalAlpha = 0.055;
  x.fillStyle = "#F2EFE8";
  const fx = L * 0.965;
  for (const [dx, y, r] of [[0, .99, .020], [.010, .90, .028], [-.008, .80, .035],
                            [.013, .69, .041], [-.007, .57, .046], [.017, .44, .047],
                            [-.013, .33, .040], [.008, .24, .031], [-.005, .17, .021]]) {
    x.beginPath();
    x.arc(fx + L * dx, H * y, L * r, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();

  const b = resultat.bilan;
  const M = 66;

  x.fillStyle = CLR.or; x.font = police(19, 800);
  x.fillText("FUMÉE BLANCHE · CONCLAVE BUDGÉTAIRE 2026", M, 76);

  const titres = {
    "fumee-blanche": "Accord scellé", rupture: "Le gouvernement est tombé",
    douziemes: "Douzièmes provisoires", greve: "Pays à l'arrêt",
  };
  x.fillStyle = CLR.craie; x.font = police(56, 780);
  x.fillText(titres[etat.statut] ?? "Conclave", M, 142);

  /* deux totaux */
  const colonne = (cx, label, valeur, couleur) => {
    x.fillStyle = CLR.craie3; x.font = police(17, 700);
    x.fillText(label.toUpperCase(), cx, 226);
    x.fillStyle = couleur; x.font = police(66, 800);
    x.fillText(valeur, cx, 296);
  };
  colonne(M, "Annoncé le 13 octobre", fmt(b.affiche), CLR.craie);
  colonne(M + 380, "Retrouvé en mars 2027", fmt(b.reel), b.reel / Math.max(1, b.affiche) > 0.7 ? CLR.vert : CLR.rouge);

  /* barre annonce / reel */
  const bx = M, by = 334, bl = 700, bh = 16;
  x.fillStyle = "#1B212D"; arrondi(x, bx, by, bl, bh, 8); x.fill();
  const pr = Math.max(0.012, Math.min(1, b.reel / Math.max(1, b.affiche)));
  x.fillStyle = pr > 0.7 ? CLR.vert : CLR.or; arrondi(x, bx, by, bl * pr, bh, 8); x.fill();
  x.fillStyle = CLR.craie3; x.font = police(16, 600);
  x.fillText(`${Math.round(pr * 100)} % de l'annonce s'est réalisé`, bx, by + 42);

  /* jauges de parti */
  let px = M;
  for (const p of ["nva", "mr", "vooruit", "cdv", "le"]) {
    const v = Math.max(0, Math.min(100, etat.cohesion[p]));
    x.fillStyle = CLR.craie3; x.font = police(15, 800);
    x.fillText(donnees.partis[p].nom.toUpperCase(), px, 444);
    x.fillStyle = "#1B212D"; arrondi(x, px, 456, 124, 9, 5); x.fill();
    x.fillStyle = v <= 0 ? CLR.rouge : donnees.partis[p].couleur;
    if (v > 0) { arrondi(x, px, 456, Math.max(6, 124 * (v / 100)), 9, 5); x.fill(); }
    px += 142;
  }

  /* pastille de mention */
  const mx = L - 188, my = 232;
  x.beginPath(); x.arc(mx, my, 84, 0, Math.PI * 2);
  x.fillStyle = "rgba(255,255,255,.03)"; x.fill();
  x.lineWidth = 4;
  x.strokeStyle = ["A", "B"].includes(resultat.mention.lettre) ? CLR.vert : resultat.mention.lettre === "C" ? CLR.or : CLR.rouge;
  x.stroke();
  x.fillStyle = x.strokeStyle; x.font = police(84, 800); x.textAlign = "center";
  x.fillText(resultat.mention.lettre, mx, my + 30);
  x.font = police(19, 700); x.fillStyle = CLR.craie2;
  x.fillText(resultat.mention.titre, mx, my + 122);
  x.font = police(16, 600); x.fillStyle = CLR.craie3;
  x.fillText(`Note souveraine ${resultat.actes[3].note}`, mx, my + 150);
  x.textAlign = "left";

  /* pied */
  x.strokeStyle = CLR.trait; x.lineWidth = 1;
  x.beginPath(); x.moveTo(M, 528); x.lineTo(L - M, 528); x.stroke();
  x.fillStyle = CLR.craie3; x.font = police(18, 600);
  x.fillText("Données : Bureau fédéral du Plan · Options de politiques pour le budget 2027", M, 562);
  x.fillStyle = CLR.or; x.font = police(20, 750);
  x.fillText("ouaisfieu.github.io/sims", M, 592);

  return c;
}

function arrondi(x, gx, gy, l, h, r) {
  const rr = Math.min(r, l / 2, h / 2);
  x.beginPath();
  x.moveTo(gx + rr, gy);
  x.arcTo(gx + l, gy, gx + l, gy + h, rr);
  x.arcTo(gx + l, gy + h, gx, gy + h, rr);
  x.arcTo(gx, gy + h, gx, gy, rr);
  x.arcTo(gx, gy, gx + l, gy, rr);
  x.closePath();
}

/* ---------- partage ---------- */
export async function partager(etat, donnees, resultat) {
  const texte = textePartage(etat, donnees, resultat);
  const canvas = dessinerCarte(etat, donnees, resultat);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  const fichier = blob ? new File([blob], "conclave-2026.png", { type: "image/png" }) : null;

  if (fichier && navigator.canShare?.({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier], text: texte }); return "partage"; }
    catch (e) { if (e.name === "AbortError") return "annule"; }
  }
  if (navigator.share) {
    try { await navigator.share({ title: "Fumée blanche", text: texte }); return "partage"; }
    catch (e) { if (e.name === "AbortError") return "annule"; }
  }
  try { await navigator.clipboard.writeText(texte); return "copie"; } catch {}
  return "echec";
}

export async function telechargerCarte(etat, donnees, resultat) {
  const canvas = dessinerCarte(etat, donnees, resultat);
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url; a.download = "conclave-2026.png";
  document.body.append(a); a.click(); a.remove();
}

export function exporterJSON(etat, donnees, resultat) {
  const b = resultat.bilan;
  return {
    simulateur: "Fumée blanche — ouaisfieu.github.io/sims",
    mode: etat.mode, statut: etat.statut, nuits: etat.nuit,
    objectif_millions: etat.objectif,
    annonce_millions: Math.round(b.affiche),
    realise_millions: Math.round(b.reel),
    credibilite: etat.credibilite, tension_sociale: etat.rue,
    cohesion: etat.cohesion,
    mention: resultat.mention.lettre,
    note_souveraine: resultat.actes[3].note,
    mesures: b.lignes.map((l) => ({
      ref: l.carte.id, titre: l.carte.titre, categorie: l.carte.categorie,
      provenance: l.carte.provenance, annonce_millions: Math.round(l.brut),
      realise_millions: Math.round(l.reel),
      retraits: l.retraits.map(([motif, m]) => ({ motif, millions: Math.round(m) })),
    })),
  };
}

export function exporterCSV(etat, donnees, resultat) {
  const e = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lignes = [["ref", "mesure", "categorie", "provenance", "annonce_millions", "realise_millions", "motifs_de_retrait"].join(",")];
  for (const l of resultat.bilan.lignes)
    lignes.push([
      e(l.carte.id), e(l.carte.titre), e(l.carte.categorie), e(l.carte.provenance),
      Math.round(l.brut), Math.round(l.reel), e(l.retraits.map(([m]) => m).join(" ; ")),
    ].join(","));
  return lignes.join("\n");
}
