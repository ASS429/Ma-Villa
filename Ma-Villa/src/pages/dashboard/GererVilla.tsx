import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import { televerserFichier as uploadFile } from '../../services/televerser'
import { messageErreur } from '../../lib/erreurs'
import { fcfa } from '../../lib/format'
import { LIBELLES_STATUT_VILLA, type StatutVilla } from '../../types'
import ConfirmModal from '../../components/ConfirmModal'

interface Photo { id: number; url: string; alt: string }
interface Tarif { id: number; type_tarif: string; avec_clim: boolean; avec_buffet: boolean; prix: number }
interface Logement { id: number; nom: string; type: string; capacite: number; disponible: boolean; tarifs: Tarif[] }
interface Villa {
  id: number; nom: string; description: string; adresse: string; ville: string;
  telephone: string; latitude: string | null; longitude: string | null; statut: StatutVilla;
  photos: Photo[]; logements: Logement[]
}

const typeLabels: Record<string, string> = {
  villa_entiere: 'Villa entière', appartement: 'Appartement', chambre: 'Chambre', piscine: 'Piscine',
}
const tarifLabels: Record<string, string> = {
  journee: 'Journée', nuitee: 'Nuitée', demi_journee: 'Demi-journée', pass: 'Pass',
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url)
}

/* ─── Sub-components ─────────────────────────────────────────── */

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-6 mb-5"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function SmallField({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--text-3)' }}>{label}</label>
      {/* className est placé après le spread : il écrase celui de l'enfant. */}
      <children.type
        {...children.props}
        className="w-full rounded-lg px-3 py-2 text-sm th-input-field resize-none"
      />
    </div>
  )
}

function InfoRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={`flex ${multiline ? 'flex-col gap-1' : 'items-start gap-3'}`}>
      <span className="text-sm shrink-0 w-24" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{value}</span>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */

