# Infrastructure et réglages

_Mis à jour le 31 août 2026. Ce document dit ce qui tourne, où, et quelles variables le
règlent. Il remplace le guide de mise en production du 9 août, dont tous les points
bloquants sont résolus._

---

## Où tourne quoi

| | |
|---|---|
| **Site** | https://passetemps.sn — servi par Render (`mavilla-web.onrender.com`) |
| **Interface applicative** | Railway — https://ma-villa-production.up.railway.app |
| **Base de données** | PostgreSQL, sur Railway |
| **Stockage des photos** | objet, hors du conteneur |
| **Paiement** | PayDunya (compte Business), Wave et Orange Money |

**Render redéploie tout seul** à chaque poussée sur `main`, en trois minutes environ.
**Railway aussi**, en général — mais il lui arrive de prendre son temps.

Pour savoir ce qui tourne réellement, sans deviner :
`https://ma-villa-production.up.railway.app/api/configuration` renvoie un champ
`version` qui porte l'empreinte du commit déployé.

⚠️ **Les deux ne sont jamais synchrones.** Il existe toujours une fenêtre où le site est
neuf et l'interface applicative ancienne. Le code est écrit pour la traverser sans
mentir sur les données ; c'est une contrainte à garder en tête pour toute évolution.

`start.sh` joue les migrations à chaque démarrage : rien à lancer à la main.

---

## Le nom de domaine

`passetemps.sn`, acheté chez **Wanekoo** le 31 août 2026, serveurs de noms par défaut
(`ns1.wanekoodns.net` / `ns2.wanekoodns.net`). **La zone se règle donc chez Wanekoo**,
pas chez Render.

| Nom | Type | Cible |
|---|---|---|
| `passetemps.sn` | `A` | l'IP affichée par Render dans *Settings → Custom Domains* |
| `www` | `CNAME` | `mavilla-web.onrender.com` |

**L'apex fait autorité, `www` redirige.** C'est Render qui pose la redirection, dès lors
que les deux noms sont déclarés chez lui. Le certificat est émis par Render, sans rien à
faire — mais seulement une fois la résolution effective.

⚠️ **`mavilla-web.onrender.com` reste vivant et doit le rester** : il sert de repli, et il
est encore inscrit dans `FRONTEND_URLS` ainsi que dans le repli en dur de
`config/cors.php`. Le nouveau domaine le masque, il ne le remplace pas.

⚠️ **L'interface applicative n'a pas été déplacée.** Elle reste sur
`ma-villa-production.up.railway.app`. Un `api.passetemps.sn` est possible — `CNAME` vers
cet hôte, Railway ne prenant pas l'apex — mais il obligerait à réinscrire l'URL de rappel
chez PayDunya et à republier l'application mobile, dont `PROD_URL` est figé dans l'APK
déjà distribué. À faire séparément, pas le jour de la bascule du site.

---

## Variables — Railway (interface applicative)

### Celles qui cassent le site si elles manquent

```
FRONTEND_URLS=https://passetemps.sn,https://www.passetemps.sn,https://mavilla-web.onrender.com
FRONTEND_URL=https://passetemps.sn
APP_ENV=production
APP_DEBUG=false
APP_KEY=<défini>
APP_URL=https://ma-villa-production.up.railway.app
DB_CONNECTION=pgsql
```

`FRONTEND_URLS` autorise le site à appeler l'interface applicative. Sans elle, seul
`localhost` est accepté et **le site ne peut plus rien charger**.

`FRONTEND_URL` est la cible des liens dans les courriels. Sans elle, un lien de
réinitialisation de mot de passe pointe vers `localhost` et ne fonctionne pour personne.

`APP_DEBUG` à `true` en production ferait fuir une trace complète à chaque erreur.

### Le courrier

```
MAIL_MAILER=<un vrai transport>
```

**Déterminant** : sans transport réel, la vérification d'adresse et la réinitialisation
de mot de passe ne partent pas. Prévoir un service transactionnel et un domaine
expéditeur signé (SPF/DKIM), sans quoi les courriels finissent en indésirables.

### Le paiement

```
PAIEMENT_ACTIF=true
PAYDUNYA_MODE=live
PAYDUNYA_MASTER_KEY=…
PAYDUNYA_PRIVATE_KEY=…
PAYDUNYA_PUBLIC_KEY=…
PAYDUNYA_TOKEN=…
```

La sonde `/admin/paiement` dit en une phrase si PayDunya répond, et distingue le cas
trompeur : une facture qui passe et un paiement direct qui tombe.

### Le reversement aux propriétaires

```
REVERSEMENT_AUTOMATIQUE=false
```

⚠️ **À passer à `true` le jour où PayDunya ouvre l'option de déboursement (PER)**, et rien
d'autre à faire : tout le code est écrit et testé. Voir
`09-DEMANDE-ACTIVATION-PER-PAYDUNYA.md`.

### Les notifications poussées

```
PUSH_ACTIF=true
VAPID_CLE_PUBLIQUE=…
VAPID_CLE_PRIVEE=…
VAPID_SUJET=mailto:contactsmavilla@gmail.com
```

La sonde `/admin/notifications` signe un vrai jeton — c'est la seule preuve que l'envoi
aboutit.

### La boutique

```
BOUTIQUE_ACTIVE=true
LIVRAISON_DAKAR=2000
LIVRAISON_REGIONS=5000
BOUTIQUE_PAIEMENT_LIVRAISON=true
```

À `false`, la boutique n'existe nulle part : ni menu, ni onglet, et les adresses
répondent « page introuvable ».

### Les règles métier, réglables sans redéployer

```
COMMISSION_TAUX_REDUIT=0.10
COMMISSION_TAUX_ELEVE=0.20
COMMISSION_SEUIL=50000
ANNONCE_PHOTOS_MAX=5
ANNONCE_REPERES_PRIX_MINIMUM=10
DELAI_REPONSE_HEURES=24
AUTH_INDICATIF_LOCAL=221
```

---

## Variables — Render (site)

```
VITE_API_URL=https://ma-villa-production.up.railway.app/api
VITE_SITE_URL=https://passetemps.sn
```

**Variables de build** : les changer exige un redéploiement, pas un redémarrage.

`VITE_SITE_URL` bascule tout le pré-rendu le jour du nom de domaine. Sans elle, c'est
l'adresse Render qui est employée partout — y compris dans le plan de site.

---

## Comptes de démonstration

Ils existent en production. **Leur mot de passe doit être posé par variable
d'environnement**, jamais laissé à sa valeur par défaut.

---

## Les pièges vérifiés

**La barre oblique finale est obligatoire** sur les adresses de fiches. Render applique
sa réécriture avant de résoudre l'index d'un dossier : `/villas/10` sert le gabarit
générique, `/villas/10/` sert la page pré-rendue.

**Composer réécrit la configuration git du dépôt.** Après toute manipulation de
`vendor/`, vérifier que `git remote -v` pointe bien vers le dépôt du projet — il a déjà
été détourné vers des dépôts tiers.

**Une adresse d'interface applicative ne s'ouvre pas dans la barre du navigateur.**
L'authentification passe par un jeton, jamais par un cookie : une adresse protégée
répond « non authentifié » même connecté dans l'application. Les sondes ont donc chacune
leur écran dans la console.
