/** Faire défiler jusqu'au formulaire, sans animation si le visiteur l'a demandé. */
export function allerAuFormulaire(id = 'demande'): void {
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' })
}
