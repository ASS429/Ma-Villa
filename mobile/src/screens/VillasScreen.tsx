import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, ScrollView, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { fixUrl } from '../utils/url'

interface Villa {
  id: number; nom: string; ville: string; description: string
  photos: { url: string }[]; avis: { note: number }[]
  vedette?: boolean; prix_min?: number
}

const TYPES = [
  { value: '', label: 'Tous' },
  { value: 'villa_entiere', label: 'Villa entière' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'chambre', label: 'Chambre' },
]

export default function VillasScreen({ navigation }: any) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { user } = useAuth()

  const [villas, setVillas]         = useState<Villa[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState('')
  const [page, setPage]             = useState(1)
  const [lastPage, setLastPage]     = useState(1)
  const [total, setTotal]           = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [favorisIds, setFavorisIds] = useState<Set<number>>(new Set())

  const [filters, setFilters] = useState({
    ville: '', prix_min: '', prix_max: '', type_logement: '',
  })
  const [draft, setDraft] = useState(filters)

  const activeCount = Object.values(filters).filter(Boolean).length

  const loadVillas = useCallback((f: typeof filters, p: number) => {
    setIsLoading(true)
    setError('')
    const params: Record<string, any> = { page: p }
    if (f.ville)         params.ville = f.ville
    if (f.prix_min)      params.prix_min = f.prix_min
    if (f.prix_max)      params.prix_max = f.prix_max
    if (f.type_logement) params.type_logement = f.type_logement
    api.get('/villas', { params })
      .then((res) => {
        setVillas(res.data.data ?? res.data)
        setLastPage(res.data.last_page ?? 1)
        setTotal(res.data.total ?? 0)
      })
      .catch((e) => {
        setError(e.message || 'Impossible de charger les villas.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { loadVillas(filters, 1) }, [])

  useEffect(() => {
    if (user?.role === 'client') {
      api.get('/favoris').then((res) => {
        setFavorisIds(new Set(res.data.map((f: any) => f.villa_id ?? f.villa?.id)))
      }).catch(() => {})
    }
  }, [user])

  const applyFilters = () => {
    setFilters(draft)
    setPage(1)
    loadVillas(draft, 1)
    setShowFilters(false)
  }

  const resetFilters = () => {
    const empty = { ville: '', prix_min: '', prix_max: '', type_logement: '' }
    setDraft(empty)
    setFilters(empty)
    setPage(1)
    loadVillas(empty, 1)
    setShowFilters(false)
  }

  const goToPage = (p: number) => {
    setPage(p)
    loadVillas(filters, p)
  }

  const toggleFavori = async (villaId: number) => {
    if (!user) { navigation.navigate('Login'); return }
    try {
      if (favorisIds.has(villaId)) {
        await api.delete(`/villas/${villaId}/favoris`)
        setFavorisIds((prev) => { const n = new Set(prev); n.delete(villaId); return n })
      } else {
        await api.post(`/villas/${villaId}/favoris`, {})
        setFavorisIds((prev) => new Set(prev).add(villaId))
      }
    } catch {}
  }

  const note = (v: Villa) => {
    if (!v.avis.length) return null
    return (v.avis.reduce((s, a) => s + a.note, 0) / v.avis.length).toFixed(1)
  }

  const s = makeStyles(colors)

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.accentLabel}>Toutes les annonces</Text>
          <Text style={s.title}>Villas disponibles</Text>
        </View>
        <TouchableOpacity style={s.filterBtn} onPress={() => { setDraft(filters); setShowFilters(true) }}>
          <Text style={s.filterBtnText}>Filtres</Text>
          {activeCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeText}>{activeCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {total > 0 && (
        <Text style={s.resultCount}>
          {total} villa{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
          {lastPage > 1 ? `  ·  page ${page}/${lastPage}` : ''}
        </Text>
      )}

      {error ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>⚠️</Text>
          <Text style={s.emptyTitle}>Erreur réseau</Text>
          <Text style={s.emptyDesc}>{error}</Text>
          <TouchableOpacity style={s.resetBtn} onPress={() => loadVillas(filters, page)}>
            <Text style={s.resetBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <ActivityIndicator color={colors.text1} style={{ marginTop: 40 }} />
      ) : villas.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🏖️</Text>
          <Text style={s.emptyTitle}>Aucune villa trouvée</Text>
          <Text style={s.emptyDesc}>Essayez d'autres critères de recherche.</Text>
          {activeCount > 0 && (
            <TouchableOpacity style={s.resetBtn} onPress={resetFilters}>
              <Text style={s.resetBtnText}>Voir toutes les villas</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={villas}
          keyExtractor={(v) => v.id.toString()}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item: v }) => {
            const n = note(v)
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => navigation.navigate('VillaDetail', { id: v.id, nom: v.nom })}
                activeOpacity={0.92}
              >
                <View style={s.photoWrap}>
                  {v.photos[0] ? (
                    <Image source={{ uri: fixUrl(v.photos[0].url) }} style={s.photo} resizeMode="cover" />
                  ) : (
                    <View style={[s.photo, s.noPhoto]} />
                  )}
                  {/* Gradient overlay */}
                  <View style={s.photoOverlay} />
                  {/* Vedette badge */}
                  {v.vedette ? (
                    <View style={s.vedetteBadge}>
                      <Text style={s.vedetteBadgeText}>Vedette</Text>
                    </View>
                  ) : null}
                  {/* Price badge */}
                  {v.prix_min ? (
                    <View style={s.priceBadge}>
                      <Text style={s.priceText}>
                        {v.prix_min.toLocaleString('fr-FR')}{' '}
                        <Text style={s.priceSub}>FCFA</Text>
                      </Text>
                    </View>
                  ) : null}
                  {/* Fav button */}
                  {user?.role === 'client' ? (
                    <TouchableOpacity
                      style={[s.favBtn, v.prix_min ? { top: 46 } : {}]}
                      onPress={() => toggleFavori(v.id)}
                    >
                      <Text style={{ fontSize: 16, color: favorisIds.has(v.id) ? '#ef4444' : 'rgba(255,255,255,0.8)' }}>
                        {favorisIds.has(v.id) ? '♥' : '♡'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {/* Rating badge */}
                  {n ? (
                    <View style={s.ratingBadge}>
                      <Text style={s.ratingText}>★ {n}</Text>
                    </View>
                  ) : null}
                  {/* Bottom info overlay */}
                  <View style={s.photoBottom}>
                    <Text style={s.photoNom} numberOfLines={1}>{v.nom}</Text>
                    <Text style={s.photoVille}>📍 {v.ville}</Text>
                  </View>
                </View>
                {v.description ? (
                  <View style={s.cardBody}>
                    <Text style={[s.desc, { color: colors.text3 }]} numberOfLines={2}>{v.description}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            )
          }}
          ListFooterComponent={lastPage > 1 ? (
            <View style={s.pagination}>
              <TouchableOpacity style={[s.pageBtn, page === 1 && s.pageBtnDisabled]}
                onPress={() => page > 1 && goToPage(page - 1)} disabled={page === 1}>
                <Text style={[s.pageBtnText, { color: colors.text1 }]}>←</Text>
              </TouchableOpacity>
              {Array.from({ length: Math.min(lastPage, 5) }, (_, i) => {
                const p = lastPage <= 5 ? i + 1 : Math.max(1, page - 2) + i
                if (p > lastPage) return null
                return (
                  <TouchableOpacity key={p} style={[s.pageNum, p === page && { backgroundColor: colors.text1 }]}
                    onPress={() => goToPage(p)}>
                    <Text style={[s.pageNumText, { color: p === page ? colors.bg : colors.text2 }]}>{p}</Text>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity style={[s.pageBtn, page === lastPage && s.pageBtnDisabled]}
                onPress={() => page < lastPage && goToPage(page + 1)} disabled={page === lastPage}>
                <Text style={[s.pageBtnText, { color: colors.text1 }]}>→</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        />
      )}

      {/* Filters modal */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowFilters(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text1 }]}>Filtres</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={[s.modalClose, { color: colors.text2 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalBody}>
            <Text style={[s.filterLabel, { color: colors.text2 }]}>Ville</Text>
            <TextInput style={[s.filterInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text1 }]}
              placeholder="Saly, Mbour, Dakar..." placeholderTextColor={colors.text3}
              value={draft.ville} onChangeText={(v) => setDraft((p) => ({ ...p, ville: v }))} />

            <Text style={[s.filterLabel, { color: colors.text2 }]}>Prix minimum (FCFA)</Text>
            <TextInput style={[s.filterInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text1 }]}
              placeholder="0" placeholderTextColor={colors.text3} keyboardType="numeric"
              value={draft.prix_min} onChangeText={(v) => setDraft((p) => ({ ...p, prix_min: v }))} />

            <Text style={[s.filterLabel, { color: colors.text2 }]}>Prix maximum (FCFA)</Text>
            <TextInput style={[s.filterInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text1 }]}
              placeholder="500 000" placeholderTextColor={colors.text3} keyboardType="numeric"
              value={draft.prix_max} onChangeText={(v) => setDraft((p) => ({ ...p, prix_max: v }))} />

            <Text style={[s.filterLabel, { color: colors.text2 }]}>Type de logement</Text>
            <View style={s.typeRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[s.typePill, { borderColor: colors.border2 },
                    draft.type_logement === t.value && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  onPress={() => setDraft((p) => ({ ...p, type_logement: t.value }))}
                >
                  <Text style={[s.typePillText, { color: colors.text2 },
                    draft.type_logement === t.value && { color: '#fff' }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={s.modalFooter}>
            <TouchableOpacity style={[s.modalResetBtn, { borderColor: colors.border }]} onPress={resetFilters}>
              <Text style={[s.modalResetText, { color: colors.text2 }]}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalApplyBtn, { backgroundColor: colors.accent }]} onPress={applyFilters}>
              <Text style={[s.modalApplyText, { color: '#fff' }]}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function makeStyles(c: ReturnType<typeof import('../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16 },
    header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    accentLabel:  { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: c.accent, marginBottom: 2 },
    title:        { fontSize: 22, fontWeight: '600', color: c.text1, letterSpacing: -0.5 },
    filterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    filterBtnText:{ fontSize: 13, color: c.text2 },
    filterBadge:  { backgroundColor: c.text1, borderRadius: 10, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
    filterBadgeText: { color: c.bg, fontSize: 11, fontWeight: '700' },
    resultCount:  { fontSize: 13, color: c.text2, marginBottom: 12 },
    card:         { backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    photoWrap:    { position: 'relative' },
    photo:        { width: '100%', height: 220 },
    noPhoto:      { backgroundColor: c.elevated },
    noPhotoText:  { fontSize: 13 },
    photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, backgroundColor: 'transparent',
                    // gradient effect via shadow
                    shadowColor: '#000', shadowOffset: { width: 0, height: -20 }, shadowOpacity: 0.6, shadowRadius: 20 },
    vedetteBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                    backgroundColor: c.accentGold },
    vedetteBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
    priceBadge:   { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                    backgroundColor: 'rgba(255,252,248,0.85)' },
    priceText:    { fontSize: 12, fontWeight: '600', color: '#1A1614' },
    priceSub:     { fontSize: 11, fontWeight: '400', opacity: 0.6 },
    favBtn:       { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
                    width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    ratingBadge:  { position: 'absolute', bottom: 44, right: 10, backgroundColor: 'rgba(255,255,255,0.2)',
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
    ratingText:   { fontSize: 12, fontWeight: '600', color: '#fff' },
    photoBottom:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12,
                    backgroundColor: 'rgba(0,0,0,0.45)' },
    photoNom:     { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
    photoVille:   { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
    cardBody:     { padding: 12 },
    cardRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    nom:          { fontWeight: '600', fontSize: 15, flex: 1 },
    noteText:     { fontSize: 13, fontWeight: '600', marginLeft: 8 },
    ville:        { fontSize: 13, marginBottom: 4 },
    desc:         { fontSize: 13, lineHeight: 18 },
    empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyIcon:    { fontSize: 48, marginBottom: 12 },
    emptyTitle:   { fontSize: 17, fontWeight: '600', color: c.text1, marginBottom: 6 },
    emptyDesc:    { fontSize: 14, color: c.text2, textAlign: 'center' },
    resetBtn:     { marginTop: 20, backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
    resetBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    pagination:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 8 },
    pageBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.border },
    pageBtnDisabled: { opacity: 0.3 },
    pageBtnText:  { fontSize: 16 },
    pageNum:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
    pageNumText:  { fontSize: 14, fontWeight: '500' },
    modal:        { flex: 1 },
    modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24 },
    modalTitle:   { fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
    modalClose:   { fontSize: 20, padding: 4 },
    modalBody:    { paddingHorizontal: 20, paddingBottom: 20 },
    filterLabel:  { fontSize: 13, marginBottom: 6, marginTop: 14 },
    filterInput:  { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
    typeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    typePill:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
    typePillText: { fontSize: 13 },
    modalFooter:  { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 32 },
    modalResetBtn:{ flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    modalResetText: { fontWeight: '600', fontSize: 15 },
    modalApplyBtn:{ flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    modalApplyText:{ fontWeight: '600', fontSize: 15 },
  })
}
