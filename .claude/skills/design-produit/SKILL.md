---
name: design-produit
description: Point d'entrée unique pour tout ce que voit, comprend, choisit ou fait un utilisateur de PasseTemps (site Ma-Villa/ et appli mobile/) — écrans, parcours, composants, textes affichés, messages d'erreur, e-mails visibles, états vides et fermés. À charger dès qu'une tâche change l'interface ou ses mots, ou pour relire un écran. Pas pour le travail purement serveur sans effet à l'écran.
---

# Design produit — PasseTemps

Rendre l'interface juste pour l'utilisateur, pour le produit et pour
PasseTemps. Du code qui marche ne suffit pas : choisir le bon geste, dire
clairement ce qu'une action change, couvrir la réalité au-delà du parcours
heureux, et **vérifier le rendu** au navigateur.

Ce skill range des **décisions déjà prises**, avec leur raison. Il ne remplace
pas les sources qui font foi ; il y renvoie.

## 1. Choisir le mode avant d'agir

| Mode | Demande typique | Ce qu'on fait |
|---|---|---|
| **Façonner** | « comment devrait marcher… », un nouveau parcours | Brief (§ 3), options, recommandation. Pas de code sans accord. |
| **Construire** | « ajoute », « fais l'écran » | Brief court, puis code, puis vérification (§ 5). |
| **Relire** | « regarde cet écran », un tour complet | Constats classés P0–P2 (§ 6). **Une relecture ne modifie rien.** |
| **Texte** | « reformule », un libellé, un message | `references/textes.md` seulement. Ne pas redessiner l'écran. |
| **Durcir** | états vides, erreurs, fermé, lenteur | `references/etats-et-bascules.md`. |

Si l'intention est ambiguë, prendre le mode le plus étroit que permet le verbe.
Une capture d'écran ou une adresse désigne un périmètre ; elle n'autorise pas
à modifier.

## 2. Ce qui fait foi, dans l'ordre

1. La demande explicite de l'utilisateur et ses contraintes.
2. La vérité du système : ce que l'API sert **en production**
   (`/api/configuration` dit ce qui est ouvert), et le code.
3. Les sources canoniques : `Ma-Villa/CLAUDE.md`, les jetons de
   `Ma-Villa/src/index.css`, les primitifs `src/components/ui/`, les règles
   ESLint de `Ma-Villa/eslint-regles/`.
4. Les décisions de ce skill et ses exemples.
5. Les conseils généraux (fiches marketing, bonnes pratiques) — **toujours
   après** : une décision de PasseTemps prime sur un conseil générique.

## 3. Le brief, pour tout changement qui compte

Un changement compte s'il modifie la tâche de l'utilisateur, un défaut, une
conséquence, la navigation ou les états atteignables. En quelques lignes,
avant le code : **qui** agit · **quoi** il cherche à faire · ce qui se passe
**aujourd'hui** · ce qu'on **veut** · le **signal** de réussite · ce qu'on ne
fait **pas** · ce que l'action **change** et si elle se **défait** · qui a le
**droit** de la faire.

Puis l'inventaire des états atteignables : chargement, vide, peu rempli,
plein, erreur, refus, **fermé par une bascule**, désactivé, téléphone de 375 px,
thème sombre.

## 4. Où aller selon le besoin

| Besoin | Lire |
|---|---|
| Une décision de produit ou de parcours | `references/jugement-produit.md` |
| Couleurs, typo, mise en page, mouvement, poids | `references/interface.md` |
| Un mot, un libellé, un message, une langue | `references/textes.md` |
| États vides, erreurs, bascules fermées | `references/etats-et-bascules.md` |
| Ce qui a déjà été décidé ou raté | `exemples.md` |
| Ce qui n'a pas encore de règle | `lacunes.md` |

## 5. Vérifier avant de dire « fait »

Depuis `Ma-Villa/` :

```bash
npx tsc -b && npx eslint src         # zéro, toujours
npm run test:regles                  # les règles PasseTemps elles-mêmes
npm run verifier:css                 # utilitaire de position battu par une classe
python scripts/audit-collisions-css.py   # même classe définie dans deux feuilles
npm run build                        # pré-rendu compris
```

Puis **le navigateur**, pour tout écran touché : 375 px et ordinateur, thème
clair et sombre, chaque état modifié, clavier et cibles tactiles (44 px).
Plusieurs défauts graves de ce projet n'ont été vus **qu'au navigateur** (voir
`exemples.md`) : ni `tsc`, ni ESLint, ni les tests ne les voyaient.

## 6. Rendre une relecture

Constats d'abord, classés par effet sur l'utilisateur :

- **P0** — bloque la tâche principale, promet ce qui n'existe pas, ou peut
  coûter de l'argent ou des données à quelqu'un ;
- **P1** — échec probable, conséquence trompeuse, état critique manquant,
  défaut mobile ou d'accessibilité majeur ;
- **P2** — friction, incohérence, hiérarchie faible.

Pour chacun : où (fichier:ligne ou écran), vérifié ou supposé, la source qui
fait foi, la conséquence pour l'utilisateur, le plus petit correctif.

## 7. Faire vivre ce skill

- Une règle s'ajoute **après vérification sur le code actuel et accord de
  l'utilisateur**, avec sa portée, sa raison et un exemple faux / juste.
- Choisir la destination la plus étroite : source canonique (jetons, primitif),
  référence de ce skill, exemple, **règle ESLint** si une machine peut la
  vérifier sans fausse alerte, ou lacune.
- Une règle qui crie au loup cesse d'être lue : préférer un contrôle étroit et
  juste à un contrôle large et bruyant.
- Une règle devenue fausse se corrige ou se retire, tout de suite.
