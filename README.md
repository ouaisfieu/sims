# sims — Fumée blanche

**Simulateur du conclave budgétaire fédéral belge.** Trouvez dix milliards sans faire tomber le gouvernement, puis regardez la Cour des comptes recompter ce que vous avez annoncé.

→ **[ouaisfieu.github.io/sims](https://ouaisfieu.github.io/sims/)**

Application web statique, mobile d'abord, installable, fonctionnant hors ligne. Aucun serveur, aucun compte, aucun traceur, aucun cookie.

---

## L'idée

L'automne 2026 met le gouvernement fédéral belge devant un écart qu'il n'a pas réduit depuis dix-neuf mois. Le matériau technique pour le combler existe : le Bureau fédéral du Plan a publié le 1<sup>er</sup> juin 2026 un inventaire de 263 mesures, dont 39 chiffrées. Le problème n'est pas l'absence d'options — c'est que **la somme des lignes rouges des cinq partis excède le montant à trouver**.

Le jeu tient deux compteurs :

| | |
|---|---|
| **Montant annoncé** | ce que vous présentez le 13 octobre 2026 |
| **Montant réel** | ce que le Comité de monitoring retrouve en mars 2027 |

Votre score n'est pas votre total. C'est l'écart entre les deux.

## Ce qu'il y a dedans

- **Le simulateur** — six nuits, cinq jauges de cohésion, des lignes rouges documentées, des bilatérales, douze événements, un épilogue en quatre actes et une carte de résultat partageable.
- **L'encyclopédie** — une page indexable par mesure, avec le texte original, les modalités, la provenance du montant et une lecture critique. 125 intitulés néerlandais traduits.
- **Les cheatcodes** — le jeu résolu par recherche par faisceau : huit combinaisons calculées et rejouables d'un lien, le coût en cohésion de chaque milliard, la déperdition mesure par mesure, et six codes secrets tapables dans le simulateur.
- **La méthodologie** — provenance des chiffres, formules du modèle, limites connues, et la liste de ce que le projet s'interdit.

## Structure

```
index.html                     le hub
conclave/
  index.html                   le simulateur
  methodologie.html
  manifest.webmanifest
  mesures/                     l'index + 263 fiches générées
  cheatcodes/                  les combinaisons résolues, générées
sw.js
assets/
  css/  base.css  jeu.css  corpus.css
  js/   app.js  moteur.js  stockage.js  partage.js  corpus.js
  data/ jeu.json  corpus.json  combinaisons.json   ← servis tels quels
  img/
tools/
  source/DATA_BUDGET2027_13320.xlsx    ← source primaire, Bureau fédéral du Plan
  source/mesures-brut.json             ← transcription fidèle du classeur
  extract.py                           xlsx → JSON brut
  enrichissement.json                  partis, lignes rouges, barème du modèle
  enrichissement-mesures.json          couche éditoriale, 39 mesures chiffrées
  cartes-extra.json                    15 mesures d'analyse, 20 cartes méthode, 2 artifices
  traductions.json                     125 intitulés néerlandais → français
  accents.py                           outil de rédaction, exécuté une fois
  build-data.mjs                       → assets/data/jeu.json + corpus.json
  solveur.mjs                          → assets/data/combinaisons.json
  build-pages.mjs                      → conclave/mesures/ + sitemap.xml
  build-cheatcodes.mjs                 → conclave/cheatcodes/
```

## Aucun build au déploiement

Le dépôt contient les fichiers finaux. GitHub Pages les sert tels quels ; le workflow ne fait que publier. Les scripts de `tools/` sont des **outils de maintenance**, à relancer seulement si les données changent :

```bash
python3 tools/extract.py        # si le Bureau du Plan publie un nouveau classeur (requiert openpyxl)
node tools/build-data.mjs       # régénère assets/data/
node tools/build-pages.mjs      # régénère les 263 fiches + sitemap.xml
node tools/solveur.mjs          # recalcule les combinaisons gagnantes (~2 min)
node tools/build-cheatcodes.mjs # régénère la page des cheatcodes
```

Puis on commite ce qui a changé. Aucune dépendance npm, Node 18+ suffit.

### Essayer en local

```bash
python3 -m http.server 8000
# http://localhost:8000/conclave/
```

Un serveur est nécessaire : les modules ES et le service worker ne fonctionnent pas en `file://`.

### Changer l'adresse du site

Une seule constante, `SITE`, en tête de `tools/build-pages.mjs`, puis relancer le script. Les URL absolues du simulateur et de la méthodologie sont dans leurs fichiers respectifs.

## D'où viennent les chiffres

Trois provenances, jamais confondues, et affichées sur chaque carte :

| Étiquette | Nombre | Origine |
|---|---|---|
| `chiffré BFP` | 39 | le montant figure au classeur du Bureau fédéral du Plan |
| `analyse` | 15 | la mesure est au corpus mais non chiffrée ; le montant vient du dossier *Trouver 23 milliards* |
| `artifice` | 2 | pratiques de construction budgétaire, pas des mesures |

Le classeur ne fournit **ni le sens** d'une mesure (améliore ou dégrade le solde), **ni sa faisabilité politique**, **ni la robustesse de son chiffrage**. Tout cela est un jugement éditorial, isolé dans `tools/enrichissement*.json` pour qu'on puisse le contester ligne par ligne. La [méthodologie](https://ouaisfieu.github.io/sims/conclave/methodologie.html) détaille les formules.

**Ce que le projet s'interdit** : aucune citation prêtée à une personnalité politique, aucun logo de parti, aucun chiffre sans provenance, aucune collecte de données.

## Ce que le solveur trouve

`tools/solveur.mjs` parcourt les 76 cartes et les cinq bilatérales par recherche par faisceau, sous la contrainte des actions disponibles et de la survie des cinq partis, puis rejoue chaque résultat soixante fois dans le moteur du jeu. Deux chiffres en sortent :

| | annoncé | constaté en mars 2027 |
|---|---|---|
| 23 Md€ en franchissant quatre lignes rouges sur cinq | 26,97 Md€ | **16,79 Md€** (62 %) |
| 23 Md€ sans en franchir aucune | 27,00 Md€ | **7,13 Md€** (26 %) |

Le total affiché est le même. Poussée à son maximum, la méthode indolore plafonne à 7,3 milliards réellement constatés — à peu de chose près le plancher que le Comité de monitoring fixait en juillet 2026.

## Capacités du navigateur

Service worker hors ligne d'abord · manifest installable avec raccourcis et icône *maskable* · IndexedDB pour le corpus et les parties archivées · localStorage pour les préférences · Web Share API avec fichier, repli presse-papiers · carte de résultat dessinée au canvas · View Transitions · Vibration · Wake Lock · Web Audio · Badging · export CSV et JSON · budget encodé dans le lien, rejouable à l'identique · six codes secrets, au clavier ou au doigt.

## Contribuer

Une correction argumentée est une contribution. Les désaccords les plus utiles portent sur `tools/enrichissement-mesures.json` (réactions des partis, robustesse des chiffrages) et sur `tools/traductions.json`. Ouvrez une issue ou une pull request.

## Licence

Code sous MIT. Données et textes éditoriaux sous CC BY 4.0. La source primaire du Bureau fédéral du Plan relève de son propre régime. Voir [LICENSE](LICENSE).

---

*Ouaisfieu — projet citoyen de veille et de contre-analyse des politiques publiques belges. Ce projet n'émane ni du Bureau fédéral du Plan, ni d'aucune institution publique.*
