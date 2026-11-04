import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, Building2, CalendarCheck, Download, FileText, Mail, MessageSquare,
  Phone, ShoppingBag, Star, Wallet, type LucideIcon,
} from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useRequete } from '../../lib/useRequete'
import { messageErreur } from '../../lib/erreurs'
import { dateCourte, fcfa } from '../../lib/format'
import { lienAppel, lienCourriel, lienWhatsApp } from '../../lib/contact'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import BoutonWhatsApp from '../../components/BoutonWhatsApp'

interface Fiche {
  utilisateur: {
    id: number
    name: string
    email: string
    phone: string | null
    role: 'client' | 'proprietaire' | 'admin'
    created_at: string | null
    email_verified_at: string | null
    compte_d_attente: boolean
  }
  chiffres: Record<
    'annonces' | 'annonces_en_ligne' | 'reservations_recues' | 'reservations_faites' | 'encaisse'
    | 'part_proprietaire' | 'verse' | 'du' | 'avis' | 'favoris' | 'messages' | 'commandes', number
  >
  annonces: { id: number; nom: string; ville: string | null; quartier: string | null; statut: string; prix_min: number | null; logements: number; capacite: number; photo: string | null }[]
  reservations_recues: Ligne[]
  reservations: Ligne[]
  journal: { id: number; action: string; cible_libelle: string | null; auteur_nom: string; created_at: string }[]
}

interface Ligne {
  id: number
  hebergement: string | null
  villa_id: number | null
  logement: string | null
  client: string | null
  date_debut: string
  date_fin: string
  personnes: number
  montant: number
  statut: 'en_attente' | 'confirmee' | 'annulee'
}

