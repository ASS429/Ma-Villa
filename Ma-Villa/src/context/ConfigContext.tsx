import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

interface MoyenPaiement {
  cle: string
  nom: string
}

interface Configuration {
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
  paiement: {
    actif: false,
    moyens: [
      { cle: 'wave', nom: 'Wave' },
      { cle: 'orange_money', nom: 'Orange Money' },
    ],
  },
}

const ConfigContext = createContext<Configuration>(DEFAUT)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Configuration>(DEFAUT)

  useEffect(() => {
    const controleur = new AbortController()

    api.get('/configuration', { signal: controleur.signal })
      .then((res) => setConfig({ ...DEFAUT, ...res.data }))
      .catch(() => { /* le repli s'applique : l'interface reste cohérente */ })

    return () => controleur.abort()
  }, [])

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- convention des modules de contexte : le hook vit auprès de son provider
export function useConfig() {
  return useContext(ConfigContext)
}
