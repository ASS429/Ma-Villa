# Ma Villa — Mise en production

_9 août 2026 · état de l'infrastructure et conditions de déploiement._

| | |
|---|---|
| Front | Render — https://mavilla-web.onrender.com (statique, `Ma-Villa/dist`) |
| API | Railway — https://ma-villa-production.up.railway.app (Docker, `php artisan serve`) |
| Base | Railway PostgreSQL — `monorail.proxy.rlwy.net` |
| Dépôt | https://github.com/ASS429/Ma-Villa |

Sondage du 9 août 2026 : `/up` → 200, `/api/villas` → 200 avec données, front → 200. **La production fonctionne.** Elle sert encore la version d'avant les corrections.

---

## ⛔ Avant tout : deux bugs PostgreSQL découverts grâce à cette information

Le code local et les tests tournent sur MySQL / SQLite ; la production est sur **PostgreSQL**. Deux constructions passaient les 100 tests et **auraient renvoyé une erreur 500 en production** :

1. `having('note_moyenne', …)` — PostgreSQL n'autorise pas un alias de `SELECT` dans `HAVING`.
   → `ERROR: column "note_moyenne" does not exist`
2. `orderByRaw('prix_min IS NULL, prix_min ASC')` — un alias de `SELECT` ne peut pas figurer
   **à l'intérieur d'une expression** `ORDER BY` sur PostgreSQL (seul un alias isolé est admis).
   → `ERROR: column "prix_min" does not exist`

Les deux sont corrigés : filtres et tris passent désormais par des sous-requêtes corrélées, valides sur les trois moteurs. Cinq tests couvrent maintenant le filtre par note et les trois tris — **leur absence est ce qui avait laissé passer ces bugs.**

Un troisième défaut a été trouvé au passage : la valeur du filtre de note, liée par PDO, arrivait en chaîne. Comparée à une expression (donc sans affinité de colonne), SQLite la traitait comme du texte — et comme tout nombre y est inférieur à toute chaîne, le filtre ne renvoyait **jamais** rien. Corrigé par un littéral numérique formaté avec `%F`, insensible à la locale.

> **Enseignement à retenir :** la suite de tests tourne sur SQLite, plus permissif que PostgreSQL.
> Elle ne peut pas garantir la compatibilité production. Faire tourner la CI sur PostgreSQL est
> la seule vraie parade.

---

## 🔴 Bloquant : les photos envoyées en production disparaissent

Le disque `local` écrit dans `storage/app/public` — **le système de fichiers du conteneur Railway, qui est éphémère.** À chaque redéploiement, il est réinitialisé.

Les photos de démonstration survivent uniquement parce que les 55 fichiers sont versionnés dans git et cuits dans l'image Docker (`COPY . .`). **Toute photo envoyée par un vrai propriétaire est perdue au déploiement suivant** : la ligne en base subsiste, l'image renvoie 404, et l'annonce se retrouve sans visuel.

Sur une place de marché où la photo est le premier argument de vente, c'est éliminatoire.

**Correction :** basculer sur un stockage objet. Le disque `s3` est déjà configuré dans `config/filesystems.php` ; il suffit de renseigner les variables et de passer `FILESYSTEM_DISK=s3`.

| Option | Remarque |
|---|---|
| **Cloudflare R2** | Compatible S3, pas de frais de sortie — le plus adapté ici |
| Backblaze B2 | Compatible S3, très bon marché |
| AWS S3 | Standard, frais de sortie facturés |

Il faudra aussi migrer les fichiers existants et réécrire les URL en base.

---

## Variables d'environnement à définir

### ⚠️ Railway (API) — à faire **avant** de déployer les corrections

`FRONTEND_URLS` pilote désormais le CORS, qui était ouvert à `*`. **Si la variable n'est pas définie, seul `localhost` est autorisé et le site de production ne peut plus appeler l'API.** C'est la première chose à régler.

```
FRONTEND_URLS=https://mavilla-web.onrender.com
FRONTEND_URL=https://mavilla-web.onrender.com
```

`FRONTEND_URL` est la cible des liens dans les emails. Sans elle, les liens de réinitialisation de mot de passe pointent vers `localhost:5173` et ne fonctionnent pour personne.

À vérifier également :

```
APP_ENV=production
APP_DEBUG=false          # sinon une trace complète fuit à chaque erreur
APP_KEY=<défini>
APP_URL=https://ma-villa-production.up.railway.app
DB_CONNECTION=pgsql
MAIL_MAILER=<un vrai transport>   # les emails ajoutés sont inutiles sinon
```

**`MAIL_MAILER` est déterminant** : les notifications de réservation, la réinitialisation de mot de passe et la vérification d'adresse ne partiront pas tant qu'un transport réel n'est pas configuré. Le `.env` local est sur `log`. Prévoir un service transactionnel (Resend, Brevo, Postmark, Mailgun) et un domaine expéditeur avec SPF/DKIM — sans quoi les emails finiront en indésirables.

### Render (front)

```
VITE_API_URL=https://ma-villa-production.up.railway.app/api
```

Variable de build : un changement exige un redéploiement.

### Fichiers à mettre à jour

`Ma-Villa/public/robots.txt` et `Ma-Villa/public/sitemap.xml` contiennent `https://mavilla.sn`. À remplacer par le domaine réellement servi.

---

## Durcissement recommandé

