# Ma Villa — point complet et analyse d'architecture

_12 août 2026. Mesures prises sur le dépôt et sur la production, pas de mémoire._

---

## En résumé

| | |
|---|---|
| Code applicatif | 9 443 lignes front · 2 855 lignes back |
| Tests | 139, dont 2 256 lignes de test — **44 % du volume backend** |
| Qualité | `tsc` propre · `eslint` 0 · `npm audit` 0 vulnérabilité |
| Poids servi | 370 Ko d'assets · 88 Ko gzip de paquet initial |
| Production | Front Render, API Railway, PostgreSQL, médias Cloudflare R2 |

**La plateforme est techniquement saine et fonctionnellement presque complète.** Ce qui bloque le lancement n'est plus du code : c'est un test de paiement de bout en bout, une relecture juridique, et un nom de domaine.

---

## Ce qui est en production

### Sécurité — le chantier le plus lourd, et le plus invisible

Cinq défauts corrigés, dont trois auraient été exploitables :

- **Fuite de données** — `GET /reservations/{id}` n'avait aucune autorisation. N'importe quel compte connecté lisait nom, email, dates et montant de n'importe quelle réservation en incrémentant l'identifiant.
- **Modération contournable** — les villas en attente ou rejetées restaient consultables par leur URL directe, ce qui vidait de sens la validation admin.
- **CORS ouvert à tous** — l'API acceptait n'importe quelle origine, jeton d'authentification compris.
- **Avis sans séjour** — n'importe qui notait n'importe quelle villa, y compris un propriétaire la sienne. La note moyenne est le principal signal de confiance : manipulable, elle détruit la crédibilité plus vite qu'elle ne la construit.
- **Sept vulnérabilités hautes** dans les dépendances, dont un contournement d'authentification par pollution de prototype dans `axios` — la bibliothèque qui porte le jeton sur chaque requête.

### Le bug qui coûtait le plus cher

`VillaController@index` ne renvoyait pas les prix. La carte de villa attendait `prix_min` ; l'API ne l'a jamais envoyé. Résultat : **une place de marché dont la grille de résultats n'affichait aucun prix.** Rien ne plantait, la carte omettait simplement le bloc — c'est ce qui l'a rendu invisible si longtemps.

### Trois incompatibilités PostgreSQL

La suite de tests tourne sur SQLite, la production sur PostgreSQL. Trois constructions passaient 100 tests et auraient renvoyé une erreur 500 en production :

1. Un alias de `SELECT` dans `HAVING` — refusé par PostgreSQL.
2. Un alias de `SELECT` dans une expression `ORDER BY` — même refus.
3. Une valeur liée par PDO comparée à une expression : SQLite la traitait comme du texte, et comme tout nombre y est inférieur à toute chaîne, **le filtre par note ne renvoyait jamais rien**, sur aucun moteur.

### Performance

`public/` est passé de **6,9 Mo à 370 Ko**. Le logo pesait 2 Mo pour un affichage de 36 px ; une vidéo de 5 Mo tournait en fond sur toutes les pages, y compris le tableau de bord — sur un forfait data payé au volume, c'est un coût réel pour le visiteur.

### Fonctionnel

Mot de passe oublié · vérification d'adresse · notifications de réservation · pages légales · recherche par dates réellement disponibles · état vide qui diagnostique quel filtre retirer · carte géographique · paiement PayDunya · sept catégories extensibles · châssis d'application avec navigation basse.

---

## Ce qui reste

### Bloquant pour ouvrir au public

**1. Le paiement n'a jamais été testé de bout en bout.** Le code est écrit, les clés sont en place, l'IPN rejette correctement une signature invalide — mais aucun franc n'a transité. `PAIEMENT_ACTIF` reste à `false`, et c'est volontaire.

