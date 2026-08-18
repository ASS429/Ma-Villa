import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { televerserFichier as uploadFile } from '../../services/televerser'
import { messageErreur } from '../../lib/erreurs'

type MediaFile = { file: File; preview: string; isVideo: boolean }

function isVideoFile(file: File) {
  return file.type.startsWith('video/')
}

export default function NouvelleVilla() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nom: '', description: '', adresse: '', ville: '', telephone: '', latitude: '', longitude: '',
  })
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const getLocation = () => {
    if (!navigator.geolocation) { setError("La géolocalisation n'est pas disponible."); return }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        setGeoLoading(false)
      },
      () => { setError("Impossible d'obtenir votre position."); setGeoLoading(false) }
    )
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setMediaFiles((prev) => [
      ...prev,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file), isVideo: isVideoFile(file) })),
    ])
    e.target.value = ''
  }

  const removeMedia = (idx: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const payload = {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      }
      const res = await api.post('/villas', payload)
      const villaId = res.data.id

      if (mediaFiles.length > 0) {
        const photos = []
        setUploadProgress({ current: 0, total: mediaFiles.length })
        for (let i = 0; i < mediaFiles.length; i++) {
          setUploadProgress({ current: i + 1, total: mediaFiles.length })
          const url = await uploadFile(mediaFiles[i].file)
          photos.push({ url, alt: mediaFiles[i].file.name, ordre: i })
        }
        await api.post(`/villas/${villaId}/photos`, { photos })
      }

      navigate(`/dashboard/villas/${villaId}`)
    } catch (err) {
      setError(messageErreur(err))
    } finally {
      setIsLoading(false)
      setUploadProgress({ current: 0, total: 0 })
    }
  }

  const hasCoords = form.latitude && form.longitude
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(form.longitude) - 0.01}%2C${parseFloat(form.latitude) - 0.01}%2C${parseFloat(form.longitude) + 0.01}%2C${parseFloat(form.latitude) + 0.01}&layer=mapnik&marker=${form.latitude}%2C${form.longitude}`
    : null

  const isUploading = uploadProgress.total > 0

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-normal mb-2">Nouvelle villa</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>
        Remplissez les informations de base. Vous pourrez ajouter des logements et tarifs ensuite.
      </p>

      {error && (
        <div className="console-erreur" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Informations générales */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium mb-4">Informations générales</p>
          <div className="flex flex-col gap-4">
            <Field label="Nom de la villa" required>
              <input type="text" required value={form.nom} onChange={set('nom')} placeholder="Villa Saly Paradis" />
            </Field>
            <Field label="Description" required>
              <textarea required value={form.description} onChange={set('description')} rows={4} placeholder="Décrivez votre villa..." />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ville" required>
                <input type="text" required value={form.ville} onChange={set('ville')} placeholder="Saly, Mbour, Dakar..." />
              </Field>
              <Field label="Téléphone" required>
                <input type="tel" required value={form.telephone} onChange={set('telephone')} placeholder="+221 77 000 00 00" />
              </Field>
            </div>
            <Field label="Adresse" required>
              <input type="text" required value={form.adresse} onChange={set('adresse')} placeholder="Route de la plage, Saly" />
            </Field>
          </div>
        </div>

        {/* Localisation */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium mb-3">
            Localisation
            <span className="font-normal ml-1.5" style={{ color: 'var(--text-3)' }}>— optionnel</span>
          </p>
          <button
            type="button"
            onClick={getLocation}
            disabled={geoLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-50 mb-3 hover:opacity-80"
            style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
          >
            {geoLoading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--text-1)' }} />
                Localisation en cours...
              </>
            ) : (
              '📍 Utiliser ma position actuelle'
            )}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <input type="number" step="any" value={form.latitude} onChange={set('latitude')} placeholder="14.4529" />
            </Field>
            <Field label="Longitude">
              <input type="number" step="any" value={form.longitude} onChange={set('longitude')} placeholder="-17.0155" />
            </Field>
          </div>
          {mapSrc && (
            <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <iframe src={mapSrc} width="100%" height="200" style={{ border: 0, display: 'block' }} loading="lazy" title="Carte" />
            </div>
          )}
        </div>

        {/* Photos & Vidéos */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-medium mb-3">
            Photos & Vidéos
            <span className="font-normal ml-1.5" style={{ color: 'var(--text-3)' }}>— optionnel</span>
          </p>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFiles} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl py-6 text-sm border-dashed border-2 transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border-2)', color: 'var(--text-3)' }}
          >
            + Ajouter des photos ou vidéos
          </button>

          {mediaFiles.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
              {mediaFiles.map((m, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden group"
                  style={{ background: 'var(--border)' }}
                >
                  {m.isVideo ? (
                    <>
                      <video src={m.preview} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/60 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm">▶</div>
                      </div>
                    </>
                  ) : (
                    <img src={m.preview} alt="" className="w-full h-full object-cover" />
                  )}
                  {i === 0 && (
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-md leading-none pointer-events-none">
                      Couverture
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="media-retirer"
                    aria-label="Retirer ce média"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload progress */}
        {isUploading && (
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--text-2)' }}>
              <span>Envoi des fichiers...</span>
              <span>{uploadProgress.current} / {uploadProgress.total}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  background: 'var(--text-1)',
                }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard/villas')}
            className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {isLoading ? (isUploading ? 'Upload en cours...' : 'Enregistrement...') : 'Créer la villa'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactElement<{ className?: string }> }) {
  return (
    <div>
      <label className="text-sm mb-1.5 block" style={{ color: 'var(--text-2)' }}>
        {label}
        {required && <span className="ml-1" style={{ color: 'var(--text-3)' }}>*</span>}
      </label>
      {/* className est placé après le spread : il écrase celui de l'enfant. */}
      <children.type
        {...children.props}
        className="w-full rounded-xl px-4 py-3 text-sm th-input-field resize-none"
      />
    </div>
  )
}