| Point | Constat | Correction |
|---|---|---|
| Serveur applicatif | `php artisan serve` — serveur de développement, mono-processus, non prévu pour la production | PHP-FPM + Nginx, ou FrankenPHP / RoadRunner |
| `x-powered-by: PHP/8.4.23` | Version de PHP divulguée | `expose_php = Off` |
| HSTS | Absent | En-tête `Strict-Transport-Security` |
| Cache de configuration | `start.sh` fait `config:clear` à chaque démarrage, jamais `config:cache` | Ajouter `config:cache` et `route:cache` après les migrations |
| `db:seed --force` au démarrage | Idempotent (le seeder s'arrête si des villas existent), donc sans danger | À retirer une fois de vraies annonces en ligne |
| Sauvegardes | Non vérifiées | Activer les sauvegardes PostgreSQL sur Railway et **tester une restauration** |
| Journalisation des erreurs | Aucun agrégateur | Sentry ou équivalent : sans cela, une erreur en production est invisible |

---

## Verdict

Il faut distinguer deux questions.

**« Ce lot est-il déployable ? »** — Oui. Il est strictement meilleur que ce qui tourne : la fuite de données sur les réservations est colmatée, le prix s'affiche enfin, le poids des pages passe de 6,9 Mo à 900 Ko, les aperçus WhatsApp fonctionnent. Sous réserve de définir `FRONTEND_URLS` **avant** de déployer, sinon le site est coupé de son API.

**« La plateforme est-elle prête pour le marché ? »** — Non, et cela ne tient pas à la qualité du code :

1. **Aucun paiement.** Wave et Orange Money sont l'avantage concurrentiel n°1 annoncé au document de référence. Sans eux, la transaction sort vers WhatsApp — le problème même que le projet veut résoudre.
2. **Les photos des propriétaires disparaissent** à chaque déploiement (§ ci-dessus).
3. **Aucun email ne part** tant que `MAIL_MAILER` n'est pas configuré : la boucle de réservation reste ouverte.
4. **Textes légaux incomplets** — mentions `[À COMPLÉTER]` et relecture juridique en attente. Les agrégateurs de paiement les exigent à l'ouverture du compte marchand.

Les points 2 et 3 sont des tâches d'infrastructure, réalisables en une journée. Le point 1 est un vrai chantier. Le point 4 dépend d'un tiers, donc à lancer dès maintenant en parallèle.

**Ordre suggéré :** stockage objet et transport email (infrastructure) → paiement (développement) → mentions légales et relecture (en parallèle, dès aujourd'hui).

---

## Procédure de déploiement

### Ordre : l'API d'abord, le front ensuite

Vérifié en conditions réelles : le front construit avec les nouveautés, branché sur l'API de
production actuelle, appelle `/api/villas/{id}/occupation` et `/api/configuration` qui n'y
existent pas encore. Il **dégrade proprement** — le calendrier d'occupation est simplement
masqué, le paiement reste annoncé comme à venir — mais deux 404 s'affichent en console.
Déployer l'API en premier évite cet intervalle.

### Étapes

1. **Sur Railway, avant tout :**
   ```
   FRONTEND_URLS=https://mavilla-web.onrender.com
   FRONTEND_URL=https://mavilla-web.onrender.com
   MAIL_MAILER=<transport réel>   + MAIL_HOST / MAIL_USERNAME / MAIL_PASSWORD
   MAIL_FROM_ADDRESS=contact@<votre domaine>
   APP_DEBUG=false
   ```
   Sans `FRONTEND_URLS`, le CORS bloque le site. Sans `MAIL_MAILER`, aucun email ne part.

2. **Stockage objet** (peut suivre, mais avant toute mise en ligne réelle) :
   créer le bucket, renseigner les variables `AWS_*`, passer `MEDIA_DISK=s3`,
   puis transférer l'existant :
   ```
   php artisan mavilla:migrer-medias --simulation
   php artisan mavilla:migrer-medias
   ```

3. Vérifier `VITE_API_URL` sur Render, et remplacer `mavilla.sn` dans `robots.txt` et
   `sitemap.xml` par le domaine réellement servi.

4. Déployer l'API, attendre qu'elle réponde, puis déployer le front.

5. **Contrôle après mise en ligne** — la commande fait le tour toute seule :
   ```
   php artisan mavilla:diagnostic --email=vous@exemple.sn
   ```
   Elle vérifie la base et son pilote, l'accès en lecture-écriture au disque média (et alerte
   si les photos partent sur un disque éphémère), l'état de la file d'attente, le transport
   email, et envoie un message de test.

   Puis à la main :
   - `/api/villas` renvoie `prix_min` et `note_moyenne` ;
   - `/api/villas?tri=prix_asc` et `?note_min=4` répondent 200, pas 500 (correctifs PostgreSQL) ;
   - une fiche villa partagée sur WhatsApp affiche photo, titre et prix ;
   - un mot de passe oublié envoie un email dont le lien ne pointe pas vers `localhost` ;
   - une photo envoyée depuis l'espace propriétaire survit à un redéploiement.

---

## Ce qui a été ajouté pour la production

| Sujet | Apport |
|---|---|
| Stockage | Disque `media` configurable (`MEDIA_DISK`), redimensionnement effectué **avant** l'envoi — indispensable avec un stockage objet, où aucun fichier local n'existe après coup |
| Migration | `php artisan mavilla:migrer-medias` transfère les fichiers et réécrit les URL en base |
| Emails | Worker de file d'attente lancé au démarrage : les notifications implémentent `ShouldQueue` et `QUEUE_CONNECTION=database`, elles s'empilaient donc dans la table `jobs` **sans jamais partir**, et sans la moindre erreur visible |
| Diagnostic | `php artisan mavilla:diagnostic` couvre les pannes silencieuses : email non parti, disque éphémère, worker arrêté |
| Paiement | Annoncé dans l'interface, inactif tant que `PAIEMENT_ACTIF=false`. `/api/configuration` permet de l'activer sans redéployer le front |
| Textes légaux | Bandeau « document en cours de validation » sur les pages légales, retirable via `TEXTES_PROVISOIRES` dans `src/pages/legal/contenu.ts` |
