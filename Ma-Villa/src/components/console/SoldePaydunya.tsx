import { useState } from 'react'
import { AlertTriangle, Landmark, RefreshCw } from 'lucide-react'
import api from '../../services/api'
import { useRequete } from '../../lib/useRequete'
import { depuis, fcfa } from '../../lib/format'
import Button from '../ui/Button'

interface Part {
  proprietaires: number
  associes: number
  remboursements: number
  total: number
}

interface Reponse {
  configure: boolean
  compte_test: boolean
  solde: number | null
  lu: boolean
  message: string | null
  lu_le: string | null
  a_garder: Part
  retirable: number | null
  manque: number | null
  hors_ligne: Part
}

/**
 * « propriétaires 88 000 FCFA · associés 12 600 FCFA », sans les postes à zéro. Jamais abrégé : sur
 * un écran où l'on décide d'un retrait, les chiffres doivent s'additionner au franc près.
 */
function detail(p: Part): string {
  return [
    p.proprietaires > 0 ? `propriétaires ${fcfa(p.proprietaires)}` : null,
    p.associes > 0 ? `associés ${fcfa(p.associes)}` : null,
    p.remboursements > 0 ? `remboursements à décider ${fcfa(p.remboursements)}` : null,
  ].filter(Boolean).join(' · ')
}

/**
 * Ce qu'on peut retirer du compte PayDunya vers le compte personnel de l'exploitant, sans
 * toucher à l'argent des propriétaires, des associés ou des clients à rembourser.
 *
 * Rien ne se retire d'ici : l'écran dit le chiffre, le retrait se fait chez PayDunya. Le solde
 * est leur approximation, et l'écran le dit.
 */
export default function SoldePaydunya() {
  const [force, setForce] = useState(0)
  const { donnees: d, chargement, erreur, reessayer } = useRequete<Reponse>(
    async (signal) => (await api.get('/admin/fonds/paydunya', { signal, params: force > 0 ? { rafraichir: 1 } : undefined })).data,
    `fonds-paydunya-${force}`,
    { messageErreurParDefaut: 'Le solde PayDunya n’a pas pu être calculé.' },
  )

  if (chargement && !d) {
    return <section className="fonds" aria-busy="true"><p className="fonds-libelle">Lecture du compte PayDunya…</p></section>
  }

  if (erreur || !d) {
    return (
      <section className="fonds">
        <p className="fonds-libelle">{erreur || 'Le solde PayDunya n’a pas pu être calculé.'}</p>
        <Button variante="discret" taille="sm" onClick={reessayer}>Réessayer</Button>
      </section>
    )
  }

  // Rien de configuré et rien à garder : un poste de développement, pas une information.
  if (!d.configure && d.a_garder.total === 0 && d.hors_ligne.total === 0) return null

  const manque = (d.manque ?? 0) > 0

  return (
    <section className={`fonds${manque ? ' est-bloque' : ''}`} aria-label="Compte PayDunya">
      <div className="fonds-principal">
        <span className="fonds-icone" aria-hidden="true"><Landmark size={16} /></span>
        <div>
          <p className="fonds-libelle">
            {d.lu ? 'Vous pouvez retirer de PayDunya' : 'À laisser sur PayDunya'}
            {d.compte_test ? ' (compte de test)' : ''}
          </p>
          <p className="fonds-valeur">{fcfa(d.lu ? (d.retirable ?? 0) : d.a_garder.total)}</p>
        </div>
      </div>

      {d.lu && (
        <dl className="fonds-detail">
          <div>
            <dt>Solde PayDunya</dt>
            <dd>{fcfa(d.solde ?? 0)}</dd>
          </div>
          <div>
            <dt>À y laisser</dt>
            <dd>{fcfa(d.a_garder.total)}</dd>
          </div>
        </dl>
      )}

      {manque && (
        <p className="fonds-alerte">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            <strong>Il manque {fcfa(d.manque ?? 0)}.</strong>{' '}
            Le compte ne couvre pas ce qui est dû : ne retirez rien, et vérifiez le solde dans votre tableau de bord PayDunya.
          </span>
        </p>
      )}

      <p className="fonds-note">
        {!d.lu && `Le solde n’a pas pu être lu${d.message ? ` (${d.message})` : ''}. Regardez-le dans votre tableau de bord PayDunya, et n’en retirez que ce qui dépasse ce montant. `}
        {d.a_garder.total > 0 && `À y laisser : ${detail(d.a_garder)}. `}
        {d.lu && `PayDunya donne ce solde comme une approximation : vérifiez-le dans votre tableau de bord avant un gros retrait.`}
        {d.lu && d.lu_le && ` Lu ${depuis(d.lu_le)}.`}
      </p>

      {d.hors_ligne.total > 0 && (
        <p className="fonds-note">
          Reçu à la main et encore dû : <strong>{fcfa(d.hors_ligne.total)}</strong> ({detail(d.hors_ligne)}). Cet argent n’est pas sur PayDunya : gardez-le aussi de côté.
        </p>
      )}

      {d.configure && (
        <Button variante="discret" taille="sm" iconeAvant={<RefreshCw size={14} aria-hidden="true" />} onClick={() => setForce((f) => f + 1)} chargement={chargement}>
          Relire le solde
        </Button>
      )}
    </section>
  )
}
