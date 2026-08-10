# Ma Villa — Corrections appliquées

_9 août 2026 · Jalon 1 de `01-AUDIT-WEB.md`, pendant que la refonte visuelle part chez Claude Design._

**Cadrage retenu :** aucune décision de direction artistique n'a été prise ici — couleurs,
typographie et mise en page restent celles de l'existant, puisqu'elles relèvent du brief
`03-PROMPT-CLAUDE-DESIGN.md`. Tout ce qui suit est fonctionnel, sécurité, performance ou SEO.

**Vérifications :** `php artisan test` 95/95 · `npx tsc -b` propre · `npx eslint src` à zéro
(25 problèmes auparavant) · `npm run build` OK · pages publiques chargées en navigateur headless,
0 erreur console, 0 requête échouée.

---

## 1. Le bug qui coûtait le plus : le prix invisible

`VillaCard` attendait `prix_min`, `capacite`, `piscine`, `wifi`. L'API ne renvoyait rien de tout
cela et les colonnes n'existaient pas : le badge prix et la barre d'équipements étaient du code
mort. **La grille affichait des villas sans prix**, et le filtre « prix min / max » portait sur une
valeur que l'utilisateur ne voyait jamais.

- `Villa::tarifs()` — relation `hasManyThrough` vers les tarifs, à travers les logements.
- `VillaController@index` agrège désormais `prix_min`, `note_moyenne`, `avis_count`, `capacite_max`.
- `VillaCard` réécrite : prix « à partir de » mis en avant, note + nombre d'avis, capacité.
  Le nom et la ville sont sortis de la photo — posés en surimpression, ils étaient illisibles
  selon la luminosité de l'image.

Couvert par `test_public_listing_exposes_price_rating_and_capacity`.

## 2. Sécurité

| Faille | Correction |
|---|---|
| `GET /reservations/{id}` sans autorisation — n'importe quel compte lisait la réservation d'autrui (nom, email, montant) | `authorize('view')` + `ReservationPolicy::view` |
| `GET /villas/{id}` ne filtrait pas le statut — les villas en attente ou rejetées restaient publiques, vidant la modération de son sens | 404, sauf pour le propriétaire et l'admin (prévisualisation) |
| CORS `allowed_origins => ['*']` | Piloté par `FRONTEND_URLS`, motifs de dev seulement hors production |
| Avis déposables sans avoir séjourné, y compris par le propriétaire sur sa propre villa | Réservation `confirmee` **et terminée** exigée, + endpoint `avis/eligibilite` |
| Connexion sans limite de tentatives | 5 échecs par email+IP, puis blocage temporaire |
| Inscription acceptant `role=admin` | Rôle restreint à `client` / `proprietaire` |
| Upload de 100 Mo stocké brut | Plafond à 20 Mo, redimensionnement à 2000 px et réencodage JPEG via GD |

Le test `public can show any villa regardless of status` **assertait la faille** : il a été
remplacé par quatre tests qui vérifient le bon comportement.

## 3. Parcours manquants

- **Mot de passe oublié / réinitialisation.** `forgotPassword`, `resetPassword`, écrans
  `/mot-de-passe-oublie` et `/reinitialiser-mot-de-passe`. Réponse volontairement identique pour
  une adresse connue ou inconnue (sinon on peut énumérer les comptes). La réinitialisation
  révoque tous les jetons ouverts : c'est souvent un compte compromis.
- **Vérification d'adresse email.** Envoi à l'inscription, lien signé, `/email-verifie`, renvoi
  possible depuis le compte.
- **Notifications email, en français** — `NouvelleReservation` (au propriétaire),
  `ReservationMiseAJour` (au client), `ReinitialiserMotDePasse`, `VerifierAdresseEmail`.
  Un envoi qui échoue est journalisé sans faire échouer la réservation elle-même.
  Sans ces emails, une demande pouvait mourir en silence.

## 4. Réservation — garde-fous et lisibilité

- Règle de chevauchement de dates factorisée en scopes `Reservation::chevauchant()` /
  `bloquante()`, **partagée** par la création de réservation et la recherche par dates : une
  villa présentée comme libre reste réservable.
- Refus explicite si le logement est retiré, si la période est bloquée par le propriétaire,
  ou si le nombre de personnes dépasse la capacité.
- `GET /villas/{id}/occupation` expose les plages déjà prises. La fiche les affiche et signale
  le conflit **avant** soumission — le client découvrait le refus en 409 après coup.
- **Récapitulatif de prix** avant validation : prix unitaire × durée = total. Il validait
  jusqu'ici sans jamais voir le montant.

## 5. Recherche

- **Barre destination + dates + voyageurs sur l'accueil** — il n'y en avait aucune : le hero
  proposait « Voir les villas » et le visiteur devait ensuite trouver un panneau de filtres.
