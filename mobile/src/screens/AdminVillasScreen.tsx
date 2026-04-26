import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useTheme, Colors } from '../context/ThemeContext'

interface Villa {
  id: number; nom: string; ville: string; statut: string; vedette: boolean
  description: string | null; telephone: string; created_at: string
  proprietaire: { name: string; email: string } | null
}

const VILLA_TABS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee',    label: 'Validées'   },
  { value: 'rejetee',   label: 'Rejetées'   },
]

export default function AdminVillasScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const s = makeStyles(colors)

  const [statut, setStatut]         = useState('en_attente')
  const [villas, setVillas]         = useState<Villa[]>([])
  const [loading, setLoading]       = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchVillas = useCallback((st: string) => {
    setLoading(true)
    api.get(`/admin/villas?statut=${st}`)
      .then((res) => setVillas(Array.isArray(res.data) ? res.data : res.data.data ?? []))
      .catch(() => setVillas([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchVillas(statut) }, [statut])

  const updateStatut = (villa: Villa, next: 'validee' | 'rejetee') => {
    Alert.alert(
      next === 'validee' ? 'Valider cette villa ?' : 'Rejeter cette villa ?',
      villa.nom,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: async () => {
          await api.patch(`/admin/villas/${villa.id}/statut`, { statut: next })
          fetchVillas(statut)
        }},
      ]
    )
  }

  const toggleVedette = async (villa: Villa) => {
    setTogglingId(villa.id)
    try {
      const res = await api.patch(`/admin/villas/${villa.id}/vedette`)
      setVillas((prev) => prev.map((v) => v.id === villa.id ? { ...v, vedette: res.data.vedette } : v))
    } finally {
      setTogglingId(null)
    }
  }

  const vedetteCount = villas.filter((v) => v.vedette).length

  return (
    <View style={[s.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <Text style={s.title}>Gestion des villas</Text>

      {/* Status tabs — View avec flexWrap pour que les pills restent compactes */}
      <View style={s.pillsRow}>
        {VILLA_TABS.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[s.pill, statut === t.value
              ? { backgroundColor: colors.text1 }
              : { borderWidth: 1, borderColor: colors.border }]}
            onPress={() => setStatut(t.value)}
          >
            <Text style={[s.pillText, { color: statut === t.value ? colors.bg : colors.text2 }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {statut === 'validee' && !loading && vedetteCount > 0 && (
        <Text style={s.vedetteInfo}>
          ⭐ {vedetteCount} villa{vedetteCount !== 1 ? 's' : ''} en vedette sur la page d'accueil
        </Text>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.text1} /></View>
      ) : villas.length === 0 ? (
        <View style={[s.center, { paddingTop: 40 }]}>
          <Text style={{ color: colors.text3, fontSize: 14 }}>Aucune villa dans cette catégorie.</Text>
        </View>
      ) : (
        <FlatList
          data={villas}
          keyExtractor={(v) => v.id.toString()}
          contentContainerStyle={s.list}
          renderItem={({ item: v }) => (
            <View style={[s.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>

              {/* Nom + badge vedette */}
              <View style={s.cardTitleRow}>
                <Text style={[s.cardNom, { color: colors.text1 }]} numberOfLines={1}>{v.nom}</Text>
                {!!v.vedette && (
                  <View style={s.vedetteBadge}>
                    <Text style={s.vedetteText}>Vedette</Text>
                  </View>
                )}
              </View>

              {/* Ville · Téléphone */}
              <Text style={[s.cardSub, { color: colors.text2 }]}>{v.ville} · {v.telephone}</Text>

              {/* Propriétaire — null-safe */}
              {v.proprietaire && (
                <Text style={[s.cardMeta, { color: colors.text3 }]}>
                  {v.proprietaire.name} · {v.proprietaire.email}
                </Text>
              )}

              {/* Description */}
              {!!v.description && (
                <Text style={[s.cardDesc, { color: colors.text3 }]} numberOfLines={2}>
                  {v.description}
                </Text>
              )}

              {/* Boutons d'action */}
              <View style={s.actionsRow}>
                {statut === 'en_attente' && (
                  <>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.text1 }]}
                      onPress={() => updateStatut(v, 'validee')}
                    >
                      <Text style={{ color: colors.bg, fontWeight: '600', fontSize: 13 }}>Valider</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => updateStatut(v, 'rejetee')}
                    >
                      <Text style={{ color: colors.text2, fontSize: 13 }}>Rejeter</Text>
                    </TouchableOpacity>
                  </>
                )}
                {statut === 'validee' && (
                  <TouchableOpacity
                    style={[s.actionBtn, v.vedette
                      ? { backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' }
                      : { borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => toggleVedette(v)}
                    disabled={togglingId === v.id}
                  >
                    <Text style={{ color: v.vedette ? '#FBBF24' : colors.text2, fontSize: 13 }}>
                      {togglingId === v.id ? '...' : v.vedette ? '⭐ En vedette' : '☆ Mettre en vedette'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: c.bg },
    title:       { color: c.text1, fontSize: 22, fontWeight: '600', letterSpacing: -0.5, paddingHorizontal: 16, marginBottom: 14 },
    center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    list:        { padding: 16, paddingTop: 8, paddingBottom: 40 },

    // Pills en ligne compacte, wrappées si besoin
    pillsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
    pill:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, alignSelf: 'flex-start' },
    pillText:    { fontSize: 13, fontWeight: '500' },

    vedetteInfo: { color: c.text3, fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },

    // Card
    card:        { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
    cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    cardNom:     { fontWeight: '600', fontSize: 15, flex: 1 },
    cardSub:     { fontSize: 13, marginBottom: 2 },
    cardMeta:    { fontSize: 12, marginBottom: 2 },
    cardDesc:    { fontSize: 12, marginTop: 5, lineHeight: 17 },

    // Boutons d'action compacts, pas étirés
    actionsRow:  { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionBtn:   { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },

    vedetteBadge:{ borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
    vedetteText: { color: '#FBBF24', fontSize: 11, fontWeight: '500' },
  })
}
