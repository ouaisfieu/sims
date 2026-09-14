/* ============================================================
   corpus.js — recherche et filtres de l'encyclopedie.
   Amelioration progressive : sans JavaScript, les 263 mesures
   restent toutes affichees et toutes accessibles.
   ============================================================ */
const $ = (s) => document.querySelector(s);
const liste = $("#liste");
if (liste) {
  const items = [...liste.children];
  const q = $("#q"), fCat = $("#f-cat"), fParti = $("#f-parti"), fChiffree = $("#f-chiffree"), compte = $("#compte");

  const sansAccent = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const i of items) i.dataset.rech = sansAccent(i.dataset.cle);

  function filtrer() {
    const t = sansAccent(q.value.trim());
    const mots = t ? t.split(/\s+/) : [];
    const c = fCat.value, p = fParti.value, ch = fChiffree.value;
    let n = 0;
    for (const i of items) {
      const ok =
        (!c || i.dataset.cat === c) &&
        (!p || i.dataset.parti === p) &&
        (!ch || i.dataset.chiffree === ch) &&
        mots.every((m) => i.dataset.rech.includes(m));
      i.hidden = !ok;
      if (ok) n++;
    }
    compte.textContent =
      n === items.length ? `${n} mesures` :
      n === 0 ? "Aucune mesure ne correspond." :
      `${n} mesure${n > 1 ? "s" : ""} sur ${items.length}`;
    ecrireAdresse(t, c, p, ch);
  }

  function ecrireAdresse(t, c, p, ch) {
    const u = new URLSearchParams();
    if (t) u.set("q", q.value.trim());
    if (c) u.set("cat", c);
    if (p) u.set("parti", p);
    if (ch) u.set("chiffree", ch);
    const s = u.toString();
    history.replaceState(null, "", s ? `?${s}` : location.pathname);
  }

  const u = new URLSearchParams(location.search);
  if (u.get("q")) q.value = u.get("q");
  if (u.get("cat")) fCat.value = u.get("cat");
  if (u.get("parti")) fParti.value = u.get("parti");
  if (u.get("chiffree")) fChiffree.value = u.get("chiffree");

  let minuteur;
  q.addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(filtrer, 110); });
  for (const s of [fCat, fParti, fChiffree]) s.addEventListener("change", filtrer);
  filtrer();
}

/* Le service worker est enregistre ici aussi, pour que la consultation des
   fiches alimente le cache hors ligne. */
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("../../sw.js", { scope: "../../" }).catch(() => {});
