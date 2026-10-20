import { Link, type LinkProps } from 'react-router-dom'
import { useLangue } from './langue'

/**
 * Un `Link` qui garde la langue de la page.
 *
 * Sur une page anglaise, `<Lien to="/hebergements/">` mène à
 * `/en/hebergements/`. Sans lui, chaque lien d'une page traduite ramènerait au
 * français, et le visiteur devrait rechoisir sa langue à chaque clic.
 */
export default function Lien({ to, ...reste }: Omit<LinkProps, 'to'> & { to: string }) {
  const { lien } = useLangue()
  return <Link {...reste} to={lien(to)} />
}