const ROLES = { client: 'Client', proprietaire: 'Propriétaire', admin: 'Administrateur' }
const STATUT_ANNONCE: Record<string, { label: string; ton: 'success' | 'warning' | 'neutre' }> = {
  validee: { label: 'En ligne', ton: 'success' },
  en_attente: { label: 'En attente', ton: 'warning' },
  rejetee: { label: 'Retirée', ton: 'neutre' },
  brouillon: { label: 'Brouillon', ton: 'neutre' },
}
const STATUT_RESA = { en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée' }

function Chiffre({ Icone, libelle, valeur, detail }: { Icone: LucideIcon; libelle: string; valeur: string | number; detail?: string }) {
  return (
    <article className="chiffre">
      <div className="chiffre-haut">
        <span className="chiffre-icone" aria-hidden="true"><Icone size={16} /></span>
      </div>
      <p className="chiffre-valeur">{valeur}</p>
      <p className="chiffre-libelle">{libelle}</p>
      {detail && <p className="chiffre-detail">{detail}</p>}
    </article>
  )
}

function Reservations({ titre, lignes, avecClient }: { titre: string; lignes: Ligne[]; avecClient: boolean }) {
  return (
    <section className="panneau">
      <h2 className="panneau-titre"><CalendarCheck size={16} aria-hidden="true" /> {titre}</h2>
      {lignes.length === 0 ? (
        <p className="th-text-3 text-sm">Aucune pour l’instant.</p>
      ) : (
        <ul className="fiche-lignes">
          {lignes.map((r) => (
            <li key={r.id}>
              <div>
                <p className="tableau-fort">#{r.id} · {r.hebergement}{avecClient && r.client ? ` · ${r.client}` : ''}</p>
                <p className="tableau-second">
                  {dateCourte(r.date_debut, 'fr')} → {dateCourte(r.date_fin, 'fr')} · {r.personnes} pers. · {STATUT_RESA[r.statut]}
                </p>
              </div>
              <p className="tableau-fort">{fcfa(r.montant)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * La fiche d'un compte : tout ce que la base sait de lui, sur un écran.
 *
 * « Ses activités » veut dire ce que la base enregistre — annonces,
 * réservations, versements, avis, décisions de l'administration —, ni
 * connexions ni pages vues. Le contenu des messages privés n'y est pas, seul
 * leur nombre. La fiche PDF porte les coordonnées et se note au journal ; le
 * catalogue n'en porte aucune et peut partir chez un partenaire.
 */
export default function FicheUtilisateur() {
  const { id } = useParams()
  const toast = useToast()
  const [enCours, setEnCours] = useState<'fiche' | 'catalogue' | null>(null)

  const { donnees: f, chargement, erreur, reessayer } = useRequete<Fiche>(
    async (signal) => (await api.get(`/admin/utilisateurs/${id}/fiche`, { signal })).data,
    `fiche-utilisateur-${id}`,
    { messageErreurParDefaut: 'Impossible de charger cette fiche.' }
  )

  const telecharger = async (type: 'fiche' | 'catalogue') => {
    if (!f) return
    setEnCours(type)
    try {
      const { data } = await api.get(`/admin/utilisateurs/${id}/documents/${type}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data as Blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = `${type === 'fiche' ? 'Fiche' : 'Catalogue'}-${f.utilisateur.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`
      document.body.appendChild(lien)
      lien.click()
      lien.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.erreur(messageErreur(err, type === 'fiche' ? 'La fiche n’a pas pu être préparée.' : 'Le catalogue n’a pas pu être préparé.'))
    } finally {
      setEnCours(null)
    }
  }

  if (chargement) return <div className="skeleton" style={{ height: 420, borderRadius: 'var(--r-lg)' }} />
  if (erreur || !f) {
    return (
      <div className="panneau">
        <p className="console-erreur">{erreur ?? 'Impossible de charger cette fiche.'}</p>
        <Button taille="sm" onClick={reessayer}>Réessayer</Button>
      </div>
    )
  }

  const u = f.utilisateur
  const c = f.chiffres
  const proprietaire = c.annonces > 0

  return (
    <div>
      <div className="devis-entete">
        <div>
          <Link to="/admin/utilisateurs" className="text-sm th-text-2 inline-flex items-center gap-1">
            <ArrowLeft size={14} aria-hidden="true" /> Utilisateurs
          </Link>
          <h1 style={{ font: 'var(--t-h2)', margin: '4px 0 2px' }}>{u.name}</h1>
          <p className="text-sm th-text-3" style={{ margin: 0 }}>
            <Badge ton={u.role === 'proprietaire' ? 'success' : u.role === 'admin' ? 'warning' : 'neutre'}>{ROLES[u.role]}</Badge>
            {' '}compte n° {u.id}{u.created_at ? ` · inscrit le ${dateCourte(u.created_at, 'fr')}` : ''}
          </p>
        </div>
        <div className="console-actions" style={{ flexWrap: 'wrap' }}>
          <Button taille="sm" chargement={enCours === 'fiche'} iconeAvant={<FileText size={15} aria-hidden="true" />} onClick={() => telecharger('fiche')}>
            Fiche interne (PDF)
          </Button>
          {c.annonces_en_ligne > 0 && (
            <Button taille="sm" chargement={enCours === 'catalogue'} iconeAvant={<BookOpen size={15} aria-hidden="true" />} onClick={() => telecharger('catalogue')}>
              Catalogue (PDF)
            </Button>
          )}
        </div>
      </div>

      {u.compte_d_attente && (
        <p className="fiche-alerte">
          Compte créé par import, sans boîte aux lettres : personne ne s’y connecte. Rattachez ses annonces à la
          vraie adresse du titulaire dès qu’elle est connue (bouton ⇄ de la liste des utilisateurs).
        </p>
      )}

      <section className="panneau" style={{ marginBottom: 'var(--space-4)' }}>
        <h2 className="panneau-titre">Coordonnées</h2>
        <div className="fiche-coordonnees">
          <p><span className="th-text-3">E-mail</span> {u.email}{u.email_verified_at ? ' · confirmée' : ' · non confirmée'}</p>
          <p><span className="th-text-3">Téléphone</span> {u.phone ?? '—'}</p>
          <div className="reservation-actions" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
            {u.phone && <BoutonWhatsApp href={lienWhatsApp(u.phone, `Bonjour ${u.name}, `)} taille="sm">WhatsApp</BoutonWhatsApp>}
            {u.phone && (
              <a href={lienAppel(u.phone)} className="btn btn-secondaire btn-sm"><Phone size={15} aria-hidden="true" /><span>Appeler</span></a>
            )}
            {!u.compte_d_attente && (
              <a href={lienCourriel(u.email)} className="btn btn-secondaire btn-sm"><Mail size={15} aria-hidden="true" /><span>E-mail</span></a>
            )}
          </div>
        </div>
      </section>

      <div className="chiffres">
        {proprietaire && <Chiffre Icone={Building2} libelle="Annonces" valeur={c.annonces} detail={`${c.annonces_en_ligne} en ligne`} />}
        {proprietaire && <Chiffre Icone={CalendarCheck} libelle="Réservations reçues" valeur={c.reservations_recues} />}
        {proprietaire && <Chiffre Icone={Wallet} libelle="Encaissé sur ses annonces" valeur={fcfa(c.encaisse)} detail={`dont sa part : ${fcfa(c.part_proprietaire)}`} />}
        {proprietaire && <Chiffre Icone={Download} libelle="Versé" valeur={fcfa(c.verse)} detail={`reste dû : ${fcfa(c.du)}`} />}
        <Chiffre Icone={CalendarCheck} libelle="Réservations faites" valeur={c.reservations_faites} />
        <Chiffre Icone={ShoppingBag} libelle="Commandes boutique" valeur={c.commandes} />
        <Chiffre Icone={Star} libelle="Avis donnés" valeur={c.avis} />
        <Chiffre Icone={MessageSquare} libelle="Messages envoyés" valeur={c.messages} detail="contenu non affiché" />
      </div>

      {proprietaire && (
        <section className="panneau" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 className="panneau-titre"><Building2 size={16} aria-hidden="true" /> Ses annonces</h2>
          <div className="fiche-annonces">
            {f.annonces.map((a) => {
              const statut = STATUT_ANNONCE[a.statut] ?? { label: a.statut, ton: 'neutre' as const }
              return (
                <article key={a.id} className="fiche-annonce">
                  {a.photo
                    ? <img src={a.photo} alt="" loading="lazy" className="fiche-annonce-photo" />
                    : <div className="fiche-annonce-photo" aria-hidden="true" />}
                  <div className="fiche-annonce-texte">
                    <p className="tableau-fort">{a.nom}</p>
                    <p className="tableau-second">
                      {[a.quartier, a.ville].filter(Boolean).join(', ')} · {a.logements} logement{a.logements > 1 ? 's' : ''}
                      {a.prix_min ? ` · dès ${fcfa(a.prix_min)}` : ''}
                    </p>
                    <div className="fiche-annonce-bas">
                      <Badge ton={statut.ton}>{statut.label}</Badge>
                      {a.statut === 'validee' && (
                        <Link to={`/hebergements/${a.id}/`} className="text-sm underline underline-offset-2">Voir la fiche</Link>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <div className="console-grille console-grille-2">
        {proprietaire && <Reservations titre="Réservations reçues" lignes={f.reservations_recues} avecClient />}
        <Reservations titre="Ses réservations" lignes={f.reservations} avecClient={false} />
      </div>

      {f.journal.length > 0 && (
        <section className="panneau" style={{ marginTop: 'var(--space-4)' }}>
          <h2 className="panneau-titre">Décisions de l’administration</h2>
          <ul className="fiche-lignes">
            {f.journal.map((j) => (
              <li key={j.id}>
                <div>
                  <p className="tableau-fort">{j.action}{j.cible_libelle ? ` · ${j.cible_libelle}` : ''}</p>
                  <p className="tableau-second">{dateCourte(j.created_at, 'fr')} · {j.auteur_nom}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
