import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'
import type { TypeTarif } from '../types'

interface MoyenPaiement {
  cle: string
  nom: string
}

/**
 * Une catégorie est un triplet : unité de prix, formules autorisées, jeu de
 * filtres. Elle vient de la base — ajouter « studio meublé » ne doit pas
 * demander de redéployer le front.
 */
export interface Categorie {
  cle: string
  nom: string
  nom_pluriel: string
  unite_prix: TypeTarif
  formules: TypeTarif[]
  filtres: string[] | null
}

/** Une zone de livraison de la boutique, telle que le serveur la declare. */
export interface ZoneLivraison {
  nom: string
  frais: number
  delai: string
}

interface Configuration {
  /**
   * Faux tant que le serveur n'a pas répondu.
   *
   * Sans cette distinction, « pas encore su » se confond avec « fermé » : les
   * écrans de la boutique redirigeaient vers l'accueil au premier rendu, avant
   * même que la réponse arrive, et l'URL affichait la page d'accueil.
   *
   * Passe à vrai aussi quand toutes les reprises ont échoué : on ne sait
   * toujours pas, mais faire tourner un chargement à l'infini est pire que
   * d'appliquer le repli.
   */
  chargee: boolean
  categories: Categorie[]
  paiement: {
    actif: boolean
    moyens: MoyenPaiement[]
    /** Plancher imposé par le prestataire, en FCFA. */
    montant_minimum: number
  }
  notifications: {
    /** Faux tant que les clés VAPID ne sont pas posées sur le serveur. */
    actives: boolean
    /** Clé publique VAPID, destinée à `pushManager.subscribe`. */
    cle_publique: string | null
  }
  boutique: {
    /** Faux tant que BOUTIQUE_ACTIVE n'est pas levée : la boutique n'existe alors nulle part. */
    actif: boolean
    /** Les frais viennent du serveur : le client doit connaître son total avant de payer. */
    zones: Record<string, ZoneLivraison>
    /** Le paiement à la livraison est-il proposé ? */
    livraison: boolean
  }
}

/**
 * Repli prudent : tant que le serveur n'a pas répondu, on considère le paiement
 * inactif. Mieux vaut annoncer « bientôt » à tort une seconde que proposer un
 * règlement qui n'aboutirait pas.
 */
const DEFAUT: Configuration = {
  chargee: false,
  categories: [],
  paiement: {
    actif: false,
    moyens: [
      { cle: 'wave', nom: 'Wave' },
      { cle: 'orange_money', nom: 'Orange Money' },
    ],
    montant_minimum: 200,
  },
  // Repli identique au paiement : tant que le serveur n'a pas répondu, on
  // n'affiche pas de bouton d'activation qui n'aboutirait pas.
  notifications: { actives: false, cle_publique: null },
  // Boutique fermée par défaut : elle ne doit apparaître nulle part tant que
  // le serveur ne l'a pas confirmée ouverte.
  boutique: { actif: false, zones: {}, livraison: false },
}

const ConfigContext = createContext<Configuration>(DEFAUT)

/** Attentes entre tentatives. La dernière couvre un démarrage à froid de l'API. */
const REPRISES = [1000, 3000, 8000]

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Configuration>(DEFAUT)

  useEffect(() => {
    const controleur = new AbortController()
    let minuteur: ReturnType<typeof setTimeout> | undefined

    // Une seule requête ne suffit pas. L'API redémarre à chaque changement de
    // variable d'environnement, et l'hébergement s'endort entre deux visites :
    // pendant ces quelques secondes, l'appel échoue. Sans reprise, le repli
    // s'installe pour toute la session — les catégories disparaissent de la
    // recherche et le paiement s'annonce « bientôt disponible » alors qu'il est
    // ouvert. Le symptôme ne ressemble en rien à sa cause, qui est réseau.
    const demander = (essai = 0) => {
      api.get('/configuration', { signal: controleur.signal })
        .then((res) => setConfig({ ...DEFAUT, ...res.data, chargee: true }))
        .catch((err) => {
          if (controleur.signal.aborted || err?.code === 'ERR_CANCELED') return
          const attente = REPRISES[essai]
          if (attente === undefined) {
            // Le repli s'applique, l'interface reste cohérente. On marque
            // néanmoins la configuration comme « connue » : un écran qui
            // attend indéfiniment est pire qu'un écran qui applique le repli.
            setConfig((c) => ({ ...c, chargee: true }))

            return
          }
          minuteur = setTimeout(() => demander(essai + 1), attente)
        })
    }

    demander()

    return () => {
      controleur.abort()
      clearTimeout(minuteur)
    }
  }, [])

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- convention des modules de contexte : le hook vit auprès de son provider
export function useConfig() {
  return useContext(ConfigContext)
}
