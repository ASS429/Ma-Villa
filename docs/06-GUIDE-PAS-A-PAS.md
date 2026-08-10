# Ma Villa — Guide pas à pas de mise en production

_10 août 2026 · à suivre dans l'ordre. Cochez au fur et à mesure._

Ce guide couvre uniquement ce que **vous** devez faire : ce qui relève du code est déjà fait
et poussé sur la branche `preparation-lancement`.

**Déjà fait de votre côté :**
- [x] `FRONTEND_URLS` et `FRONTEND_URL` sur Railway
- [x] `VITE_API_URL` sur Render

---

## Étape 1 — Fusionner la branche et déployer

**Durée : 10 min (dont ~5 min de déploiement automatique)**

### 1.1 Créer la pull request

Ouvrez : **https://github.com/ASS429/Ma-Villa/pull/new/preparation-lancement**

- Titre : `Préparation au lancement`
- Cliquez **Create pull request**, puis **Merge pull request** → **Confirm merge**

> Vous pouvez aussi fusionner en local :
> ```bash
> git checkout main
> git merge preparation-lancement
> git push origin main
> ```

### 1.2 Surveiller les deux déploiements

La fusion déclenche Render **et** Railway en même temps.

| Service | Où regarder | Signe que c'est bon |
|---|---|---|
| Railway | onglet **Deployments** → **View logs** | `==> Démarrage du serveur sur le port …` |
| Render | onglet **Events** / **Logs** | `Your site is live` |

Railway (Docker) met 3 à 5 minutes, Render 2 à 3 minutes.

**L'API doit idéalement finir avant le front.** Si le front passe en premier, ce n'est pas
grave : il affiche « Tarif sur demande » et masque le calendrier de disponibilités le temps
que l'API suive. Vérifié, aucune page ne casse.

### 1.3 Ce que vous devez voir dans les logs Railway

Le démarrage lance maintenant un diagnostic automatique. Vous devriez lire :

```
✓ Base accessible (pgsql)
✓ Stockage « public » accessible en lecture et écriture
! MEDIA_DISK vaut « public » : les photos sont écrites sur le disque du conteneur…
✓ File d'attente : database
✓ 0 tâche(s) en attente
! MAIL_MAILER vaut « log » : aucun email ne part réellement…
```

Les deux `!` sont **attendus** : ils correspondent aux étapes 3 et 5 ci-dessous.

- [ ] Pull request fusionnée
- [ ] Railway déployé, logs sans erreur
- [ ] Render déployé

---

## Étape 2 — Vérifier que le déploiement est sain

**Durée : 5 min**

Ouvrez ces adresses dans votre navigateur. Les trois premières sont les **correctifs
PostgreSQL** : si elles répondent, le bug qui aurait planté la production est bien corrigé.

| # | Adresse | Ce que vous devez voir |
|---|---|---|
| 1 | `https://ma-villa-production.up.railway.app/api/villas` | Du JSON contenant `"prix_min"` et `"note_moyenne"` |
| 2 | `https://ma-villa-production.up.railway.app/api/villas?tri=prix_asc` | Du JSON, **pas** une page d'erreur |
| 3 | `https://ma-villa-production.up.railway.app/api/villas?note_min=4` | Du JSON, **pas** une page d'erreur |
| 4 | `https://ma-villa-production.up.railway.app/api/configuration` | `{"paiement":{"actif":false,…}}` |
| 5 | `https://mavilla-web.onrender.com/` | La barre de recherche dans le bandeau d'accueil |
| 6 | `https://mavilla-web.onrender.com/villas` | **Des prix affichés sur les cartes** |

> ⚠️ Si les points 2 ou 3 renvoient une erreur 500, arrêtez-vous et prévenez-moi :
> cela signifierait qu'une requête SQL reste incompatible avec PostgreSQL.

### Le test qui compte vraiment

Envoyez-vous à vous-même, **sur WhatsApp**, le lien d'une villa :

```
https://mavilla-web.onrender.com/villas/1
```

Vous devez voir apparaître un aperçu avec **la photo, le nom et la ville**. C'est le canal
d'acquisition principal — s'il fonctionne, le travail SEO est validé.

- [ ] Les 6 vérifications passent
- [ ] L'aperçu WhatsApp affiche photo et titre

---

## Étape 3 — Stockage des photos (Cloudflare R2)

**Durée : 30 min · 🔴 à faire avant d'ouvrir aux vrais propriétaires**

