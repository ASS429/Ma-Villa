# Être sur Google — état et marche à suivre

_Écrit le 2 septembre 2026. **Les sections 8 et 9, du 23 septembre, disent l'état
courant** — les sections 1 à 3 décrivent un site qui n'avait encore aucune annonce._

---

## En un coup d'œil

| | |
|---|---|
| **Le site est techniquement prêt** | rien ne bloque un moteur, tout est vérifié en ligne |
| **Il manque une seule action** | déclarer le site à Google, dix minutes, chez vous |
| **Il manque surtout du contenu** | zéro annonce publiée : Google n'aurait que 7 pages à lire |
| **Le délai n'est pas négociable** | quelques jours à trois semaines avant d'apparaître |

---

## 1. Ce qui est déjà en place

Vérifié sur `passetemps.sn` le 2 septembre, pas supposé.

| | |
|---|---|
| `robots.txt` | autorise l'exploration, ferme la console, l'espace personnel et le tunnel de paiement |
| `sitemap.xml` | présent, sur le bon domaine, régénéré à chaque déploiement |
| Adresse canonique | chaque page déclare son adresse unique — pas de contenu compté deux fois |
| Titre et description | propres à chaque page, y compris chaque fiche d'hébergement |
| Données structurées | `WebSite` sur l'accueil, `Product` avec prix sur chaque fiche |
| `www` | redirige vers l'adresse courte, en 301 — une seule adresse fait autorité |
| HTTPS | actif |

Autrement dit : **il n'y a rien à réparer**. Ce qui suit n'est pas du rattrapage.

---

## 2. Ce qui manque : dire à Google que le site existe

Google finit par trouver un site seul, par les liens qui pointent vers lui. Un site
neuf, sans aucun lien entrant, peut attendre des semaines. La déclaration raccourcit
cette attente et — c'est le vrai bénéfice — vous donne le tableau de bord qui dit
**ce que Google a lu, ce qu'il a refusé, et sur quelles recherches on vous trouve**.

### Étape 1 — Créer la propriété

