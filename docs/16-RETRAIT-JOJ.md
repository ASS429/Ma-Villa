# Retirer la vitrine des JOJ Dakar 2026

> Décidé par l'exploitant le 20 octobre 2026 : après les Jeux (31 octobre – 13 novembre
> 2026), **tout ce qui porte « JOJ » quitte la plateforme**. Les services qu'elle mettait
> en avant — transport et repas — **restent** : ils ne lui appartiennent pas.

Le code a été écrit pour ce retrait : tout ce qui est propre aux Jeux vit dans
`Ma-Villa/src/joj/`, et s'éteint par une seule variable.

---

## Temps 1 — éteindre (une minute, sans déploiement)

Sur Railway, service API : **`JOJ_ACTIF=false`** (ou supprimer la variable).

Effet immédiat : la page `/joj-dakar-2026/` renvoie à l'accueil (elle reste visible en
aperçu pour l'administration), le bandeau de l'accueil et le lien du pied de page
disparaissent. Le bandeau, lui, se retire **de toute façon** le 14 novembre 2026, par sa
date (`src/joj/index.ts`).

Puis **relancer un déploiement Render** : le pré-rendu retire alors la page du plan de site.

## Temps 2 — supprimer le code (à faire une fois les liens WhatsApp retombés)

| Où | Quoi |
|---|---|
| `Ma-Villa/src/joj/` | **supprimer le dossier entier** |
| `Ma-Villa/src/App.tsx` | l'import `PageJoj` et `BandeauJoj`, la route `joj-dakar-2026`, `<BandeauJoj />` dans l'accueil |
| `Ma-Villa/src/components/Footer.tsx` | `vitrineJoj`, son lien, l'import de `../joj` |
| `Ma-Villa/src/context/ConfigContext.tsx` | le bloc `joj` (type et repli) |
| `Ma-Villa/src/pages/admin/AdminDemandes.tsx` | le lien d'aperçu « JOJ » du sous-titre |
| `Ma-Villa/scripts/prerendu.mjs` | l'entrée `si: 'joj'` des pages fixes, la branche `chemin === 'joj-dakar-2026'` de `corps()`, `joj` dans `ouvertures()` |
| `backend/config/joj.php` | supprimer le fichier |
| `backend/app/Http/Controllers/Api/ConfigurationController.php` | la clé `joj` |
| `backend/tests/Feature/DemandeServiceTest.php` | les assertions sur `joj.actif` (deux tests) |
| `docs/juridique/A-REPRENDRE.md` | la section « Après les JOJ » |

Puis vérifier qu'il ne reste rien :

```bash
grep -rniE "joj|dakar 2026" Ma-Villa/src Ma-Villa/scripts backend/app backend/config backend/routes backend/tests
```

Les seules occurrences admises après le retrait :

- `'joj'` dans `DemandeService::ORIGINES` (backend) et dans `OrigineDemande` (`types.ts`) :
  **les demandes déjà reçues portent cette origine**. Les retirer rendrait ces lignes
  invalides, et ce chiffre — combien de demandes la vitrine a apportées — est celui qui
  servira à négocier la prochaine opération de ce genre ;
- le libellé « vitrine JOJ » de `ORIGINE` dans `AdminDemandes.tsx`, pour les mêmes lignes.

## Ce qu'il ne faut **pas** retirer

- `Ma-Villa/src/prestations/` et les pages `/transport/`, `/restauration/` ;
- `TRANSPORT_ACTIF`, `RESTAURATION_ACTIVE`, `config/prestations.php` ;
- la table `demandes_service` et ses lignes ;
- l'écran « Demandes » de la console.
