import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, MessagesSquare } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useMessages } from '../../context/MessagesContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { dateCourte } from '../../lib/format'
import Button from '../../components/ui/Button'

interface Auteur { id: number; name: string; role: string }

interface Message {
  id: number
  corps: string
  created_at: string
  user_id: number | null
  auteur: Auteur | null
}

interface Reservation {
  id: number
  statut: string
  date_debut: string
  date_fin: string
  logement?: { nom: string; villa?: { nom: string } }
  client?: { name: string }
}

/** Un séparateur par jour : sans lui, un fil étalé sur une semaine se lit mal. */
function memeJour(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export default function Conversation() {
  const { id } = useParams<{ id: string }>()
  const naviguer = useNavigate()
  const { user } = useAuth()
  const { rafraichir } = useMessages()
  const [brouillon, setBrouillon] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreurEnvoi, setErreurEnvoi] = useState('')
  const filRef = useRef<HTMLDivElement>(null)

  const { donnees: messages, chargement, erreur, statut, reessayer } = useRequete<Message[]>(
    async (signal) => (await api.get(`/reservations/${id}/messages`, { signal })).data,
    `messages-${id}`,
    { messageErreurParDefaut: 'Impossible de charger la conversation.' }
  )

  const { donnees: reservation } = useRequete<Reservation>(
    async (signal) => (await api.get(`/reservations/${id}`, { signal })).data,
    `reservation-${id}`,
    { messageErreurParDefaut: 'Impossible de charger la réservation.' }
  )

  const liste = messages ?? []

  // Une conversation s'ouvre sur son dernier message, pas sur le premier.
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight })

    // Ouvrir le fil marque ses messages comme lus côté serveur : sans cette
    // relance, la pastille de navigation resterait allumée jusqu'au relevé
    // suivant, devant un fil qu'on vient de lire.
    if (messages) rafraichir()
  }, [messages, rafraichir])

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    const corps = brouillon.trim()
    if (!corps || envoi) return

    setEnvoi(true)
    setErreurEnvoi('')
    try {
      await api.post(`/reservations/${id}/messages`, { corps })
      setBrouillon('')
      reessayer()
    } catch (err) {
      // Le brouillon est conservé : rien n'est plus agaçant que de perdre un
      // message écrit parce que le réseau a lâché à l'envoi.
      setErreurEnvoi(messageErreur(err, "Le message n'est pas parti."))
    } finally {
      setEnvoi(false)
    }
  }

  const villa = reservation?.logement?.villa?.nom
  const enTete = villa ?? 'Conversation'

  return (
    <div className="conversation">
      <div className="conversation-entete">
        <Link to="/dashboard/reservations" className="btn btn-discret btn-sm" aria-label="Retour aux réservations">
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="conversation-titre">{enTete}</p>
          {reservation && (
            <p className="conversation-detail">
              {dateCourte(reservation.date_debut)} → {dateCourte(reservation.date_fin)}
              {reservation.logement?.nom ? ` · ${reservation.logement.nom}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Un refus d'accès n'est pas une panne : réessayer ne donnera jamais
          rien, et « accès refusé » laisse croire à une faute. On nomme la
          cause réelle — presque toujours le mauvais compte, sur un téléphone
          partagé ou après un changement de numéro. */}
      {statut === 403 && !chargement ? (
        <div className="console-erreur" role="alert">
          Cette réservation appartient à un autre compte. Connectez-vous avec
          celui qui l'a créée.
          <Button variante="secondaire" taille="sm" onClick={() => naviguer('/login')}>
            Changer de compte
          </Button>
        </div>
      ) : erreur && !chargement && (
        <div className="console-erreur" role="alert">
          {erreur}
          <Button variante="secondaire" taille="sm" onClick={reessayer}>Réessayer</Button>
        </div>
      )}

      <div className="conversation-fil" ref={filRef}>
        {chargement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[60, 40, 70].map((l, i) => (
              <div key={i} className="skeleton" style={{ height: 44, width: `${l}%`, borderRadius: 14, alignSelf: i % 2 ? 'flex-end' : 'flex-start' }} />
            ))}
          </div>
        ) : liste.length === 0 ? (
          <div className="console-vide">
            <span className="console-vide-icone"><MessagesSquare size={22} /></span>
            <p>
              Aucun message. <strong>Posez vos questions ici</strong> — horaires d'arrivée,
              équipements, accès. Tout reste rattaché à cette réservation.
            </p>
          </div>
        ) : (
          liste.map((m, i) => {
            const deMoi = m.user_id === user?.id
            const nouveauJour = i === 0 || !memeJour(m.created_at, liste[i - 1].created_at)

            return (
              <div key={m.id}>
                {nouveauJour && (
                  <p className="conversation-jour">{dateCourte(m.created_at)}</p>
                )}
                <div className={`bulle${deMoi ? ' est-moi' : ''}`}>
                  {/* Le nom n'apparaît que sur les messages reçus : sur les
                      siens, il est évident et n'ajoute que du bruit. */}
                  {!deMoi && (
                    <p className="bulle-auteur">{m.auteur?.name ?? 'Compte supprimé'}</p>
                  )}
                  <p className="bulle-corps">{m.corps}</p>
                  <time className="bulle-heure" dateTime={m.created_at}>{heure(m.created_at)}</time>
                </div>
              </div>
            )
          })
        )}
      </div>

      <form className="conversation-saisie" onSubmit={envoyer}>
        {erreurEnvoi && <p className="conversation-erreur" role="alert">{erreurEnvoi}</p>}
        <div className="conversation-champ">
          <textarea
            className="champ-controle"
            rows={1}
            maxLength={2000}
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            onKeyDown={(e) => {
              // Entrée envoie, Maj+Entrée passe à la ligne — la convention de
              // toutes les messageries. Sur mobile, le clavier fournit sa
              // propre touche de validation.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                envoyer(e as unknown as React.FormEvent)
              }
            }}
            placeholder="Écrivez votre message…"
            aria-label="Votre message"
          />
          <Button
            type="submit"
            variante="primaire"
            taille="sm"
            disabled={!brouillon.trim() || envoi}
            chargement={envoi}
            iconeAvant={<Send size={16} />}
            aria-label="Envoyer"
          />
        </div>
      </form>
    </div>
  )
}
