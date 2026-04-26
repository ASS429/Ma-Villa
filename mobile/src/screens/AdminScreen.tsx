import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme, Colors } from '../context/ThemeContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Villa {
  id: number; nom: string; ville: string; statut: string; vedette: boolean
  description: string; telephone: string; created_at: string
  proprietaire: { name: string; email: string }
}
interface Utilisateur {
  id: number; name: string; email: string; role: string
  phone: string | null; created_at: string
}
interface Avis {
  id: number; note: number; commentaire: string | null
  client: { name: string }; villa: { nom: string }; created_at: string
}

const VILLA_TABS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee',    label: 'Validées'   },
  { value: 'rejetee',   label: 'Rejetées'   },
]

const roleColors: Record<string, string> = {
  admin:        '#a78bfa',
  proprietaire: '#60a5fa',
  client:       '#9ca3af',
}
const roleLabels: Record<string, string> = {
  admin: 'Admin', proprietaire: 'Propriétaire', client: 'Client',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Gestion des villas ───────────────────────────────────────────────────────

function GestionVillas({ colors, s }: { colors: Colors; s: ReturnType<typeof makeStyles> }) {
  const [statut, setStatut]         = useState('en_attente')
  const [villas, setVillas]         = useState<Villa[]>([])
  const [loading, setLoading]       = useState(true)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchVillas = useCallback((st: string) => {
    setLoading(true)
    api.get(`/admin/villas?statut=${st}`)
      .then((res) => setVillas(res.data))
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
    <View style={{ flex: 1 }}>
      {/* Status tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        {VILLA_TABS.map((t) => (
          <TouchableOpacity key={t.value}
            style={[s.pill, statut === t.value
              ? { backgroundColor: colors.text1 }
              : { borderWidth: 1, borderColor: colors.border }]}
            onPress={() => setStatut(t.value)}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: statut === t.value ? colors.bg : colors.text2 }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {statut === 'validee' && !loading && villas.length > 0 && (
        <Text style={{ color: colors.text3, fontSize: 12, paddingHorizontal: 16, marginBottom: 4 }}>
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
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
          renderItem={({ item: v }) => (
            <View style={[s.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                <Text style={{ color: colors.text1, fontWeight: '600', fontSize: 15, flex: 1 }} numberOfLines={1}>
                  {v.nom}
                </Text>
                {v.vedette ? (
                  <View style={s.vedetteBadge}>
                    <Text style={s.vedetteText}>Vedette</Text>
                  </View>
                ) : null}
              </View>

              <Text style={{ color: colors.text2, fontSize: 13, marginBottom: 2 }}>
                {v.ville} · {v.telephone}
              </Text>
              <Text style={{ color: colors.text3, fontSize: 12, marginBottom: 2 }}>
                {v.proprietaire.name} · {v.proprietaire.email}
              </Text>
              {!!v.description && (
                <Text style={{ color: colors.text3, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                  {v.description}
                </Text>
              )}

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {statut === 'en_attente' && (
                  <>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: colors.text1, flex: 1 }]}
                      onPress={() => updateStatut(v, 'validee')}>
                      <Text style={{ color: colors.bg, fontWeight: '600', fontSize: 13 }}>Valider</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { borderWidth: 1, borderColor: colors.border, flex: 1 }]}
                      onPress={() => updateStatut(v, 'rejetee')}>
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
                    disabled={togglingId === v.id}>
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

// ─── Gestion des utilisateurs ─────────────────────────────────────────────────

function GestionUtilisateurs({ colors, s }: { colors: Colors; s: ReturnType<typeof makeStyles> }) {
  const { user: me } = useAuth()
  const [users, setUsers]     = useState<Utilisateur[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = () => {
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

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.text1} /></View>

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.id.toString()}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: colors.text1, fontSize: 15, fontWeight: '500' }}>Utilisateurs</Text>
          <Text style={{ color: colors.text3, fontSize: 13 }}>{users.length} au total</Text>
        </View>
      }
      renderItem={({ item: u }) => {
        const rc = roleColors[u.role] ?? '#9ca3af'
        return (
          <View style={[s.card, { backgroundColor: colors.elevated, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
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
        )
      }}
    />
  )
}

// ─── Modération des avis ──────────────────────────────────────────────────────

function ModerationAvis({ colors, s }: { colors: Colors; s: ReturnType<typeof makeStyles> }) {
  const [avis, setAvis]       = useState<Avis[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAvis = () => {
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

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.text1} /></View>

  if (avis.length === 0) {
    return (
      <View style={[s.center, { paddingTop: 60 }]}>
        <Text style={{ fontSize: 36, marginBottom: 10 }}>💬</Text>
        <Text style={{ color: colors.text3, fontSize: 14 }}>Aucun avis pour l'instant.</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={avis}
      keyExtractor={(a) => a.id.toString()}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: colors.text1, fontSize: 15, fontWeight: '500' }}>Modération des avis</Text>
          <Text style={{ color: colors.text3, fontSize: 13 }}>{avis.length} au total</Text>
        </View>
      }
      renderItem={({ item: a }) => (
        <View style={[s.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'villas',        label: 'Gestion des villas'        },
  { key: 'utilisateurs',  label: 'Gestion des utilisateurs'  },
  { key: 'avis',          label: 'Modération des avis'       },
]

export default function AdminScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [section, setSection] = useState('villas')
  const s = makeStyles(colors)

  const currentLabel = SECTIONS.find((sec) => sec.key === section)?.label ?? ''

  return (
    <View style={[s.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Administration</Text>
      </View>

      {/* Section tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        {SECTIONS.map((sec) => (
          <TouchableOpacity key={sec.key}
            style={[s.sectionTab, section === sec.key
              ? { backgroundColor: colors.text1 }
              : { borderWidth: 1, borderColor: colors.border }]}
            onPress={() => setSection(sec.key)}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: section === sec.key ? colors.bg : colors.text2 }}>
              {sec.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {section === 'villas'       && <GestionVillas       colors={colors} s={s} />}
        {section === 'utilisateurs' && <GestionUtilisateurs colors={colors} s={s} />}
        {section === 'avis'         && <ModerationAvis      colors={colors} s={s} />}
      </View>
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: c.bg },
    header:      { paddingHorizontal: 16, marginBottom: 12 },
    title:       { color: c.text1, fontSize: 22, fontWeight: '600', letterSpacing: -0.5 },
    center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    sectionTab:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    pill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
    card:        { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
    actionBtn:   { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
    avatar:      { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    roleBadge:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
    vedetteBadge:{ borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
    vedetteText: { color: '#FBBF24', fontSize: 11, fontWeight: '500' },
  })
}