Aller sur [search.google.com/search-console](https://search.google.com/search-console),
se connecter avec le compte Google du projet.

Deux formulaires sont proposés. Choisir celui de **gauche, « Domaine »**, et saisir :

```
passetemps.sn
```

Google affiche alors un enregistrement à ajouter au DNS, de cette forme :

```
Type : TXT
Nom  : @
Valeur : google-site-verification=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Étape 2 — Poser l'enregistrement dans Cloudflare

⚠️ **Pas chez Wanekoo.** Wanekoo a vendu le domaine, mais les serveurs de noms sont
ceux de Cloudflare (`fish.ns.cloudflare.com`, `jaime.ns.cloudflare.com`, vérifié le
2 septembre) : c'est **Cloudflare** qui répond aux questions sur `passetemps.sn`, et un
enregistrement ajouté dans l'espace Wanekoo ne serait jamais lu.

Donc : tableau de bord Cloudflare → domaine `passetemps.sn` → **DNS** → **Add record**.

| Champ | Valeur |
|---|---|
| Type | `TXT` |
| Name | `@` |
| Content | la ligne `google-site-verification=…` fournie par Google |
| TTL | Auto |

Ajouter **à côté** des enregistrements existants. Ne rien supprimer : ceux qui sont
déjà là font vivre le site et le courrier.

Puis revenir sur Search Console et cliquer **Valider**. Sur Cloudflare la propagation
est habituellement affaire de minutes ; si la validation échoue du premier coup, ce
n'est généralement pas une erreur, c'est trop tôt — réessayer un peu plus tard.

> **Pourquoi cette voie plutôt qu'un fichier à déposer ?** Elle vérifie le domaine
> entier d'un coup : l'adresse courte, `www`, et tout sous-domaine à venir — dont
> `api.passetemps.sn` le jour où l'interface applicative déménagera. Aucun déploiement
> n'est nécessaire, et la vérification ne peut pas se perdre à la prochaine mise en ligne.
>
> **Si l'accès à Cloudflare manque**, le repli existe : choisir « Préfixe d'URL », méthode
> « Balise HTML », copier le jeton, le poser dans la variable `VITE_GOOGLE_VERIFICATION`
> du panneau Render, et **relancer un déploiement** — c'est une variable de compilation,
> elle n'a d'effet qu'au build suivant.

### Étape 3 — Soumettre le plan de site

Une fois la propriété validée : menu **Sitemaps**, saisir `sitemap.xml`, envoyer.

### Étape 4 — Demander la lecture de l'accueil

Coller `https://passetemps.sn/` dans la barre de recherche en haut de Search Console,
puis **Demander l'indexation**. C'est la seule page qui mérite qu'on force le passage.

---

## 3. Le vrai obstacle : il n'y a rien à indexer

> _Dépassé._ Au 23 septembre, le plan de site compte **22 adresses**, dont dix
> hébergements et quatre articles. Cette section garde la trace de l'état de départ.

Le plan de site compte **7 adresses**. Sept.

| | |
|---|---|
| L'accueil | 1 |
| La liste des hébergements | 1, **et elle est vide** |
| La boutique | 1, **et elle est vide** |
| Les quatre pages légales | 4, dont les descriptions disent « en cours de rédaction » |

Aucune fiche d'hébergement n'y figure, pour une raison simple : **aucune annonce n'est
publiée**. Elles ont été repassées en brouillon avant l'ouverture, ce qui était le bon
choix — mais tant que ça dure, Google n'a que la façade à se mettre sous la dent.

Un site qu'on cherche par son nom (« passetemps sénégal ») sortira. Un site qu'on
cherche par ce qu'il vend (« location villa Saly piscine ») ne sortira pas : cette
recherche-là se gagne avec des fiches, leurs photos, leurs prix et leurs villes.

**La conséquence pratique :** déclarer le site aujourd'hui est utile — le compte est
ouvert, le suivi commence, l'attente initiale est purgée. Mais le référencement
démarrera réellement le jour de la première annonce publiée, et **au déploiement
suivant**, puisque les fiches sont écrites à la compilation (voir plus bas).

---

## 4. À savoir : une annonce publiée n'entre pas seule dans le plan de site

Les fiches sont écrites **au moment du déploiement**, pas à la demande. Une villa
publiée cet après-midi est visible immédiatement pour un visiteur, mais son adresse
n'entre au plan de site — et son aperçu WhatsApp n'existe — **qu'au déploiement
suivant**.

C'est un choix assumé, documenté dans `Ma-Villa/scripts/prerendu.mjs`. Le piège s'est
produit le 5 septembre 2026 : trois annonces publiées, **une seule** au plan de site.
Les deux autres servaient le gabarit de l'accueil et déclaraient l'accueil comme
adresse canonique — elles disaient donc à Google de ne pas les indexer.

**C'est maintenant automatique.** Voir la section suivante.

---

## 4 bis. Le redéploiement automatique

`.github/workflows/redeploiement-si-necessaire.yml` s'exécute **chaque nuit à 3 h**
(heure de Dakar) et fait ceci :

1. il réveille l'API — Railway s'endort entre deux visites ;
2. il compare les annonces publiées aux fiches présentes dans le plan de site en ligne ;
3. **s'il n'y a rien de neuf, il ne fait rien** ;
4. sinon il demande à Render de reconstruire le site.

> ⚠️ **Il ne déploie jamais à l'aveugle, et c'est le point important.** Reconstruire
> pendant que l'API dort écrirait les pages fixes **sans les fiches**, tout en gardant
> le plan de site qui, lui, les annonce encore : on détruirait de bonnes pages en
> silence. Si l'API ne répond pas après cinq tentatives, le travail **échoue
> bruyamment** et aucun déploiement n'est demandé. GitHub vous envoie alors un
> courriel.

### Ce que vous devez faire une seule fois

Sans ça, le travail nocturne échouera dès qu'il aura quelque chose à déployer.

1. **Render** → service `mavilla-web` → **Settings** → section **Deploy Hook** →
   copier l'adresse (elle ressemble à `https://api.render.com/deploy/srv-…?key=…`)
2. **GitHub** → dépôt `ASS429/Ma-Villa` → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**
   - Name : `RENDER_DEPLOY_HOOK`
   - Secret : coller l'adresse
   - **Add secret**

Cette adresse est un mot de passe : quiconque l'a peut déclencher vos déploiements.
Elle n'a sa place que dans les secrets GitHub, jamais dans le code.

### Le lancer à la main

Onglet **Actions** du dépôt → **Redéploiement si nécessaire** → **Run workflow**.
C'est le moyen le plus court de rafraîchir le site juste après une salve de
publications, sans ouvrir Render.

Une case **« Reconstruire même si rien ne semble avoir changé »** est proposée.
Laissée décochée, le travail ne fait rien s'il n'y a rien de neuf — c'est le cas
courant. Cochée, il reconstruit dans tous les cas : utile après une modification
qui ne se voit pas dans le plan de site, par exemple un prix ou une photo changés
sur une annonce déjà en ligne.

> Le forçage passe outre la comparaison, **jamais le réveil de l'API**. Si Railway
> ne répond pas, le travail s'arrête avant de demander quoi que ce soit à Render,
> case cochée ou non.

---

## 5. Combien de temps

| | |
|---|---|
| Validation de la propriété | quelques minutes à quelques heures (DNS) |
| Première lecture par Google | 1 à 3 jours après la soumission du plan de site |
| Apparition sur le nom « PasseTemps » | quelques jours à deux semaines |
| Apparition sur « location villa Saly » | **des mois**, et seulement avec des annonces |

Rien de tout cela ne s'achète ni ne s'accélère. Les offres de « référencement garanti
en 48 h » achètent des liens que Google sanctionne.

---

## 6. Ce qui viendra ensuite, quand il y aura du contenu

Rien de ceci n'est urgent aujourd'hui ; tout devient utile dès les premières annonces.

- **Des pages par ville** — « Villas à Saly », « Villas à Mbour », « Locations à Dakar ».
  C'est le levier le plus rentable : ce sont les mots réellement tapés, et une page par
  ville vaut mieux qu'une liste filtrable qu'aucun moteur ne sait explorer.
- **Des liens depuis vos propres canaux** — la page Facebook, la signature de vos
  courriels, les groupes WhatsApp professionnels.
- **Des liens entrants** — annuaires touristiques sénégalais, pages Facebook, groupes
  WhatsApp. Un lien depuis un site déjà connu vaut plus que n'importe quel réglage.

---

## 7. Ce qui a été fait dans le dépôt le 2 septembre

Tout est dans `Ma-Villa/scripts/prerendu.mjs`, sauf mention contraire.

**Ce qui était demandé**

- La balise de vérification Google est posée si `VITE_GOOGLE_VERIFICATION` existe, et
  **rien n'est écrit** sinon. `Ma-Villa/.env.production` documente la variable.
- `/boutique` entre au plan de site — elle en était absente.
- Les **fiches d'œuvres** sont pré-rendues comme les villas : titre, artiste, prix,
  photo, et une offre `Product` qui distingue *disponible* de *vendu*. `/boutique/12`
  partagé sur WhatsApp s'affichait jusqu'ici sans titre ni photo ni prix.
- Boutique fermée (`BOUTIQUE_ACTIVE=false`), ni `/boutique` ni aucune fiche n'entrent au
  plan de site — le code décidait déjà que ces adresses ne doivent alors pas exister,
  le plan de site le respecte maintenant aussi.

**Trois défauts trouvés en testant, et corrigés**

| | |
|---|---|
| **Le filet du plan de site ne tenait rien** | En cas d'API endormie, le script promettait de « conserver le plan précédent ». Mais `vite build` **vide `dist/`** juste avant — vérifié avec un témoin qui n'a pas survécu. Il n'y avait jamais rien à conserver : **un seul déploiement lancé pendant que Railway dormait sortait toutes les fiches du plan de site.** Le plan déjà en ligne est maintenant repris. |
| **Les données structurées se cumulaient** | Relancé sans reconstruction (`npm run prerendu`), le script relisait un gabarit qu'il avait lui-même écrit : chaque fiche héritait du bloc de l'accueil **en plus** du sien. Constaté sur une fiche de test. L'en-tête repart maintenant toujours à zéro. |
| **Une lecture d'`.env.production` cassée** | Introduite par moi dans la première version de ce chantier : une expression régulière assemblée dans un littéral gabarit, où `\s` avec un seul antislash devient la lettre « s », sans erreur. Lecture ligne à ligne désormais. |

**Comment ça a été testé**

Une API factice a servi à éprouver ce que la production ne montre pas, faute de
contenu : boutique ouverte avec deux œuvres dont une vendue, boutique fermée en 404,
API injoignable avec et sans plan de site en ligne. Les guillemets dans un nom
d'artiste et un `<script>` dans une description ont été passés exprès : la page reste
du HTML valide.

Voir aussi `docs/05-INFRASTRUCTURE.md`, section « Le nom de domaine ».

---

## 8. Le 23 septembre : Google avait tout détecté, et rien lu

Le rapport d'indexation exporté ce jour-là dit une chose, et une seule :

| | |
|---|---|
| Pages dans l'index | **1** |
| Pages « Détectée, actuellement non indexée » | **15** |
| Impressions du 1er au 18 septembre | 29, entre 0 et 5 par jour |

« Détectée, actuellement non indexée » signifie que Google **connaît** l'adresse — il l'a
lue dans le plan de site — mais **ne l'a jamais explorée**. En trois semaines, pas une
seule fiche n'a été visitée. Ce n'est ni une panne ni une sanction : c'est ce qui arrive
à un site dont rien n'indique qu'il vaut le déplacement.

### La cause, mesurée

Le HTML livré ne contenait **rien**. Le corps d'une fiche faisait 151 caractères —
`<div id="root">` vide et un `<noscript>` — et comptait **zéro lien**. Nos vingt-deux
adresses n'étaient donc connues que par le plan de site, et **aucune page n'en désignait
une autre**. Un moteur juge l'importance d'une page au nombre et à la qualité des liens
qui pointent vers elle : toutes les nôtres valaient zéro.

Googlebot exécute le JavaScript, mais dans une file d'attente séparée où les sites sans
autre signal passent en dernier. Nous étions exactement dans ce cas.

### Ce qui a été fait

Chaque page pré-rendue porte maintenant, dans le corps, ce que l'application affiche une
seconde plus tard : un titre, la ville ou l'artiste, la photo, le prix, la description —
et **les liens**. L'accueil en compte 22, une fiche 15, un article 12.

Vérifié au navigateur, scripts bloqués et service worker désinscrit : la page s'affiche
proprement, aux couleurs du site. Vérifié aussi que `createRoot().render()` remplace bien
ce corps au montage — il ne vit que pour les robots et pour le visiteur qui attend.

Le plan de site porte en plus un `lastmod` **vrai**, pris sur la date de modification de
chaque fiche. Les pages fixes n'en ont pas : un `lastmod` pris en défaut fait ignorer tous
les autres.

### Ce qu'il faut faire, et attendre

1. Dans Search Console, **Inspecter l'URL** → `https://passetemps.sn/` → *Demander
   l'indexation*. Puis la même chose pour `https://passetemps.sn/hebergements/`. Deux
   suffisent : les liens internes mèneront Google au reste.
2. Attendre. Un changement de ce type se lit en une à trois semaines, pas en deux jours.
3. Réexporter le rapport d'indexation début octobre. Ce qu'il faut y voir : la colonne
   « Dans l'index » qui monte, et « Détectée, actuellement non indexée » qui descend.

### Ce qui reste, et qui n'est pas technique

⚠️ **La ville est du texte libre, et Saly s'écrit de cinq façons** — « Saly », « Saly
bambara », « Saly velingara », « Saly derrière rdc », « Mbour Saly ». Pour Google comme
pour un visiteur qui filtre, ce sont cinq destinations différentes, et notre marché
principal est donc éclaté en cinq. Le chantier qui range tout cela est écrit et testé
depuis le 12 septembre, **mais pas déployé** : sa migration réécrit les annonces de vrais
propriétaires et attend un accord explicite. C'est le préalable aux pages par ville.

---

## 9. Le 23 septembre, suite : une page par destination

Les villes rangées (voir la section précédente), chaque ville réellement pourvue a
désormais **son adresse à elle** :

```
https://passetemps.sn/destinations/saly/
https://passetemps.sn/destinations/dakar/
https://passetemps.sn/destinations/thies/
https://passetemps.sn/destinations/ziguinchor/
```

Pourquoi un chemin et pas un filtre : la liste savait déjà afficher « Hébergements à
Saly », mais à l'adresse `/hebergements?ville=Saly`. Un paramètre de requête **ne se
pré-rend pas** — le site est statique, il sert un fichier par chemin — donc cette page
n'entrait pas au plan de site et Google n'en voyait que le gabarit. Or « location villa
Saly » est exactement ce que les gens tapent.

Ces pages sont construites **sur les annonces publiées**, jamais sur la liste des villes
connues : une destination sans annonce ferait douter du reste. Elles apparaissent et
disparaissent donc toutes seules, au rythme des publications.

Le plan de site compte maintenant **26 adresses**.

### Trois défauts trouvés en les construisant

| | |
|---|---|
| **Le prix d'une destination était faux** | Il était pris sur l'annonce choisie pour la photo, pas sur la ville. Juste tant qu'une ville n'avait qu'une annonce ; avec cinq à Saly, l'accueil annonçait « à partir de 160 000 FCFA » quand la moins chère est à **17 000**. C'est une promesse de prix, et elle faisait fuir. |
| **La liste se déclarait à la mauvaise adresse** | L'application annonçait `/villas` comme adresse de référence — l'ancienne route, qui redirige — et contredisait le HTML pré-rendu. C'est la version rendue que Google retient. |
| **Une destination sans réponse s'affichait vide** | Tant que la configuration n'était pas arrivée, la page montrait « Hébergements à » sans ville, en se déclarant indexable. Trouvé au navigateur, pas autrement. |

### Ce que vous pouvez faire

Ces quatre adresses sont les meilleures candidates à une demande d'indexation, après
l'accueil. Dans Search Console, **Inspecter l'URL** puis *Demander l'indexation* :

```
https://passetemps.sn/destinations/saly/
```

C'est la page qui porte le plus d'annonces, et « Saly » la requête la plus disputée.
