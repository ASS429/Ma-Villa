/**
 * Liens pour joindre quelqu'un depuis un numéro écrit pour être lu.
 *
 * Le numéro arrive du serveur sous sa forme lisible (« +221 77 868 47 23 »).
 * `tel:` et WhatsApp veulent des chiffres seuls, indicatif compris : un numéro
 * local de neuf chiffres reçoit donc l'indicatif sénégalais, sans quoi l'appel
 * partirait vers un numéro qui n'existe pas.
 */
function international(numero: string): string {
  const chiffres = numero.replace(/\D/g, '')
  return chiffres.length === 9 ? `221${chiffres}` : chiffres
}

export function lienAppel(numero: string): string {
  return `tel:+${international(numero)}`
}

/** `wa.me` refuse le signe + : l'indicatif s'écrit en chiffres seuls. */
export function lienWhatsApp(numero: string, message?: string): string {
  const base = `https://wa.me/${international(numero)}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export function lienCourriel(adresse: string, objet?: string): string {
  return objet ? `mailto:${adresse}?subject=${encodeURIComponent(objet)}` : `mailto:${adresse}`
}
