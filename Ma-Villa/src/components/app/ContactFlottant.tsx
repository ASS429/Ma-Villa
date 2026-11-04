import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Mail, MessageCircle, X } from 'lucide-react'
import IconeReseau from '../IconeReseau'
import RESEAUX from '../../reseaux.json'
import COORDONNEES from '../../coordonnees.json'
import { lienCourriel, lienWhatsApp } from '../../lib/contact'
import { sansChassis } from '../../lib/chassis'
import { cheminSansLangue, useLangue } from '../../i18n/langue'
import { COMMUN } from '../../i18n/commun'

/** En partant du bouton : écrire d'abord, suivre ensuite. */
const ORDRE_RESEAUX = ['instagram', 'facebook', 'tiktok', 'snapchat', 'chaine-whatsapp', 'groupe-whatsapp']

interface Lien {
  cle: string
  ton: string
  nom: string
  href: string
  icone: ReactNode
}

/**
 * Le bouton flottant : nous écrire et nous suivre, depuis n'importe quel écran.
 *
 * Fermé, il n'occupe qu'un rond en bas à droite. Ouvert, les liens montent
 * au-dessus de lui, sans voile ni fenêtre : la page reste lisible et
 * utilisable derrière. Un second appui, Échap, un clic ailleurs ou un
 * changement de page les replient.
 *
 * Absent des écrans qui se passent du châssis (tunnel de paiement, console) :
 * proposer Instagram au moment de payer, c'est inviter à partir.
 */
export default function ContactFlottant() {
  const { pathname: brut } = useLocation()
  const { langue } = useLangue()
  const t = COMMUN[langue].flottant
  // Ouvert « sur » une page : en changer le referme, sans effet à écrire.
  const [ouvertSur, setOuvertSur] = useState<string | null>(null)
  const ouvert = ouvertSur === brut
  const racine = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const [souleve, setSouleve] = useState(0)
  const souleveActuel = useRef(0)

  // Ce qui ne doit pas passer sous le bouton (la recherche de l'accueil, qui
  // occupe le bas du premier écran) le fait monter d'autant, le temps qu'il
  // est dessous. Marqué `data-evite-flottant` là où il est rendu.
  useEffect(() => {
    let image = 0
    const mesurer = () => {
      image = 0
      const b = bouton.current?.getBoundingClientRect()
      if (!b) return
      const haut = b.top + souleveActuel.current
      const bas = b.bottom + souleveActuel.current
      let besoin = 0
      document.querySelectorAll<HTMLElement>('[data-evite-flottant]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.right <= b.left || r.left >= b.right) return
        if (r.top < bas && r.bottom > haut) besoin = Math.max(besoin, Math.ceil(bas - r.top + 12))
      })
      if (besoin !== souleveActuel.current) {
        souleveActuel.current = besoin
        setSouleve(besoin)
      }
    }
    const demander = () => { if (!image) image = requestAnimationFrame(mesurer) }
    demander()
    window.addEventListener('scroll', demander, { passive: true })
    window.addEventListener('resize', demander)
    return () => {
      cancelAnimationFrame(image)
      window.removeEventListener('scroll', demander)
      window.removeEventListener('resize', demander)
    }
  }, [brut])

  useEffect(() => {
    if (!ouvert) return
    const clavier = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOuvertSur(null)
      bouton.current?.focus()
    }
    const dehors = (e: PointerEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvertSur(null)
    }
    document.addEventListener('keydown', clavier)
    document.addEventListener('pointerdown', dehors)
    return () => {
      document.removeEventListener('keydown', clavier)
      document.removeEventListener('pointerdown', dehors)
    }
  }, [ouvert])

  const chemin = cheminSansLangue(brut)
  if (sansChassis(chemin)) return null

  // La page d'où l'on écrit : l'équipe sait tout de suite de quoi on lui parle.
  const page = chemin === '/' ? undefined : `${window.location.origin}${brut}`

  const liens: Lien[] = [
    {
      cle: 'whatsapp',
      ton: 'whatsapp',
      nom: t.ecrire,
      href: lienWhatsApp(COORDONNEES.whatsapp, t.message(page)),
      icone: <IconeReseau icone="whatsapp" taille={22} />,
    },
    {
      cle: 'email',
      ton: 'courriel',
      nom: t.email,
      href: lienCourriel(COORDONNEES.email, t.objet),
      icone: <Mail size={20} aria-hidden="true" />,
    },
    ...ORDRE_RESEAUX.flatMap((cle) => {
      const r = RESEAUX.find((x) => x.cle === cle)
      return r
        ? [{ cle, ton: r.icone, nom: langue === 'en' ? r.nom_en : r.nom, href: r.url, icone: <IconeReseau icone={r.icone} taille={20} /> }]
        : []
    }),
  ]

  return (
    <div
      ref={racine}
      className={`flottant${ouvert ? ' est-ouvert' : ''}`}
      style={{ '--flottant-souleve': `${souleve}px` } as CSSProperties}
    >
      <button
        ref={bouton}
        type="button"
        className="flottant-bouton"
        aria-expanded={ouvert}
        aria-controls="flottant-liens"
        aria-label={ouvert ? t.fermer : t.ouvrir}
        title={ouvert ? t.fermer : t.ouvrir}
        onClick={() => setOuvertSur(ouvert ? null : brut)}
      >
        <MessageCircle className="flottant-icone flottant-icone-ouvrir" size={26} aria-hidden="true" />
        <X className="flottant-icone flottant-icone-fermer" size={24} aria-hidden="true" />
      </button>

      <nav aria-label={t.region} aria-hidden={!ouvert}>
        <ul id="flottant-liens" className="flottant-liste">
          {liens.map((l, i) => (
            <li key={l.cle} className="flottant-item" style={{ '--i': i } as CSSProperties}>
              <a
                href={l.href}
                {...(l.cle === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                className="flottant-lien"
                onClick={() => setOuvertSur(null)}
              >
                <span className="flottant-nom">{l.nom}</span>
                <span className="flottant-rond" data-ton={l.ton}>{l.icone}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