**2. Les CGU affirment que la plateforme n'encaisse rien.** Dès l'ouverture du paiement, ce texte devient faux. C'est précisément ce qu'un agrégateur vérifie, et c'est aussi ce qui vous exposerait en cas de litige sur un remboursement.

**3. Pas de nom de domaine.** Il conditionne les emails avec SPF/DKIM, les aperçus de partage, et la crédibilité d'un lien envoyé sur WhatsApp.

### Important, non bloquant

**Le pré-rendu des fiches villa.** Les métadonnées sont posées en JavaScript, que les robots n'exécutent pas. Concrètement : partager une villa sur WhatsApp affiche le logo du site, jamais la photo ni le prix du bien. C'est la boucle de croissance la moins chère du produit, et elle reste à moitié cassée.

**Aucune supervision d'erreurs.** Une erreur en production est aujourd'hui invisible tant qu'un utilisateur ne la signale pas.

**`php artisan serve` en production.** C'est le serveur de développement de Laravel : mono-processus, non prévu pour ça. Il tient à faible trafic et lâchera au premier pic.

**Aucune sauvegarde vérifiée.** Railway sauvegarde peut-être ; personne n'a testé une restauration. Une sauvegarde non testée n'est pas une sauvegarde.

### Souhaitable

Boutique d'art · messagerie client-propriétaire · statistiques propriétaire · application mobile.

---

## Analyse d'architecture

### Modèle de données — le point fort

```
Villa → Logements → Formules tarifaires
        (unités réservables    (journée / demi-journée / nuitée / pass
         indépendamment)        × clim × buffet)
```

Une même villa loue la villa entière, une chambre, ou **la piscine seule à la journée**. Airbnb ne sait pas représenter ça. C'est le vrai avantage produit, et il est correctement modélisé depuis le départ.

La sortie des catégories vers une table est le bon geste : ajouter « studio meublé » est passé d'une mise en production à une ligne en base.

**Une réserve** : `logements.type` coexiste maintenant avec `logements.categorie_id`. La transition est volontaire, mais deux sources de vérité pour la même information finissent toujours par diverger. Il faut planifier la suppression de `type`.

### Base de données — la faiblesse la plus concrète

**`villas.statut`, `villas.ville` et `villas.vedette` sont filtrés à chaque recherche et ne sont pas indexés.** Sur vingt villas, invisible. Sur deux mille, c'est un parcours complet de table à chaque requête.

Le coût s'ajoute : la recherche exécute **six sous-requêtes corrélées par ligne** (prix minimum, note moyenne, capacité, piscine, climatisation, unité de prix), plus un tri par sous-requête. À douze résultats par page, environ quatre-vingts sous-requêtes par recherche. C'est correct aujourd'hui ; ça ne le restera pas.

`VillaController@destinations` fait une requête par ville dans une boucle — six villes, jusqu'à douze requêtes. Borné, mais c'est un N+1.

### Backend — sain

Douze contrôleurs, onze modèles, deux services, quatre notifications, deux policies. Le plus gros contrôleur fait 315 lignes ; aucun n'est hors de contrôle.

**139 tests pour 2 855 lignes de code applicatif** — un ratio inhabituel et sain. La logique de commission est couverte à dix cas, dont la vérification que les deux parts se somment toujours exactement au montant payé : un franc qui apparaît dans une répartition est une erreur comptable, pas un arrondi.

**Le point à surveiller** : la suite tourne sur SQLite quand la production est sur PostgreSQL. Trois bugs sont déjà passés à travers. Faire tourner la CI sur PostgreSQL est la seule vraie parade.

### Front — la dette est là

**384 blocs de style en ligne** subsistent. Les tokens existent et sont bons ; ils sont contournés dans les écrans privés. Le tableau de bord et l'administration n'ont reçu que l'alignement des boutons.

Deux fichiers dépassent 700 lignes — `VillaDetail` et `GererVilla`. Ils font trop de choses à la fois.

