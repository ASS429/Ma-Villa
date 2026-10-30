// Vérifie ce que ni TypeScript ni ESLint ne voient : un utilitaire Tailwind de
// position battu en silence par une classe du projet.
//
//   node scripts/verifier-css.mjs        (npm run verifier:css)
//
// Une déclaration hors de `@layer` bat tous les utilitaires de Tailwind, quel
// que soit leur ordre. Le 18 août 2026, `.bouton-icone { position: relative }`
// a écrasé le `absolute` de la bascule de thème : elle a quitté son coin et
// décalé tout l'écran de connexion. Trouvé par capture d'écran.
//
// Une `position` hors couche n'est pas fautive en soi — le site en compte une
// quarantaine, sur des éléments qui ne portent aucun utilitaire de position.
// La faute, c'est la rencontre des deux sur le même élément : c'est elle, et
// elle seule, qui est cherchée ici, pour ne pas crier au loup. Remède : mettre
// la déclaration dans `@layer components`, ou retirer l'utilitaire.
//
// Les collisions de noms de classe entre deux feuilles se cherchent avec
// `python scripts/audit-collisions-css.py`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FEUILLES = ["src/index.css", "src/styles/console.css", "src/styles/profondeur.css"];
const UTILITAIRES = /^(?:[a-z0-9-]+:)*(absolute|relative|fixed|sticky|static)$/;

const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

// Classe du projet → où elle pose une `position` hors couche.
const horsCouche = new Map();
for (const chemin of FEUILLES) {
  const css = sansCommentaires(readFileSync(chemin, "utf8"));
  const pile = [];
  let debut = 0;
  const verifier = (morceau, origine) => {
    const m = /(^|[\s;])position\s*:\s*([a-z-]+)/i.exec(morceau);
    if (!m || pile.length === 0 || pile.some((p) => p.startsWith("@layer"))) return;
    const selecteurs = pile.at(-1).split(",");
    for (const s of selecteurs) {
      // Un pseudo-élément a sa propre boîte : l'utilitaire posé sur l'élément
      // ne le touche pas.
      if (/::?(before|after)/.test(s)) continue;
      // La dernière classe du sélecteur est celle de l'élément visé.
      const dernier = s.trim().split(/[\s>+~]+/).at(-1) ?? "";
      for (const [, nom] of dernier.matchAll(/\.([a-zA-Z0-9_-]+)/g)) {
        const ligne = css.slice(0, origine + m.index).split("\n").length;
        if (!horsCouche.has(nom)) horsCouche.set(nom, `${chemin}:${ligne} (position: ${m[2]})`);
      }
    }
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "{") {
      pile.push(css.slice(debut, i).trim());
      debut = i + 1;
    } else if (c === "}") {
      verifier(css.slice(debut, i), debut);
      pile.pop();
      debut = i + 1;
    } else if (c === ";") {
      verifier(css.slice(debut, i + 1), debut);
      debut = i + 1;
    }
  }
}

const fichiers = (dossier) =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(join(dossier, e.name)) : /\.tsx$/.test(e.name) ? [join(dossier, e.name)] : [],
  );

// Le texte de chaque `className=` : chaîne, gabarit ou expression entre
// accolades. Les jetons d'une expression conditionnelle sont tous pris : on
// préfère un faux signal relu qu'un vrai manqué.
const fautes = [];
for (const fichier of fichiers("src")) {
  const source = readFileSync(fichier, "utf8");
  for (const m of source.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{([^}]*(?:\{[^}]*\}[^}]*)*)\})/g)) {
    const texte = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
    const jetons = new Set(texte.split(/[\s'"`?:()|&,]+/).filter(Boolean));
    const utilitaires = [...jetons].filter((j) => UTILITAIRES.test(j));
    if (!utilitaires.length) continue;
    for (const j of jetons) {
      if (!horsCouche.has(j)) continue;
      const ligne = source.slice(0, m.index).split("\n").length;
      fautes.push(`${fichier}:${ligne}  .${j} (${horsCouche.get(j)}) écrase « ${utilitaires.join(" ")} »`);
    }
  }
}

if (fautes.length) {
  console.error(`${fautes.length} utilitaire(s) de position battu(s) par une classe hors couche :\n  ${fautes.join("\n  ")}`);
  console.error("\nMettre la déclaration de la classe dans `@layer components { … }`, ou retirer l'utilitaire.");
  process.exit(1);
}
console.log(`CSS : aucun utilitaire de position battu (${horsCouche.size} classes hors couche surveillées).`);
