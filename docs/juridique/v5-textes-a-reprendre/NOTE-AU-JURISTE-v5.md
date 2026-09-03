# Note au juriste — version 5

_3 septembre 2026. Retour sur les quatre documents corrigés que vous nous avez remis._

**Objet.** Merci pour les quatre fichiers. L'hébergement que vous aviez laissé à compléter
est renseigné (§ 1). Mais **les textes ne peuvent pas être publiés en l'état** : ils
décrivent la plateforme telle qu'elle était le 10 août, et elle a changé sur le point le
plus sensible — **elle encaisse l'argent depuis le 18 août**.

Les documents portent d'ailleurs toujours votre bandeau « DOCUMENT SOUMIS À RELECTURE
JURIDIQUE — NON PUBLIÉ EN L'ÉTAT » et la mention « Version de travail — 10 août 2026 ».
Nous en déduisons que vous ne les considérez pas comme définitifs non plus, et que les
notes des 18 août, 22 août et 1er septembre ne vous étaient peut-être pas parvenues.
Elles sont jointes de nouveau.

Ce document décrit ce que le logiciel fait réellement au 3 septembre 2026. Il n'a pas
valeur d'avis juridique et n'est pas destiné à être publié.

---

## 1. Ce qui est fait — l'hébergement

Les deux lignes que vous aviez laissées en jaune dans les mentions légales sont
renseignées, et nous en avons ajouté trois que ces deux-là ne couvraient pas : les
photographies des annonces, l'envoi des courriels et le traitement des paiements sortent
tous de la plateforme et vont chez des tiers.

| Rôle | Prestataire |
|---|---|
| Application web | Render Services, Inc., 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis |
| API et base de données | Railway Corporation, 548 Market Street PMB 68956, San Francisco, CA 94104, États-Unis |
| Photographies des annonces | Cloudflare, Inc. (Cloudflare R2), 101 Townsend Street, San Francisco, CA 94107, États-Unis |
| Envoi des courriels | Plus Five Five, Inc. (Resend), 2261 Market Street #5039, San Francisco, CA 94114, États-Unis |
| Traitement des paiements | PayDunya, Dakar, Sénégal |

Chaque dénomination et chaque adresse a été relevée sur les documents légaux du
prestataire lui-même. Deux points méritent votre attention :

- **Resend est exploité par « Plus Five Five, Inc. »**, et non par une société du même
  nom. C'est cette dénomination-là qui figure dans leurs conditions et leur avenant de
  traitement des données ;
- **quatre prestataires sur cinq sont établis aux États-Unis.** Les données des
  utilisateurs y sont donc transférées. La politique de confidentialité mentionne
  aujourd'hui des « prestataires techniques » sans les nommer ni signaler le transfert —
  voir § 4.

> **Ce que nous vous demandons :** ce transfert hors du Sénégal appelle-t-il une mention
> particulière, une information préalable de l'utilisateur, ou une formalité auprès de la
> CDP que vous citez à l'article 35 de la politique de confidentialité ?

---

## 2. Le point bloquant — les textes disent que la plateforme n'encaisse pas

C'est la seule chose qui empêche vraiment la publication, et elle revient dans deux
documents.

**Conditions générales, article 5 :**

> « À ce jour, aucun paiement n'est encaissé par la plateforme : le règlement s'effectue
> directement entre le client et le propriétaire […] Un paiement en ligne par Wave et
> Orange Money sera introduit ultérieurement. »

**Politique d'annulation, chapeau et article 4 :**

> « La plateforme n'encaissant aucun paiement à ce jour, les remboursements éventuels
> relèvent d'un accord direct entre le client et le propriétaire. »
>
> « Tant que la plateforme n'encaisse aucun paiement, le remboursement est effectué par
> le propriétaire […] »

**Ces phrases sont fausses depuis le 18 août 2026.** Le paiement en ligne n'est pas à
venir : il est en service, en argent réel. PasseTemps encaisse la totalité du séjour sur
son compte marchand PayDunya, en retient une commission, et **détient les fonds** jusqu'au
reversement au propriétaire après la fin du séjour.

