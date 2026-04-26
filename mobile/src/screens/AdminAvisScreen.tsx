import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useTheme, Colors } from '../context/ThemeContext'

interface Avis {
  id: number; note: number; commentaire: string | null
  client: { name: string }; villa: { nom: string }; created_at: string
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminAvisScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const s = makeStyles(colors)

  const [avis, setAvis]       = useState<Avis[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAvis = () => {
    setLoading(true)
    api.get('/admin/avis')
      .then((res) => setAvis(res.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchAvis() }, [])

  const supprimer = (a: Avis) => {
    Alert.alert(
      'Supprimer cet avis ?',
      'L\'avis sera définitivement supprimé de la plateforme.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await api.delete(`/admin/avis/${a.id}`)
          fetchAvis()
        }},
      ]
    )
  }

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top + 8 }]}>
        <ActivityIndicator color={colors.text1} />
      </View>
    )
  }

  return (
    <FlatList
      data={avis}
      keyExtractor={(a) => a.id.toString()}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={s.title}>Modération des avis</Text>
            <Text style={{ color: colors.text3, fontSize: 13 }}>{avis.length} au total</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={[s.center, { paddingTop: 60 }]}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>💬</Text>
          <Text style={{ color: colors.text3, fontSize: 14 }}>Aucun avis pour l'instant.</Text>
        </View>
      }
      renderItem={({ item: a }) => (
        <View style={[s.card, { backgroundColor: colors.elevated, borderColor: colors.border, marginHorizontal: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <Text style={{ color: colors.text1, fontWeight: '500', fontSize: 14 }}>{a.client.name}</Text>
                <Text style={{ color: '#FBBF24', fontSize: 13, letterSpacing: 1 }}>
                  {'★'.repeat(a.note)}{'☆'.repeat(5 - a.note)}
                </Text>
                <Text style={{ color: colors.text3, fontSize: 12 }}>sur {a.villa.nom}</Text>
              </View>
              {!!a.commentaire && (
                <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 18 }}>{a.commentaire}</Text>
              )}
              <Text style={{ color: colors.text3, fontSize: 11, marginTop: 6 }}>{fmt(a.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={() => supprimer(a)} style={{ padding: 4, marginLeft: 10 }}>
              <Text style={{ color: colors.text3, fontSize: 13 }}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    center: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
    title:  { color: c.text1, fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
    card:   { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
  })
}
