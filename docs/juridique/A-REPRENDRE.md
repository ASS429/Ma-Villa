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

Dernière mise à jour : 22 octobre 2026.

---

## 1. Politique de confidentialité

| § | Ce qui est devenu faux ou incomplet | Depuis | Origine |
|---|---|---|---|
| 2. Ce que nous conservons | « Nous n'en collectons pas d'autres » est faux : les **demandes de service** (transport, repas) gardent nom, téléphone, e-mail, lieu, numéro de vol, pays de l'athlète, précisions, langue — **sans compte**. | 20 oct. 2026 | Demandes JOJ |
| 2. Ce que nous conservons | Ajouter la **position** (latitude, longitude, précision) que le visiteur peut joindre à une demande de service par « Utiliser ma position actuelle » : facultative, demandée seulement sur ce geste, transmise au prestataire dans le message WhatsApp. | 22 oct. 2026 | Position |
| 3. À quoi elles servent | Ajouter : transmettre la demande au prestataire (transporteur, restaurant) et rappeler la famille. | 20 oct. 2026 | Demandes JOJ |
| 4. Qui les reçoit | Ajouter les **prestataires partenaires** (transport, restauration) et le **partenaire** qui coordonne les JOJ. Ajouter **WhatsApp (Meta)** : la demande y est envoyée. | 20 oct. 2026 | Demandes JOJ |
| 5. Transfert hors du Sénégal | WhatsApp / Meta s'ajoute aux prestataires établis hors du Sénégal. | 20 oct. 2026 | Demandes JOJ |
| 6. Durée de conservation | Fixer une durée pour les demandes de service (proposition : 12 mois après la date du service). **À décider.** | 20 oct. 2026 | Demandes JOJ |
| 7. Ce que nous ne faisons pas | « Votre numéro n'est communiqué à l'autre partie qu'une fois une réservation confirmée » : faux pour une demande de service, où le numéro part tout de suite chez l'équipe et le prestataire. | 20 oct. 2026 | Demandes JOJ |
| 7. Ce que nous ne faisons pas | « Nous ne mesurons pas votre navigation à des fins commerciales » deviendrait faux **si** un compteur de clics est ajouté aux partenaires Bronze / Argent / Or. | si codé | Partenariats |
| 4 et 5 | Si le **partenaire encaisse** : il devient destinataire des données de paiement — à nommer. | si adopté | Encaissement partenaire |
| — | **Version anglaise** pour les clients étrangers (la version française fait foi). | si multilingue | Multilingue |

## 2. Conditions générales d'utilisation

| Art. | Ce qui manque ou a changé | Depuis | Origine |
|---|---|---|---|
| 1. Ce qu'est PasseTemps | Ajouter les **services** (transport, repas ; plus tard sorties guidées) : PasseTemps met en relation, le prestataire exécute et en répond. | 20 oct. 2026 | Demandes JOJ |
| nouvel article | **Les services** : une demande n'est pas une réservation ; prix « à partir de », indicatifs ; confirmation sur WhatsApp ; rien n'est payé en ligne. Règle d'annulation d'un service (le partenaire propose « gratuite jusqu'à 24 h avant ») : **à décider**. | 20 oct. 2026 | Demandes JOJ |
| 4–5. Réserver, paiement | Décrivent encore le circuit PayDunya, **suspendu** depuis le 14 sept. 2026. | 14 sept. 2026 | Réservations suspendues |
| 4. Réserver | Dire comment se calcule le prix : nuits pour une nuitée, jours (bornes comprises) pour une formule de jour ; **prix à la semaine dès 7 nuits et au mois dès 30**, appliqués à tout le séjour quand ils sont plus avantageux ; **durée minimale** fixée par le propriétaire. | 22 oct. 2026 | Longs séjours |
| 4. Réserver | Limites d'une demande : **six mois** de séjour au plus, **dix-huit mois** à l'avance au plus, **cinq demandes** sans réponse à la fois. | 23 oct. 2026 | Audit de sécurité |
| compte | Changer d'**e-mail ou de téléphone** demande le mot de passe actuel, et ferme les autres sessions. | 23 oct. 2026 | Audit de sécurité |
| 4–5 | Si le **partenaire encaisse** : qui encaisse (son nom apparaît sur l'écran Wave / Orange Money), qui rembourse, sous quel délai, quand le propriétaire est payé. | si adopté | Encaissement partenaire |
| commission | Si les taux du partenaire sont retenus (10 % sur les appartements, 5 % sur les services) : nouveau barème, à reporter aussi dans `config/paiement.php` et le pré-rendu. | si adopté | Offre du 19 oct. |
| nouvel article | **Commande de repas livrés** (si construite) : le restaurant prépare, livre et répond de l'hygiène ; paiement à la livraison. | si codé | Restauration |
| — | Version anglaise des articles qui concernent les clients. | si multilingue | Multilingue |

## 3. Politique d'annulation

| § | Ce qui manque ou a changé | Depuis | Origine |
|---|---|---|---|
| nouveau | Annulation d'un **service** (transport, repas) : délai et ce qui est rendu. **À décider.** | 20 oct. 2026 | Demandes JOJ |
| 5–7 | Si le **partenaire encaisse** : c'est lui qui rembourse — le texte dit aujourd'hui PasseTemps. | si adopté | Encaissement partenaire |
| nouveau | Une annulation est **définitive** ; un paiement arrivé **après** l'annulation ne rouvre pas la réservation, il est rendu au client. | 23 oct. 2026 | Audit de sécurité |

## 4. Mentions légales

| Bloc | Ce qui manque ou a changé | Depuis | Origine |
|---|---|---|---|
| Éditeur | Toujours aucune structure déclarée (RCCM, NINEA). | 22 août 2026 | Statut informel |
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