**Huit `catch` silencieux** subsistent, tous sur des chargements secondaires où l'échec est sans conséquence. Ils sont commentés, mais c'est une convention à tenir.

Point positif : **zéro `any`**, `eslint` à zéro, découpage du paquet effectif — Leaflet ne se télécharge que si l'on ouvre la carte.

### Sécurité — bon niveau, deux réserves

Autorisations vérifiées, CORS restreint, limitation de tentatives sur la connexion, réponse non énumérante sur le mot de passe oublié, IPN authentifiée par signature, réponse du prestataire masquée des API.

**Réserve 1** : le jeton vit dans `localStorage`, donc lisible par n'importe quelle faille XSS. Acceptable, à noter au registre des risques.

**Réserve 2** : `PhotoController@upload` accepte 20 Mo et vérifie le type MIME déclaré. Un fichier malveillant renommé passerait la validation — il ne serait pas exécuté, mais il serait servi.

### Exploitation — le maillon faible

| Point | État |
|---|---|
| Serveur applicatif | `php artisan serve` — développement |
| Supervision d'erreurs | Aucune |
| Sauvegardes | Non vérifiées |
| Cache de configuration | Vidé à chaque démarrage, jamais reconstruit |
| Fichiers orphelins | ~5,7 Mo encore hébergés sur Render |

### Mobile — abandonné en l'état

Vingt-et-un fichiers, Expo 54, jamais mis à jour depuis le début du chantier. Il pointe vers une API qui a changé : catégories, paiement, agrégats de prix. **Il ne fonctionnerait pas aujourd'hui.**

C'est une décision à prendre : le reprendre, ou l'assumer comme abandonné. Le laisser dans le dépôt sans le dire est le pire des trois.

---

## Recommandations, par ordre

Cet ordre est une séquence réelle : chaque étape débloque la suivante.

### 1. Tester un paiement de bout en bout

Passer `PAIEMENT_ACTIF=true`, faire une vraie réservation avec un numéro de test, vérifier que l'IPN confirme. Tant que ce n'est pas fait, tout le reste est théorique.

### 2. Faire relire les CGU sur le paiement

En parallèle, car cela dépend d'un tiers. Trois points : la plateforme encaisse désormais, la commission de 20 % / 10 % doit être annoncée, et le barème d'annulation devient opposable puisque vous détenez les fonds.

### 3. Indexer la base

Trois index sur `villas` — `statut`, `ville`, `vedette`. Dix minutes de travail, et la seule chose qui empêchera la recherche de s'effondrer en grandissant.

### 4. Brancher une supervision d'erreurs

Sentry ou équivalent. Sans cela, vous apprendrez vos pannes par vos clients.

### 5. Nom de domaine, puis emails sur domaine propre

Débloque les aperçus de partage et la délivrabilité.

### 6. Remplacer `php artisan serve`

PHP-FPM et Nginx, ou FrankenPHP. À faire avant toute campagne d'acquisition.

### 7. Pré-rendre les fiches villa

Pour que partager une villa affiche la villa, et que Google voie autre chose qu'une page vide.

### 8. Solder la dette front

Les 384 styles en ligne, les deux fichiers de 700 lignes, la suppression de `logements.type`.

---

## Ce que je ferais différemment

Trois choses que ce chantier a apprises et qui méritent d'être retenues :

**Tester sur le moteur de production.** Trois bugs PostgreSQL ont traversé cent tests parce que SQLite est plus permissif. C'est le défaut le plus coûteux de l'installation actuelle.

**Vérifier au navigateur, pas au raisonnement.** Le « 0 » affiché sur chaque carte, la note en « 4.5 » au lieu de « 4,5 », le responsive mobile non conforme — tous trouvés en regardant, aucun en relisant du code.

**Se méfier de ses propres captures.** Images en chargement différé et blocs à révélation au défilement paraissent absents en navigateur headless sans l'être. J'ai failli signaler deux faux bugs pour cette raison.
