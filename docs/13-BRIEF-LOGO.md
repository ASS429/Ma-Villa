# Brief logo — PasseTemps

> Prompt à coller dans Claude Design. Tout ce qui suit est relevé du code réel
> (`Ma-Villa/src/index.css`, `Ma-Villa/src/components/Marque.tsx`,
> `Ma-Villa/public/manifest.webmanifest`), pas reconstitué de mémoire.

---

Tu redessines le logo de **PasseTemps**, une marketplace de location de logements
de vacances au Sénégal (Saly, Mbour, Dakar) qui ouvre au public. Le site existe et
son design system est arrêté : **le logo doit entrer dans le design, pas l'inverse.**
Ne propose rien qui demanderait de retoucher les couleurs ou les fontes du site.

## 1. Le produit, en trois phrases

On y loue une villa entière, un appartement, une chambre — **ou une piscine seule
à la journée**, pour une fête de famille. C'est l'écart avec Airbnb : on ne réserve
pas seulement un lieu, on réserve un **moment** (journée, demi-journée, nuitée,
pass), avec ou sans clim, avec ou sans buffet. Une boutique d'artisanat sénégalais
(bracelets, sandales, chemises, pièces d'art) s'ouvre sous la même marque.

Le nom dit le temps qu'on s'accorde, pas le mètre carré qu'on loue.
Baseline, à conserver telle quelle : **« Réservez. Séjournez. Vivez la teranga ! »**

## 2. Ce qui existe aujourd'hui, et pourquoi ça ne va plus

Le logo actuel : une **épingle de carte** terracotta contenant un cercle blanc et
une **maison** blanche ; à côté, « **Passe** » en terracotta (avec un pictogramme
de calendrier logé dans la boucle du P) et « **Temps** » en doré, souligné d'un
paraphe doré ; la baseline dessous en terracotta, dont la fin en cursive.

Six défauts constatés, à corriger :

1. **L'épingle + maison est le signe générique de l'immobilier.** Elle raconte
   « une adresse », quand la marque vend du temps passé quelque part. Elle ne dit
   rien de la piscine à la journée, ni de la boutique.
2. **Le calendrier dans le P meurt à 30 px.** Le logo est affiché à **30, 36 et
   72 px** dans l'application — jamais plus grand. Tout détail intérieur disparaît.
3. **Deux écritures se disputent le mot** : « Passe » et « Temps » n'ont ni la même
   couleur ni le même dessin, et la baseline en ajoute une troisième (cursive).
4. **L'icône et le mot ne parlent pas la même langue.** L'épingle est géométrique
   et froide, le mot est rond et manuscrit.
5. **Le fichier est une image à fond blanc opaque**, sans couche alpha
   (`logo.webp`, 256×256, RGB). Le site a un **thème sombre** : le logo y apparaît
   en tuile blanche découpée aux angles arrondis. C'est le défaut le plus visible.
6. **Il n'existe qu'en pixels.** Aucun SVG, donc aucun redimensionnement propre,
   aucune version monochrome, aucune déclinaison.

## 3. Le design system, à respecter au token près

**Couleurs — thème clair**

```
--bg            #F7F4EF   fond de page (blanc cassé chaud)
--bg-surface    #FFFFFF
--text-1        #1A1614   noir chaud
--accent        #A34D1F   terracotta — couleur de marque, theme_color du manifeste
--accent-hover  #8A3F19
--accent-soft   #E8845A   décoratif seulement, jamais sous du texte
--gold          #8A6A12
--gold-soft     #D4A843   décoratif seulement
```

**Couleurs — thème sombre** (le logo doit y tenir sans être retouché à la main)

```
--bg            #0C0A08
--text-1        #F5F0EB
--accent        #E8845A   l'accent s'éclaircit en sombre
--gold          #E8C060
```

Les contrastes du site sont calibrés WCAG AA (`--accent` sur `--bg` = 5,3:1).
**Ne pas éclaircir le terracotta** pour le thème clair.

**Typographie**

- Display : **Cormorant Garamond**, graisses 300 et 400, interlettrage serré
  (−0,02 à −0,04 em). C'est la fonte des titres **et du nom de marque**.
- Interface : **DM Sans**, 400 / 500 / 600.
- Pas d'autre fonte sur le site. Si le mot-symbole est lettré à la main, il doit
  rester parent de Cormorant Garamond — même axe humaniste, même finesse.

**Formes** : rayons 8 / 12 / 16 px et cercle. Ombres douces et chaudes.
L'esthétique du site est **calme, chaude, éditoriale** — beaucoup de blanc cassé,
de grandes photos, une typographie serif fine. Pas de néon, pas de dégradé criard,
pas de glassmorphisme sur la marque.

## 4. La contrainte technique n°1, à lire avant de dessiner

Dans l'application, la marque est un composant unique (`Marque.tsx`) :
**une image d'icône, suivie du mot « PasseTemps » rendu en texte vivant**, en
Cormorant Garamond 400, couleur `--text-1`, interlettrage −0,02 em.

Conséquences, non négociables :

- **L'icône doit fonctionner seule, à côté d'un texte qui n'est pas dessiné par
  toi.** Elle est le seul fichier chargé par le site (`logo.webp`).
- Le mot, dans l'interface, est **monochrome** et suit le thème : il devient clair
  sur fond sombre, et blanc avec une ombre quand il est posé sur une photo.
  Un mot-symbole bicolore ne survivra donc pas dans l'application — il ne vivra
  que sur les supports (réseaux, factures, enseigne).
- L'icône reçoit `border-radius: 12px` et `object-fit: contain`. Elle doit donc
  être **carrée** et soit à fond transparent, soit conçue comme une tuile pleine
  assumée aux angles arrondis. Tranche, et dis pourquoi.
- Écarts imposés : **10 px** entre l'icône et le mot, hauteur de clic minimale
  44 px.

## 5. Trois directions à explorer, une planche chacune

Ne présente pas une seule proposition. Dessine trois pistes complètes, jusqu'à
l'application réelle, puis recommande-en une et défends ce choix.

- **A — L'héritage tenu.** On garde l'épingle, mais on la redessine : trait unique,
  aucun détail intérieur en dessous de 30 px, et on lui fait dire le temps plutôt
  que l'adresse. Le risque assumé : rester dans le langage de l'immobilier.
- **B — Le temps.** Le signe part du nom : un arc de journée, un soleil bas, une
  course d'ombre, un cycle. Doit évoquer le séjour sans tomber dans l'horloge ni
  le sablier, qui disent l'attente et l'urgence — l'inverse du produit.
- **C — La teranga.** Un motif tiré de l'hospitalité et de l'artisanat sénégalais
  (tissage, natte, calebasse, ombre du toit, cauri), abstrait au point d'être
  géométrique. Attention : **ni baobab ni masque** — clichés touristiques, et la
  marque s'adresse aussi à la diaspora et au marché local.

Dans les trois cas : **une seule idée, lisible d'un coup d'œil à 30 px.**

## 6. Ce que la planche doit prouver

Pour la direction recommandée, montre-la posée en vrai :

1. **L'icône seule**, dessinée en grand, avec sa grille et sa zone de protection.
2. **Le bloc horizontal** — icône + « PasseTemps » en Cormorant Garamond, gouttière
   de 10 px, aux trois tailles réelles : **30, 36 et 72 px de haut**, en pixels
   réels, non agrandies. C'est le test qui élimine.
3. **Le bloc vertical** (icône au-dessus du nom), pour les écrans de connexion.
4. **Le bloc complet avec baseline**, pour les supports.
5. **Sur les quatre fonds** : `#F7F4EF` clair, `#0C0A08` sombre, blanc pur, et
   posé sur une photographie de villa (le nom passe alors en blanc).
6. **Monochrome** — un seul ton, pour tampon, facture, filigrane.
7. **L'icône PWA maskable** : le dessin doit tenir dans le **cercle intérieur à
   80 %** d'un carré de 512, le reste étant rogné par Android. Fond de sécurité
   `#F7F4EF`.
8. **Le favicon à 32 px et à 16 px**, tel qu'il apparaîtra dans un onglet.
9. Une bande d'**interdits** : ce qu'il ne faut pas faire au logo (déformer,
   recolorer, ajouter une ombre portée, poser sur un fond saturé…).

## 7. Contraintes de fabrication

- **Livrer en SVG**, tracés fermés, sans texte non vectorisé, sans filtre, sans
  masque exotique. Le site sert ensuite des PNG/WebP exportés.
- Poids visé pour l'icône servie : **≤ 8 Ko**. Le marché est mobile et la data se
  paie au volume — c'est une règle du projet, pas une préférence.
- Exports attendus (noms de fichiers du projet) :
  `logo.webp` et `logo.png` (256), `icon-192.png`, `icon-512.png`,
  `icon-maskable-192.png`, `icon-maskable-512.png` (dessin dans les 80 % centraux),
  `apple-touch-icon.png` (180, **fond plein obligatoire**, iOS n'accepte pas la
  transparence), `favicon-32.png`, `favicon.ico`, et un `og-image.jpg` 1200×630.
- **Couche alpha obligatoire** partout sauf `apple-touch-icon` et `og-image`.

## 8. Critères d'acceptation

Le logo est bon si, et seulement si :

- il reste identifiable à **30 px de haut** sans qu'on devine ce qu'il représente ;
- il tient sur `#F7F4EF` **et** sur `#0C0A08` sans version bricolée à la main ;
- il ne raconte pas seulement « une maison sur une carte » ;
- il tient à côté d'un « PasseTemps » en Cormorant Garamond sans le contredire ;
- rogné au cercle des 80 %, il n'a rien perdu d'essentiel.