C'est précisément pour cette raison que ces mêmes phrases ont été retirées du site le
20 août : un client aurait pu les opposer à la plateforme dans un litige sur un
remboursement ou sur la détention de fonds. Les republier serait revenir en arrière sur
le seul point où nous savons que le texte expose.

> **Ce que nous vous demandons :** reprendre l'article 5 des conditions générales et
> l'article 4 de la politique d'annulation à partir du fonctionnement réel, décrit dans
> la note du 18 août. Deux questions en découlent :
>
> 1. **La qualification d'« intermédiaire technique » tient-elle encore ?** L'article 2
>    des conditions générales l'affirme. Une plateforme qui encaisse pour le compte
>    d'autrui et conserve les fonds n'est peut-être plus dans ce cadre.
> 2. **La commission n'apparaît nulle part dans les textes.** Elle est prélevée sur le
>    prix affiché : 10 % sur les 50 000 premiers francs, 20 % au-delà. Sur 100 000 FCFA,
>    la commission est de 15 000 et le propriétaire perçoit 85 000. Faut-il l'écrire, et
>    à quel endroit ?

---

## 3. La politique d'annulation ne correspond plus au logiciel

Au-delà du point précédent, quatre écarts. Le premier est une contradiction directe entre
votre texte et ce que la machine calcule.

### Le barème ne porte pas sur la même somme

Votre article 1 écrit : *« plus de 7 jours avant l'arrivée : remboursement intégral des
sommes versées »*, et *« entre 7 et 2 jours : remboursement de 50 % »*.

Le logiciel applique bien ces délais, mais **sur la part du client, la commission restant
acquise** — sauf lorsque l'annulation est imputable à la plateforme ou au propriétaire,
auquel cas tout est rendu, commission comprise.

Sur une réservation de 100 000 FCFA annulée par le client à trois jours de l'arrivée :

| | Somme rendue |
|---|---|
| Ce que votre texte annonce | 50 000 FCFA (la moitié des sommes versées) |
| Ce que le logiciel calcule | 42 500 FCFA (la moitié des 85 000 revenant au propriétaire) |

