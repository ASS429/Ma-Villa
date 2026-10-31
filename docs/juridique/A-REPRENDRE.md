# Textes juridiques — ce qu'il faudra reprendre

> **Liste vivante.** On y ajoute une ligne **à chaque fois** qu'une règle du produit change
> (donnée collectée, prestataire, argent, délai, service nouveau). On ne la vide qu'en
> reprenant réellement le texte en ligne.
>
> Les textes publiés vivent dans `Ma-Villa/src/pages/legal/contenu.ts`. Leur résumé pour
> Google est dans `Ma-Villa/scripts/prerendu.mjs` : à reprendre en même temps.
>
> **Gelés depuis le 14 septembre 2026**, sur décision de l'exploitant (« ne touche pas aux
> textes pour le moment »). Rien de cette liste n'est appliqué tant qu'il ne l'a pas décidé.
>
> **31 octobre 2026 — CGU et politique d'annulation reprises**, sur son autorisation, pour
> rouvrir la réservation en ligne. Les lignes appliquées sont retirées ci-dessous et
> relevées en fin de page. Le même jour, la **confidentialité** aussi (seconde autorisation). Les mentions légales
> attendent les numéros RCCM et NINEA.

Dernière mise à jour : 31 octobre 2026.

---

## 1. Politique de confidentialité

| § | Ce qui est devenu faux ou incomplet | Depuis | Origine |
|---|---|---|---|
| 7. Ce que nous ne faisons pas | « Nous ne mesurons pas votre navigation à des fins commerciales » deviendrait faux **si** un compteur de clics est ajouté aux partenaires Bronze / Argent / Or. | si codé | Partenariats |
| 4. Qui les reçoit | Si le **paiement en ligne des services** est construit : le prestataire de paiement et le partenaire qui encaisse, à nommer. | si codé | Paiement des services |
| — | **Version anglaise** pour les clients étrangers (la version française fait foi). | si multilingue | Multilingue |

## 2. Conditions générales d'utilisation

