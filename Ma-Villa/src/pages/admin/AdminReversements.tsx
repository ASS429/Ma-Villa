import { useState } from 'react'
import { Banknote, Hourglass, CheckCheck, Inbox, X } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte } from '../../lib/format'
import Button from '../../components/ui/Button'
import { Champ, ChampSelection, ChampZoneTexte } from '../../components/ui/Champ'

interface Proprietaire {
  id: number
  nom: string
  email: string
  phone: string | null
  du: number
  a_venir: number
  verse: number
}

interface Versement {
  id: number
  beneficiaire_nom: string
  montant: number
  methode: string
  reference: string | null
  verse_le: string
  createur_nom: string | null
}

interface File {
  proprietaires: Proprietaire[]
  total_du: number
  total_a_venir: number
  derniers: Versement[]
  methodes: Record<string, string>
}

export default function AdminReversements() {
  const toast = useToast()
  const [cible, setCible] = useState<Proprietaire | null>(null)
  const [methode, setMethode] = useState('wave')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const { donnees, chargement, erreur, reessayer } = useRequete<File>(
    async (signal) => (await api.get('/admin/reversements', { signal })).data,
    'reversements',
    { messageErreurParDefaut: 'Impossible de charger la file des reversements.' }
  )

  const methodes = donnees?.methodes ?? {}
  const liste = donnees?.proprietaires ?? []

  const ouvrir = (p: Proprietaire) => {
    setCible(p)
    setMethode('wave')
    setReference('')
    setNote('')
  }

  const enregistrer = async () => {
    if (!cible || envoi) return

    setEnvoi(true)
    try {
      // Le montant n'est pas envoyé : le serveur le calcule à partir de ce
      // qui est réellement exigible. Une somme dictée par le navigateur
      // serait une écriture comptable dictée par le navigateur.
      const { data } = await api.post('/admin/reversements', {
        user_id: cible.id,
        methode,
        reference: reference.trim() || null,
        note: note.trim() || null,
      })
      toast.succes(`${fcfa(data.montant)} enregistrés pour ${cible.nom}.`)
      setCible(null)
      reessayer()
    } catch (err) {
      toast.erreur(messageErreur(err, "Le versement n'a pas été enregistré."))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div>
      <p className="console-sous-titre">
        La plateforme encaisse tout, puis reverse. Cet écran ne déplace pas
        d'argent : <strong>faites le virement, puis enregistrez-le ici</strong> —
        le montant est calculé et les séjours concernés sont soldés.
      </p>

      {erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      <div className="chiffres">
        <div className={`chiffre${(donnees?.total_du ?? 0) > 0 ? ' demande-action' : ''}`}>
          <div className="chiffre-haut">
            <span className="chiffre-icone"><Banknote size={17} aria-hidden="true" /></span>
          </div>
          <p className="chiffre-valeur">{fcfa(donnees?.total_du ?? 0)}</p>
          <p className="chiffre-libelle">Dû aux propriétaires</p>
          <p className="chiffre-detail">Séjours terminés, non encore versés</p>
        </div>

        <div className="chiffre">
          <div className="chiffre-haut">
            <span className="chiffre-icone"><Hourglass size={17} aria-hidden="true" /></span>
          </div>
          <p className="chiffre-valeur">{fcfa(donnees?.total_a_venir ?? 0)}</p>
          <p className="chiffre-libelle">Engagé, pas encore exigible</p>
          <p className="chiffre-detail">Séjours payés qui n'ont pas eu lieu</p>
        </div>
      </div>

      <div className="console-grille console-grille-large">
        <section className="panneau">
          <h2 className="panneau-titre">File d'attente</h2>

          {chargement ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map((n) => <div key={n} className="skeleton" style={{ height: 38, borderRadius: 8 }} />)}
            </div>
          ) : liste.length === 0 ? (
            <div className="console-vide">
              <span className="console-vide-icone"><Inbox size={22} /></span>
              <p>Aucun propriétaire n'attend d'argent. Rien à faire.</p>
            </div>
          ) : (
            <div className="tableau-cadre">
              <table className="tableau">
                <thead>
                  <tr>
                    <th scope="col">Propriétaire</th>
                    <th scope="col">Dû</th>
                    <th scope="col">À venir</th>
                    <th scope="col">Déjà versé</th>
                    <th scope="col"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="tableau-fort">{p.nom}</span>
                        <span className="tableau-second"> · {p.phone ?? p.email}</span>
                      </td>
                      <td className="tableau-nombre tableau-fort">{fcfa(p.du)}</td>
                      <td className="tableau-nombre">{fcfa(p.a_venir)}</td>
                      <td className="tableau-nombre">{fcfa(p.verse)}</td>
                      <td>
                        <Button
                          variante="primaire"
                          taille="sm"
                          disabled={p.du <= 0}
                          onClick={() => ouvrir(p)}
                        >
                          Enregistrer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panneau">
          <h2 className="panneau-titre">Derniers versements</h2>

          {(donnees?.derniers ?? []).length === 0 ? (
            <p className="console-sous-titre" style={{ margin: 0 }}>Aucun versement enregistré.</p>
          ) : (
            <ul className="liste-versements">
              {donnees?.derniers.map((v) => (
                <li key={v.id}>
                  <div>
                    <p className="versement-montant">{fcfa(v.montant)}</p>
                    <p className="versement-detail">
                      {v.beneficiaire_nom} · {dateCourte(v.verse_le)} · {methodes[v.methode] ?? v.methode}
                      {v.reference ? ` · ${v.reference}` : ''}
                    </p>
                  </div>
                  <CheckCheck size={16} aria-hidden="true" style={{ color: 'var(--success)', flex: 'none' }} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {cible && (
        <>
          <div className="console-voile" onClick={() => !envoi && setCible(null)} aria-hidden="true" />
          <div className="modale" role="dialog" aria-modal="true" aria-labelledby="titre-versement">
            <div className="modale-entete">
              <h2 id="titre-versement" className="panneau-titre" style={{ margin: 0 }}>
                Versement à {cible.nom}
              </h2>
              <Button
                variante="discret" taille="sm" onClick={() => setCible(null)}
                iconeAvant={<X size={18} />} aria-label="Fermer"
              />
            </div>

            {/* Le montant est affiché, pas saisi : il n'y a rien à décider ici,
                et un champ modifiable inviterait à corriger un calcul qui est
                de toute façon refait côté serveur. */}
            <p className="modale-montant">{fcfa(cible.du)}</p>
            <p className="console-sous-titre">
              Somme des séjours terminés et non encore versés. Enregistrer les
              solde tous — à faire <strong>après</strong> le virement.
            </p>

            <div className="modale-formulaire">
              <ChampSelection
                label="Moyen employé"
                value={methode}
                onChange={(e) => setMethode(e.target.value)}
              >
                {Object.entries(methodes).map(([cle, nom]) => (
                  <option key={cle} value={cle}>{nom}</option>
                ))}
              </ChampSelection>

              <Champ
                label="Référence de la transaction"
                aide="Ce qui permettra de retrouver le virement dans six mois."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
                placeholder="Identifiant Wave, Orange Money ou virement"
              />

              <ChampZoneTexte
                label="Note interne"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Facultatif"
              />
            </div>

            <div className="modale-actions">
              <Button variante="secondaire" onClick={() => setCible(null)} disabled={envoi}>
                Annuler
              </Button>
              <Button variante="primaire" onClick={enregistrer} chargement={envoi}>
                Enregistrer le versement
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
