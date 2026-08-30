import { useState } from 'react'
import { Send } from 'lucide-react'
import api from '../../services/api'
import { messageErreur } from '../../lib/erreurs'
import { fcfa } from '../../lib/format'
import Button from '../../components/ui/Button'
import { Bloc, Ligne, Alerte } from '../../components/console/Sonde'

interface Sonde {
  automatique_actif: boolean
  montant_minimum: number
  moyens: Record<string, string>
  url_rappel: string
  initiation: { ok: boolean; code?: string | null; verdict: string; jeton?: string | null }
  en_cours?: number
  echoues?: number
}

/**
 * Sonde du déboursement — répond à « PayDunya nous laisse-t-il enfin verser ? »
 *
 * Elle est sans danger, et ce n'est pas un hasard : l'API se déroule en deux
 * temps, et cette sonde ne fait que le premier. Un jeton créé reste « created »
 * tant qu'il n'est pas soumis — la documentation PayDunya est formelle. Aucun
 * franc ne peut partir en cliquant ici.
 *
 * À lancer depuis cet écran, jamais en ouvrant l'adresse d'API dans un onglet :
 * le jeton vit dans le stockage local, pas dans un cookie, et la réponse serait
 * « non authentifié ». C'est l'erreur déjà commise sur les deux autres sondes.
 */
export default function AdminDeboursement() {
  const [sonde, setSonde] = useState<Sonde | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  const lancer = async () => {
    setChargement(true)
    setErreur('')
    try {
      const { data } = await api.get<Sonde>('/admin/diagnostic/reversement')
      setSonde(data)
    } catch (err) {
      setErreur(messageErreur(err, "La sonde n'a pas pu être exécutée."))
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="console-titre">Déboursement</h1>
      <p className="console-sous-titre">
        Demande à PayDunya un jeton de versement, et <strong>s'arrête là</strong>.
        Un jeton non soumis reste sans effet : aucun argent ne bouge. C'est le seul
        moyen de savoir si l'option « Paiement Et Redistribution » a été ouverte
        sur le compte marchand.
      </p>

      <div className="console-filtres">
        <Button
          variante="primaire"
          taille="md"
          disabled={chargement}
          chargement={chargement}
          onClick={lancer}
          iconeAvant={<Send size={16} />}
        >
          Tester l'autorisation
        </Button>
      </div>

      {erreur && <Alerte ton="danger">{erreur}</Alerte>}

      {sonde && (
        <>
          {/* Le verdict d'abord : c'est la réponse à la question posée. Le
              détail sert à comprendre, pas à conclure. */}
          <Alerte ton={sonde.initiation.ok ? 'succes' : 'danger'}>
            {sonde.initiation.verdict}
          </Alerte>

          <Bloc titre="Autorisation">
            <Ligne
              libelle="Initiation acceptée"
              valeur={sonde.initiation.ok ? 'oui' : 'non'}
              bon={sonde.initiation.ok}
            />
            {sonde.initiation.code && (
              <Ligne libelle="Code PayDunya" valeur={sonde.initiation.code} bon={sonde.initiation.ok} />
            )}
            {sonde.initiation.jeton && (
              <Ligne libelle="Jeton créé (non soumis)" valeur={sonde.initiation.jeton} />
            )}
          </Bloc>

          <Bloc titre="Réglages">
            <Ligne
              libelle="Versement automatique"
              valeur={sonde.automatique_actif ? 'actif' : 'inactif'}
              bon={sonde.automatique_actif}
            />
            <Ligne libelle="Montant minimum" valeur={fcfa(sonde.montant_minimum)} />
            <Ligne libelle="Moyens desservis" valeur={Object.values(sonde.moyens ?? {}).join(', ')} />
            {/* PayDunya refuse l'initiation si cette URL ne répond pas depuis
                l'extérieur : c'est une cause d'échec qu'on ne devinerait pas. */}
            <Ligne libelle="URL de rappel" valeur={sonde.url_rappel} />
          </Bloc>

          {(sonde.en_cours !== undefined || sonde.echoues !== undefined) && (
            <Bloc titre="Versements">
              <Ligne libelle="En cours" valeur={String(sonde.en_cours ?? 0)} />
              <Ligne
                libelle="Échoués"
                valeur={String(sonde.echoues ?? 0)}
                bon={(sonde.echoues ?? 0) === 0}
              />
              <p className="text-xs th-text-3 mt-3">
                Un versement en cours est tranché par <code>php artisan
                passetemps:suivre-reversements</code>, au cas où le rappel de PayDunya
                n'arriverait jamais. Un échec rend ses paiements à la file.
              </p>
            </Bloc>
          )}
        </>
      )}
    </div>
  )
}
