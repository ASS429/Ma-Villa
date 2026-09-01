# Rendre l'argent au client — mode d'emploi

_1er septembre 2026. Écrit pour être lu sans connaître le code._

---

## Le problème que ça règle

Vous encaissez **tout** sur votre compte PayDunya, puis vous virez la part du
propriétaire à la main. Le sens inverse n'existait pas : si un séjour ne pouvait
pas avoir lieu, rien dans l'application ne permettait de rendre l'argent, ni même
de noter qu'on l'avait rendu.

Trois conséquences, dans l'ordre de gravité :

1. **Le chiffre d'affaires était faux.** Un séjour remboursé restait compté comme
   une vente. Vous auriez déclaré — et éventuellement payé des impôts sur — de
   l'argent qui n'était plus chez vous.
2. **Aucune trace ne survivait.** Le virement de retour existait chez PayDunya,
   le motif dans votre tête. Six mois plus tard, sur un litige, il n'y avait rien
   à montrer.
3. **Un propriétaire déjà payé gardait une somme que plus rien ne réclamait.**
   C'est le cas qui coûte le plus cher, parce qu'il est silencieux.

---

## Ce que l'écran fait, et ce qu'il ne fait pas

**Il ne déplace pas d'argent.** Exactement comme les reversements : vous faites le
virement de retour depuis votre tableau PayDunya, puis vous l'enregistrez ici.

C'est délibéré. L'option de déboursement automatique (PER) n'est toujours pas
ouverte sur le compte, et même une fois ouverte, un remboursement est une
décision — pas un calcul qu'on laisse partir tout seul.

Enregistrer un remboursement fait quatre choses d'un coup :

| | |
|---|---|
| **Annule la réservation** | la date se libère et redevient réservable |
| **Coupe le versement au propriétaire** | sa part cesse d'être exigible |
| **Retranche la somme du chiffre d'affaires** | les comptes redeviennent justes |
| **Écrit au journal d'audit** | qui, quand, combien, et **pourquoi** |

---

## Combien rendre — la règle

Tout dépend d'**une seule question** : à qui l'annulation est-elle imputable ?
L'écran vous la pose, et le montant proposé change sous vos yeux selon la réponse.

### Si la faute vient de vous ou du propriétaire

**Remboursement intégral, commission comprise.**

Logement indisponible, propriétaire injoignable, erreur de votre côté : le client
n'a pas à payer votre défaillance. Lui retenir 15 % sur un séjour qu'il n'a pas
eu est le meilleur moyen de ne jamais le revoir — et de le voir l'écrire quelque
part où d'autres le liront.

### Si le client se désiste

Le barème s'applique sur **sa part seulement** ; la commission reste acquise. La
mise en relation a bien eu lieu, et l'encaissement vous a coûté des frais que
PayDunya ne vous rend pas.

| Il annule… | Il récupère |
|---|---|
| **7 jours ou plus** avant l'arrivée | **la totalité** de sa part |
| **entre 2 et 6 jours** avant | **la moitié** |
| **moins de 48 h** avant | **rien** |

Le dernier palier protège le propriétaire : la date était bloquée, il a refusé
d'autres clients pour elle.

> ⚠️ **Le barème propose, il ne décide pas.** Le montant reste modifiable dans
> l'écran. Un cas particulier existe toujours, et une règle qu'on ne peut pas
> contourner se contourne **hors du logiciel** — donc sans trace.

Le barème vit dans `backend/config/reservations.php`. Le changer est l'affaire
d'une ligne, mais **ne le publiez pas dans les CGU avant validation du juriste** :
c'est une clause contractuelle, pas un réglage.

---

## Le cas qui coûte de l'argent

**Un propriétaire déjà payé.** L'écran l'affiche en jaune, et laisse passer.

Refuser n'aiderait personne : l'argent est sorti dans la réalité, et un logiciel
qui dit non ne le fait pas revenir. Ce que l'écran fait à la place, c'est
**inscrire combien il vous doit** — visible en permanence sur la carte
« À récupérer ». Sans ce chiffre, personne ne le réclamerait jamais.

C'est aussi la raison pour laquelle on ne verse **jamais** avant la fin du séjour.
La règle existait déjà pour les reversements ; ce cas est ce qu'elle évite.

---

## Le client demande, vous décidez

Un client qui a payé **ne peut plus annuler seul**. Il le pouvait, à tout moment,
y compris la veille de l'arrivée : la date se libérait, et il attendait ensuite son
argent sans qu'aucune règle ne dise combien, ni que personne ne soit prévenu.

Désormais son bouton s'appelle **« Demander l'annulation »**, il exige un motif,
et la demande arrive dans **« Ce qui attend »**. La réservation, elle, **reste
confirmée** : les dates restent bloquées jusqu'à votre décision. Les libérer tout
de suite laisserait un second client réserver un séjour qu'on n'a pas encore
décidé d'annuler.

Le motif n'est pas une politesse : c'est lui qui décide de l'imputation, donc du
montant. « La villa était inhabitable » et « j'ai changé d'avis » ne valent pas la
même somme.

**Rien ne change quand rien n'a été encaissé.** Une demande non réglée s'annule
toujours d'un clic : il n'y a pas d'argent à rendre, donc pas de décision à
prendre, et faire attendre le client serait gratuit.

---

## En pratique

1. La demande apparaît dans **« Ce qui attend »**, en tête si elle traîne depuis
   deux jours — quelqu'un attend son argent, et le silence se lit comme un refus.
2. Ouvrez **Remboursements** dans la console. Lisez le motif, choisissez la cause.
3. Notez le montant proposé, **faites le virement chez PayDunya**.
4. Revenez, corrigez le montant si vous avez décidé autrement, écrivez le motif —
   celui qui vous expliquera la ligne dans six mois — et enregistrez.

Pour rembourser une réservation dont le client n'a **rien demandé** (une villa
devenue indisponible, par exemple), saisissez son numéro dans le champ au bas de
la liste des demandes.

---

## Ce que ça ne couvre pas encore

- **La boutique.** Les commandes d'articles ont leur propre paiement, séparé des
  réservations, et cet écran ne les touche pas. Une commande annulée remet
  l'exemplaire en vente ; le remboursement, lui, reste hors application.
- **Le virement automatique.** Il arrivera avec l'option PER, la même qui manque
  aux reversements. Le geste restera le même : décider, puis constater.
- **La publication du barème.** Il est appliqué mais n'est écrit nulle part côté
  client. Il doit passer par le juriste avec le reste des CGU — annoncer une règle
  de remboursement qu'on devra ensuite corriger est pire que de ne rien annoncer.
