import { useState } from 'react'
import { BellRing } from 'lucide-react'
import api from '../../services/api'
import { messageErreur } from '../../lib/erreurs'
import Button from '../../components/ui/Button'
import { Bloc, Ligne, Alerte } from '../../components/console/Sonde'

interface Empreinte {
  presente: boolean
  longueur: number
  debut: string | null
  espaces_en_bout: boolean
}

interface Sonde {
  actif_declare: boolean
  extensions: Record<string, boolean>
  cles: { sujet: string; publique: Empreinte; privee: { presente: boolean } }
  abonnements: number
  signature: { ok: boolean; entetes?: string[]; erreur?: string }
  verdict: string
}

/**
 * Sonde des notifications, dans l'espace d'administration.
 *
 * Elle existait côté serveur, mais je l'avais donnée comme une adresse à
 * ouvrir dans le navigateur — ce qui répond « non authentifié », le jeton
 * vivant dans le stockage local et non dans un cookie. Exactement l'erreur
 * déjà commise sur la sonde d'encaissement, et déjà consignée dans son
 * fichier. Une sonde qu'on ne peut pas atteindre ne sert à rien.
 *
 * Ce qu'elle vérifie que `/api/configuration` ne vérifie pas : la signature
 * aboutit réellement. Une clé tronquée ou une paire dépareillée passe le
 * contrôle de présence, et le premier envoi échoue en silence.
 */
export default function AdminNotifications() {
  const [sonde, setSonde] = useState<Sonde | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  const lancer = async () => {
    setChargement(true)
    setErreur('')
    try {
      const { data } = await api.get<Sonde>('/admin/diagnostic/notifications')
      setSonde(data)
    } catch (err) {
      setErreur(messageErreur(err, "La sonde n'a pas pu être exécutée."))
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="console-titre">Notifications</h1>
      <p className="console-sous-titre">
        Signe un vrai jeton VAPID avec les clés en place. Aucun message n'est envoyé,
        aucun abonné n'est touché, et la clé privée n'est jamais affichée.
      </p>

      <div className="console-filtres">
        <Button
          variante="primaire"
          taille="md"
          disabled={chargement}
          chargement={chargement}
          onClick={lancer}
          iconeAvant={<BellRing size={16} />}
        >
          Vérifier les notifications
        </Button>
      </div>

      {erreur && <Alerte ton="danger">{erreur}</Alerte>}

      {sonde && (
        <>
          {/* Le verdict d'abord : c'est la réponse à la question posée. Le
              détail sert à comprendre, pas à conclure. */}
          <Alerte ton={sonde.signature.ok ? 'succes' : 'danger'}>
            {sonde.verdict}
          </Alerte>

          <Bloc titre="Signature">
            <Ligne
              libelle="Jeton VAPID signé"
              valeur={sonde.signature.ok ? 'oui' : 'non'}
              bon={sonde.signature.ok}
            />
            {sonde.signature.entetes && (
              <Ligne libelle="En-têtes produits" valeur={sonde.signature.entetes.join(', ')} />
            )}
            {sonde.signature.erreur && (
              <Ligne libelle="Erreur" valeur={sonde.signature.erreur} bon={false} />
            )}
          </Bloc>

          <Bloc titre="Clés">
            <Ligne libelle="Sujet" valeur={sonde.cles.sujet || 'absent'} bon={Boolean(sonde.cles.sujet)} />
            <Ligne
              libelle="Clé publique"
              valeur={
                sonde.cles.publique.presente
                  ? `${sonde.cles.publique.debut}… · ${sonde.cles.publique.longueur} caractères`
                    + (sonde.cles.publique.espaces_en_bout ? ' · espace en bout !' : '')
                  : 'absente'
              }
              bon={sonde.cles.publique.presente && !sonde.cles.publique.espaces_en_bout}
            />
            <Ligne
              libelle="Clé privée"
              valeur={sonde.cles.privee.presente ? 'posée' : 'absente'}
              bon={sonde.cles.privee.presente}
            />
          </Bloc>

          <Bloc titre="État">
            <Ligne
              libelle="Notifications ouvertes"
              valeur={sonde.actif_declare ? 'oui' : 'non'}
              bon={sonde.actif_declare}
            />
            <Ligne libelle="Appareils abonnés" valeur={String(sonde.abonnements)} />
          </Bloc>

          <Bloc titre="Extensions PHP">
            {Object.entries(sonde.extensions).map(([nom, presente]) => (
              <Ligne
                key={nom}
                libelle={nom}
                valeur={presente ? 'chargée' : 'absente'}
                // `gmp` ne sert qu'à générer une paire, jamais à envoyer :
                // son absence n'est pas un défaut. La signaler en rouge
                // enverrait chercher au mauvais endroit.
                bon={nom === 'gmp' ? undefined : presente}
              />
            ))}
            <p className="text-xs th-text-3 mt-3">
              gmp n'est nécessaire qu'à <code>php artisan push:cles</code>, qui génère
              la paire. L'envoi fonctionne sans elle.
            </p>
          </Bloc>
        </>
      )}
    </div>
  )
}