Il faut trancher lequel des deux a raison — c'est une clause contractuelle, pas un
réglage. **Nous n'avons rien publié de ce barème en attendant votre réponse** : la page
d'annulation du site n'annonce aujourd'hui aucun pourcentage, seulement les deux critères
qui pèsent sur la décision (qui est à l'origine de l'annulation, et le délai avant
l'arrivée).

### Le client ne peut plus annuler seul

Votre article 1 écrit : *« Le client peut annuler depuis son espace, à tout moment avant
le début du séjour. »* Ce n'était plus vrai au 1er septembre pour une réservation
**payée** : le bouton s'intitule « Demander l'annulation », le motif est obligatoire, la
réservation reste confirmée et les dates restent bloquées jusqu'à la décision de
PasseTemps. Une réservation **non réglée**, elle, s'annule toujours librement.

### Le remboursement n'est pas fait par le propriétaire

Votre article 4 le dit ; c'est PasseTemps qui rembourse, puisque c'est elle qui détient
les fonds. Le virement de retour part de son compte marchand, vers le numéro qui a servi
à payer.

### Le délai de quatorze jours n'a été promis par personne

Votre article 4 annonce un remboursement *« sous 14 jours ouvrés »*. Le virement est
aujourd'hui **fait à la main** ; aucun délai n'a jamais été annoncé aux utilisateurs, et
l'exploitant préfère n'en annoncer aucun plutôt qu'un délai manqué une fois sur deux —
c'est la position déjà retenue pour le reversement aux propriétaires. Si un délai est
juridiquement exigible, dites-le : il faudra alors le tenir, ou automatiser le virement.

---

## 4. Politique de confidentialité — deux collectes manquantes

Le texte est bon dans sa structure. Deux données qu'il ne couvre pas :

**Le numéro de téléphone qui sert à payer est conservé** depuis le 1er septembre. Il
n'est pas nécessairement celui du compte : on s'inscrit avec son téléphone personnel et
on règle avec le portefeuille mobile d'un proche. Sa seule finalité est de pouvoir
rembourser sur le numéro réellement débité. **Durée de conservation à fixer.**

**Les messages entre client et propriétaire, et le journal d'administration** — qui a
validé, rejeté ou retiré quoi, et quand — sont conservés. Le second est la seule pièce
produisible en cas de litige avec un propriétaire. **Durées à fixer également.**

L'article 26 mentionne des « prestataires techniques » sans les nommer. Les mentions
légales, elles, les nomment désormais tous les cinq. Faut-il aligner les deux documents ?

---

## 5. Mentions légales — deux vérifications

**« Directeur de la publication : Abdou Ndour ».** Ce nom n'apparaît nulle part ailleurs
dans le projet. Merci de confirmer qu'il est bien celui que l'exploitant vous a indiqué,
et non un exemple resté dans la trame.

**L'adresse de contact ne concorde pas.** Vos quatre documents portent
`contactptemps@gmail.com`. Le site publie aujourd'hui `contactsmavilla@gmail.com` sur ses
quatre pages légales. Il faut choisir : nous alignerons le site sur votre adresse, ou
l'inverse — mais publier deux adresses différentes selon l'endroit est un défaut visible.

⚠️ À noter : `passetemps.sn` **peut envoyer du courrier mais ne peut pas en recevoir**,
faute de boîte configurée sur le domaine. C'est pourquoi l'adresse publiée reste une
adresse Gmail. Si un texte impose une adresse au domaine du site, il faudra ouvrir la
boîte avant de la publier.

---

## 6. Ce qui reste sans réponse depuis le 22 août

La question de fond n'a pas encore reçu de réponse écrite, et elle n'est plus théorique :
**la plateforme est ouverte au public depuis le 1er septembre**, sur son propre nom de
domaine, avec l'encaissement réel actif.

1. **L'encaissement pour compte de tiers peut-il se faire sans structure déclarée ?**
   L'activité est exercée par une personne physique, sans société, sans RCCM ni NINEA —
   ce que vos mentions légales inscrivent d'ailleurs comme « en cours de formalisation ».
   Si la réponse est non, qu'est-ce qui est le plus urgent : créer la société, ou cesser
   d'encaisser en attendant et revenir au règlement direct entre client et propriétaire ?
2. **À partir de quel seuil la déclaration devient-elle exigible ?**
3. **Des conditions générales de vente pour la boutique d'artisanat**, demandées le
   22 août. C'est le seul texte entièrement à créer : la plateforme y est **vendeur**, et
   non intermédiaire, ce qui ne relève pas des mêmes règles. La boutique reste fermée en
   attendant.

En attendant vos réponses, les quatre pages du site portent un bandeau « Ceci n'est pas un
contrat » et ne contiennent aucune clause — seulement une description factuelle du
fonctionnement, vérifiable. C'est ce qui nous permet d'être ouverts sans rien affirmer de
faux, mais ce n'est pas un état tenable longtemps.

---

## 7. Documents joints

| Fichier | État |
|---|---|
| `corriges/1-Conditions-generales-utilisation.docx` | votre retour — **article 5 à reprendre**, voir § 2 |
| `corriges/2-Politique-de-confidentialite.docx` | votre retour — deux collectes à ajouter, voir § 4 |
| `corriges/3-Politique-d-annulation.docx` | votre retour — **à reprendre entièrement**, voir §§ 2 et 3 |
| `corriges/4-Mentions-legales.docx` | votre retour, **hébergement complété** — deux vérifications, voir § 5 |
| `NOTE-AU-JURISTE-v2.md` (18 août) | l'encaissement réel — **le point du § 2** |
| `NOTE-AU-JURISTE-v3.md` (22 août) | boutique, commission par tranches, absence de société |
| `NOTE-AU-JURISTE-v4.md` (1er septembre) | remboursements, barème, changement de nom |
| **`NOTE-AU-JURISTE-v5.md`** (3 septembre) | cette note |

---

*Nous n'avons modifié dans vos fichiers que ce qui nous était demandé — les lignes
d'hébergement — plus trois coquilles d'en-tête (« reservation » sans accent,
« logementl », et la casse de la marque, qui variait d'un fichier à l'autre). Aucune
clause n'a été touchée.*
