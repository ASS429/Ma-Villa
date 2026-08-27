import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import Button from '../ui/Button'

interface Props {
  titre: string
  /** Ce que la liste contient, dit en une phrase. */
  sousTitre?: ReactNode
  /** Barre de filtres, onglets, recherche, bouton de création. */
  outils?: ReactNode

  chargement: boolean
  erreur?: string
  reessayer?: () => void

  /** Vrai quand la requête a abouti et n'a rien rendu. */
  vide: boolean
  videIcone?: typeof Inbox
  /** Ce qu'on dit quand il n'y a rien — jamais « aucun résultat ». */
  videTexte: ReactNode
  /**
   * La sortie offerte depuis le vide.
   *
   * Un écran vide sans issue est une impasse : on y arrive, on lit qu'il n'y
   * a rien, et il faut ressortir par la navigation. Quand une action peut
   * remplir l'écran — explorer, créer — elle a sa place ici.
   */
  videAction?: ReactNode

  /** Nombre de lignes fantômes pendant le chargement. */
  squelette?: number

  children: ReactNode
}

/**
 * Le gabarit des listes de l'administration.
 *
 * Les cinq écrans de liste — utilisateurs, avis, articles, commandes, journal —
 * portaient chacun leur copie des mêmes quatre états : le titre, le bandeau
 * d'erreur avec sa reprise, le squelette de chargement, et le vide. Quatre
 * copies d'un même agencement, c'est quatre endroits où corriger une faute et
 * trois qu'on oublie.
 *
 * **Ce qui change d'un écran à l'autre reste dans l'écran** : les lignes, et
 * la colonne qui porte le risque. C'est la seule chose qu'un opérateur regarde
 * vraiment — le montant impayé, la note basse, le stock à zéro.
 *
 * L'ordre des états n'est pas indifférent : l'erreur passe avant le
 * chargement, sinon une requête qui échoue puis se relance affiche un
 * squelette par-dessus le message et donne l'impression que rien ne s'est
 * passé.
 */
export default function ListeConsole({
  titre, sousTitre, outils,
  chargement, erreur, reessayer,
  vide, videIcone: Icone = Inbox, videTexte, videAction,
  squelette = 3,
  children,
}: Props) {
  return (
    <div>
      <h1 className="console-titre">{titre}</h1>
      {sousTitre && <p className="console-sous-titre">{sousTitre}</p>}

      {outils}

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          {reessayer && (
            <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
          )}
        </div>
      )}

      {chargement ? (
        <div className="liste-console">
          {Array.from({ length: squelette }).map((_, i) => (
            <div key={i} className="panneau">
              <div className="skeleton" style={{ height: 14, width: '32%', borderRadius: 6, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '68%', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : vide && !erreur ? (
        // Le vide est un résultat, pas un manque : on dit ce qu'il signifie,
        // pas qu'il n'y a rien.
        <div className="console-vide">
          <span className="console-vide-icone"><Icone size={22} /></span>
          <p>{videTexte}</p>
          {videAction}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