export default function GererVilla() {
  const { id } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [villa, setVilla] = useState<Villa | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({ nom: '', description: '', adresse: '', ville: '', telephone: '', latitude: '', longitude: '' })
  const [infoSaving, setInfoSaving] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [erreurPhotos, setErreurPhotos] = useState('')
  const [confirmModal, setConfirmModal] = useState<{ message: string; detail?: string; onConfirm: () => void } | null>(null)
  const [showLogementForm, setShowLogementForm] = useState(false)
  const [showTarifForm, setShowTarifForm] = useState<number | null>(null)
  const [logementForm, setLogementForm] = useState({ nom: '', type: 'chambre', capacite: '1', description: '' })
  const [tarifForm, setTarifForm] = useState({ type_tarif: 'nuitee', prix: '', avec_clim: false, avec_buffet: false })
  const [editingLogement, setEditingLogement] = useState<number | null>(null)
  const [editLogementForm, setEditLogementForm] = useState({ nom: '', type: 'chambre', capacite: '1' })
  const [editingTarif, setEditingTarif] = useState<{ logementId: number; tarifId: number } | null>(null)
  const [editTarifForm, setEditTarifForm] = useState({ type_tarif: 'nuitee', prix: '', avec_clim: false, avec_buffet: false })

  // Stable par identifiant : l'effet ci-dessous ne se relance qu'au changement
  // de villa, et le rechargement manuel après édition reste possible.
  const fetchVilla = useCallback(() => {
    api.get(`/villas/${id}`)
      .then((res) => {
        const v = res.data
        setVilla(v)
        setInfoForm({
          nom: v.nom ?? '', description: v.description ?? '', adresse: v.adresse ?? '',
          ville: v.ville ?? '', telephone: v.telephone ?? '',
          latitude: v.latitude ?? '', longitude: v.longitude ?? '',
        })
      })
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { fetchVilla() }, [fetchVilla])

  const getLocation = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInfoForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }))
        setGeoLoading(false)
      },
      () => setGeoLoading(false)
    )
  }

  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setInfoSaving(true)
    try {
      await api.put(`/villas/${id}`, {
        ...infoForm,
        latitude: infoForm.latitude ? parseFloat(infoForm.latitude) : null,
        longitude: infoForm.longitude ? parseFloat(infoForm.longitude) : null,
      })
      setEditingInfo(false)
      fetchVilla()
    } finally {
      setInfoSaving(false)
    }
  }

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadingPhoto(true)
    setErreurPhotos('')
    try {
      const photos = []
      const existingCount = villa?.photos.length ?? 0
      for (let i = 0; i < files.length; i++) {
        photos.push({ url: await uploadFile(files[i]), alt: files[i].name, ordre: existingCount + i })
      }
      await api.post(`/villas/${id}/photos`, { photos })
      fetchVilla()
    } catch (err) {
      // Sans ce filet, un envoi refusé ne laissait qu'une trace en console :
      // le propriétaire voyait l'attente s'arrêter et ses photos absentes,
      // sans savoir si c'était le format, le poids, ou le réseau.
      setErreurPhotos(messageErreur(err, "L'ajout de photos a échoué."))
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const deletePhoto = async (photoId: number) => {
    await api.delete(`/villas/${id}/photos/${photoId}`)
    fetchVilla()
  }

  const submitLogement = async (e: React.FormEvent) => {
    e.preventDefault()
    await api.post(`/villas/${id}/logements`, { ...logementForm, capacite: parseInt(logementForm.capacite) })
    setShowLogementForm(false)
    setLogementForm({ nom: '', type: 'chambre', capacite: '1', description: '' })
    fetchVilla()
  }

  const submitTarif = async (e: React.FormEvent, logementId: number) => {
    e.preventDefault()
    await api.post(`/logements/${logementId}/tarifs`, { ...tarifForm, prix: parseFloat(tarifForm.prix) })
    setShowTarifForm(null)
    setTarifForm({ type_tarif: 'nuitee', prix: '', avec_clim: false, avec_buffet: false })
    fetchVilla()
  }

  const toggleDisponibilite = async (logement: Logement) => {
    await api.patch(`/villas/${id}/logements/${logement.id}/disponibilite`)
    fetchVilla()
  }

  const deleteLogement = (logementId: number) => {
    setConfirmModal({
      message: 'Supprimer ce logement ?',
      detail: 'Cette action supprimera le logement et tous ses tarifs. Elle est irréversible.',
      onConfirm: async () => {
        setConfirmModal(null)
        await api.delete(`/villas/${id}/logements/${logementId}`)
        fetchVilla()
      },
    })
  }

  const deleteTarif = async (logementId: number, tarifId: number) => {
    await api.delete(`/logements/${logementId}/tarifs/${tarifId}`)
    fetchVilla()
  }

  const startEditLogement = (logement: Logement) => {
    setEditingLogement(logement.id)
    setEditLogementForm({ nom: logement.nom, type: logement.type, capacite: String(logement.capacite) })
    setShowLogementForm(false)
    setShowTarifForm(null)
  }

  const saveLogement = async (e: React.FormEvent, logementId: number) => {
    e.preventDefault()
    await api.put(`/villas/${id}/logements/${logementId}`, {
      ...editLogementForm,
      capacite: parseInt(editLogementForm.capacite),
    })
    setEditingLogement(null)
    fetchVilla()
  }

  const startEditTarif = (logementId: number, tarif: Tarif) => {
    setEditingTarif({ logementId, tarifId: tarif.id })
    setEditTarifForm({
      type_tarif: tarif.type_tarif,
      prix: String(tarif.prix),
      avec_clim: tarif.avec_clim,
      avec_buffet: tarif.avec_buffet,
    })
  }

  const saveTarif = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTarif) return
    await api.put(`/logements/${editingTarif.logementId}/tarifs/${editingTarif.tarifId}`, {
      ...editTarifForm,
      prix: parseFloat(editTarifForm.prix),
    })
    setEditingTarif(null)
    fetchVilla()
  }

  if (isLoading || !villa) return (
    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
      <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
      Chargement...
    </div>
  )

  const hasCoords = infoForm.latitude && infoForm.longitude
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(infoForm.longitude) - 0.01}%2C${parseFloat(infoForm.latitude) - 0.01}%2C${parseFloat(infoForm.longitude) + 0.01}%2C${parseFloat(infoForm.latitude) + 0.01}&layer=mapnik&marker=${infoForm.latitude}%2C${infoForm.longitude}`
    : null

  return (
    <div>
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          detail={confirmModal.detail}
          confirmLabel="Supprimer"
          danger
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-normal">{villa.nom}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            {villa.ville} · {LIBELLES_STATUT_VILLA[villa.statut] ?? villa.statut}
          </p>
        </div>
        <Link
          to={`/hebergements/${id}/`}
          target="_blank"
          className="text-sm transition-all hover:opacity-70 px-3 py-1.5 rounded-xl"
          style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          Voir la page →
        </Link>
      </div>

      {/* Informations */}
      <Section
        title="Informations"
        action={
          !editingInfo ? (
            <button
              onClick={() => setEditingInfo(true)}
              className="text-sm px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              Modifier
            </button>
          ) : undefined
        }
      >
        {editingInfo ? (
          <form onSubmit={saveInfo} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SmallField label="Nom">
                <input required value={infoForm.nom} onChange={(e) => setInfoForm((f) => ({ ...f, nom: e.target.value }))} />
              </SmallField>
              <SmallField label="Ville">
                <input required value={infoForm.ville} onChange={(e) => setInfoForm((f) => ({ ...f, ville: e.target.value }))} />
              </SmallField>
            </div>
            <SmallField label="Adresse">
              <input required value={infoForm.adresse} onChange={(e) => setInfoForm((f) => ({ ...f, adresse: e.target.value }))} />
            </SmallField>
            <SmallField label="Téléphone">
              <input required value={infoForm.telephone} onChange={(e) => setInfoForm((f) => ({ ...f, telephone: e.target.value }))} />
            </SmallField>
            <SmallField label="Description">
              <textarea rows={3} required value={infoForm.description} onChange={(e) => setInfoForm((f) => ({ ...f, description: e.target.value }))} />
            </SmallField>

            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-3)' }}>Localisation — optionnel</p>
              <button
                type="button"
                onClick={getLocation}
                disabled={geoLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all disabled:opacity-50 mb-3 hover:opacity-80"
                style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                {geoLoading
                  ? <><span className="w-3 h-3 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} /> En cours...</>
                  : '📍 Ma position actuelle'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <SmallField label="Latitude">
                  <input type="number" step="any" value={infoForm.latitude} onChange={(e) => setInfoForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="14.4529" />
                </SmallField>
                <SmallField label="Longitude">
                  <input type="number" step="any" value={infoForm.longitude} onChange={(e) => setInfoForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="-17.0155" />
                </SmallField>
              </div>
              {mapSrc && (
                <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <iframe src={mapSrc} width="100%" height="160" style={{ border: 0, display: 'block' }} loading="lazy" title="Carte" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditingInfo(false)}
                className="flex-1 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={infoSaving}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                {infoSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2.5">
            <InfoRow label="Adresse" value={`${villa.adresse}, ${villa.ville}`} />
            <InfoRow label="Téléphone" value={villa.telephone} />
            <InfoRow label="Description" value={villa.description} multiline />
            {(villa.latitude || villa.longitude) && (
              <InfoRow label="Coordonnées" value={`${villa.latitude}, ${villa.longitude}`} />
            )}
          </div>
        )}
      </Section>

      {/* Photos & Vidéos */}
      <Section
        title="Photos & Vidéos"
        action={
          <>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={addPhotos} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="text-sm px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 hover:opacity-80"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              {uploadingPhoto ? 'Envoi…' : '+ Ajouter'}
            </button>
          </>
        }
      >
        {erreurPhotos && (
          <p
            className="rounded-xl px-4 py-3 text-sm mb-4"
            role="alert"
            style={{
              background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
              color: 'var(--danger)',
            }}
          >
            {erreurPhotos}
          </p>
        )}

        {villa.photos.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Aucun média. Ajoutez des photos ou vidéos pour illustrer votre villa.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {villa.photos.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square rounded-xl overflow-hidden group"
                style={{ background: 'var(--border)' }}
              >
                {isVideoUrl(p.url) ? (
                  <>
                    <video src={p.url} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/60 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm">▶</div>
                    </div>
                  </>
                ) : (
                  <img src={p.url} alt={p.alt} className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => deletePhoto(p.id)}
                  className="media-retirer"
                  aria-label="Supprimer cette photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Logements */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium">Logements</h2>
        <button
          onClick={() => setShowLogementForm(!showLogementForm)}
          className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          + Logement
        </button>
      </div>

      {showLogementForm && (
        <form
          onSubmit={submitLogement}
          className="rounded-2xl p-5 mb-4 flex flex-col gap-4"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="grid grid-cols-2 gap-4">
            <SmallField label="Nom">
              <input required value={logementForm.nom} onChange={(e) => setLogementForm({ ...logementForm, nom: e.target.value })} placeholder="Chambre deluxe" />
            </SmallField>
            <SmallField label="Type">
              <select value={logementForm.type} onChange={(e) => setLogementForm({ ...logementForm, type: e.target.value })}>
                {Object.entries(typeLabels).map(([v, l]) => (
                  <option key={v} value={v} style={{ background: 'var(--bg)' }}>{l}</option>
                ))}
              </select>
            </SmallField>
          </div>
          <SmallField label="Capacité (personnes)">
            <input type="number" min="1" required value={logementForm.capacite} onChange={(e) => setLogementForm({ ...logementForm, capacite: e.target.value })} />
          </SmallField>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowLogementForm(false)}
              className="flex-1 py-2 rounded-xl text-sm transition-all hover:opacity-80"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              Annuler
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              Ajouter
            </button>
          </div>
        </form>
      )}

      {villa.logements.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Aucun logement. Ajoutez-en un pour commencer.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {villa.logements.map((logement) => (
            <div
              key={logement.id}
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              {editingLogement === logement.id ? (
                <form onSubmit={(e) => saveLogement(e, logement.id)} className="flex flex-col gap-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <SmallField label="Nom">
                      <input required value={editLogementForm.nom}
                        onChange={(e) => setEditLogementForm({ ...editLogementForm, nom: e.target.value })} />
                    </SmallField>
                    <SmallField label="Type">
                      <select value={editLogementForm.type}
                        onChange={(e) => setEditLogementForm({ ...editLogementForm, type: e.target.value })}>
                        {Object.entries(typeLabels).map(([v, l]) => (
                          <option key={v} value={v} style={{ background: 'var(--bg)' }}>{l}</option>
                        ))}
                      </select>
                    </SmallField>
                  </div>
                  <SmallField label="Capacité (personnes)">
                    <input type="number" min="1" required value={editLogementForm.capacite}
                      onChange={(e) => setEditLogementForm({ ...editLogementForm, capacite: e.target.value })} />
                  </SmallField>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingLogement(null)}
                      className="flex-1 py-2 rounded-xl text-xs transition-all hover:opacity-80"
                      style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                      Annuler
                    </button>
                    <button type="submit"
                      className="flex-1 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                      Enregistrer
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-medium">{logement.nom}</h3>
                      <span className={`etat-logement ${logement.disponible ? 'est-disponible' : 'est-retire'}`}>
                        {logement.disponible ? 'Proposé' : 'Retiré'}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                      {typeLabels[logement.type]} · {logement.capacite} pers.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => toggleDisponibilite(logement)}
                      className="btn btn-secondaire btn-sm"
                      aria-pressed={logement.disponible}
                    >
                      {/* « Proposé » / « Retiré » plutôt que « disponible » :
                          un logement peut être retiré du catalogue tout en
                          étant libre à ces dates — deux choses différentes que
                          le même mot confondait. */}
                      {logement.disponible ? 'Retirer du catalogue' : 'Remettre au catalogue'}
                    </button>
                    <button
                      onClick={() => setShowTarifForm(showTarifForm === logement.id ? null : logement.id)}
                      className="text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                      style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
                    >
                      + Tarif
                    </button>
                    <button
                      onClick={() => startEditLogement(logement)}
                      className="text-xs px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                      style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => deleteLogement(logement.id)}
                      className="lien-danger text-xs px-2 py-1.5"
                      style={{ color: 'var(--text-3)' }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )}

              {showTarifForm === logement.id && (
                <form
                  onSubmit={(e) => submitTarif(e, logement.id)}
                  className="rounded-xl p-4 mb-4 flex flex-col gap-3"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <SmallField label="Formule">
                      <select value={tarifForm.type_tarif} onChange={(e) => setTarifForm({ ...tarifForm, type_tarif: e.target.value })}>
                        {Object.entries(tarifLabels).map(([v, l]) => (
                          <option key={v} value={v} style={{ background: 'var(--bg)' }}>{l}</option>
                        ))}
                      </select>
                    </SmallField>
                    <SmallField label="Prix (FCFA)">
                      <input type="number" min="0" required value={tarifForm.prix}
                        onChange={(e) => setTarifForm({ ...tarifForm, prix: e.target.value })} placeholder="25000" />
                    </SmallField>
                  </div>
                  <div className="flex gap-5 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-2)' }}>
                      <input type="checkbox" checked={tarifForm.avec_clim}
                        onChange={(e) => setTarifForm({ ...tarifForm, avec_clim: e.target.checked })} />
                      Climatisation
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-2)' }}>
                      <input type="checkbox" checked={tarifForm.avec_buffet}
                        onChange={(e) => setTarifForm({ ...tarifForm, avec_buffet: e.target.checked })} />
                      Buffet
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowTarifForm(null)}
                      className="flex-1 py-2 rounded-xl text-xs transition-all hover:opacity-80"
                      style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                      Annuler
                    </button>
                    <button type="submit"
                      className="flex-1 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-90"
                      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                      Ajouter ce tarif
                    </button>
                  </div>
                </form>
              )}

              {logement.tarifs.length > 0 && (
                <div className="flex flex-col gap-2">
                  {logement.tarifs.map((tarif) =>
                    editingTarif?.logementId === logement.id && editingTarif?.tarifId === tarif.id ? (
                      <form
                        key={tarif.id}
                        onSubmit={saveTarif}
                        className="rounded-xl p-3 flex flex-col gap-3"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border-2)' }}
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <SmallField label="Formule">
                            <select value={editTarifForm.type_tarif}
                              onChange={(e) => setEditTarifForm({ ...editTarifForm, type_tarif: e.target.value })}>
                              {Object.entries(tarifLabels).map(([v, l]) => (
                                <option key={v} value={v} style={{ background: 'var(--bg)' }}>{l}</option>
                              ))}
                            </select>
                          </SmallField>
                          <SmallField label="Prix (FCFA)">
                            <input type="number" min="0" required value={editTarifForm.prix}
                              onChange={(e) => setEditTarifForm({ ...editTarifForm, prix: e.target.value })} />
                          </SmallField>
                        </div>
                        <div className="flex gap-5 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-2)' }}>
                            <input type="checkbox" checked={editTarifForm.avec_clim}
                              onChange={(e) => setEditTarifForm({ ...editTarifForm, avec_clim: e.target.checked })} />
                            Climatisation
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text-2)' }}>
                            <input type="checkbox" checked={editTarifForm.avec_buffet}
                              onChange={(e) => setEditTarifForm({ ...editTarifForm, avec_buffet: e.target.checked })} />
                            Buffet
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingTarif(null)}
                            className="flex-1 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
                            style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                            Annuler
                          </button>
                          <button type="submit"
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                            Enregistrer
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div
                        key={tarif.id}
                        className="flex items-center justify-between text-sm rounded-xl px-4 py-2.5"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                      >
                        <span style={{ color: 'var(--text-2)' }}>
                          {tarifLabels[tarif.type_tarif]}
                          {tarif.avec_clim && ' · clim'}
                          {tarif.avec_buffet && ' · buffet'}
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{fcfa(tarif.prix)}</span>
                          <button
                            onClick={() => startEditTarif(logement.id, tarif)}
                            className="text-xs transition-colors hover:opacity-70"
                            style={{ color: 'var(--text-3)' }}
                          >
                            Éditer
                          </button>
                          <button
                            onClick={() => deleteTarif(logement.id, tarif.id)}
                            className="lien-danger text-xs"
                            style={{ color: 'var(--text-3)' }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
