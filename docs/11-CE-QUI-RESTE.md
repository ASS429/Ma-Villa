# Ce qui reste — état au 22 août 2026

_Écrit pour être lu sans connaître le code. Chaque point dit **ce que c'est**, **pourquoi
ça compte**, et **ce que ça coûte**._

---

## En un coup d'œil

| | |
|---|---|
| **Le produit fonctionne** | réservation, paiement, messagerie, boutique, console, PWA — tout est en ligne |
| **Ce qui reste est surtout du design** | les écrans dessinés par Claude Design ne sont pas encore construits |
| **Deux blocages ne dépendent pas de nous** | PayDunya et le juriste |
| **Trois questions attendent votre arbitrage** | elles sont à la fin, et deux touchent à l'argent |

---

## 1. Ce qui est fait, pour situer

Inutile d'y revenir, mais il faut le savoir pour comprendre ce qui manque.

**Les fondations du design sont posées.** La grammaire des superpositions (une feuille monte
du bas, une modale se centre, un tiroir vient du côté, un toast n'interrompt pas), la
pastille de notification et ses règles, le châssis partagé entre propriétaire et
administration, le téléverseur de photos, la grille des notifications.

**Les règles métier que vous avez arrêtées sont en place.** Commission par tranches, plafond
de cinq photos, annulation automatique sous 24 h, retrait d'une annonce en ligne contre un
motif.

Autrement dit : **la structure est là, les écrans ne le sont pas encore.**

---

## 2. Ce qui reste à construire

### 2.1 « Ce qui attend » — l'écran manquant de l'administration

**Ce que c'est.** Un écran d'accueil pour la console, listant tout ce qui demande une
décision : annonces à valider, versements dus, sondes en panne, avis signalés, commandes
impayées.

**Pourquoi ça compte.** Aujourd'hui, pour savoir si vous avez du travail, il faut ouvrir
neuf pages une par une. C'est le designer qui l'a repéré : cet écran ne figurait pas dans
mon inventaire, alors qu'il est la première entrée du menu.

**Ce que ça coûte.** Une demi-journée. C'est le même écran que l'accueil du propriétaire,
avec d'autres lignes — le travail sert deux fois.

---

### 2.2 Publier une villa — l'écran le plus important qui reste

**Ce que c'est.** Le formulaire qu'un propriétaire remplit pour mettre son bien en ligne.

**Pourquoi ça compte.** C'est, selon le designer, **le seul écran dont l'échec se mesure en
annonces qui n'existent pas**. Un propriétaire qui abandonne au milieu ne revient pas, et
vous ne le saurez jamais.

**Ce que le design change.** Cinq décisions contre l'abandon :

1. **On peut publier avec le minimum** — une villa, un logement, une formule. Les logements
   supplémentaires et les autres tarifs se rajoutent *après*, depuis « Gérer ». Le
   formulaire long devient un formulaire court suivi d'enrichissements facultatifs.
2. **La progression compte les étapes restantes**, pas un pourcentage : « il reste 4 étapes,
   environ 10 minutes » est vérifiable, « 33 % » ne veut rien dire.
3. **Chaque étape peut être sautée** sauf le nom et la ville. L'annonce reste en brouillon,
   mais le travail est sauvé.
4. **Le prix arrive avec une fourchette locale et le net** : « à Mbour, entre 65 000 et
   95 000 » puis « pour vous, 60 000 ». C'est l'étape où le propriétaire hésite le plus, et
   celle où il découvrirait sinon la commission après coup.
5. **L'aperçu de la carte est permanent** — il voit ce qu'il fabrique, et les trous sont
   nommés plutôt qu'inventés.

**Ce que ça coûte.** Deux à trois jours. C'est le plus gros morceau restant.

---

### 2.3 Les cinq écrans d'authentification

**Ce que c'est.** Connexion, inscription, mot de passe oublié, réinitialisation, e-mail
vérifié.

**Pourquoi ça compte.** Le designer les appelle des **péages** : ils n'ont aucune valeur
propre, et un champ de plus, c'est une réservation de moins. D'où trois champs seulement à
l'inscription.

**Un écart avec le code actuel.** Vous avez arbitré que la connexion accepterait **téléphone
ou e-mail**. Aujourd'hui, l'écran ne propose que l'e-mail — or beaucoup de propriétaires
sénégalais n'ont pas d'adresse e-mail utilisée. C'est un frein réel à l'inscription.

**Ce que ça coûte.** Un jour et demi, dont une partie côté serveur pour accepter les deux
identifiants sans casser les comptes existants.

---

### 2.4 L'écran de confirmation — il change de nature

**Ce que c'est.** L'écran qui suit un paiement réussi.

**Pourquoi ça compte.** C'est aujourd'hui un écran de félicitations. Le designer y voit **le
seul moment où le client a une décharge d'attention et quatre choses à faire** : noter
l'adresse, appeler le propriétaire, bloquer la date, prévenir d'une arrivée tardive. Dire
« merci » puis renvoyer à l'accueil gaspille exactement cette fenêtre.

**Et surtout :** c'est là que **le numéro du propriétaire apparaît pour la première fois**.
C'est la contrepartie visible de sa disparition des fiches — sans ce moment, le masquage se
lit comme une rétention.

**Ce que ça coûte.** Une demi-journée.

---

### 2.5 La page 404

**Ce que c'est.** La page affichée quand une adresse ne mène nulle part.

**Pourquoi ça compte.** Le designer relève que **la plupart des visiteurs y arrivent par un
lien WhatsApp vers une villa retirée** — WhatsApp étant votre principal canal d'acquisition.
Une 404 qui n'offre qu'un bouton « retour à l'accueil » perd ce client : il cherchait une
villa à Saly, on lui fait tout refaire.

Le design propose un champ de recherche, les trois villes principales, et des villas
semblables. Une 404 devient une page d'atterrissage.

**Ce que ça coûte.** Deux heures. C'est le meilleur rapport travail / clients récupérés de
la liste.

---

### 2.6 Le reste des écrans

Par ordre décroissant d'importance :

- **Les trois sondes** (Encaissement, Notifications, Déboursement) : elles ressemblent
  aujourd'hui à des listes de clés et de valeurs. Le design veut **le verdict d'abord**, en
  une phrase — « Non, les versements sont bloqués. 3 propriétaires attendent 1 810 500 FCFA,
  dont un depuis 5 jours » — et le détail technique en dessous.
- **Le tableau de bord de l'administration** : une seule question, « la plateforme va-t-elle
  bien ce matin ? », et une réponse en un chiffre — les fonds détenus pour les
  propriétaires.
- **Les listes** (utilisateurs, articles, commandes, modération) : un gabarit commun, où ce
  qui change est la colonne qui porte le risque.
- **Gérer une villa**, **Réservations**, **Favoris**, **Profil**.

**Ce que ça coûte.** Trois à quatre jours au total.

---

## 3. Ce qui ne dépend pas de nous

### 3.1 PayDunya — l'option de déboursement

Le mail est parti le **20 août**, sans réponse à ce jour. **Tout le code est écrit et
testé** : le jour où ils activent l'option, il suffit de poser une variable
(`REVERSEMENT_AUTOMATIQUE=true`) et de lancer la sonde depuis la console.

En attendant, vous versez à la main et vous l'enregistrez — le suivi fonctionne.

**Si vous voulez accélérer :** relancer par le ticket ouvert dans votre tableau de bord
PayDunya, pas par courriel. La demande y est rattachée à votre compte.

### 3.2 Les textes juridiques

Chez votre juriste. Les quatre pages portent une note d'attente honnête — elles décrivent le
fonctionnement réel sans prétendre tenir lieu de contrat.

**Un point que le designer soulève et qui n'attend pas le juriste :** les **mentions
légales** n'ont pas besoin de lui. Raison sociale, adresse, registre de commerce,
hébergeur, contact. Il propose de les publier tout de suite — *une page publiée sur quatre
rend les trois notes d'attente crédibles*.

---

## 4. Les questions du designer — celles qui vous reviennent

### Question 1 · Le seuil de publication d'une villa

**Ce qu'il a supposé :** une villa se publie avec un logement, une formule tarifaire et des
photos. Rien d'autre.

**Ce qu'il vous demande :** votre modération exige-t-elle davantage ? Une adresse vérifiée ?
Une pièce d'identité du propriétaire ? Des photos de chaque chambre ?

**Pourquoi ça compte.** Chaque exigence supplémentaire fait monter l'abandon. Mais chaque
exigence retirée fait monter le nombre d'annonces douteuses à modérer. C'est un arbitrage
entre le volume et la qualité, et il vous appartient.

> **Ce qu'il faut me dire :** la liste minimale que vous accepteriez de publier.

---

### Question 2 · La fourchette de prix locale

**Ce qu'il a dessiné :** à l'étape du prix, une phrase du type « à Mbour, les villas de
4 chambres avec piscine se louent entre 65 000 et 95 000 FCFA la nuitée. Vous êtes dans la
fourchette. »

**Le problème qu'il signale lui-même :** cette fourchette suppose assez d'annonces pour être
juste. À Ziguinchor avec neuf villas, elle serait trompeuse — et un propriétaire qui fixe son
prix sur une fourchette fausse le regrettera.

**Ce qu'il propose :** ne l'afficher qu'au-delà de dix annonces comparables, et sinon
afficher la médiane nationale **en le disant**.

> **Ce qu'il faut me dire :** d'accord avec le seuil de dix, ou vous préférez ne rien
> afficher tant qu'on n'a pas de volume ?

---

### Question 3 · « Encaissé mais non versable »

**Ce que c'est.** Un indicateur en tête du tableau de bord, qui dirait combien d'argent la
plateforme a encaissé **et ne peut pas reverser**.

**Pourquoi il le propose.** Encaissement et déboursement sont les deux moitiés d'une même
promesse. Si l'un marche et l'autre pas — **exactement la situation d'aujourd'hui, tant que
PayDunya n'a pas activé l'option** — la plateforme accumule de l'argent qu'elle ne peut pas
rendre. C'est le seul chiffre qui dit que la situation est intenable.

**Il propose aussi que la panne prévienne les propriétaires**, pas seulement vous : un
propriétaire qui attend un versement, ne le reçoit pas et n'a aucune explication appelle et
perd confiance. Une panne interne visible vaut mieux qu'une promesse silencieusement
manquée.

> **Ce qu'il faut me dire :** affiche-t-on ce chiffre, et prévient-on les propriétaires en
> cas de retard ?

---

## 5. Ce que je propose de faire, dans l'ordre

1. **« Ce qui attend »** — vous saurez enfin d'un coup d'œil ce qui demande une décision.
2. **La 404** — deux heures, et elle récupère des clients venus de WhatsApp.
3. **La confirmation** — c'est là que le numéro du propriétaire réapparaît.
4. **L'authentification**, avec la connexion par téléphone.
5. **Publier une villa** — le plus long, et celui qui rapporte le plus d'annonces.
6. Les sondes, le tableau de bord, les listes.

Aucune des trois questions ci-dessus ne bloque les points 1 à 4. La question 1 touche le
point 5 ; les questions 2 et 3 peuvent se trancher plus tard.
