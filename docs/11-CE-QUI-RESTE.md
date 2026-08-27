# Ce qui reste — état au 22 août 2026 (soir)

_Écrit pour être lu sans connaître le code. Chaque point dit **ce que c'est**, **pourquoi
ça compte**, et **ce que ça coûte**._

---

## En un coup d'œil

| | |
|---|---|
| **Le gros du design est construit** | tout ce qui restait au matin est en ligne |
| **Une seule chose vous attend** | la réponse du juriste sur l'exercice sans société |
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

## 2. Ce qui vous attend, vous

### Les mentions légales — elles attendent le juriste, finalement

Je pensais pouvoir les publier sans lui : il ne manquait, croyais-je, que vos
informations d'entreprise. **Ces informations n'existent pas** — l'activité est exercée
de manière informelle, sans société déclarée.

Publier des mentions légales revient donc à écrire noir sur blanc *qui* édite le site, et
je ne sais pas ce qu'il est obligatoire d'y faire figurer quand l'éditeur est une
personne physique non déclarée, ni ce qu'il serait imprudent d'y mettre. La question part
au juriste dans la note du 22 août.

**La seule information disponible est l'adresse de contact** — `contactsmavilla@gmail.com` —
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
