import { useCallback, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme, Colors } from '../context/ThemeContext'

interface Reservation {
  id: number
  statut: 'en_attente' | 'confirmee' | 'annulee'
  date_debut: string
  date_fin: string
  nb_personnes: number
  montant_total: number
  logement: { id: number; nom: string; villa: { nom: string } }
  tarif: { type_tarif: string }
  client?: { name: string }
}

const statutLabel: Record<string, string> = {
  en_attente: 'En attente', confirmee: 'Confirmée', annulee: 'Annulée',
}
const statutColor: Record<string, string> = {
  en_attente: '#f59e0b', confirmee: '#22c55e', annulee: '#ef4444',
}

const tarifLabels: Record<string, string> = {
  journee: 'Journée', nuitee: 'Nuitée', demi_journee: 'Demi-j.', pass: 'Pass',
}

export default function ReservationsScreen({ navigation }: any) {
  const { user } = useAuth()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchReservations = useCallback(() => {
    setIsLoading(true)
    api.get('/reservations')
      .then((res) => setReservations(res.data))
      .catch(() => setReservations([]))
      .finally(() => setIsLoading(false))
  }, [])

  useFocusEffect(fetchReservations)

  const updateStatut = async (id: number, statut: string) => {
    try {
      await api.patch(`/reservations/${id}/statut`, { statut })
      fetchReservations()
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Une erreur est survenue.')
    }
  }

  const confirmAction = (id: number, statut: string, label: string) => {
    Alert.alert('Confirmation', `Marquer comme "${label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: () => updateStatut(id, statut) },
    ])
  }

  const s = makeStyles(colors)

  if (!user) {
    return (
      <View style={[s.center, { paddingTop: insets.top + 16 }]}>
        <Text style={s.grey}>Connectez-vous pour voir vos réservations.</Text>
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
      <Text style={s.title}>Réservations</Text>
      <FlatList
        data={reservations}
        keyExtractor={(r) => r.id.toString()}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={s.grey}>Aucune réservation.</Text>}
        renderItem={({ item: r }) => {
          const sc = statutColor[r.statut]
          return (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.villaName}>{r.logement.villa.nom}</Text>
                  <Text style={s.logementName}>
                    {r.logement.nom} · {tarifLabels[r.tarif.type_tarif] ?? r.tarif.type_tarif}
                  </Text>
                  {user.role === 'proprietaire' && r.client && (
                    <Text style={s.clientName}>Client : {r.client.name}</Text>
                  )}
                </View>
                <View style={[s.badge, { backgroundColor: sc + '22', borderColor: sc + '55' }]}>
                  <Text style={[s.badgeText, { color: sc }]}>{statutLabel[r.statut]}</Text>
                </View>
              </View>

              <View style={s.infoRow}>
                <Text style={s.info}>📅 {r.date_debut} → {r.date_fin}</Text>
                <Text style={s.info}>👥 {r.nb_personnes} pers.</Text>
              </View>
              <Text style={s.montant}>{r.montant_total.toLocaleString('fr-FR')} FCFA</Text>

              {user.role === 'proprietaire' && r.statut === 'en_attente' && (
                <View style={s.actions}>
                  <TouchableOpacity style={s.confirmBtn}
                    onPress={() => confirmAction(r.id, 'confirmee', 'Confirmée')}>
                    <Text style={s.confirmText}>Confirmer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn}
                    onPress={() => confirmAction(r.id, 'annulee', 'Annulée')}>
                    <Text style={s.cancelText}>Refuser</Text>
                  </TouchableOpacity>
                </View>
              )}

              {user.role === 'client' && r.statut === 'en_attente' && (
                <TouchableOpacity style={s.cancelBtn}
                  onPress={() => confirmAction(r.id, 'annulee', 'Annulée')}>
                  <Text style={s.cancelText}>Annuler la réservation</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }}
      />
    </View>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16 },
    center:       { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
    title:        { color: c.text1, fontSize: 22, fontWeight: '600', marginBottom: 16, letterSpacing: -0.5 },
    card:         { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14, marginBottom: 12 },
    cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    villaName:    { color: c.text1, fontWeight: '600', fontSize: 15, marginBottom: 2 },
    logementName: { color: c.text2, fontSize: 13 },
    clientName:   { color: c.text3, fontSize: 12, marginTop: 2 },
    badge:        { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText:    { fontSize: 12, fontWeight: '600' },
    infoRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    info:         { color: c.text2, fontSize: 13 },
    montant:      { color: c.text1, fontWeight: '600', fontSize: 15, marginBottom: 10 },
    actions:      { flexDirection: 'row', gap: 10 },
    confirmBtn:   { flex: 1, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    confirmText:  { color: '#22c55e', fontWeight: '600', fontSize: 14 },
    cancelBtn:    { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    cancelText:   { color: '#ef4444', fontWeight: '600', fontSize: 14 },
    grey:         { color: c.text3, fontSize: 14, textAlign: 'center', marginBottom: 20 },
    btn:          { backgroundColor: c.text1, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
    btnText:      { color: c.bg, fontWeight: '600', fontSize: 15 },
  })
}