Aujourd'hui, une photo déposée par un propriétaire est écrite sur le disque du conteneur
Railway, **qui est effacé à chaque déploiement**. La photo disparaît, l'annonce se retrouve
sans visuel. Les photos de démonstration survivent seulement parce qu'elles sont dans le
dépôt git.

R2 est recommandé : compatible S3, et **sans frais de sortie** — ce qui compte quand on sert
des photos à répétition.

### 3.1 Créer le bucket

1. Créez un compte sur **https://dash.cloudflare.com** (gratuit).
2. Menu de gauche → **R2 Object Storage** → **Create bucket**.
3. Nom : `mavilla-medias`. Emplacement : laissez **Automatic**.
4. **Create bucket**.

### 3.2 Rendre le bucket public

1. Ouvrez le bucket → onglet **Settings**.
2. Section **Public Access** → **R2.dev subdomain** → **Allow Access**, confirmez.
3. Notez l'adresse obtenue, de la forme :
   ```
   https://pub-xxxxxxxxxxxxxxxx.r2.dev
   ```

> Cette adresse `r2.dev` est limitée en débit par Cloudflare et n'est pas prévue pour un
> gros trafic. Elle convient parfaitement pour démarrer. **Quand vous aurez votre nom de
> domaine** (étape 5), remplacez-la par un sous-domaine à vous, par exemple
> `medias.mavilla.sn` — c'est un réglage dans ce même onglet, section **Custom Domains**.

### 3.3 Créer les clés d'accès

1. Toujours dans R2, menu de droite → **Manage R2 API Tokens** → **Create API Token**.
2. Nom : `mavilla-api`.
3. Permissions : **Object Read & Write**.
4. **Specify bucket** → `mavilla-medias`.
5. **Create API Token**.
6. Notez immédiatement les trois valeurs affichées — **le secret ne sera plus jamais visible** :
   - `Access Key ID`
   - `Secret Access Key`
   - `Endpoint` (de la forme `https://<identifiant_compte>.r2.cloudflarestorage.com`)

### 3.4 Renseigner les variables sur Railway

Railway → votre service → onglet **Variables** → **New Variable**, une par une :

