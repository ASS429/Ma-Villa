# Textes

Ce qu'on écrit à l'écran, dans les e-mails et les notifications. *Les mots
interdits sont vérifiés par ESLint (`passetemps/vocabulaire`), en français et
en anglais.*

## Le premier principe : dire vrai aujourd'hui

**Rien de fermé, de suspendu ou de cassé n'est présenté comme disponible.**
Une phrase vraie au lancement peut devenir fausse quand une bascule se ferme :
fermer une bascule, c'est relire tout texte qui la suppose (voir
`etats-et-bascules.md`).

| On n'écrit pas | Parce que | On écrit |
|---|---|---|
| « Annonces vérifiées », « contrôlée » | l'équipe **relit** l'annonce, personne ne visite | « relue par notre équipe » |
| « piscine seule », « piscines à la journée » | retirée du catalogue le 28/08/2026 | — |
| « villa(s) » pour le catalogue | sept types de logement | « hébergement(s) », « annonce(s) » |
| « Partout au Sénégal » sans nuance | cinq villes ont des annonces | les villes réelles |
| « bientôt » sans le dire tel | une promesse sans date | ce qui marche aujourd'hui |

## Les noms canoniques

| Objet | À l'écran | Dans le code (ne pas renommer) |
|---|---|---|
| La marque | **PasseTemps** — un mot, deux majuscules | — |
| Le site | passetemps.sn | `mavilla-web.onrender.com` (hôte) |
| Une annonce | annonce, hébergement | `villa` |
| Le catalogue | Hébergements (`/hebergements/`) | `/villas` redirige, avec sa requête |
| L'espace propriétaire | Mes hébergements, Publier une annonce | `/dashboard/villas` |
| Une unité réservable | logement | `logement` |
| Les formules | Nuitée, Journée, Demi-journée, Pass | `type_tarif` |
| La boutique | Boutique, Artisanat (client) ; Articles (console) | `oeuvre` |

« Villa » reste juste pour **la catégorie** (« Villa entière », « Villas,
appartements, studios ») et pour décrire une villa réelle. Les identifiants
internes gardent `villa` : renommer coûterait une migration pour rien.

## Le ton

- **Français, vouvoiement**, phrases courtes, mots simples. Le contenu saisi
  par les propriétaires reste dans sa langue.
- Pages client en français **et** en anglais (`src/i18n/`) ; pages des
  propriétaires, des prestataires et de la console en français seulement
  (décision du 20/10/2026).
- Des **chiffres concrets** plutôt que des adjectifs : « il reste 4 étapes,
  environ 10 minutes », pas « presque fini ».

## Boutons et messages

- Un bouton dit **ce qu'il fait** : « Envoyer à la validation », « Retirer du
  catalogue ». Jamais « OK » ni « Confirmer » seuls sur une action destructrice.
- Les erreurs vont **sous le champ** (`erreursParChamp`), dans la langue de
  l'utilisateur, **sans nom de champ technique** (`lang/fr/validation.php`).
- Un échec de connexion dit la même chose que le compte existe ou non.
- Un bouton reste gris tant que les champs requis manquent, **sans message
  préventif**.

## E-mails et notifications

- Une notification est un **rappel**, jamais le seul canal d'une information
  importante : elle double l'e-mail.
- Un refus porte **son motif**, sinon le propriétaire ne peut ni corriger ni
  contester.
