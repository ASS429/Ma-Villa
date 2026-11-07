# Ce qui reste — état au 6 novembre 2026

_Écrit pour être lu sans connaître le code. Chaque point dit **ce que c'est**, **pourquoi
ça compte**, et **ce que ça coûte**. L'ancien état du 22 août est plus bas, pour mémoire._

---

## En un coup d'œil, au 6 novembre 2026

| | |
|---|---|
| **Le site est en ligne** | passetemps.sn, 59 annonces, en français et en anglais |
| **On encaisse déjà, à la main** | devis, règlement auprès de l'équipe, reçu numéroté, reversement suivi |
| **La réservation en ligne est prête mais fermée** | KYC PayDunya envoyé le 5 novembre, relance le 20 |
| **L'immatriculation est faite** | RCCM SN.DKR.2026.A.43219, NINEA 013512810, partout sur le site, les devis, les reçus et les courriels |
| **Le transport a un vrai véhicule** | l'Outlander, trois trajets au prix du chauffeur + 5 000 F de commission |
| **Le site a été testé de bout en bout le 6 novembre** | quatre rôles, toutes les pages, 21 formulaires, au téléphone et à l'ordinateur |

## Dans l'ordre où le faire

1. **Autoriser le « Transfert Automatique (TFA) » chez PayDunya** (réglages de l'intégration).
   Sans lui, la console ne peut pas lire le solde (code 4002), et le déboursement automatique
   ne pourra pas partir.
2. **Le 20 novembre, relancer PayDunya** si le KYC n'a pas de réponse
   (`18-DEMANDE-PAYDUNYA-KYC-PER-CARTE.md`), puis chercher un second prestataire agréé
   sur la liste de la BCEAO.
3. **Rouvrir la réservation en ligne** une fois le KYC validé : `PAIEMENT_ACTIF` et
   `RESERVATIONS_OUVERTES` à `true` sur Railway, puis un paiement réel de 200 F.
4. **Voir un comptable** avec `19-QUESTIONS-AU-COMPTABLE.md` : régime fiscal, facture, et ce que
   veut dire, pour une entreprise individuelle, détenir l'argent de tiers.
5. **Valider la phrase des CGU sur le transport** (article 7) : PasseTemps encaisse et reverse
   au transporteur depuis le 6 novembre. Proposition dans `juridique/A-REPRENDRE.md`.
6. **Les accords écrits des propriétaires** (Clé d'Or, Modou Sene, vidéos) et de vrais comptes pour
   ceux qui n'en ont pas.
7. **Faire préciser l'activité au registre** si le comptable ou PayDunya le demandent : la liste
   déposée ne cite ni l'hébergement, ni la réservation, ni l'intermédiation.

Décidé le 5 novembre : le compte bancaire est **le compte personnel** de l'exploitant (même
personne que l'entreprise individuelle). La règle qui protège l'argent des propriétaires :
**laisser leur part sur PayDunya et ne retirer que la commission**, sans jamais descendre sous
le montant « À laisser sur PayDunya » de la console.

## Ce que le test du 6 novembre a vérifié, et ce qu'il n'a pas pu

Vérifié, en local avec la réservation en ligne fermée comme en production : visiteur (recherche,
catégories, filtres, tri, carte, langue, thème, devis depuis une fiche, demande particulière,
dates prises puis « être rappelé », transport, repas, mot de passe oublié, connexion refusée,
boutique), client (inscription, profil, favori, commande d'œuvre), propriétaire (assistant de
publication, dates fermées, revenus), administrateur (devis, règlement et reçu, renonciation et
remboursement, validation d'annonce, demandes, exports, fiches PDF, solde PayDunya). Puis le
site en ligne, en visiteur, sur toutes les pages du plan du site.

Six défauts corrigés le jour même : un « Tout est traité » affiché quand la console n'avait
rien pu lire, trois listes « Aucun… » affichées avant la réponse, un tableau qui débordait,
des boutons trop petits au doigt, un « 0 FCFA » qui se lisait « o FCFA », et **les photos en
portrait qui n'étaient pas réduites à l'envoi** (seule la largeur était plafonnée).

**Les photos déjà en ligne, allégées sur votre accord (6 novembre).** 25 photos de 8 annonces
(31, 32, 33, 36, 53, 54, 56, 64) pesaient 33 Mo, la moitié du site : la fiche 32 coûtait 11 Mo
au téléphone, contre 3 pour une fiche ordinaire. Une migration lance une fois
`passetemps:alleger-photos` en production : même adresse, original gardé sous `originaux/`.
Elle a repris 17 photos (le site passe de 65 à 55,7 Mo, la fiche 32 de 7,3 à 1,2 Mo) avant sa
limite de deux minutes ; le reste — 12 PNG de 2 Mo nommés `.jpg` — est repris par une passe
nocturne (4 h), qui rattrapera aussi tout import futur.

⚠️ **8 images d'annonces sont signées ChatGPT** (manifeste C2PA « créée par gpt-image ») :
annonce 53 (4 photos sur 5), 54 (1 sur 3), 64 (3 sur 5). Une image d'IA montrée comme la photo
d'un logement peut tromper le client : **à décider** — demander de vraies photos au propriétaire,
ou les retirer.

**Le transport, tranché le 6 novembre.** PasseTemps encaisse et reverse au transporteur
(Mamadou pour l'instant) : la console Demandes note le paiement du client, la part du
transporteur (prix moins 5 000 F), puis le reversement ; tant qu'elle n'est pas reversée, cette
part compte dans l'argent à garder et, une fois le trajet fait, dans « Ce qui attend ». Une
autre ville : 35 000 F au minimum. Location sans chauffeur : permis exigé, caution, carburant à
la charge du client, assurance comprise. « Trajets vers les sites » et « Voiture avec chauffeur »
sont retirés.

**Pas testable aujourd'hui** : le paiement en ligne et la réponse d'un propriétaire à une
demande en ligne (la réservation est fermée), et les écrans d'administration de production
(on n'y entre pas avec un script). Ils ont été testés de bout en bout le 31 octobre, tout
ouvert en local ; à refaire après la réouverture avec le paiement réel de 200 F.

## À faire plus tard (noté le 4 novembre 2026)

Rien d'urgent ; ce qu'on a vu passer et qu'il ne faut pas perdre.

- **Les questions qui reviennent dans les demandes.** Événements autorisés, capacité en journée,
  traiteur extérieur : les clients les posent à chaque fois, et il faut rappeler le propriétaire.
  Des champs par annonce, remplis une fois, répondraient sans appel et rempliraient les fiches.
- **Lier un règlement à un compte client existant.** Un client qui a déjà un compte et qui règle
  auprès de l'équipe ne voit pas ce séjour dans son espace : on ne rapproche pas un compte sur un
  simple numéro, l'identité n'étant pas vérifiée. Le dossier reste complet dans la console.
- **Ouvrir le classeur du pilotage dans le vrai Excel.** Il est vérifié avec un lecteur
  indépendant (openpyxl), pas avec Excel, absent de la machine de développement.

---

## État au 22 août 2026, pour mémoire

### En un coup d'œil

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
| Conditions générales | vous encaissez, vous détenez les fonds, la commission est 10 puis 14 % avec un exemple chiffré |
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
