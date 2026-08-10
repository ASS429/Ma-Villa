/**
 * Fond du hero — planche 03.
 *
 * Une image, jamais de vidéo. Le hero doit rester utile sur un forfait data
 * payé au volume : la vidéo précédente venait d'une URL tierce héritée d'un
 * gabarit, pesait 5 Mo et tournait même sur les pages applicatives.
 *
 * L'image, elle, porte une information — c'est la promesse du produit — ce qui
 * justifie son poids. Elle reste sous le budget de 180 Ko fixé par le design.
 */
export default function FondHero() {
  return (
    <>
      <picture>
        <source srcSet="/hero-poster.webp" type="image/webp" />
        <img
          src="/hero-poster.jpg"
          alt=""
          /* Décorative : le sens est porté par le titre juste à côté. */
          aria-hidden="true"
          /* Seule image que le visiteur voit immédiatement : elle ne doit pas
             être différée, et sa priorité de chargement passe devant le reste. */
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>

      {/* Voile de lisibilité : le titre et la barre de recherche sont posés
          dessus, et la photo varie d'une saison à l'autre. */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(20,14,10,.55) 0%, rgba(20,14,10,.35) 45%, rgba(20,14,10,.62) 100%)' }}
        aria-hidden="true"
      />
    </>
  )
}
