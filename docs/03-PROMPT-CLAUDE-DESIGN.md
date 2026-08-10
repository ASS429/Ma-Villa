# Prompt pour Claude Design — Refonte Ma Villa (web)

**Mode d'emploi.** Le bloc ci-dessous est autonome : il ne suppose aucun accès au dépôt. Copiez-le tel quel dans Claude Design.

- Si vous voulez livrer écran par écran, gardez tout le préambule (§A→§F) et ne conservez que l'écran voulu dans §G.
- Le §H propose une direction artistique alternative — à utiliser **à la place** de §C si vous voulez explorer une rupture plutôt qu'une évolution.
- Les valeurs de couleur du §C sont déjà corrigées pour passer WCAG AA (les valeurs actuelles du produit échouent — voir `01-AUDIT-WEB.md` §6.6).

---

## ▼▼▼ DÉBUT DU PROMPT — COPIER À PARTIR D'ICI ▼▼▼

Tu es le designer produit de **Ma Villa**. Je veux une refonte complète du design de la plateforme web, livrée sous forme de design system + écrans haute-fidélité. Tout l'écrit doit être en français.

---

### A. Le produit

**Ma Villa** est une marketplace de location de villas et de logements de vacances au Sénégal, concentrée sur **Saly-Portudal, Mbour et Dakar**.

**Le problème qu'elle résout.** Aujourd'hui, dans cette zone, les villas se louent par WhatsApp et par téléphone. Le client ne sait pas ce qui est libre à ses dates, les tarifs ne sont ni standardisés ni publics, et les propriétaires n'ont aucun outil pour gérer leur activité. Aucune plateforme locale n'existe.

**Le positionnement, face à Airbnb :**

1. **Ultra-locale** — Saly, Mbour, Dakar. Elle connaît le marché, pas l'inverse.
2. **Paiement mobile money** — Wave et Orange Money, ce que les gens utilisent réellement. Pas de carte bancaire obligatoire.
3. **Un modèle de location plus souple** — c'est la vraie différence produit, détaillée juste en dessous.
4. **Accessible aux propriétaires non-technophiles** — beaucoup n'ont jamais géré d'annonce en ligne.

**Le modèle de location — à comprendre avant de dessiner quoi que ce soit.**

Une **villa** est un bien. Elle contient un ou plusieurs **logements**, qui sont les unités réservables indépendamment :

- villa entière
- appartement
- chambre
- **piscine seule** ← on peut réserver uniquement la piscine, à la journée

Chaque logement a plusieurs **formules tarifaires**, combinables :

- type : journée · demi-journée · nuitée · pass
- options : avec/sans climatisation, avec/sans buffet

Concrètement, une même villa peut afficher : « Chambre, nuitée avec clim — 35 000 FCFA », « Villa entière, journée avec buffet — 250 000 FCFA », « Piscine seule, demi-journée — 15 000 FCFA ». Airbnb ne sait pas représenter ça.

**Ce modèle est l'avantage concurrentiel n°1. Il doit être lisible, pas enterré dans un menu déroulant.** C'est le principal défi de design du projet : rendre une grille de tarifs multi-dimensionnelle immédiatement compréhensible, y compris pour quelqu'un qui n'a jamais réservé en ligne.

---

### B. Les utilisateurs

