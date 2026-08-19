import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Hourglass, Inbox, X, Info } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { fcfa, dateCourte } from '../../lib/format'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
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

type Statut = 'manuel' | 'en_cours' | 'reussi' | 'echoue'

interface Versement {
  id: number
  beneficiaire_nom: string
  montant: number
  methode: string
  statut: Statut
  reference: string | null
  echec_motif: string | null
  verse_le: string | null
  created_at: string
  createur_nom: string | null
}

interface File {
  proprietaires: Proprietaire[]
  total_du: number
  total_a_venir: number
  derniers: Versement[]
  methodes: Record<string, string>
  statuts: Record<Statut, string>
  /** Faux tant que PayDunya n'a pas ouvert l'option PER sur le compte. */
  automatique: boolean
  moyens_automatiques: string[]
  en_cours: number
}

const TON: Record<Statut, 'success' | 'warning' | 'danger' | 'neutre'> = {
  manuel: 'success',
  reussi: 'success',
  en_cours: 'warning',
  echoue: 'danger',
}

export default function AdminReversements() {
  const toast = useToast()
  const [cible, setCible] = useState<Proprietaire | null>(null)
  const [methode, setMethode] = useState('wave')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'manuel' | 'automatique'>('manuel')
  const [envoi, setEnvoi] = useState(false)

  const { donnees, chargement, erreur, reessayer } = useRequete<File>(
    async (signal) => (await api.get('/admin/reversements', { signal })).data,
    'reversements',
    { messageErreurParDefaut: 'Impossible de charger la file des reversements.' }
  )

  const methodes = donnees?.methodes ?? {}
  const liste = donnees?.proprietaires ?? []

  const automatiquePossible = (m: string) =>
    Boolean(donnees?.automatique) && (donnees?.moyens_automatiques ?? []).includes(m)

  const ouvrir = (p: Proprietaire) => {
    setCible(p)
    setMethode('wave')
    setReference('')
    setNote('')
    // Le mode par défaut suit ce qui est réellement possible : proposer
    // l'envoi automatique quand PayDunya n'a pas ouvert l'option ne
    // produirait qu'un refus après coup.
    setMode(automatiquePossible('wave') ? 'automatique' : 'manuel')
  }

  // Changer de moyen peut retirer l'envoi automatique : un virement bancaire
  // ou des espèces n'existent qu'hors ligne.
  const choisirMethode = (m: string) => {
    setMethode(m)
    if (!automatiquePossible(m)) setMode('manuel')
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
        mode,
        reference: reference.trim() || null,
        note: note.trim() || null,
      })
      toast.succes(
        data.statut === 'en_cours'
          ? `${fcfa(data.montant)} envoyés à ${cible.nom} — en attente de confirmation.`
          : `${fcfa(data.montant)} enregistrés pour ${cible.nom}.`
      )
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
      <h1 className="console-titre">Reversements</h1>
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

      {/* Dire pourquoi l'envoi automatique n'est pas là évite de le chercher :
          ce n'est pas une panne, c'est une option à faire ouvrir. */}
      {donnees && !donnees.automatique && (
        <div className="console-note">
          <Info size={16} aria-hidden="true" />
          <p>
            <strong>Envoi automatique indisponible.</strong> L'option « Paiement Et
            Redistribution » (PER) n'est pas ouverte sur le compte PayDunya, ou
            n'est pas activée ici. Les versements se font donc à la main.
            La sonde <Link to="/admin/deboursement">Déboursement</Link> dit
            précisément ce que PayDunya répond.
          </p>
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
                  <div style={{ minWidth: 0 }}>
                    <p className="versement-montant">{fcfa(v.montant)}</p>
                    <p className="versement-detail">
                      {v.beneficiaire_nom} · {dateCourte(v.verse_le ?? v.created_at)} · {methodes[v.methode] ?? v.methode}
                      {v.reference ? ` · ${v.reference}` : ''}
                    </p>
                    {/* Un échec sans son motif oblige à ouvrir les journaux du
                        serveur : c'est précisément ce qu'on veut éviter. */}
                    {v.echec_motif && <p className="versement-echec">{v.echec_motif}</p>}
                  </div>
                  <Badge ton={TON[v.statut]}>{donnees?.statuts?.[v.statut] ?? v.statut}</Badge>
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
              Somme des séjours terminés et non encore versés. Valider les solde
              tous.{' '}
              {mode === 'manuel' && <>À faire <strong>après</strong> le virement.</>}
            </p>

            <div className="modale-formulaire">
              {automatiquePossible(methode) && (
                <fieldset className="choix-mode">
                  <legend className="champ-label">Comment verser</legend>
                  {([
                    ['automatique', 'Envoyer maintenant', `PayDunya débourse vers le ${methodes[methode] ?? methode} du propriétaire.`],
                    ['manuel', 'Déjà versé à la main', 'Constate un virement fait hors de l’application.'],
                  ] as const).map(([valeur, titre, aide]) => (
                    <label key={valeur} className={`choix${mode === valeur ? ' est-actif' : ''}`}>
                      <input
                        type="radio"
                        name="mode-versement"
                        value={valeur}
                        checked={mode === valeur}
                        onChange={() => setMode(valeur)}
                      />
                      <span>
                        <span className="choix-titre">{titre}</span>
                        <span className="choix-aide">{aide}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              <ChampSelection
                label="Moyen employé"
                value={methode}
                onChange={(e) => choisirMethode(e.target.value)}
              >
                {Object.entries(methodes).map(([cle, nom]) => (
                  <option key={cle} value={cle}>{nom}</option>
                ))}
              </ChampSelection>

              {mode === 'manuel' && (
                <Champ
                  label="Référence de la transaction"
                  aide="Ce qui permettra de retrouver le virement dans six mois."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={120}
                  placeholder="Identifiant Wave, Orange Money ou virement"
                />
              )}

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
                {mode === 'automatique' ? `Envoyer ${fcfa(cible.du)}` : 'Enregistrer le versement'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
