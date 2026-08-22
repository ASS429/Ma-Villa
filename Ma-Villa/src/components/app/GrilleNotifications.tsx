import { useState } from 'react'
import { Info, Lock } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import Button from '../ui/Button'

interface Canal { nom: string }

interface Sujet {
  cle: string
  nom: string
  detail: string | null
  raison: string | null
  canaux: Record<string, { actif: boolean; verrouille: boolean }>
}

interface Grille {
  canaux: Record<string, Canal>
  sujets: Sujet[]
  phrase_sms: string
}

/**
 * La grille des notifications — planche 38.
 *
 * Trois canaux, cinq sujets. Une liste d'interrupteurs « Recevoir les SMS » ne
 * dit pas **de quoi** ; ici on lit une ligne et on sait où arrive quoi.
 *
 * Deux lignes ne sont pas désactivables dans l'application. Une case grisée
 * **avec sa raison écrite** vaut mieux qu'une case absente : le propriétaire
 * comprend la règle au lieu de la subir, et ne se demande pas si l'interface a
 * un défaut.
 *
 * Le barème vient du serveur, libellés et verrous compris : ajouter un sujet
 * ne demande pas de redéployer cet écran.
 */
export default function GrilleNotifications() {
  const toast = useToast()
  const [brouillon, setBrouillon] = useState<Record<string, Record<string, boolean>>>({})
  const [envoi, setEnvoi] = useState(false)

  const { donnees, chargement, erreur, reessayer } = useRequete<Grille>(
    async (signal) => (await api.get('/notifications/preferences', { signal })).data,
    'preferences-notification',
    { messageErreurParDefaut: 'Impossible de charger vos préférences.' }
  )

  const canaux = Object.entries(donnees?.canaux ?? {})
  const sujets = donnees?.sujets ?? []

  const valeur = (sujet: Sujet, canal: string) =>
    brouillon[sujet.cle]?.[canal] ?? sujet.canaux[canal].actif

  const basculer = (sujet: Sujet, canal: string) => {
    setBrouillon((b) => ({
      ...b,
      [sujet.cle]: { ...b[sujet.cle], [canal]: !valeur(sujet, canal) },
    }))
  }

  const modifie = Object.keys(brouillon).length > 0

  const enregistrer = async () => {
    if (!modifie || envoi) return

    setEnvoi(true)
    try {
      // On renvoie la grille entière et non le seul brouillon : le serveur
      // remplace ce qu'il détient, et un envoi partiel effacerait le reste.
      const complet: Record<string, Record<string, boolean>> = {}
      for (const s of sujets) {
        complet[s.cle] = {}
        for (const [cle] of canaux) {
          if (!s.canaux[cle].verrouille) complet[s.cle][cle] = valeur(s, cle)
        }
      }

      await api.put('/notifications/preferences', { preferences: complet })
      setBrouillon({})
      toast.succes('Préférences enregistrées.')
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "Les préférences n'ont pas été enregistrées."))
    } finally {
      setEnvoi(false)
    }
  }

  if (chargement) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
        ))}
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="console-erreur" role="alert">
        {erreur}
        <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
      </div>
    )
  }

  return (
    <div className="grille-notif">
      <div className="tableau-cadre">
        <table className="tableau grille-notif-table">
          <thead>
            <tr>
              <th scope="col">Ce que vous recevez</th>
              {canaux.map(([cle, c]) => (
                <th key={cle} scope="col" className="grille-notif-canal">{c.nom}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sujets.map((s) => (
              <tr key={s.cle}>
                <th scope="row" className="grille-notif-sujet">
                  <span className="tableau-fort">{s.nom}</span>
                  {s.detail && <span className="grille-notif-detail">{s.detail}</span>}
                  {/* La raison du verrou vit sur la ligne, pas dans une
                      infobulle : elle doit se lire sans geste. */}
                  {s.raison && (
                    <span className="grille-notif-raison">
                      <Lock size={11} aria-hidden="true" /> {s.raison}
                    </span>
                  )}
                </th>

                {canaux.map(([cle]) => {
                  const etat = s.canaux[cle]
                  const coche = valeur(s, cle)

                  return (
                    <td key={cle} className="grille-notif-case">
                      <label className="grille-notif-boite">
                        <input
                          type="checkbox"
                          checked={coche}
                          disabled={etat.verrouille}
                          onChange={() => basculer(s, cle)}
                          aria-label={`${s.nom} — ${donnees?.canaux[cle].nom}${etat.verrouille ? ' (toujours actif)' : ''}`}
                        />
                        <span className="sr-only">
                          {coche ? 'reçu' : 'non reçu'}
                        </span>
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Le SMS n'est jamais seul : à 6 % d'échec relevé par la sonde, toute
          notification critique double par le message dans l'application. */}
      <p className="grille-notif-pied">
        <Info size={14} aria-hidden="true" />
        {donnees?.phrase_sms}
      </p>

      {modifie && (
        <div className="grille-notif-actions">
          <Button variante="secondaire" taille="sm" onClick={() => setBrouillon({})} disabled={envoi}>
            Annuler
          </Button>
          <Button variante="primaire" taille="sm" onClick={enregistrer} chargement={envoi}>
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  )
}