**1. Le client** — sénégalais résidant ou membre de la diaspora, ou touriste. Cherche une villa pour un week-end, des vacances, ou un événement familial (baptême, anniversaire — d'où la location « piscine seule » ou « journée »). **Majoritairement sur mobile, souvent sur un réseau lent et une data payée au volume.** Il arrive fréquemment par un lien WhatsApp partagé par un proche.

Ses questions, dans l'ordre : *C'est où ? Combien ? C'est libre à mes dates ? À quoi ça ressemble ? Est-ce que c'est fiable ?*

**2. Le propriétaire** — possède une ou plusieurs villas à Saly ou Mbour. **Souvent peu à l'aise avec le numérique.** Il doit pouvoir publier un bien, définir des tarifs complexes, bloquer des dates et répondre à une demande sans jamais se sentir perdu. Il consulte souvent depuis son téléphone.

**3. L'administrateur** — valide chaque villa avant mise en ligne, modère les avis, supervise. Interface dense assumée, il est sur ordinateur.

---

### C. Direction artistique — évolution, pas rupture

Le produit a déjà une identité que je veux **garder et affirmer** : sable chaud, terre cuite, or. Un registre éditorial, hôtelier, chaleureux — l'inverse du bleu générique de la tech. Elle est juste, mais elle est mal appliquée : styles incohérents d'un écran à l'autre, aucun composant réutilisable, contrastes insuffisants.

**Ta mission : transformer cette intuition esthétique en système rigoureux.**

#### Palette — thème clair

```
--bg            #F7F4EF   fond de page, sable très clair
--bg-surface    #FFFFFF   cartes, panneaux
--bg-elevated   #F0EDE6   encarts internes
--text-1        #1A1614   texte principal (brun-noir, jamais de noir pur)
--text-2        #5C5650   texte secondaire
--text-3        #726A62   texte tertiaire  ← corrigé pour AA, ne pas éclaircir
--border        rgba(0,0,0,.08)
--accent        #A34D1F   terracotta        ← corrigé pour AA, ne pas éclaircir
--accent-soft   #E8845A   terracotta clair — décoratif uniquement, jamais sous du texte
--accent-gold   #8A6A12   or — badges « Vedette », distinctions
--gold-soft     #D4A843   or clair — décoratif uniquement (dégradés, liserés)
--success       #1F7A4F
--warning       #9A5203
--danger        #C42020
```

Ratios vérifiés sur `--bg` sable et sur blanc : `text-2` 6,6/7,2 · `text-3` 4,8/5,3 · `accent` 5,3 (et 5,8 en blanc sur bouton) · `gold` 4,6/5,1 · `success` 4,8 · `warning` 5,3 · `danger` 5,4. Tous ≥ 4,5:1.

#### Palette — thème sombre

```
--bg            #0C0A08   presque noir, teinté chaud
--bg-surface    #161210
--bg-elevated   #1E1A17
--text-1        #F5F0EB
--text-2        #A69E97
--text-3        #8A837D
--border        rgba(255,240,220,.10)
--accent        #E8845A
--accent-gold   #E8C060
--success       #34D399
--warning       #FBBF24
--danger        #F87171
```

Ratios vérifiés sur `--bg-surface` : `text-2` 7,1 · `text-3` 5,0 · `accent` 7,0 (et 6,7 en `--text-1` sur bouton accent). Tous ≥ 4,5:1.

**Contrainte ferme : tout couple texte/fond atteint WCAG AA — 4,5:1 en texte courant, 3:1 en texte large.** L'accent en fond de bouton avec du texte blanc doit atteindre 4,5:1. La version actuelle échoue sur ces points ; ta refonte ne doit pas.

#### Typographie

- **Display — Cormorant Garamond** (serif). Titres de page, titre hero, wordmark, valeurs de statistiques. Graisses 300–400, `letter-spacing` négatif (−0,02 à −0,04em).
- **Interface — DM Sans**. Tout le reste : corps, libellés, boutons, navigation, tableaux.

Livre une **échelle typographique explicite et nommée** (display / h1 / h2 / h3 / body-lg / body / body-sm / label / caption), avec taille, graisse, interlignage et interlettrage pour chaque niveau, en mobile et en desktop. Aujourd'hui chaque page réinvente ses tailles — c'est ce que je veux supprimer.

#### Formes et profondeur

- Rayons : 8 px (petits éléments) · 12 px (boutons, champs) · 16 px (cartes, panneaux) · plein (pastilles, avatars). Pas d'autres valeurs.
- Ombres : 4 niveaux, définis séparément pour le clair et pour le sombre.
- **Une seule** recette d'effet verre, réservée aux surfaces posées sur une photo ou une vidéo. Aujourd'hui il en existe quatre — ramène-les à une.

#### Le ton

Chaleureux et confiant, jamais tape-à-l'œil. On vend un séjour, pas un logiciel. La photo est la vedette : l'interface l'encadre, elle ne rivalise pas avec elle. Générosité dans les blancs, densité seulement là où c'est utile (dashboard, admin).

---

### D. Contraintes non négociables

1. **Mobile d'abord, réseau lent.** Dessine le mobile en premier ; le desktop est l'élargissement. Chaque écran doit rester utile sur un rendu 360 px de large. Pas de vidéo décorative en fond, pas d'image lourde qui ne porte aucune information. Un écran qui n'est beau qu'en fibre est un écran raté.
2. **Français intégral.** Y compris les états vides, les erreurs et les micro-textes.
3. **FCFA, format `120 000 FCFA`.** Jamais de décimales. Le montant est une donnée de première importance : il doit être typographiquement fort.
4. **Thème clair et thème sombre, tous deux complets.** Le clair est le défaut, mais le premier chargement doit respecter la préférence système.
5. **WCAG AA.** Contrastes, cibles tactiles ≥ 44 px, focus visible au clavier, hiérarchie de titres correcte.
6. **Un seul en-tête**, avec deux variantes (posé sur une photo / posé sur un fond uni). Pas deux composants distincts comme aujourd'hui.
7. **Un seul bouton primaire**, dans la couleur d'accent. Aujourd'hui quatre styles coexistent et l'action « Réserver » n'utilise même pas la couleur de marque — c'est le principal défaut à corriger.
8. **Zéro valeur codée en dur.** Chaque couleur, espacement, rayon, ombre vient d'un token nommé.
9. **Le mouvement sert la compréhension.** Transitions courtes (150–300 ms), respect de `prefers-reduced-motion`. Pas de transition de page plein écran : la version actuelle impose 720 ms de rideau noir à chaque clic, c'est à supprimer.

---

### E. Le système de composants à livrer

Chacun avec **tous** ses états : repos, survol, focus clavier, actif, désactivé, chargement, erreur. En clair **et** en sombre.

**Primitifs** — Button (primaire / secondaire / discret / danger, en 3 tailles, avec ou sans icône) · Input · Textarea · Select · DatePicker (plage de dates, avec dates indisponibles grisées) · Stepper numérique (nombre de personnes) · Checkbox · Radio · Toggle · Badge (statut + « Vedette ») · Avatar · Spinner · Skeleton · Tooltip.

**Composés** — Carte de villa · Barre de recherche (destination + dates + voyageurs) · Panneau de filtres (barre sur desktop, feuille modale sur mobile) · Carte tarifaire (le composant qui rend lisible logement × formule × options) · Carte de réservation, côté client et côté propriétaire · Carte d'avis + saisie d'une note · Galerie photo + lightbox · Modale · Feuille modale mobile · Toast · État vide · État d'erreur avec bouton « Réessayer » · Pagination · Carte de statistique · Élément de navigation latérale · Barre d'action mobile fixe.

**Structures** — En-tête public (2 variantes) · Pied de page · Coquille de dashboard (navigation latérale 240 px, tiroir sous 1024 px) · Coquille d'administration.

---

### F. Ce qu'il faut explicitement supprimer

Ces éléments existent aujourd'hui. Ils sont à retirer, pas à améliorer :

- La vidéo décorative en fond sur les pages applicatives (connexion, dashboard, admin) — 5 Mo pour une couche masquée par un voile opaque.
- Le mode de thème global qui réécrit toute la palette selon la présence d'une vidéo. Le fond vidéo doit être un composant local du hero, rien de plus.
- Le rideau noir plein écran à chaque navigation (720 ms).
- Le titre hero animé caractère par caractère.
- Les quatre recettes d'effet verre concurrentes.
- Le second en-tête, doublon du premier avec une identité de marque différente.

---

### G. Les écrans à concevoir

Chacun en **mobile (375 px) et desktop (1440 px)**, avec les états vide / chargement / erreur quand ils s'appliquent.

#### G1 — Accueil `/` 🔴 priorité maximale

Aujourd'hui, le hero propose « Voir les villas » et « Publier ma villa ». **Il n'y a aucune recherche.** C'est le défaut le plus coûteux du produit.

À concevoir :

- Un hero avec une **barre de recherche comme élément central** : destination (Saly · Mbour · Dakar · Ziguinchor) + dates d'arrivée et de départ + nombre de voyageurs + bouton Rechercher. Sur mobile, ce bloc se replie en un champ unique qui ouvre une feuille modale plein écran.
- Une image de fond forte, mais **une image, pas une vidéo** — et légère.
- Accès rapides par destination, avec une photo par ville.
- Villas en vedette — 3 à 6 cartes.
- Un bloc « comment ça marche », en 3 étapes, orienté client.
- Un bloc destiné aux propriétaires : « Publiez votre villa », avec l'argument de revenu.
- Signaux de confiance : villas vérifiées par l'équipe, paiement Wave et Orange Money, avis réels.
- Pied de page avec navigation, contact, et **liens légaux (CGU, confidentialité, politique d'annulation)**.

#### G2 — Recherche `/villas` 🔴 priorité maximale

- Barre de recherche persistante en haut, reprenant les critères saisis.
- Filtres : ville · **plage de dates** · fourchette de prix en FCFA · type de logement (villa entière / appartement / chambre / piscine) · note minimale · options (clim, buffet, piscine). Barre horizontale sur desktop, feuille modale sur mobile avec un compteur de filtres actifs.
- Grille de cartes de villa. **Chaque carte doit afficher le prix.** Aujourd'hui elle ne l'affiche pas — c'est un bug majeur, et le prix doit être un élément de premier plan dans ton design.
- Anatomie de la carte : photo, nom, ville, note + nombre d'avis, **prix à partir de + unité (par nuit / par journée)**, 2 ou 3 équipements clés, badge « Vedette », bouton favori.
- Basculement liste / carte géographique (marqueurs à Saly, Mbour, Dakar).
- États : chargement en squelettes · aucun résultat, avec suggestion d'élargir les critères · erreur réseau avec « Réessayer ».
- Pagination.

#### G3 — Fiche villa `/villas/:id` 🔴 priorité maximale

L'écran le plus important : c'est celui qu'on partage sur WhatsApp et celui qui convertit.

- Galerie photo — une principale + une mosaïque, lightbox au clic, gestion des vidéos. Compteur de photos.
- Titre, ville, note, nombre d'avis, bouton favori, bouton partager.
- Propriétaire : nom, badge « Vérifié », photo, ancienneté sur la plateforme.
- Description.
- **Le bloc logements & tarifs — le cœur du design.** Il faut rendre lisible, d'un seul coup d'œil : quels logements sont disponibles dans cette villa, quelles formules pour chacun (journée / demi-journée / nuitée / pass), et l'effet des options (clim, buffet) sur le prix. Un tableau brut ne conviendra pas sur mobile. **Propose deux approches différentes et argumente celle que tu recommandes.**
- Équipements, sous forme d'icônes + libellés.
- Carte de localisation.
- Avis : note moyenne, répartition par étoile, liste, formulaire de dépôt.
- **Panneau de réservation** — collant à droite sur desktop, barre fixe en bas + feuille modale sur mobile. Contient : choix du logement, choix de la formule, dates (avec les indisponibilités visibles), nombre de personnes, **récapitulatif de prix détaillé** (prix unitaire × durée = total en FCFA), bouton « Réserver ».
- Le parcours de paiement : choix entre **Wave** et **Orange Money**, écran de confirmation, écran d'échec.
- Politique d'annulation, visible avant validation.

#### G4 — Authentification `/login`, `/register` 🟠

- Connexion, inscription, **mot de passe oublié**, **réinitialisation**, **vérification d'email** (ces trois derniers écrans n'existent pas aujourd'hui).
- À l'inscription : choix explicite entre « Je cherche une villa » et « Je loue ma villa », présenté comme deux cartes, pas comme un menu déroulant.
- Messages d'erreur en français, précis, sous le champ concerné.

#### G5 — Espace propriétaire `/dashboard` 🟠

Rappel : **cet utilisateur n'est pas technophile.** Chaque écran doit avoir une action évidente et une seule.

- Accueil : revenus du mois, taux d'occupation, demandes en attente (mises en avant si > 0), prochaines arrivées.
- Mes villas : liste avec le statut de modération (en attente / validée / rejetée).
- **Publication d'une villa — assistant en étapes**, avec progression visible : informations générales → localisation → photos → logements → tarifs → publication. Aujourd'hui c'est un formulaire unique de 300 lignes ; c'est là que le propriétaire abandonne.
- **Gestion des tarifs** — l'écran le plus difficile. Le propriétaire doit définir, par logement, un prix pour chaque combinaison formule × clim × buffet. Trouve une représentation qu'un utilisateur non technique comprend sans explication.
- **Calendrier de disponibilités** — vue mensuelle, blocage de plages de dates, distinction visuelle entre réservé et bloqué manuellement.
- Demandes de réservation : accepter / refuser, avec les coordonnées du client et le détail du séjour.
- Profil.

#### G6 — Espace client `/dashboard` 🟠

- Mes réservations, réparties en à venir / passées / annulées, avec le statut et le montant.
- Détail d'une réservation : récapitulatif, statut du paiement, contact du propriétaire, annulation.
- Favoris.
- Profil.

#### G7 — Administration `/admin` 🟡

Interface dense, desktop en priorité.

- Tableau de bord : utilisateurs, villas, réservations, revenus, villas en attente de validation.
- File de validation des villas : prévisualisation, valider / rejeter avec motif, mettre en vedette.
- Utilisateurs : recherche, filtre par rôle, suspension.
- Modération des avis : signalés en premier.

#### G8 — Transverse 🟡

- 404 et 500.
- Pages légales : CGU, confidentialité, politique d'annulation, mentions légales.
- États hors ligne / réseau lent.
- Modèles d'emails transactionnels : nouvelle demande (propriétaire), réservation confirmée (client), réservation refusée, paiement reçu, rappel de séjour, réinitialisation de mot de passe. **En français, lisibles sur mobile.**
- L'aperçu de partage (Open Graph) d'une fiche villa : photo, nom, ville, prix, note. C'est ce que voit quelqu'un à qui on envoie le lien sur WhatsApp — le principal canal d'acquisition. Traite-le comme un écran à part entière.

---

### Ce que j'attends en retour

1. **Les tokens de design**, complets, en clair et en sombre, sous forme de variables CSS nommées, prêtes à l'implémentation.
2. **La bibliothèque de composants** du §E, chaque composant avec tous ses états.
3. **Les écrans** du §G, en mobile et desktop.
4. Pour chaque décision structurante (l'affichage des tarifs, la barre de recherche, l'assistant de publication) : **explique ton raisonnement en deux ou trois phrases.** Je dois pouvoir défendre ces choix, pas seulement les appliquer.
5. Signale-moi tout endroit où mon brief te semble faux ou contradictoire. Je préfère un désaccord argumenté à une exécution docile.

Commence par me proposer les tokens et l'anatomie de la carte de villa, puis l'accueil. On validera avant d'aller plus loin.

## ▲▲▲ FIN DU PROMPT ▲▲▲

---

## H. Variante — direction artistique de rupture

_À utiliser **à la place** du §C si vous voulez explorer autre chose que l'évolution de l'existant. Le reste du prompt (§A, §B, §D→§G) reste identique._

> **Direction artistique — repartir de zéro.**
>
> Oublie la palette actuelle. Je veux une identité neuve, ancrée dans une esthétique **sénégalaise contemporaine** — pas folklorique, pas « africain décoratif », pas de motifs plaqués. Pense à l'architecture moderne de Dakar, au design ouest-africain d'aujourd'hui, à la lumière de la Petite Côte.
>
> Propose-moi **trois directions distinctes**, chacune avec : une palette complète (clair + sombre, WCAG AA), un appariement de polices, un principe de forme, un principe photographique, et **la même carte de villa dessinée dans les trois** pour que je puisse comparer sur un objet identique.
>
> Contraintes : le résultat doit rester chaleureux et digne de confiance (on vend un séjour), fonctionner en majorité sur mobile bas de gamme, et laisser la photographie dominer. Évite le bleu corporate générique du secteur du voyage.

---

## Rappel — les correctifs qui ne relèvent pas du design

Un beau design ne compensera pas ces points ; ils sont à traiter en parallèle (détails et emplacements dans `01-AUDIT-WEB.md`) :

1. L'API ne renvoie pas le prix des villas — **la carte ne peut pas l'afficher, même parfaitement dessinée.**
2. Aucun paiement implémenté.
3. Aucune notification email.
4. Pas de réinitialisation de mot de passe.
5. Deux failles d'autorisation à corriger avant ouverture publique.
6. 7 Mo d'assets décoratifs (logo de 2 Mo, vidéo de 5 Mo) à supprimer ou compresser.
7. Aucune meta Open Graph — les partages WhatsApp n'affichent aucun aperçu.
