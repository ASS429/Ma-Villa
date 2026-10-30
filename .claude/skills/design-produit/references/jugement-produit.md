# Jugement produit

Les décisions de parcours, avec leur raison. Chacune a été prise par
l'utilisateur ou vérifiée en production.

## Le modèle

**Villa → Logements → Formules tarifaires.** Une annonce (`villa` dans le
code) contient des logements réservables séparément ; chaque logement a ses
formules : nuitée, journée, demi-journée, pass, avec ou sans climatisation,
avec ou sans buffet, et des prix à la semaine ou au mois. Toute interface doit
garder ce modèle lisible : c'est ce qu'Airbnb ne sait pas représenter.

Sept catégories : villa, appartement, résidence, studio, chambre, hôtel,
auberge. La **piscine seule** est retirée du catalogue depuis le 28 août 2026
(désactivée, pas supprimée : des logements anciens la portent encore).

## La recherche

- **La catégorie d'abord, le lieu ensuite** (« Que cherchez-vous ? » avant
  « Où allez-vous ? »). Chercher un lieu sans savoir ce qu'on loue oblige à
  filtrer un catalogue où une chambre à la nuitée côtoie un studio au mois.
- Une catégorie est un triplet : unité de temps + jeu de filtres + libellé de
  prix. La migration précède l'écran.
- Les villes sont **rangées à l'écriture** (ville canonique + quartier) : ne
  jamais servir aux humains l'ordre d'un algorithme ni des doublons de lieux.
- Une redirection de route **garde la requête** (`?categorie=…`) : sinon un
  lien partagé arrive sur le catalogue entier et le filtre semble mort.

## Les coordonnées

- Le **numéro du propriétaire** n'est jamais public. Il n'est donné qu'au
  client dont la réservation est **confirmée ou payée**
  (`revelerLesCoordonnees`). Sans cela, on conclut hors plateforme : la
  commission s'évapore, et le client perd avis, preuve et recours.
- L'**adresse** s'affiche sur la fiche (`lieu(adresse, quartier, ville)`).
  Conseiller au propriétaire le quartier, pas la rue. Ne jamais lui promettre
  le contraire.

## L'argent

- **Aucun montant ne vient de la requête** : le serveur recalcule tout.
- Le **tunnel de paiement reste nu** : pas de barre de navigation, pas
  d'animation entre un montant et sa validation — chaque milliseconde est un
  abandon.
- La commission est **prise sur le prix affiché**, jamais ajoutée au client.
  Le propriétaire voit son net **avant** de fixer son prix.

## Les propriétaires

- **Publier une annonce** : six étapes, un nom et une ville suffisent à
  commencer, chaque étape s'enregistre, `?brouillon=<id>` dans l'adresse.
- La progression dit **les étapes restantes et les minutes**, jamais un
  pourcentage.
- La complétude se vérifie à l'envoi, en **nommant l'étape à reprendre**, pas
  le champ technique manquant.
- Cinq photos **au plus** (plafond de poids), aucun minimum.
- Une annonce envoyée est **relue** par l'équipe avant publication.

## Les comptes

- **E-mail obligatoire, téléphone facultatif** à l'inscription : l'e-mail est
  le seul chemin de récupération d'un mot de passe. Décision prise deux fois ;
  ne pas la rouvrir de soi-même.
- Connexion par **« Téléphone ou e-mail »** dans un seul champ
  (`type="text"`). Même message d'échec que le compte existe ou non.

## Principe général

**Chaque état intermédiaire doit être vu par quelqu'un.** Un statut qu'aucun
écran ne liste est un angle mort (le brouillon invisible de l'administration,
septembre 2026). En ajoutant un statut, se demander *qui le voit*.
