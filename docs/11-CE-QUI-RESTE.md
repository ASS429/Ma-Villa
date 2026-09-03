# Ce qui reste — état au 22 août 2026 (soir)

_Écrit pour être lu sans connaître le code. Chaque point dit **ce que c'est**, **pourquoi
ça compte**, et **ce que ça coûte**._

---

## En un coup d'œil

| | |
|---|---|
| **Le gros du design est construit** | tout ce qui restait au matin est en ligne |
| **Une seule chose vous attend** | la réponse du juriste sur l'exercice sans société |
| **Le courrier fonctionne** | depuis le 1er septembre, par Resend sur `passetemps.sn` |
| **Deux blocages ne dépendent de personne ici** | PayDunya et le juriste |
| **Le reste est du polissage** | utile, mais rien qui empêche d'ouvrir |

---

## 1. Ce qui a été fait aujourd'hui

Six chantiers, tous en production et vérifiés au navigateur.

**« Ce qui attend »** — l'accueil de la console répond enfin à la question du matin :
ai-je du travail ? Il fallait auparavant ouvrir neuf pages pour le savoir. Sept files
possibles, triées par gravité, et **rien à faire affiche « rien à faire »** plutôt qu'une
liste de zéros. En tête, l'argent détenu pour les propriétaires — et la part que vous
avez encaissée sans pouvoir la rendre.

**La page introuvable** est devenue un point de reprise. La plupart des visiteurs y
arrivent par un lien WhatsApp vers une villa retirée : ils trouvent maintenant une
recherche, les trois premières villes, et des villas semblables. Le cas visé n'y arrivait
même pas — une adresse de villa morte tombait sur la fiche, qui proposait « Réessayer ».

**La confirmation** a changé de nature. C'est le seul moment où le client a quatre choses
à faire, et **le numéro du propriétaire y apparaît pour la première fois** — contrepartie
visible de sa disparition des fiches. L'écran promettait jusqu'ici de l'envoyer par
courriel, ce qui n'arrivait pas.

**La connexion par téléphone.** Un seul champ, « Téléphone ou e-mail ». Sans SMS, comme
vous l'avez tranché.

**Publier une villa** est devenu une suite de six étapes. Un nom et une ville suffisent à
commencer ; tout s'enregistre en chemin. C'est le seul écran dont l'échec se mesurait en
annonces qui n'existent pas.

**Les pannes se nomment.** La sonde d'encaissement donne son verdict en une phrase ; la
page d'erreur dit « quelque chose a cassé chez nous » et, pendant un règlement, ajoute
la seule phrase qui compte : *aucun paiement n'a été prélevé*.

---

## 1 bis. Rendre l'argent — fait le 1er septembre

L'argent ne savait aller que dans un sens. Un séjour qui ne pouvait pas avoir lieu se
remboursait chez PayDunya, à la main, et l'application n'en gardait **rien** : le chiffre
d'affaires comptait encore la vente, le motif restait dans votre tête, et un propriétaire
déjà payé gardait une somme que plus rien ne réclamait.

Un écran **Remboursements** existe maintenant dans la console. Comme les reversements, il
ne déplace pas d'argent : vous faites le virement de retour, puis vous l'enregistrez —
et l'enregistrement annule la réservation, libère la date, coupe le versement au
propriétaire et écrit au journal.

Une seule question décide du montant : **à qui l'annulation est-elle imputable ?**
Votre faute ou celle du propriétaire, le client récupère tout, commission comprise. Il se
désiste, le barème s'applique sur sa part : sept jours ou plus, tout ; deux à six jours,
la moitié ; moins de quarante-huit heures, rien. **Le barème propose, il ne décide pas** —
le montant reste modifiable.

Un client qui a payé **ne peut plus annuler seul**. Il le pouvait la veille de l'arrivée.
Sa demande arrive maintenant dans « Ce qui attend », avec son motif, et la réservation
reste confirmée — dates bloquées — jusqu'à votre décision.

⚠️ **Le barème n'est écrit nulle part côté client, et c'est volontaire.** C'est une clause
contractuelle : il doit passer par le juriste avec les CGU. Annoncer une règle de
remboursement qu'on devra corriger ensuite est pire que de ne rien annoncer.

Mode d'emploi complet : `docs/14-REMBOURSEMENTS.md`.

---

## 1 ter. Les textes légaux sont publiés — 3 septembre

Le juriste a rendu les quatre documents. Il a fait le renommage et rempli le bloc
éditeur — **Abdou Ndour, directeur de la publication**, contact `contactptemps@gmail.com` —
mais il est reparti de la trame du 10 août : ses textes affirmaient encore que
**« aucun paiement n'est encaissé par la plateforme »**, ce qui est faux depuis le 18 août
et qui est précisément la phrase retirée du site le 20.

Plutôt que de refaire un aller-retour, nous les avons repris nous-mêmes, à partir de ce
que le logiciel fait réellement. **Cinq documents sont en ligne**, et le bandeau « ceci
n'est pas un contrat » a disparu — le garder au-dessus de vraies conditions les aurait
vidées de leur effet.

| Document | Ce qu'il dit maintenant |
|---|---|
| Conditions générales | vous encaissez, vous détenez les fonds, la commission est 10 puis 20 % avec un exemple chiffré |
| Politique d'annulation | le barème complet, la demande d'annulation, **remboursement sous 15 jours ouvrés** |
| Confidentialité | les cinq prestataires nommés, le transfert vers les États-Unis, et des durées de conservation |
| **Conditions de vente** | nouveau — la boutique n'avait aucun texte, c'est ce qui l'empêchait d'ouvrir |
| Mentions légales | éditeur, directeur de la publication, hébergement complet |

