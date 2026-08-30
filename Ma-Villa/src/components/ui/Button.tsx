import { Link } from 'react-router-dom'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Emploi de l'accent, arrêté en revue de design : il signale la conversion du
 * parcours en cours — « Rechercher », « Réserver ». « Publier PasseTemps » reste
 * en `secondaire` partout sauf sur la page qui lui est dédiée, pour ne pas
 * pointer la couleur d'action vers une action qui ne concerne pas le visiteur.
 *
 * L'application comptait quatre styles de bouton primaire concurrents, et
 * l'action la plus importante — « Réserver » — n'utilisait pas la couleur de
 * marque. Tout passe désormais par ce composant.
 */
type Variante = 'primaire' | 'secondaire' | 'discret' | 'danger' | 'verre'
type Taille = 'sm' | 'md' | 'lg'

interface Commun {
  variante?: Variante
  taille?: Taille
  /** Occupe toute la largeur disponible. */
  bloc?: boolean
  /** Remplace le contenu par un indicateur et neutralise l'interaction. */
  chargement?: boolean
  iconeAvant?: ReactNode
  iconeApres?: ReactNode
  /**
   * Facultatif : un bouton à icône seule est légitime là où la place manque
   * — en-tête de console, barre d'outils. Il doit alors porter un
   * `aria-label`, sans quoi un lecteur d'écran annonce « bouton » sans dire
   * lequel.
   */
  children?: ReactNode
  className?: string
}

type ProprietesBouton = Commun & Omit<ComponentPropsWithoutRef<'button'>, keyof Commun>
type ProprietesLien = Commun & { to: string } & Omit<ComponentPropsWithoutRef<'a'>, keyof Commun | 'href'>

function classes(variante: Variante, taille: Taille, bloc: boolean, sup?: string) {
  return [
    'btn',
    `btn-${variante}`,
    `btn-${taille}`,
    bloc ? 'btn-bloc' : '',
    sup ?? '',
  ].filter(Boolean).join(' ')
}

function Contenu({ chargement, iconeAvant, iconeApres, children }: Pick<Commun, 'chargement' | 'iconeAvant' | 'iconeApres' | 'children'>) {
  if (chargement) {
    return (
      <>
        <span className="btn-spinner" aria-hidden="true" />
        <span>Patientez…</span>
      </>
    )
  }
  return (
    <>
      {iconeAvant}
      {/* Pas de <span> vide sur un bouton à icône seule : il ajouterait
          l'espacement du `gap` et décentrerait l'icône. */}
      {children != null && children !== false && <span>{children}</span>}
      {iconeApres}
    </>
  )
}

export default function Button({
  variante = 'secondaire',
  taille = 'md',
  bloc = false,
  chargement = false,
  iconeAvant,
  iconeApres,
  children,
  className,
  disabled,
  ...reste
}: ProprietesBouton) {
  return (
    <button
      {...reste}
      className={classes(variante, taille, bloc, className)}
      disabled={disabled || chargement}
      // Le lecteur d'écran doit savoir que l'action est en cours, pas seulement
      // que le bouton est désactivé.
      aria-busy={chargement || undefined}
    >
      <Contenu chargement={chargement} iconeAvant={iconeAvant} iconeApres={iconeApres}>
        {children}
      </Contenu>
    </button>
  )
}

/** Même apparence, mais c'est une navigation : le bon élément est un lien. */
export function ButtonLink({
  variante = 'secondaire',
  taille = 'md',
  bloc = false,
  iconeAvant,
  iconeApres,
  children,
  className,
  to,
  ...reste
}: ProprietesLien) {
  return (
    <Link {...reste} to={to} className={classes(variante, taille, bloc, className)}>
      {iconeAvant}
      <span>{children}</span>
      {iconeApres}
    </Link>
  )
}