| Variable | Valeur |
|---|---|
| `MEDIA_DISK` | `s3` |
| `AWS_ACCESS_KEY_ID` | l'Access Key ID de l'étape 3.3 |
| `AWS_SECRET_ACCESS_KEY` | le Secret Access Key |
| `AWS_BUCKET` | `mavilla-medias` |
| `AWS_DEFAULT_REGION` | `auto` |
| `AWS_ENDPOINT` | l'Endpoint de l'étape 3.3 |
| `AWS_URL` | l'adresse publique de l'étape 3.2 (`https://pub-….r2.dev`) |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` |

Railway redéploie automatiquement après le dernier enregistrement.

> `AWS_URL` est **indispensable** : c'est elle qui construit les adresses publiques des
> photos. Sans elle, les images ne s'afficheraient pas.

### 3.5 Vérifier

Dans les logs de démarrage Railway, l'alerte doit avoir changé :

```
✓ Stockage « s3 » accessible en lecture et écriture
```

Si vous lisez une erreur à la place, une clé est erronée — reprenez l'étape 3.3.

### 3.6 Transférer les photos existantes

Les photos de démonstration pointent encore vers l'ancien disque. Une commande les déplace
et met à jour les adresses en base.

**Installer le CLI Railway** (une seule fois) :

```bash
npm install -g @railway/cli
railway login
```

Puis, depuis le dossier `backend/` du projet :

```bash
railway link                                     # choisir le projet Ma Villa
railway run php artisan mavilla:migrer-medias --simulation
```

La simulation n'écrit rien : elle liste ce qui serait transféré. Si le résultat vous paraît
correct, lancez le vrai transfert :

```bash
railway run php artisan mavilla:migrer-medias
```

Vous devez lire `Transférées : N · ignorées : 0 · échecs : 0`.

### 3.7 Le test qui valide tout

1. Connectez-vous sur le site en propriétaire.
2. Publiez une villa avec une photo.
3. Sur Railway, onglet **Deployments** → **Redeploy**.
4. Rouvrez la fiche de la villa : **la photo doit toujours être là.**

C'est exactement ce qui échouait avant.

- [ ] Bucket créé et rendu public
- [ ] Clés créées et notées
- [ ] Variables renseignées sur Railway
- [ ] Diagnostic : `✓ Stockage « s3 »`
- [ ] Photos existantes transférées
- [ ] Test de survie au redéploiement réussi

---

## Étape 4 — Remettre les documents juridiques

**Durée : 10 min · à lancer dès aujourd'hui, le délai dépend d'un tiers**

Dans le dossier `docs/juridique/` :

| Fichier | À faire |
|---|---|
| `NOTE-AU-JURISTE.md` | À lire d'abord, puis à transmettre |
| `1-Conditions-generales-utilisation.docx` + `.pdf` | |
| `2-Politique-de-confidentialite.docx` + `.pdf` | |
| `3-Politique-d-annulation.docx` + `.pdf` | |
| `4-Mentions-legales.docx` + `.pdf` | |

Envoyez **les Word** (modifiables) et **les PDF** (lecture confortable) à votre associé.

**Les informations à lui fournir**, sans quoi il ne pourra pas compléter les 14 mentions
surlignées : dénomination sociale, forme juridique, RCCM, NINEA, adresse du siège, nom du
directeur de la publication, adresse email de contact à publier.

**Trois points méritent vraiment son attention** — ils sont détaillés dans la note :
1. Les formalités auprès de la CDP (déclaration ou autorisation préalable ?).
2. L'hébergement des données **hors du Sénégal** (Render et Railway sont en Europe et aux
   États-Unis).
3. L'opposabilité du barème d'annulation, alors que la plateforme n'encaisse aucun paiement.

**À réception de sa version**, prévenez-moi : j'intègre les textes dans
`Ma-Villa/src/pages/legal/contenu.ts` et je retire le bandeau « document en cours de
validation ». Les pages du site et les documents Word sont générés depuis la même source,
il n'y a donc aucun risque de divergence.

- [ ] Documents envoyés
- [ ] Informations d'entreprise transmises

---

## Étape 5 — Nom de domaine, puis emails

**Durée : 1 h + délai de propagation DNS (2 à 24 h)**

Vous avez choisi d'attendre un domaine avant de configurer les emails. C'est cohérent —
mais lisez d'abord l'encadré ci-dessous, car cela a une conséquence immédiate.

> ### ⚠️ Sans email, deux choses ne fonctionnent pas
>
> 1. **Un utilisateur qui oublie son mot de passe est bloqué définitivement.** Il n'existe
>    aucun autre moyen de le réinitialiser.
> 2. **Un propriétaire n'est jamais prévenu d'une demande de réservation.** Il doit ouvrir
>    son tableau de bord de lui-même. Une demande peut donc rester sans réponse.
>
> Tant que c'est le cas, **ne communiquez pas publiquement sur la plateforme.** Vous pouvez
> déployer, tester, faire essayer à des proches — mais pas lancer.
>
> **Solution d'attente si vous voulez ouvrir plus tôt** (30 min, sans domaine) : Brevo
> permet de valider une **adresse expéditrice seule**, sans posséder le domaine. Créez un
> compte sur brevo.com, validez votre adresse Gmail dans **Senders**, récupérez les
> identifiants SMTP dans **SMTP & API**, et renseignez sur Railway :
> `MAIL_MAILER=smtp`, `MAIL_HOST=smtp-relay.brevo.com`, `MAIL_PORT=587`,
> `MAIL_USERNAME=<votre identifiant>`, `MAIL_PASSWORD=<votre clé>`,
> `MAIL_FROM_ADDRESS=<votre adresse validée>`.
> Les messages partiront depuis une adresse Gmail — moins professionnel, mais fonctionnel.
> Vous basculerez sur le domaine plus tard.

### 5.1 Acheter le domaine

| Extension | Où | Remarque |
|---|---|---|
| `.sn` | NIC Sénégal (nic.sn) | Ancrage local, le plus crédible ici |
| `.com` | Cloudflare Registrar, Namecheap | Moins cher, plus rapide à obtenir |

Le plus simple est de gérer le DNS chez **Cloudflare** (gratuit), quelle que soit
l'extension : vous y aurez déjà votre compte pour R2.

### 5.2 Brancher le domaine sur les services

**Render (le site)** : Settings → **Custom Domains** → **Add Custom Domain** →
`mavilla.sn` et `www.mavilla.sn`. Render affiche les enregistrements DNS à créer chez
Cloudflare.

**Railway (l'API)** : Settings → **Networking** → **Custom Domain** →
`api.mavilla.sn`. Railway affiche l'enregistrement CNAME à créer.

### 5.3 Mettre à jour les variables après bascule

| Service | Variable | Nouvelle valeur |
|---|---|---|
| Railway | `APP_URL` | `https://api.mavilla.sn` |
| Railway | `FRONTEND_URL` | `https://mavilla.sn` |
| Railway | `FRONTEND_URLS` | `https://mavilla.sn,https://www.mavilla.sn` |
| Render | `VITE_API_URL` | `https://api.mavilla.sn/api` |