| Art. | Ce qui manque ou a changé | Depuis | Origine |
|---|---|---|---|
| 7. Les services | **Règle d'annulation d'un service** (le partenaire propose « gratuite jusqu'à 24 h avant ») : le texte dit seulement qu'elle est « indiquée à la confirmation ». **À décider.** | 20 oct. 2026 | Demandes JOJ |
| 6. Équipe | Si **`RESERVATIONS_ASSOCIES_OUVERTES`** passe à vrai : ces annonces se réservent en ligne. Réécrire l'article — prix du propriétaire **majoré de 14 %** (pas le barème prélevé), argent transmis **aux associés à chaque paiement** et non au propriétaire après le séjour, frais PayDunya sur leur part, remboursement par eux (engagement écrit à obtenir). **Avant** d'ouvrir. | 31 oct. 2026 | Circuit des associés |
| commission | Si les taux du partenaire sont retenus (10 % sur les appartements, 5 % sur les services) : nouveau barème, à reporter aussi dans `config/paiement.php` et le pré-rendu. | si adopté | Offre du 19 oct. |
| nouvel article | **Commande de repas livrés** (si construite) : le restaurant prépare, livre et répond de l'hygiène ; paiement à la livraison. | si codé | Restauration |
| 7. Les services | Si le **paiement en ligne des services** est construit : « aucun service ne se règle en ligne » devient faux. | si codé | Paiement des services |
| — | Version anglaise des articles qui concernent les clients. | si multilingue | Multilingue |

## 3. Politique d'annulation

| § | Ce qui manque ou a changé | Depuis | Origine |
|---|---|---|---|
| nouveau | Annulation d'un **service** (transport, repas) : délai et ce qui est rendu. **À décider.** | 20 oct. 2026 | Demandes JOJ |
| 1 | Si `RESERVATIONS_ASSOCIES_OUVERTES` passe à vrai : la phrase « pour un hébergement réservé auprès de notre équipe » tombe, et les § 5–7 doivent dire que **les associés rendent** ce qu'ils ont reçu. | 31 oct. 2026 | Circuit des associés |

## 4. Mentions légales

| Bloc | Ce qui manque ou a changé | Depuis | Origine |
|---|---|---|---|
| Éditeur | Forme juridique, RCCM et NINEA : « en cours de formalisation ». Déposés le 21 oct. 2026, **numéros attendus le 2 ou le 3 novembre** : les reporter ici dès réception (et dans le bloc éditeur de la confidentialité si la dénomination change). | 22 août 2026 | Statut informel |
| Éditeur | Si le **partenaire encaisse** : le nommer comme encaisseur. | si adopté | Encaissement partenaire |
| Propriété intellectuelle | « JOJ Dakar 2026 » : PasseTemps n'est ni partenaire ni fournisseur officiel — déjà dit sur la page, à dire aussi ici. | 20 oct. 2026 | Page JOJ |

## 5. Conditions générales de vente (boutique)

| § | Ce qui manque ou a changé | Depuis | Origine |
|---|---|---|---|
| nouveau | Une commande payée **après** son annulation reste annulée et le montant est rendu (la pièce a pu être revendue). | 23 oct. 2026 | Audit de sécurité |

---

## Après les JOJ (à partir du 14 novembre 2026)

Retirer toute mention des JOJ ajoutée aux textes. Les services (transport, repas) restent :
leurs clauses aussi.

---

## Appliqué le 31 octobre 2026 (CGU et annulation)

- CGU art. 1 : les **services** (transport, repas) ; le prestataire exécute et en répond.
- CGU art. 2 : changer mot de passe, adresse ou numéro exige le mot de passe actuel et ferme
  les autres sessions.
- CGU art. 4 : **le règlement confirme la demande** sans attendre le propriétaire (l'ancien
  texte disait « confirmation, puis règlement », faux depuis l'origine) ; calendrier tenu par
  le propriétaire et dates fermées ; calcul du prix (nuits, jours bornes comprises, semaine
  dès 7 nuits, mois dès 30, durée minimale) ; limites (six mois, dix-huit mois, cinq demandes).
- CGU art. 6 (nouveau) : les annonces des associés se réservent **auprès de l'équipe**, prix
  tout compris, conditions confirmées par écrit avant paiement.
- CGU art. 7 (nouveau) : les services — une demande n'est pas une réservation, prix
  indicatifs, confirmation notamment par WhatsApp, rien n'est payé en ligne.
- CGU art. 10 : la responsabilité couvre aussi les prestataires.
- Annulation § 1 : ne vaut que pour les séjours réservés en ligne. § 4 : une annulation est
  **définitive**, un paiement arrivé après est rendu.
- Lignes devenues sans objet : « circuit PayDunya suspendu » (réouverture) et « si le
  partenaire encaisse » (c'est nous qui encaissons depuis le 29 octobre).

## Appliqué le 31 octobre 2026 (confidentialité)

- § 2 : les **demandes de service** (prestation, date, heure, personnes, lieu, vol, délégation,
  nom, téléphone, e-mail, précisions, langue — sans compte) et la **position** facultative.
- § 3 : transmettre la demande au prestataire, rappeler pour confirmer.
- § 4 : le partenaire qui exécute ou coordonne le service ; le partenaire qui gère un
  hébergement réservé auprès de l'équipe ; WhatsApp (Meta) quand le visiteur l'emploie.
- § 5 : WhatsApp exploité hors du Sénégal.
- § 6 : demandes de service **effacées douze mois après la date du service** — tenu par
  `passetemps:effacer-demandes-de-service`, chaque jour (durée proposée le 20 octobre,
  retenue faute d'autre décision ; à changer dans la commande **et** le texte).
- § 7 : le numéro part tout de suite chez le prestataire pour une demande de service.

## Appliqué le 31 octobre 2026 (carte bancaire)

Demandée par l'exploitant (« je veux ajouter le paiement par carte »). Écrit au conditionnel
— « lorsqu'elle est proposée » — car la carte n'est servie que si `PAIEMENT_CARTE_ACTIVE`
est vraie : CGU art. 5 (moyens, la carte saisie chez PayDunya), annulation § 7 (remboursement
d'un paiement par carte : Wave ou Orange Money sur le numéro indiqué, sauf autre moyen
convenu), confidentialité § 2 et § 4 (numéro du payeur, PayDunya traite aussi la carte),
CGV § 5. Si la carte devient permanente, retirer « lorsqu'elle est proposée ».
