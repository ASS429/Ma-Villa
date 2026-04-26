import { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme, Colors } from '../context/ThemeContext'
import { fixUrl } from '../utils/url'

interface Villa {
  id: number; nom: string; ville: string; description: string
  photos: { url: string }[]; avis: { note: number }[]
}
interface Favori { id: number; villa: Villa }

export default function FavorisScreen({ navigation }: any) {
  const { user } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [favoris, setFavoris] = useState<Favori[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchFavoris = useCallback(() => {
    if (!user) { setIsLoading(false); return }
    setIsLoading(true)
    api.get('/favoris')
      .then((res) => setFavoris(res.data))
      .catch(() => setFavoris([]))
      .finally(() => setIsLoading(false))
  }, [user])

  useFocusEffect(fetchFavoris)

  const removeFavori = (villaId: number) => {
    Alert.alert('Retirer des favoris ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer', style: 'destructive', onPress: async () => {
          await api.delete(`/villas/${villaId}/favoris`).catch(() => {})
          setFavoris((prev) => prev.filter((f) => f.villa.id !== villaId))
        },
      },
    ])
  }

  const note = (villa: Villa) => {
    if (!villa.avis.length) return null
    return (villa.avis.reduce((s, a) => s + a.note, 0) / villa.avis.length).toFixed(1)
  }

  const s = makeStyles(colors)

  if (!user) {
    return (
      <View style={[s.center, { paddingTop: insets.top + 16 }]}>
        <Text style={s.grey}>Connectez-vous pour voir vos favoris.</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Login')}>
          <Text style={s.btnText}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator color={colors.text1} /></View>
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <Text style={s.title}>Mes favoris</Text>
      <FlatList
        data={favoris}
        keyExtractor={(f) => f.id.toString()}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={s.grey}>Vous n'avez pas encore de villa en favoris.</Text>}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => navigation.navigate('VillaDetail', { id: f.villa.id, nom: f.villa.nom })}
          >
            {f.villa.photos[0] ? (
              <Image source={{ uri: fixUrl(f.villa.photos[0].url) }} style={s.photo} resizeMode="cover" />
            ) : (
              <View style={[s.photo, s.noPhoto]}>
                <Text style={s.noPhotoText}>Pas de photo</Text>
              </View>
            )}
            <View style={s.cardBody}>
              <View style={s.cardRow}>
                <Text style={s.nom} numberOfLines={1}>{f.villa.nom}</Text>
                {note(f.villa) && <Text style={s.note}>★ {note(f.villa)}</Text>}
              </View>
              <Text style={s.ville}>{f.villa.ville}</Text>
              <Text style={s.desc} numberOfLines={2}>{f.villa.description}</Text>
              <TouchableOpacity style={s.removeBtn} onPress={() => removeFavori(f.villa.id)}>
                <Text style={s.removeBtnText}>♡ Retirer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16 },
    center:       { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
    title:        { color: c.text1, fontSize: 22, fontWeight: '600', marginBottom: 16, letterSpacing: -0.5 },
    card:         { backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    photo:        { width: '100%', height: 160 },
    noPhoto:      { backgroundColor: c.elevated, justifyContent: 'center', alignItems: 'center' },
    noPhotoText:  { color: c.text3, fontSize: 13 },
    cardBody:     { padding: 14 },
    cardRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    nom:          { color: c.text1, fontWeight: '600', fontSize: 15, flex: 1 },
    note:         { color: '#FBBF24', fontSize: 13, fontWeight: '600', marginLeft: 8 },
    ville:        { color: c.text2, fontSize: 13, marginBottom: 4 },
    desc:         { color: c.text3, fontSize: 13, lineHeight: 18, marginBottom: 10 },
    removeBtn:    { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    removeBtnText:{ color: c.text3, fontSize: 13 },
    grey:         { color: c.text3, fontSize: 14, textAlign: 'center', marginBottom: 20 },
    btn:          { backgroundColor: c.text1, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
    btnText:      { color: c.bg, fontWeight: '600', fontSize: 15 },
  })
}