- Filtres serveur ajoutés : `date_debut`/`date_fin` (disponibilité réelle), `note_min`,
  `capacite`, `tri` (récent, prix croissant/décroissant, mieux notées).
- Les critères vivent dans l'URL : une recherche est partageable, rechargeable, et le retour
  navigateur fonctionne.

## 6. Poids : `public/` de 6,9 Mo à 901 Ko

| Avant | Après |
|---|---|
| `logo.png` **2,0 Mo** pour un rendu 36 × 36 px | `logo.webp` **16 Ko** (+ repli PNG, favicon, icône iOS) |
| `video_backgroud.mp4` **5,0 Mo**, autoplay sur **toutes** les routes sauf l'accueil, y compris `/login` et `/dashboard`, sous un voile opaque | `hero.mp4` **534 Ko**, uniquement sur le hero |
| Vidéo du hero servie depuis une **URL CloudFront tierce** héritée du gabarit de départ | Asset local ; la source 2560 px est archivée dans `media/`, hors dossier servi |

La vidéo ne se charge pas si `prefers-reduced-motion`, `saveData`, ou une connexion 2G/3G est
détectée : l'image d'affiche suffit. Ajouté aussi : code-splitting de `/dashboard` et `/admin`
(≈ 84 Ko différés), `loading="lazy"` et dimensions explicites sur les images.

## 7. SEO et partage

`index.html` n'avait **aucune** description, aucun Open Graph, et déclarait `lang="en"` sur un
site intégralement français. Une fiche villa envoyée sur WhatsApp — le canal principal sur ce
marché — s'affichait en URL nue.

- `lang="fr"`, description, Open Graph et Twitter Card par défaut.
- Composant `Seo` : titre, description, image, canonique et JSON-LD **par route**. La fiche villa
  utilise sa propre photo en image de partage et publie un `LodgingBusiness` avec prix et note.
- `robots.txt` (espaces privés exclus) et `sitemap.xml`.

Vérifié en navigateur : chaque route sert bien son titre, sa description et son canonique.

## 8. Erreurs et robustesse

- **11 `.catch(() => {})`** supprimés. `messageErreur()` traduit une erreur axios en français,
  en distinguant la panne réseau — fréquente en mobilité — d'une erreur serveur.
- `useRequete` : état unique données/chargement/erreur, annulation de la requête au démontage,
  et `reessayer()` pour offrir une sortie. Les écrans d'erreur ont désormais un bouton.
- Système de toasts et `ErrorBoundary` : une exception de rendu ne laisse plus une page blanche.
- Une 401 sur une page publique n'éjecte plus vers `/login` ; sur une page privée, elle y renvoie
  avec un paramètre `retour` qui ramène l'utilisateur là où il était.

## 9. Divers

- `prefers-color-scheme` respecté au premier chargement, et suivi tant que l'utilisateur n'a rien
  choisi. Le thème était figé sur clair.
- `FloatingInput` : le `<label>` n'était rattaché à aucun champ — les lecteurs d'écran annonçaient
  un champ sans nom. Corrigé avec `htmlFor` / `useId`, plus `aria-invalid` et `aria-describedby`.
- Pied de page unique et partagé, avec les liens légaux.
- **Pages légales** rédigées : CGU, confidentialité, politique d'annulation, mentions légales.
- `Ma-Villa/CLAUDE.md`, qui décrivait encore un projet « VEX Hero » sans rapport, réécrit.

---

## Ce qui reste bloquant pour le lancement

1. **Paiement Wave / Orange Money.** Table et modèle `Paiement` présents ; aucun contrôleur,
   aucune route, aucune interface. C'est l'avantage concurrentiel n°1 annoncé au document de
   référence, et sans lui la transaction continue de sortir vers WhatsApp.
2. **Textes légaux à compléter et à faire relire.** `src/pages/legal/contenu.ts` contient des
   mentions `[À COMPLÉTER]` (raison sociale, RCCM, NINEA, siège, hébergeurs, email de contact).
   Elles sont volontairement visibles pour qu'aucune page ne parte incomplète. Une relecture
   juridique est nécessaire — ces trames n'en tiennent pas lieu.
3. **Pré-rendu ou SSR des fiches villa.** Les métadonnées sont désormais correctes, mais un moteur
   de recherche qui n'exécute pas le JavaScript ne voit toujours rien. À traiter avant d'investir
   en acquisition.
4. Le domaine de production doit remplacer `mavilla.sn` dans `robots.txt` et `sitemap.xml`, et
   `FRONTEND_URL` / `FRONTEND_URLS` doivent être renseignés côté API.

Puis le Jalon 3 de l'audit : carte interactive sur la recherche, statistiques propriétaire,
messagerie client ↔ propriétaire, optimisation des images à l'upload.
