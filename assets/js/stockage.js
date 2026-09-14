/* ============================================================
   stockage.js — tout reste dans le navigateur.
   IndexedDB : corpus des mesures et parties archivees.
   localStorage : preferences.
   Rien ne part vers un serveur, parce qu'il n'y en a pas.
   ============================================================ */

const BASE = "ouaisfieu-conclave";
const VERSION = 1;
let promesse = null;

function ouvrir() {
  if (promesse) return promesse;
  promesse = new Promise((resoudre, rejeter) => {
    if (!("indexedDB" in globalThis)) return rejeter(new Error("IndexedDB indisponible"));
    const d = indexedDB.open(BASE, VERSION);
    d.onupgradeneeded = () => {
      const db = d.result;
      if (!db.objectStoreNames.contains("parties"))
        db.createObjectStore("parties", { keyPath: "id", autoIncrement: true }).createIndex("fin", "fin");
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "cle" });
    };
    d.onsuccess = () => resoudre(d.result);
    d.onerror = () => rejeter(d.error);
  });
  return promesse;
}

async function tx(magasin, mode, action) {
  try {
    const db = await ouvrir();
    return await new Promise((resoudre, rejeter) => {
      const t = db.transaction(magasin, mode);
      const r = action(t.objectStore(magasin));
      t.oncomplete = () => resoudre(r?.result ?? null);
      t.onerror = () => rejeter(t.error);
    });
  } catch {
    return null; /* navigation privee, quota, base bloquee : on continue sans. */
  }
}

/* ---------- corpus mis en cache ---------- */
export async function lireCache(cle) {
  const v = await tx("cache", "readonly", (m) => m.get(cle));
  return v?.valeur ?? null;
}
export const ecrireCache = (cle, valeur) =>
  tx("cache", "readwrite", (m) => m.put({ cle, valeur, date: Date.now() }));

/* ---------- parties ---------- */
export const archiver = (partie) =>
  tx("parties", "readwrite", (m) => m.add({ ...partie, fin: Date.now() }));
export const listerParties = () => tx("parties", "readonly", (m) => m.getAll());
export const viderParties = () => tx("parties", "readwrite", (m) => m.clear());

/* ---------- partie en cours ---------- */
const EN_COURS = "conclave.encours";
export function sauverEnCours(etat) {
  try { localStorage.setItem(EN_COURS, JSON.stringify(etat)); } catch {}
}
export function lireEnCours() {
  try {
    const v = localStorage.getItem(EN_COURS);
    const e = v ? JSON.parse(v) : null;
    return e && e.statut === "en-cours" ? e : null;
  } catch { return null; }
}
export function effacerEnCours() { try { localStorage.removeItem(EN_COURS); } catch {} }

/* ---------- preferences ---------- */
const PREFS = "conclave.prefs";
const defauts = { son: true, vibration: true, vus: [] };
export function prefs() {
  try { return { ...defauts, ...JSON.parse(localStorage.getItem(PREFS) || "{}") }; }
  catch { return { ...defauts }; }
}
export function majPrefs(partiel) {
  const p = { ...prefs(), ...partiel };
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch {}
  return p;
}

/* ---------- donnees du jeu ---------- */
export async function chargerDonnees(url) {
  try {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    ecrireCache("jeu", d);
    return d;
  } catch (e) {
    const secours = await lireCache("jeu");
    if (secours) return secours;
    throw e;
  }
}