Et dites-le-moi : je remplacerai `mavilla.sn` dans `robots.txt` et `sitemap.xml`, qui
contiennent encore une valeur provisoire.

### 5.4 Configurer les emails

Une fois le domaine actif, choisissez un service transactionnel — **Resend** (le plus
simple), Brevo, Postmark ou Mailgun.

1. Créez le compte, ajoutez le domaine `mavilla.sn`.
2. Le service affiche des enregistrements **SPF** et **DKIM** : créez-les chez Cloudflare.
   Sans eux, vos emails partent en indésirables.
3. Attendez la validation (quelques minutes à quelques heures).
4. Renseignez sur Railway : `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`,
   `MAIL_PASSWORD`, et `MAIL_FROM_ADDRESS=contact@mavilla.sn`.

### 5.5 Vérifier

```bash
railway run php artisan mavilla:diagnostic --email=votre@adresse.com
```

Vous devez lire `✓ Transport email : smtp` et **recevoir le message de test**. Vérifiez
aussi les indésirables : s'il y atterrit, c'est que SPF ou DKIM n'est pas encore propagé.

Puis testez le parcours réel : sur le site, **Connexion → Mot de passe oublié**. Vous devez
recevoir un email dont le lien ouvre bien la page de réinitialisation.

- [ ] Domaine acheté
- [ ] Domaine branché sur Render et Railway
- [ ] Variables mises à jour
- [ ] Service email configuré, SPF et DKIM validés
- [ ] Message de test reçu
- [ ] Parcours « mot de passe oublié » testé de bout en bout

---

## Étape 6 — Le paiement, quand vous aurez décidé

**Rien à faire pour l'instant.**

L'interface annonce « Wave et Orange Money bientôt disponibles » et précise que le règlement
se fait avec le propriétaire. Aucun bouton de paiement n'existe : personne ne peut être
induit en erreur.

Quand votre associé et vous aurez tranché, l'infrastructure est prête à recevoir
l'intégration : `config/paiement.php`, la variable `PAIEMENT_ACTIF`, l'endpoint
`/api/configuration` et le composant `MoyensPaiement`. Le passage à `true` suffira à faire
apparaître le parcours — **sans redéployer le front**.

Les trois voies possibles, pour information :

| Voie | Avantage | Inconvénient |
|---|---|---|
| **Agrégateur** (PayDunya, CinetPay) | Wave + Orange Money + carte via une seule intégration | Commission plus élevée |
| **API directes** Wave et Orange Money | Commission plus faible | Deux intégrations, dossier marchand pour chacune |
| **Mixte** | Wave en direct, le reste via agrégateur | Le plus de travail |

Dans tous les cas, l'ouverture d'un compte marchand exige des **CGU conformes** — d'où
l'importance de lancer l'étape 4 dès maintenant.

---

## Récapitulatif de l'ordre

```
1. Fusionner et déployer                    ← 10 min, maintenant
2. Vérifier le déploiement                  ← 5 min, dans la foulée
3. Stockage R2                              ← 30 min, avant les vrais propriétaires
4. Documents au juriste                     ← 10 min, à lancer aujourd'hui (délai externe)
5. Domaine puis emails                      ← avant toute communication publique
6. Paiement                                 ← quand la stratégie sera arrêtée
```

**Le seuil à retenir :** vous pouvez faire les étapes 1 à 3 et faire tester la plateforme à
des proches. Mais **ne communiquez pas publiquement avant l'étape 5** : sans email, un
utilisateur qui perd son mot de passe est définitivement bloqué, et un propriétaire ne sait
pas qu'on lui a demandé une réservation.

---

## En cas de problème

| Symptôme | Cause probable |
|---|---|
| Le site s'affiche mais aucune villa | CORS : vérifiez `FRONTEND_URLS` sur Railway, puis la console du navigateur (F12) |
| Erreur 500 sur `/api/villas?tri=…` | Incompatibilité SQL avec PostgreSQL — prévenez-moi |
| Les photos ne s'affichent plus après R2 | `AWS_URL` manquante ou erronée |
| `mavilla:migrer-medias` annonce des échecs | Fichiers absents du disque source ; les originaux ne sont pas supprimés, vous pouvez relancer |
| Emails non reçus | Vérifiez les indésirables, puis la propagation SPF/DKIM |
| Un doute quelconque | `railway run php artisan mavilla:diagnostic` |
