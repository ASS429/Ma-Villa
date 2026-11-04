/**
 * Propose un fichier préparé dans le navigateur (ou reçu par l'API) à
 * l'enregistrement. La révocation attend : certains navigateurs lisent l'adresse
 * après le clic, et une révocation immédiate leur donne un fichier vide.
 */
export function enregistrerFichier(contenu: Blob, nom: string): void {
  const url = URL.createObjectURL(contenu)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
