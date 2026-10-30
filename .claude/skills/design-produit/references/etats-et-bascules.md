# États et bascules

PasseTemps ouvre et ferme des pans entiers par configuration, sans
redéployer : `GET /api/configuration` dit ce qui est ouvert. Un écran doit
être juste **dans chaque état**, pas seulement le jour où tout est ouvert.

## Les bascules

| Bascule (`/api/configuration`) | Quand elle est fermée |
|---|---|
| `reservations.ouvertes` | aucune demande ; la fiche donne un contact (`ContactReservation`) ; le refus est aussi **côté serveur** (503), car l'appli Android appelle la même API |
| `paiement.actif` | pas de « Payer » ni de « Régler » ; ne pas annoncer Wave ni Orange Money comme disponibles |
| `boutique.actif` | pas d'onglet Boutique (un onglet qui ramène à l'accueil est pire que pas d'onglet) |
| `boutique.livraison` | pas de « Payer à la livraison » |
| `services` (transport, restauration) | pas d'entrée vers le service |

**Fermer une bascule, c'est relire tout ce qui la suppose** : textes d'accueil,
descriptions de référencement, e-mails, l'appli mobile, et les autres métiers
qui partagent le même prestataire (la boutique proposait encore de payer en
ligne après la fermeture du paiement, septembre 2026).

## « Pas encore chargé » n'est pas « fermé »

Tout écran gardé par une configuration distante attend qu'elle soit **chargée**
(`chargee` dans `ConfigContext`) avant de conclure. Les cinq écrans de la
boutique redirigeaient vers l'accueil au premier rendu, parce qu'ils lisaient
« fermé » avant la réponse de l'API.

Le front garde un **repli prudent** : fermé, contact compris, pour la fenêtre
où l'API n'est pas encore déployée.

## Les états d'une liste ou d'un écran

- **Chargement** : squelette, pas un écran blanc.
- **Erreur** : testée **avant** le chargement (sinon un squelette recouvre le
  message), avec une reprise.
- **Vide** : dit pourquoi et donne **une issue** (un vide sans issue est une
  impasse).
- **Peu rempli** : une catégorie vide reste honnête (« Hôtels au Sénégal »,
  liste vide) ; ne pas inventer de contenu de remplissage.
- **Lien expiré** (réinitialisation, confirmation) : occupe l'écran entier,
  avec une sortie.

## Les chiffres

- Une variation sur une période précédente vide vaut **rien**, pas « +100 % ».
- Une série par jour contient **tous les jours**, même à zéro : une série
  trouée invente une activité.
- Un tableau de bord **penche du côté du problème** dès qu'il y en a un.
