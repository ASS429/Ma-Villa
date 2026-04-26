import { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useTheme, Colors } from '../context/ThemeContext'
import { fixUrl } from '../utils/url'

interface Villa {
  id: number; nom: string; ville: string
  statut: 'en_attente' | 'validee' | 'rejetee'; vedette: boolean
  photos: { url: string }[]
}

const statutLabel: Record<string, string> = {
  en_attente: 'En attente', validee: 'Validée', rejetee: 'Rejetée',
}
const statutColor: Record<string, string> = {
  en_attente: '#f59e0b', validee: '#22c55e', rejetee: '#ef4444',
}

export default function MesVillasScreen({ navigation }: any) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [villas, setVillas] = useState<Villa[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchVillas = useCallback(() => {
    setIsLoading(true)
    api.get('/proprietaire/villas')
      .then((res) => setVillas(res.data))
      .catch(() => setVillas([]))
      .finally(() => setIsLoading(false))
  }, [])

  useFocusEffect(fetchVillas)

  const deleteVilla = (id: number, nom: string) => {
    Alert.alert('Supprimer', `Supprimer "${nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          await api.delete(`/villas/${id}`).catch(() => {})
          setVillas((prev) => prev.filter((v) => v.id !== id))
        },
      },
    ])
  }

  const s = makeStyles(colors)

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator color={colors.text1} /></View>
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>
        <Text style={s.title}>Mes villas</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('NouvelleVilla')}>
          <Text style={s.addBtnText}>+ Nouvelle</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={villas}
        keyExtractor={(v) => v.id.toString()}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Vous n'avez pas encore de villa.</Text>
            <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('NouvelleVilla')}>
              <Text style={s.btnText}>Créer ma première villa</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: v }) => {
          const sc = statutColor[v.statut]
          return (
            <View style={s.card}>
              {v.photos[0] ? (
                <Image source={{ uri: fixUrl(v.photos[0].url) }} style={s.photo} resizeMode="cover" />
              ) : (
                <View style={[s.photo, s.noPhoto]}>
                  <Text style={s.noPhotoText}>Pas de photo</Text>
                </View>
              )}
              <View style={s.cardBody}>
                <View style={s.cardRow}>
                  <Text style={s.nom} numberOfLines={1}>{v.nom}</Text>
                  {v.vedette ? <Text style={{ fontSize: 14, marginLeft: 6 }}>⭐</Text> : null}
                </View>
                <Text style={s.ville}>{v.ville}</Text>
                <View style={[s.badge, { backgroundColor: sc + '22', borderColor: sc + '55' }]}>
                  <Text style={[s.badgeText, { color: sc }]}>{statutLabel[v.statut]}</Text>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.gererBtn}
                    onPress={() => navigation.navigate('GererVilla', { id: v.id, nom: v.nom })}>
                    <Text style={s.gererText}>Gérer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => deleteVilla(v.id, v.nom)}>
                    <Text style={s.deleteText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16 },
    center:      { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
    header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title:       { color: c.text1, fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
    addBtn:      { backgroundColor: c.text1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
    addBtnText:  { color: c.bg, fontWeight: '600', fontSize: 14 },
    empty:       { alignItems: 'center', paddingTop: 60 },
    emptyText:   { color: c.text3, fontSize: 15, marginBottom: 24 },
    card:        { backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginBottom: 16 },
    photo:       { width: '100%', height: 150 },
    noPhoto:     { backgroundColor: c.elevated, justifyContent: 'center', alignItems: 'center' },
    noPhotoText: { color: c.text3, fontSize: 13 },
    cardBody:    { padding: 14 },
    cardRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    nom:         { color: c.text1, fontWeight: '600', fontSize: 15, flex: 1 },
    ville:       { color: c.text2, fontSize: 13, marginBottom: 8 },
    badge:       { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
    badgeText:   { fontSize: 12, fontWeight: '600' },
    actions:     { flexDirection: 'row', gap: 10 },
    gererBtn:    { flex: 1, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    gererText:   { color: c.text1, fontWeight: '600', fontSize: 14 },
    deleteBtn:   { flex: 1, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    deleteText:  { color: '#ef4444', fontWeight: '600', fontSize: 14 },
    btn:         { backgroundColor: c.text1, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
    btnText:     { color: c.bg, fontWeight: '600', fontSize: 15 },
  })
}
