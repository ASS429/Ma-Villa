import { useState } from 'react'
import api from '../../services/api'
import { messageErreur } from '../../lib/erreurs'
import Button from '../../components/ui/Button'

interface EmpreinteCle {
  renseignee: boolean
  debut: string
  longueur: number
  espaces_au_bout: boolean
}

interface Sonde {
  paiement_actif: boolean
  mode_declare: string
  cles: Record<string, EmpreinteCle>
  softpay_disponible: boolean
  repli_checkout: boolean
  facture: { ok: boolean; jeton?: string; url?: string; erreur?: string }
  softpay?: {
    essaye: boolean
    note?: string
    methode?: string
    ok?: boolean
    url?: string | null
    url_application?: string | null
    url_maxit?: string | null
    erreur?: string
  }
}

const LIBELLES_CLES: Record<string, string> = {
  maitre: 'Clé maîtresse',
  privee: 'Clé privée',
  publique: 'Clé publique',
  token: 'Token',
}

/**
 * Sonde de l'encaissement, dans l'espace d'administration.
 *
 * Elle existait déjà côté serveur, mais n'était atteignable qu'en collant une
 * requête dans la console : ouvrir son adresse dans la barre du navigateur
 * renvoie « non authentifié », le jeton vivant dans le stockage local et non
 * dans un cookie. Trois tentatives ont buté là-dessus — le défaut était l'outil,
 * pas celui qui s'en servait.
 */
export default function AdminPaiement() {
  const [sonde, setSonde] = useState<Sonde | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [telephone, setTelephone] = useState('')
  const [methode, setMethode] = useState<'wave' | 'orange_money'>('wave')

  const lancer = async (avecSoftpay: boolean) => {
    setChargement(true)
    setErreur('')
    try {
      const params = avecSoftpay
        ? { telephone: telephone.replace(/\D/g, ''), methode }
        : undefined
      const { data } = await api.get<Sonde>('/admin/diagnostic/paiement', { params })
      setSonde(data)
    } catch (err) {
      setErreur(messageErreur(err, 'La sonde n\'a pas pu être exécutée.'))
    } finally {
      setChargement(false)
    }
  }

  const numeroValide = telephone.replace(/\D/g, '').length >= 9

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-normal mb-2">Encaissement</h1>
      <p className="text-sm th-text-2 mb-8">
        Interroge PayDunya avec les clés en place et rapporte sa réponse exacte. Aucune
        réservation n'est créée. Les clés ne sont jamais affichées.
      </p>

      <div className="flex flex-wrap gap-3 mb-8">
        <Button variante="primaire" taille="md" disabled={chargement} onClick={() => lancer(false)}>
          {chargement ? 'Interrogation…' : 'Vérifier la configuration'}
        </Button>
      </div>

      {erreur && <Alerte ton="danger">{erreur}</Alerte>}

      {sonde && (
        <>
          <Bloc titre="Configuration">
            <Ligne libelle="Paiement ouvert aux clients" valeur={sonde.paiement_actif ? 'oui' : 'non'} bon={sonde.paiement_actif} />
            <Ligne libelle="Mode déclaré" valeur={sonde.mode_declare} />
            <Ligne
              libelle="SoftPay utilisable"
              valeur={sonde.softpay_disponible ? 'oui' : 'non — clés de test'}
              bon={sonde.softpay_disponible}
            />
            <Ligne libelle="Repli sur la page PayDunya" valeur={sonde.repli_checkout ? 'autorisé' : 'refusé'} />
          </Bloc>

          <Bloc titre="Clés">
            {Object.entries(sonde.cles).map(([nom, cle]) => (
              <Ligne
                key={nom}
                libelle={LIBELLES_CLES[nom] ?? nom}
                valeur={
                  cle.renseignee
                    ? `${cle.debut}… · ${cle.longueur} caractères${cle.espaces_au_bout ? ' · espace en fin !' : ''}`
                    : 'absente'
                }
                bon={cle.renseignee && !cle.espaces_au_bout}
              />
            ))}
          </Bloc>

          <Bloc titre="Création de facture">
            {sonde.facture.ok ? (
              <Alerte ton="succes">
                PayDunya accepte nos clés. Facture de sonde <code>{sonde.facture.jeton}</code>.
              </Alerte>
            ) : (
              <Alerte ton="danger">{sonde.facture.erreur}</Alerte>
            )}
          </Bloc>

          {sonde.facture.ok && (
            <Bloc titre="SoftPay — ouverture directe de l'application">
              {sonde.softpay?.ok && (
                <Alerte ton="succes">
                  SoftPay répond. Lien : <code className="break-all">{sonde.softpay.url}</code>
                </Alerte>
              )}
              {sonde.softpay?.essaye && sonde.softpay.ok === false && (
                <Alerte ton="danger">{sonde.softpay.erreur}</Alerte>
              )}

              <p className="text-sm th-text-2 mb-4">
                Envoie une demande de <strong>100 FCFA</strong> sur le numéro indiqué. Rien
                n'est débité tant que vous ne validez pas dans l'application.
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs th-text-2">Numéro</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="77 123 45 67"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    className="champ-controle"
                    style={{ minWidth: 180 }}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs th-text-2">Moyen</span>
                  <select
                    value={methode}
                    onChange={(e) => setMethode(e.target.value as 'wave' | 'orange_money')}
                    className="champ-controle"
                  >
                    <option value="wave">Wave</option>
                    <option value="orange_money">Orange Money</option>
                  </select>
                </label>

                <Button
                  variante="secondaire"
                  taille="md"
                  disabled={chargement || !numeroValide}
                  onClick={() => lancer(true)}
                >
                  Tester SoftPay
                </Button>
              </div>
            </Bloc>
          )}
        </>
      )}
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-6 mb-5"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <h2 className="text-sm font-semibold mb-4 th-text-1">{titre}</h2>
      {children}
    </section>
  )
}

function Ligne({ libelle, valeur, bon }: { libelle: string; valeur: string; bon?: boolean }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 py-2 text-sm"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span className="th-text-2">{libelle}</span>
      <span
        className="font-medium text-right"
        style={{ color: bon === undefined ? 'var(--text-1)' : bon ? 'var(--success)' : 'var(--danger)' }}
      >
        {valeur}
      </span>
    </div>
  )
}

function Alerte({ ton, children }: { ton: 'succes' | 'danger'; children: React.ReactNode }) {
  const couleur = ton === 'succes' ? 'var(--success)' : 'var(--danger)'

  return (
    <p
      className="rounded-xl px-4 py-3 text-sm mb-4"
      role={ton === 'danger' ? 'alert' : 'status'}
      style={{
        background: `color-mix(in srgb, ${couleur} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${couleur} 25%, transparent)`,
        color: couleur,
      }}
    >
      {children}
    </p>
  )
}
