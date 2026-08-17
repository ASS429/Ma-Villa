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

interface Configuration {
  categories: Categorie[]
  paiement: {
    actif: boolean
    moyens: MoyenPaiement[]
  }
}

/**
 * Repli prudent : tant que le serveur n'a pas répondu, on considère le paiement
 * inactif. Mieux vaut annoncer « bientôt » à tort une seconde que proposer un
 * règlement qui n'aboutirait pas.
 */
const DEFAUT: Configuration = {
  categories: [],
  paiement: {
    actif: false,
    moyens: [
      { cle: 'wave', nom: 'Wave' },
      { cle: 'orange_money', nom: 'Orange Money' },
    ],
  },
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
        .then((res) => setConfig({ ...DEFAUT, ...res.data }))
        .catch((err) => {
          if (controleur.signal.aborted || err?.code === 'ERR_CANCELED') return
          const attente = REPRISES[essai]
          if (attente === undefined) return // le repli s'applique, l'interface reste cohérente
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
