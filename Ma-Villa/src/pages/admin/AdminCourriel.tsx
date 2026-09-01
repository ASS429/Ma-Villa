import { useState } from 'react'
import { Mail } from 'lucide-react'
import api from '../../services/api'
import { messageErreur } from '../../lib/erreurs'
import Button from '../../components/ui/Button'
import FloatingInput from '../../components/FloatingInput'
import { Bloc, Ligne, Alerte } from '../../components/console/Sonde'

interface Sonde {
  ok: boolean
  verdict: string
  transport: string
  expediteur: string | null
  nom_affiche: string | null
  hote: string | null
  port: number | null
  transports_connus: string[]
  avertissements?: { sujet: string; message: string }[]
  envoi?: { tente: boolean; ok?: boolean; erreur?: string; destinataire?: string }
}

/**
 * La sonde du courrier — la quatrième, et celle qui manquait le plus.
 *
 * Trois sondes couvraient l'encaissement, les notifications et le
 * déboursement. Le courrier n'en avait aucune, alors qu'il porte la seule
 * chose qu'un utilisateur ne peut pas contourner : **récupérer son compte**.
 * Sans SMS, un mot de passe oublié se répare par courriel ou pas du tout.
 *
 * Et la panne est silencieuse par construction : « Mot de passe oublié »
 * répond toujours « si un compte existe, un lien vient d'être envoyé », qu'il
 * ait envoyé ou non. C'est volontaire — cela évite de dire qui est inscrit —
 * mais le même silence cache une panne totale à l'exploitant, qui ne
 * l'apprend que par un utilisateur bloqué.
 *
 * ⚠️ Le test **envoie un vrai message**. D'où le champ : rien ne part sans
 * qu'une adresse ait été saisie.
 */
export default function AdminCourriel() {
  const [sonde, setSonde] = useState<Sonde | null>(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [destinataire, setDestinataire] = useState('')

  async function lancer(avecEnvoi: boolean) {
    setChargement(true)
    setErreur('')
    try {
      const { data } = await api.get('/admin/diagnostic/courriel', {
        params: avecEnvoi && destinataire ? { email: destinataire } : {},
      })
      setSonde(data)
    } catch (e) {
      setErreur(messageErreur(e, "La sonde n'a pas répondu."))
    } finally {
      setChargement(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="console-titre">Courrier</h1>
      <p className="console-sous-titre">
        C'est le courrier qui porte la récupération des comptes. Sans SMS, un mot de
        passe oublié se répare par courriel ou pas du tout — et « Mot de passe oublié »
        répond la même chose qu'il ait envoyé ou non. C'est ici, et nulle part ailleurs,
        qu'on sait.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <Button variante="primaire" taille="md" disabled={chargement} onClick={() => lancer(false)}>
          {chargement ? 'Vérification…' : 'Vérifier la configuration'}
        </Button>
      </div>

      {erreur && <Alerte ton="danger">{erreur}</Alerte>}

      {sonde && (
        <>
          {/* Le verdict d'abord : c'est la réponse à la question posée. */}
          <Alerte ton={sonde.ok ? 'succes' : 'danger'}>{sonde.verdict}</Alerte>

          {/* Ce qui part sans erreur mais arrive mal, ou signé du mauvais
              nom. Aucun envoi de test ne le révèle : le message part, et
              c'est chez le destinataire que ça se voit. */}
          {sonde.avertissements && sonde.avertissements.length > 0 && (
            <Bloc titre="À corriger avant d'écrire à de vrais utilisateurs">
              <ul className="sonde-avertissements">
                {sonde.avertissements.map((a) => (
                  <li key={a.sujet}>
                    <strong>{a.sujet}</strong>
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            </Bloc>
          )}

          <Bloc titre="Configuration">
            <Ligne
              libelle="Transport"
              valeur={sonde.transport}
              bon={sonde.transport !== 'log' && sonde.transport !== 'array'}
            />
            <Ligne libelle="Adresse d'expédition" valeur={sonde.expediteur ?? 'absente'} bon={!!sonde.expediteur} />
            {sonde.nom_affiche && <Ligne libelle="Nom affiché" valeur={sonde.nom_affiche} />}
            {sonde.hote && <Ligne libelle="Hôte" valeur={`${sonde.hote}${sonde.port ? ` : ${sonde.port}` : ''}`} />}
          </Bloc>

          {/* L'envoi réel n'est proposé qu'une fois la configuration lue :
              inutile d'expédier quoi que ce soit si le transport vaut « log ». */}
          <Bloc titre="Envoi de test">
            <p className="text-sm th-text-2 mb-4">
              Un message part réellement à l'adresse indiquée. Vérifiez la boîte
              <strong> et les indésirables</strong> : un domaine d'expédition sans SPF
              ni DKIM part bien et arrive mal.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <FloatingInput
                  label="Adresse de test"
                  type="email"
                  value={destinataire}
                  onChange={(e) => setDestinataire(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <Button
                variante="secondaire"
                taille="md"
                disabled={chargement || !destinataire.trim()}
                onClick={() => lancer(true)}
              >
                {chargement ? 'Envoi…' : 'Envoyer un test'}
              </Button>
            </div>

            {sonde.envoi?.tente && (
              <div className="mt-4">
                <Ligne
                  libelle="Envoi"
                  valeur={sonde.envoi.ok ? `parti vers ${sonde.envoi.destinataire}` : 'refusé'}
                  bon={sonde.envoi.ok}
                />
                {sonde.envoi.erreur && (
                  // La réponse du service, telle quelle : elle nomme presque
                  // toujours la cause — identifiants, port, domaine non vérifié.
                  <Ligne libelle="Réponse du service" valeur={sonde.envoi.erreur} bon={false} />
                )}
              </div>
            )}
          </Bloc>

          {!sonde.ok && sonde.transport === 'log' && (
            <Bloc titre="Ce qu'il faut poser">
              <p className="text-sm th-text-2">
                Sur Railway : <code>MAIL_MAILER</code> vers un transport réel
                (<code>smtp</code>, ou celui du service choisi), puis <code>MAIL_HOST</code>,
                <code> MAIL_PORT</code>, <code>MAIL_USERNAME</code>, <code>MAIL_PASSWORD</code>.
                L'adresse d'expédition doit appartenir à un domaine que vous contrôlez,
                avec SPF et DKIM — sinon les messages partent et finissent en indésirables.
              </p>
            </Bloc>
          )}
        </>
      )}

      {!sonde && !chargement && (
        <div className="console-vide">
          <span className="console-vide-icone"><Mail size={22} /></span>
          <p>Lancez la vérification pour savoir si le courrier part réellement.</p>
        </div>
      )}
    </div>
  )
}
