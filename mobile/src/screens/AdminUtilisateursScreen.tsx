import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme, Colors } from '../context/ThemeContext'

interface Utilisateur {
  id: number; name: string; email: string; role: string
  phone: string | null; created_at: string
}

const roleColors: Record<string, string> = {
  admin:        '#a78bfa',
  proprietaire: '#60a5fa',
  client:       '#9ca3af',
}
const roleLabels: Record<string, string> = {
  admin: 'Admin', proprietaire: 'Propriétaire', client: 'Client',
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}
function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminUtilisateursScreen() {
  const { colors } = useTheme()
  const { user: me } = useAuth()
  const insets = useSafeAreaInsets()
  const s = makeStyles(colors)

  const [users, setUsers]     = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = () => {
    setLoading(true)
    api.get('/admin/utilisateurs')
      .then((res) => setUsers(res.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { fetchUsers() }, [])

  const supprimer = (u: Utilisateur) => {
    Alert.alert(
      'Supprimer cet utilisateur ?',
      `${u.name} — ${u.email}\nCette action est irréversible. Toutes les données associées seront perdues.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await api.delete(`/admin/utilisateurs/${u.id}`)
          fetchUsers()
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
      data={users}
      keyExtractor={(u) => u.id.toString()}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={s.title}>Utilisateurs</Text>
            <Text style={{ color: colors.text3, fontSize: 13 }}>{users.length} au total</Text>
          </View>
        </View>
      }
      style={{ backgroundColor: colors.bg }}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item: u }) => {
        const rc = roleColors[u.role] ?? '#9ca3af'
        return (
          <View style={[s.card, { backgroundColor: colors.elevated, borderColor: colors.border, marginHorizontal: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[s.avatar, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text1, fontWeight: '600', fontSize: 13 }}>{initials(u.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                  <Text style={{ color: colors.text1, fontWeight: '500', fontSize: 14 }} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <View style={[s.roleBadge, { borderColor: rc + '55', backgroundColor: rc + '18' }]}>
                    <Text style={{ color: rc, fontSize: 11, fontWeight: '500' }}>{roleLabels[u.role] ?? u.role}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.text2, fontSize: 12 }} numberOfLines={1}>{u.email}</Text>
                <Text style={{ color: colors.text3, fontSize: 11, marginTop: 1 }}>Inscrit le {fmt(u.created_at)}</Text>
              </View>
              {u.id !== me?.id && (
                <TouchableOpacity onPress={() => supprimer(u)} style={{ padding: 4 }}>
                  <Text style={{ color: colors.text3, fontSize: 13 }}>Supprimer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )
      }}
    />
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    center:    { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
    title:     { color: c.text1, fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
    card:      { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
    avatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    roleBadge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  })
}
