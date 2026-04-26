import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, FlatList, Image, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Linking, Dimensions,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme, Colors } from '../context/ThemeContext'
import { fixUrl } from '../utils/url'

const { width: SW } = Dimensions.get('window')

interface Tarif { id: number; type_tarif: string; avec_clim: boolean; avec_buffet: boolean; prix: number }
interface Logement { id: number; nom: string; type: string; capacite: number; disponible: boolean; tarifs: Tarif[] }
interface Avis { id: number; note: number; commentaire: string; client: { name: string }; created_at: string }
interface Villa {
  id: number; nom: string; description: string; adresse: string; ville: string; telephone: string
  latitude: number | null; longitude: number | null
  photos: { url: string; alt: string }[]
  logements: Logement[]; avis: Avis[]; proprietaire: { name: string }
}

const tarifLabels: Record<string, string> = {
  journee: 'Journée', nuitee: 'Nuitée', demi_journee: 'Demi-j.', pass: 'Pass',
}
const typeLabels: Record<string, string> = {
  villa_entiere: 'Villa entière', appartement: 'Appartement', chambre: 'Chambre', piscine: 'Piscine',
}

function Stars({ note, size = 14 }: { note: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ fontSize: size, color: i <= note ? '#FBBF24' : '#555' }}>★</Text>
      ))}
    </View>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)}>
          <Text style={{ fontSize: 30, color: i <= value ? '#FBBF24' : '#555' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tarifLabel(t: Tarif) {
  return `${tarifLabels[t.type_tarif] ?? t.type_tarif}${t.avec_clim ? ' + clim' : ''}${t.avec_buffet ? ' + buffet' : ''} — ${t.prix.toLocaleString('fr-FR')} FCFA`
}

export default function VillaDetailScreen({ route, navigation }: any) {
  const { id } = route.params
  const { user } = useAuth()
  const { colors } = useTheme()
  const s = makeStyles(colors)

  const [villa, setVilla] = useState<Villa | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // gallery
  const galleryRef = useRef<FlatList>(null)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const lightboxRef = useRef<FlatList>(null)

  // favori
  const [isFavori, setIsFavori] = useState(false)

  // reservation
  const [resLogId, setResLogId] = useState('')
  const [resTarifId, setResTarifId] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [nbPersonnes, setNbPersonnes] = useState('1')
  const [resLoading, setResLoading] = useState(false)
  const [resError, setResError] = useState('')
  const [resSuccess, setResSuccess] = useState(false)
  const [logModal, setLogModal] = useState(false)
  const [tarifModal, setTarifModal] = useState(false)

  // avis
  const [avisNote, setAvisNote] = useState(5)
  const [avisComment, setAvisComment] = useState('')
  const [avisSuccess, setAvisSuccess] = useState(false)
  const [avisLoading, setAvisLoading] = useState(false)

  useEffect(() => {
    api.get(`/villas/${id}`)
      .then((res) => setVilla(res.data))
      .finally(() => setIsLoading(false))
    if (user?.role === 'client') {
      api.get('/favoris').then((res) => {
        setIsFavori(res.data.some((f: any) => f.villa_id === id || f.villa?.id === id))
      }).catch(() => {})
    }
  }, [id])

  const logSel = villa?.logements.find((l) => l.id.toString() === resLogId)

  const toggleFavori = async () => {
    if (!user) { navigation.navigate('Login'); return }
    try {
      if (isFavori) { await api.delete(`/villas/${id}/favoris`) }
      else { await api.post(`/villas/${id}/favoris`) }
      setIsFavori(!isFavori)
    } catch {}
  }

  const reserver = async () => {
    if (!user) { navigation.navigate('Login'); return }
    if (!resLogId || !resTarifId || !dateDebut || !dateFin) {
      setResError('Veuillez remplir tous les champs.'); return
    }
    setResError('')
    setResLoading(true)
    try {
      await api.post('/reservations', {
        logement_id: parseInt(resLogId),
        tarif_id: parseInt(resTarifId),
        date_debut: dateDebut,
        date_fin: dateFin,
        nb_personnes: parseInt(nbPersonnes),
      })
      setResSuccess(true)
    } catch (e: any) {
      const errs = e.response?.data?.errors
      const first = errs ? (Object.values(errs).flat()[0] as string) : null
      setResError(first || e.response?.data?.message || 'Une erreur est survenue.')
    } finally {
      setResLoading(false)
    }
  }

  const submitAvis = async () => {
    if (!user) { navigation.navigate('Login'); return }
    setAvisLoading(true)
    try {
      await api.post('/avis', { villa_id: id, note: avisNote, commentaire: avisComment })
      setAvisSuccess(true)
      api.get(`/villas/${id}`).then((res) => setVilla(res.data))
    } catch (e: any) {
      setResError(e.response?.data?.message || 'Impossible de publier l\'avis.')
    } finally {
      setAvisLoading(false)
    }
  }

  const scrollGalleryTo = (i: number) => {
    setPhotoIdx(i)
    galleryRef.current?.scrollToIndex({ index: i, animated: true })
  }

  const openLightbox = (i: number) => {
    setLightboxIdx(i)
    setLightboxOpen(true)
  }

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.text1} size="large" />
      </View>
    )
  }
  if (!villa) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🏚️</Text>
        <Text style={{ color: colors.text3 }}>Villa introuvable.</Text>
      </View>
    )
  }

  const noteAvg = villa.avis.length
    ? (villa.avis.reduce((sum, a) => sum + a.note, 0) / villa.avis.length).toFixed(1)
    : null
  const photos = villa.photos ?? []

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Photo gallery ──────────────────────── */}
        {photos.length > 0 ? (
          <View>
            <FlatList
              ref={galleryRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SW))
              }
              getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => openLightbox(index)}>
                  <Image
                    source={{ uri: fixUrl(item.url) }}
                    style={{ width: SW, height: 260, backgroundColor: colors.surface }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            />
            {photos.length > 1 && (
              <View style={s.photoBadge}>
                <Text style={s.photoBadgeText}>{photoIdx + 1} / {photos.length}</Text>
              </View>
            )}
            {photos.length > 1 && (
              <View style={s.dotRow}>
                {photos.map((_, i) => (
                  <View key={i} style={[s.dot, i === photoIdx && s.dotActive]} />
                ))}
              </View>
            )}
            {photos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.thumbStrip}>
                {photos.map((p, i) => (
                  <TouchableOpacity key={i} onPress={() => scrollGalleryTo(i)}>
                    <Image
                      source={{ uri: fixUrl(p.url) }}
                      style={[s.thumb, { borderColor: i === photoIdx ? colors.text1 : 'transparent' }]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={[s.noPhoto, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text3, fontSize: 13 }}>Aucune photo disponible</Text>
          </View>
        )}

        <View style={s.content}>

          {/* ── Nom + note + favori ────────────────── */}
          <View style={s.headerRow}>
            <Text style={[s.nom, { color: colors.text1 }]}>{villa.nom}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
              {noteAvg ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#FBBF24', fontSize: 14 }}>★</Text>
                  <Text style={{ color: colors.text1, fontWeight: '600', fontSize: 14 }}>{noteAvg}</Text>
                  <Text style={{ color: colors.text3, fontSize: 12 }}>({villa.avis.length})</Text>
                </View>
              ) : null}
              {user?.role === 'client' && (
                <TouchableOpacity
                  onPress={toggleFavori}
                  style={[s.favBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 17, color: isFavori ? '#ef4444' : colors.text3 }}>
                    {isFavori ? '♥' : '♡'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 16 }}>
            {villa.adresse}, {villa.ville}
          </Text>

          {/* ── Contact propriétaire ───────────────── */}
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text2, fontSize: 13 }}>
              Propriétaire :{' '}
              <Text style={{ color: colors.text1, fontWeight: '600' }}>{villa.proprietaire.name}</Text>
            </Text>
            {!!villa.telephone && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${villa.telephone}`)}
                style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ fontSize: 16 }}>📞</Text>
                <Text style={{ color: colors.text1, fontSize: 15, fontWeight: '500' }}>
                  {villa.telephone}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Description ───────────────────────── */}
          <Text style={{ color: colors.text2, fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
            {villa.description}
          </Text>

          {/* ── Localisation ──────────────────────── */}
          {!!(villa.latitude != null && villa.longitude != null && villa.latitude !== '' && villa.longitude !== '') && (
            <View style={{ marginBottom: 24 }}>
              <Text style={[s.section, { color: colors.text1 }]}>Localisation</Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    `https://www.openstreetmap.org/?mlat=${villa.latitude}&mlon=${villa.longitude}#map=15/${villa.latitude}/${villa.longitude}`
                  )
                }
                style={[s.card, {
                  backgroundColor: colors.surface, borderColor: colors.border,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }]}
              >
                <Text style={{ fontSize: 26 }}>🗺️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text1, fontWeight: '500', fontSize: 14 }}>
                    Voir sur la carte
                  </Text>
                  <Text style={{ color: colors.text3, fontSize: 12, marginTop: 2 }}>
                    {parseFloat(String(villa.latitude)).toFixed(4)}, {parseFloat(String(villa.longitude)).toFixed(4)}
                  </Text>
                </View>
                <Text style={{ color: colors.text3, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Logements ─────────────────────────── */}
          <Text style={[s.section, { color: colors.text1 }]}>Logements disponibles</Text>
          {villa.logements.map((l) => (
            <View
              key={l.id}
              style={[s.card, {
                backgroundColor: colors.surface, borderColor: colors.border,
                opacity: l.disponible ? 1 : 0.55, marginBottom: 10,
              }]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text1, fontWeight: '600', fontSize: 15 }}>{l.nom}</Text>
                  <Text style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                    {typeLabels[l.type] ?? l.type} · {l.capacite} pers.
                  </Text>
                </View>
                <View style={[s.badge, l.disponible ? s.badgeGreen : s.badgeRed]}>
                  <Text style={[s.badgeText, { color: l.disponible ? '#16a34a' : '#ef4444' }]}>
                    {l.disponible ? 'Disponible' : 'Indisponible'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {l.tarifs.map((t) => (
                  <View key={t.id} style={[s.chip, { backgroundColor: colors.elevated, borderColor: colors.border2 }]}>
                    <Text style={{ color: colors.text2, fontSize: 12 }}>{tarifLabel(t)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* ── Réservation ───────────────────────── */}
          <Text style={[s.section, { color: colors.text1, marginTop: 8 }]}>Réserver</Text>
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {user && user.role !== 'client' ? (
              <Text style={{ color: colors.text3, fontSize: 14, textAlign: 'center', paddingVertical: 12 }}>
                {user.role === 'proprietaire'
                  ? 'Aperçu de votre villa telle que vue par les clients.'
                  : 'Les réservations sont réservées aux clients.'}
              </Text>
            ) : resSuccess ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>✅</Text>
                <Text style={{ color: '#16a34a', fontWeight: '600', fontSize: 16, marginBottom: 6 }}>
                  Réservation envoyée !
                </Text>
                <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center' }}>
                  Le propriétaire va confirmer sous peu.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {!!resError && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{resError}</Text>
                  </View>
                )}

                <View>
                  <Text style={[s.label, { color: colors.text2 }]}>Logement</Text>
                  <TouchableOpacity
                    style={[s.picker, { backgroundColor: colors.input, borderColor: colors.border2 }]}
                    onPress={() => setLogModal(true)}
                  >
                    <Text style={{ color: logSel ? colors.text1 : colors.text3, fontSize: 14, flex: 1 }}>
                      {logSel ? logSel.nom : 'Choisir un logement'}
                    </Text>
                    <Text style={{ color: colors.text3 }}>▾</Text>
                  </TouchableOpacity>
                </View>

                {logSel && (
                  <View>
                    <Text style={[s.label, { color: colors.text2 }]}>Formule</Text>
                    <TouchableOpacity
                      style={[s.picker, { backgroundColor: colors.input, borderColor: colors.border2 }]}
                      onPress={() => setTarifModal(true)}
                    >
                      <Text
                        style={{ color: resTarifId ? colors.text1 : colors.text3, fontSize: 14, flex: 1 }}
                        numberOfLines={1}
                      >
                        {resTarifId
                          ? tarifLabel(logSel.tarifs.find((t) => t.id.toString() === resTarifId)!)
                          : 'Choisir un tarif'}
                      </Text>
                      <Text style={{ color: colors.text3 }}>▾</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { color: colors.text2 }]}>Arrivée</Text>
                    <TextInput
                      style={[s.input, { color: colors.text1, backgroundColor: colors.input, borderColor: colors.border2 }]}
                      placeholder="AAAA-MM-JJ"
                      placeholderTextColor={colors.text3}
                      value={dateDebut}
                      onChangeText={setDateDebut}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { color: colors.text2 }]}>Départ</Text>
                    <TextInput
                      style={[s.input, { color: colors.text1, backgroundColor: colors.input, borderColor: colors.border2 }]}
                      placeholder="AAAA-MM-JJ"
                      placeholderTextColor={colors.text3}
                      value={dateFin}
                      onChangeText={setDateFin}
                    />
                  </View>
                </View>

                <View>
                  <Text style={[s.label, { color: colors.text2 }]}>Nombre de personnes</Text>
                  <TextInput
                    style={[s.input, { color: colors.text1, backgroundColor: colors.input, borderColor: colors.border2 }]}
                    placeholder="1"
                    placeholderTextColor={colors.text3}
                    value={nbPersonnes}
                    onChangeText={setNbPersonnes}
                    keyboardType="number-pad"
                  />
                </View>

                <TouchableOpacity
                  style={[s.btn, { backgroundColor: colors.text1, opacity: resLoading ? 0.6 : 1 }]}
                  onPress={reserver}
                  disabled={resLoading}
                >
                  <Text style={[s.btnText, { color: colors.bg }]}>
                    {resLoading ? 'Envoi...' : user ? 'Réserver' : 'Connexion pour réserver'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Avis ──────────────────────────────── */}
          <Text style={[s.section, { color: colors.text1, marginTop: 8 }]}>
            Avis{villa.avis.length > 0 ? ` (${villa.avis.length})` : ''}
          </Text>
          {villa.avis.length === 0 ? (
            <Text style={{ color: colors.text3, fontSize: 14, marginBottom: 16 }}>
              Aucun avis pour l'instant.
            </Text>
          ) : (
            villa.avis.map((a) => (
              <View
                key={a.id}
                style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 }]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: colors.text1, fontWeight: '500', fontSize: 14 }}>{a.client.name}</Text>
                  <Stars note={a.note} />
                </View>
                {!!a.commentaire && (
                  <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19, marginBottom: 4 }}>
                    {a.commentaire}
                  </Text>
                )}
                <Text style={{ color: colors.text3, fontSize: 12 }}>{fmt(a.created_at)}</Text>
              </View>
            ))
          )}

          {/* ── Laisser un avis (clients) ──────────── */}
          {user?.role === 'client' && !avisSuccess && (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
              <Text style={{ color: colors.text1, fontWeight: '500', fontSize: 15, marginBottom: 14 }}>
                Laisser un avis
              </Text>
              <StarPicker value={avisNote} onChange={setAvisNote} />
              <TextInput
                style={[s.textarea, {
                  color: colors.text1, backgroundColor: colors.input,
                  borderColor: colors.border2, marginTop: 14,
                }]}
                placeholder="Votre commentaire..."
                placeholderTextColor={colors.text3}
                value={avisComment}
                onChangeText={setAvisComment}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[s.btnSmall, { backgroundColor: colors.text1, opacity: avisLoading ? 0.6 : 1 }]}
                onPress={submitAvis}
                disabled={avisLoading}
              >
                <Text style={[s.btnText, { color: colors.bg }]}>
                  {avisLoading ? 'Envoi...' : 'Publier'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {avisSuccess && (
            <View style={s.successBox}>
              <Text style={s.successText}>Merci pour votre avis !</Text>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Logement modal ─────────────────────── */}
      <Modal visible={logModal} transparent animationType="slide" onRequestClose={() => setLogModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setLogModal(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[s.sheetTitle, { color: colors.text1 }]}>Choisir un logement</Text>
            {villa.logements.filter((l) => l.disponible).map((l) => (
              <TouchableOpacity
                key={l.id}
                style={[s.sheetItem, resLogId === l.id.toString() && { backgroundColor: colors.elevated }]}
                onPress={() => { setResLogId(l.id.toString()); setResTarifId(''); setLogModal(false) }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text1, fontSize: 15, fontWeight: '500' }}>{l.nom}</Text>
                  <Text style={{ color: colors.text3, fontSize: 12, marginTop: 2 }}>
                    {typeLabels[l.type] ?? l.type} · {l.capacite} pers.
                  </Text>
                </View>
                {resLogId === l.id.toString() && (
                  <Text style={{ color: colors.text1, fontSize: 16 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Tarif modal ────────────────────────── */}
      <Modal visible={tarifModal} transparent animationType="slide" onRequestClose={() => setTarifModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setTarifModal(false)}>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[s.sheetTitle, { color: colors.text1 }]}>Choisir une formule</Text>
            {logSel?.tarifs.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[s.sheetItem, resTarifId === t.id.toString() && { backgroundColor: colors.elevated }]}
                onPress={() => { setResTarifId(t.id.toString()); setTarifModal(false) }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text1, fontSize: 15, fontWeight: '500' }}>
                    {tarifLabels[t.type_tarif] ?? t.type_tarif}
                    {t.avec_clim ? ' + clim' : ''}
                    {t.avec_buffet ? ' + buffet' : ''}
                  </Text>
                  <Text style={{ color: '#FBBF24', fontWeight: '600', fontSize: 14, marginTop: 3 }}>
                    {t.prix.toLocaleString('fr-FR')} FCFA
                  </Text>
                </View>
                {resTarifId === t.id.toString() && (
                  <Text style={{ color: colors.text1, fontSize: 16 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Lightbox ───────────────────────────── */}
      <Modal visible={lightboxOpen} transparent animationType="fade" onRequestClose={() => setLightboxOpen(false)}>
        <View style={s.lightbox}>
          <TouchableOpacity style={s.lightboxClose} onPress={() => setLightboxOpen(false)}>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '300', lineHeight: 36 }}>×</Text>
          </TouchableOpacity>
          <FlatList
            ref={lightboxRef}
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={lightboxIdx}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
            onMomentumScrollEnd={(e) =>
              setLightboxIdx(Math.round(e.nativeEvent.contentOffset.x / SW))
            }
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <Image
                source={{ uri: fixUrl(item.url) }}
                style={{ width: SW, height: '100%' }}
                resizeMode="contain"
              />
            )}
          />
          <Text style={s.lightboxCounter}>{lightboxIdx + 1} / {photos.length}</Text>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  )
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content:        { paddingHorizontal: 20, paddingTop: 20 },
    headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    nom:            { fontSize: 22, fontWeight: '600', flex: 1, letterSpacing: -0.5, marginRight: 10 },
    favBtn:         { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    section:        { fontSize: 17, fontWeight: '600', marginBottom: 12, marginTop: 4 },
    card:           { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 14 },
    badge:          { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
    badgeGreen:     { backgroundColor: 'rgba(22,163,74,0.1)', borderColor: 'rgba(22,163,74,0.2)' },
    badgeRed:       { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' },
    badgeText:      { fontSize: 11, fontWeight: '500' },
    chip:           { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
    label:          { fontSize: 12, marginBottom: 6 },
    picker:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
    input:          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
    textarea:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 88, textAlignVertical: 'top' },
    btn:            { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
    btnSmall:       { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22, alignSelf: 'flex-start', marginTop: 2 },
    btnText:        { fontWeight: '600', fontSize: 15 },
    errorBox:       { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12, padding: 12 },
    errorText:      { color: '#ef4444', fontSize: 13 },
    successBox:     { backgroundColor: 'rgba(22,163,74,0.1)', borderWidth: 1, borderColor: 'rgba(22,163,74,0.2)', borderRadius: 12, padding: 14, marginBottom: 16 },
    successText:    { color: '#16a34a', fontSize: 14 },
    // Gallery
    photoBadge:     { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    photoBadgeText: { color: '#fff', fontSize: 12 },
    dotRow:         { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
    dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
    dotActive:      { width: 16, backgroundColor: '#fff', borderRadius: 3 },
    thumbStrip:     { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
    thumb:          { width: 62, height: 62, borderRadius: 10, borderWidth: 2 },
    noPhoto:        { height: 200, margin: 20, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    // Bottom sheets
    overlay:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet:          { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 20, paddingBottom: 44 },
    sheetTitle:     { fontSize: 16, fontWeight: '600', paddingHorizontal: 20, marginBottom: 10 },
    sheetItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, marginHorizontal: 10, marginBottom: 2 },
    // Lightbox
    lightbox:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center' },
    lightboxClose:  { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
    lightboxCounter:{ position: 'absolute', bottom: 52, alignSelf: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13 },
  })
}