⚠️ **Ce qui n'est pas réglé pour autant.** Ces textes sont justes, mais ils n'ont pas été
validés par un juriste, et surtout : ils ne changent rien au fait que **vous encaissez
l'argent de tiers sans société déclarée**. C'est la question posée le 22 août, toujours
sans réponse, et aucune formulation ne la contourne. Gardez le juriste dessus.

Le relevé des écarts entre ses textes et le logiciel est dans
`docs/juridique/v5-textes-a-reprendre/` — utile pour lui expliquer pourquoi on a repris
la main.

---

## 2. Ce qui vous attend, vous

### Les mentions légales — elles attendent le juriste, finalement

Je pensais pouvoir les publier sans lui : il ne manquait, croyais-je, que vos
informations d'entreprise. **Ces informations n'existent pas** — l'activité est exercée
de manière informelle, sans société déclarée.

Publier des mentions légales revient donc à écrire noir sur blanc *qui* édite le site, et
je ne sais pas ce qu'il est obligatoire d'y faire figurer quand l'éditeur est une
personne physique non déclarée, ni ce qu'il serait imprudent d'y mettre. La question part
au juriste dans la note du 22 août.

**La seule information disponible est l'adresse de contact** — `contactptemps@gmail.com` —
et elle est déjà en ligne sur les quatre pages.

---

## 3. Ce qui ne dépend de personne ici

### PayDunya — l'option de déboursement

Mail parti le **20 août**, sans réponse. **Tout le code est écrit et testé** : le jour de
l'activation, une variable suffit (`REVERSEMENT_AUTOMATIQUE=true`).

En attendant, vous versez à la main et l'enregistrez — le suivi fonctionne, et « Ce qui
attend » vous dit exactement combien est dû et depuis quand.

**Pour accélérer :** relancer par le ticket ouvert dans votre tableau de bord PayDunya,
pas par courriel. La demande y est rattachée à votre compte.

### Les textes juridiques

Chez votre juriste. `TEXTES_PROVISOIRES` reste à `true` et **ne doit pas repasser à
`false`** avant d'avoir les textes validés — le projet de CGU v2 est une proposition
soumise, pas un texte approuvé.

⚠️ **La vente à distance n'est couverte nulle part** : rétractation, livraison, retour
d'un article. À régler avant d'ouvrir commercialement la boutique.

---

## 4. Le polissage — fait le 27 août

Tout est en ligne.

**Le tableau de bord** répond à une seule question par un seul chiffre : les fonds
détenus pour les propriétaires. Une phrase conclut, et elle penche du côté du problème
dès qu'il y en a un.

**Les erreurs d'authentification** descendent sous le champ qu'elles concernent. Les
boutons restent gris tant que les champs requis manquent. Un lien expiré occupe l'écran
avec une sortie, au lieu d'un bandeau rouge sur un formulaire devenu inutile.

**Les sept listes** — cinq de l'administration, deux de l'espace personnel — partagent
un gabarit. Ce qui reste propre à chaque écran est la colonne qui porte le risque.

**Une page de maintenance** existe, qui ne charge rien : elle s'affiche même quand le
reste est tombé. ⚠️ **L'heure de retour qu'elle annonce est à modifier à la main** avant
de l'employer — une heure fausse est pire que pas d'heure.

**Un défaut d'accessibilité trouvé en chemin :** le bouton de suppression portait du
texte blanc sur rouge dans les deux thèmes. En mode sombre, le rouge est clair et le
contraste tombait à 2,8 pour 1 — sur le bouton qu'il faut justement lire avant de
cliquer. Corrigé, mesuré à 5,9 et 6,5 pour 1.

---

## 5. Les trois questions du designer — où elles en sont

**1 · Le seuil de publication.** Ma recommandation : ne rien exiger de plus pour publier,
et **déplacer l'exigence au premier versement** (pièce d'identité, adresse). Le risque
n'est pas à la publication — votre modération garde déjà la porte — il est au moment où
l'argent bouge. C'est ce qui est construit aujourd'hui : nom et ville suffisent.
**Reste à trancher** si vous voulez la vérification d'identité avant versement.

**2 · La fourchette de prix locale.** Tranchée et construite : elle n'apparaît qu'au-delà
de **dix annonces comparables**, à formule et type de logement égaux. En dessous, on
n'affiche rien — surtout pas une médiane nationale, qui serait fausse dans les deux sens
entre Saly et la Casamance. Le **net**, lui, s'affiche toujours.

**3 · « Encaissé mais non versable ».** Construit côté administration. **Prévenir les
propriétaires d'un retard : délibérément non**, tant qu'aucun délai ne leur est promis —
annoncer un retard contre une promesse inexistante crée l'inquiétude sans motif. À
rouvrir le jour où vous annoncerez un délai.

---

## 6. Le point à ne pas laisser traîner

La plateforme **encaisse de l'argent qui appartient à des propriétaires** et le conserve
jusqu'à un virement fait à la main. Elle le fait aujourd'hui sans structure déclarée.

Je ne sais pas si c'est tenable, et ce n'est pas à moi d'en juger — la question part au
juriste dans la note du 22 août, formulée sans détour : l'encaissement pour le compte de
tiers peut-il se faire ainsi, et sinon, qu'est-ce qui est le plus urgent — créer la
société, ou cesser d'encaisser en attendant ?

C'est le seul point de ce document qui pourrait obliger à **changer le fonctionnement du
produit**, et pas seulement à écrire un texte. Tout le reste peut attendre.
