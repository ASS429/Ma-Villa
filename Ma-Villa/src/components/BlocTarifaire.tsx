import type { Logement, Tarif } from '../types'
import { fcfa } from '../lib/format'
import { FORMULES, tarifLeMoinsCher } from '../lib/tarifs'
import { useLangue } from '../i18n/langue'
import { TEXTES_HEBERGEMENT } from '../i18n/hebergement'
import { METIER, libelleOptionsEn } from '../i18n/metier'

/**
 * Bloc « logements × formules × options » — planche 08.
 *
 * C'est le cœur de ce que la plateforme sait représenter et qu'Airbnb ne sait
 * pas : une même villa loue la villa entière, une chambre ou un appartement,
 * à la nuitée comme à la demi-journée, avec ou sans climatisation ni buffet.
 *
 * Les deux approches de la planche cohabitent, comme arbitré :
 *  — B, la grille, dans le corps de la page : support de décision, on compare.
 *  — A, le parcours guidé, dans le panneau : support de saisie, on choisit.
 * Cliquer une cellule de la grille renseigne le parcours.
 */


/* ─── B — grille tarifaire, tout visible ─────────────────────── */

export function GrilleTarifaire({
  logements,
  tarifChoisi,
  onChoisir,
}: {
  logements: Logement[]
  tarifChoisi: number | null
  onChoisir: (logement: Logement, tarif: Tarif) => void
}) {
  const { langue } = useLangue()
  const t = TEXTES_HEBERGEMENT[langue].grille
  const metier = METIER[langue]

  // Ne garder que les colonnes réellement proposées : afficher quatre colonnes
  // dont trois vides ferait croire à une offre incomplète.
  const colonnes = FORMULES.filter((type) =>
    logements.some((l) => tarifLeMoinsCher(l, type) !== null)
  )

  if (colonnes.length === 0) {
    return (
      <p className="th-text-3 text-sm">
        {t.aucunTarif}
      </p>
    )
  }

  return (
    <div className="grille-tarifs-defilement">
      <table className="grille-tarifs">
        <caption className="sr-only">
          {t.legende}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t.logement}</th>
            {colonnes.map((c) => <th key={c} scope="col">{metier.tarif[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {logements.map((l) => (
            <tr key={l.id} className={l.disponible ? undefined : 'grille-tarifs-indispo'}>
              <th scope="row">
                <span className="grille-tarifs-nom">{l.nom}</span>
                <span className="grille-tarifs-detail">
                  {metier.logement[l.type]} · {l.capacite} {metier.pers}
                  {!l.disponible && t.indisponible}
                </span>
              </th>

              {colonnes.map((type) => {
                const tarif = tarifLeMoinsCher(l, type)

                if (!tarif) {
                  // Une case grisée dit ce qui n'existe pas — l'absence est une
                  // information, la masquer laisserait le client la chercher.
                  return (
                    <td key={type} className="grille-tarifs-vide">
                      <span aria-label={t.nonPropose}>—</span>
                    </td>
                  )
                }

                const actif = tarif.id === tarifChoisi

                return (
                  <td key={type}>
                    <button
                      type="button"
                      className={`grille-tarifs-prix${actif ? ' est-choisi' : ''}`}
                      onClick={() => onChoisir(l, tarif)}
                      disabled={!l.disponible}
                      aria-pressed={actif}
                    >
                      {fcfa(tarif.prix)}
                      {actif && <span className="grille-tarifs-etiquette">{t.choisi}</span>}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── A — parcours guidé, trois temps ────────────────────────── */

export function ParcoursReservation({
  logements,
  logementChoisi,
  tarifChoisi,
  onChoisirLogement,
  onChoisirTarif,
}: {
  logements: Logement[]
  logementChoisi: Logement | null
  tarifChoisi: Tarif | null
  onChoisirLogement: (l: Logement) => void
  onChoisirTarif: (t: Tarif) => void
}) {
  const { langue } = useLangue()
  const t = TEXTES_HEBERGEMENT[langue].grille
  const metier = METIER[langue]
  const disponibles = logements.filter((l) => l.disponible)

  // Étape 3 : à formule choisie, les variantes ne diffèrent que par les options.
  const variantes = logementChoisi && tarifChoisi
    ? logementChoisi.tarifs
        .filter((t) => t.type_tarif === tarifChoisi.type_tarif)
        .sort((a, b) => Number(a.prix) - Number(b.prix))
    : []

  return (
    <div className="parcours">
      <Etape numero={1} titre={t.etapeLogement}>
        <div className="parcours-choix">
          {disponibles.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`parcours-option${logementChoisi?.id === l.id ? ' est-choisi' : ''}`}
              onClick={() => onChoisirLogement(l)}
              aria-pressed={logementChoisi?.id === l.id}
            >
              <span className="parcours-option-nom">{l.nom}</span>
              <span className="parcours-option-detail">
                {metier.logement[l.type]} · {l.capacite} {metier.pers}
              </span>
            </button>
          ))}
        </div>
      </Etape>

      {logementChoisi && (
        <Etape numero={2} titre={t.etapeFormule}>
          <div className="parcours-formules">
            {FORMULES.map((type) => {
              const tarif = tarifLeMoinsCher(logementChoisi, type)
              const actif = tarifChoisi?.type_tarif === type

              // Les formules impossibles sont barrées, pas cachées : le client
              // apprend l'offre sans avoir à la chercher.
              return (
                <button
                  key={type}
                  type="button"
                  className={`parcours-formule${actif ? ' est-choisi' : ''}${tarif ? '' : ' est-impossible'}`}
                  onClick={() => tarif && onChoisirTarif(tarif)}
                  disabled={!tarif}
                  aria-pressed={actif}
                  aria-label={tarif
                    ? `${metier.tarif[type]}, ${fcfa(tarif.prix)}`
                    : t.nonProposePour(metier.tarif[type])}
                >
                  {metier.tarif[type]}
                </button>
              )
            })}
          </div>
        </Etape>
      )}

      {variantes.length > 1 && (
        <Etape numero={3} titre={t.etapeOptions}>
          <div className="parcours-choix">
            {variantes.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`parcours-option${tarifChoisi?.id === v.id ? ' est-choisi' : ''}`}
                onClick={() => onChoisirTarif(v)}
                aria-pressed={tarifChoisi?.id === v.id}
              >
                <span className="parcours-option-nom">{libelleOptionsEn(v, langue)}</span>
                <span className="parcours-option-detail">{fcfa(v.prix)}</span>
              </button>
            ))}
          </div>
        </Etape>
      )}
    </div>
  )
}

function Etape({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <section className="parcours-etape">
      <h3 className="parcours-etape-titre">
        <span className="parcours-etape-numero" aria-hidden="true">{numero}</span>
        {titre}
      </h3>
      {children}
    </section>
  )
}
