import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native'
import api from '../services/api'
import { useTheme, Colors } from '../context/ThemeContext'

interface Tarif { id: number; type_tarif: string; prix: number; avec_clim: boolean; avec_buffet: boolean }
interface Logement { id: number; nom: string; type: string; capacite: number; disponible: boolean; tarifs: Tarif[] }
interface Villa { id: number; nom: string; ville: string; statut: string; logements: Logement[] }

const TYPES_LOGEMENT = ['chambre', 'suite', 'villa_entiere', 'appartement']
const TYPES_TARIF    = ['nuitee', 'journee', 'demi_journee', 'pass']
const tarifLabel: Record<string, string> = {
  nuitee: 'Nuitée', journee: 'Journée', demi_journee: 'Demi-journée', pass: 'Pass',
}

export default function GererVillaScreen({ route }: any) {
  const { id } = route.params
  const { colors } = useTheme()
  const [villa, setVilla] = useState<Villa | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Logement form
  const [showAddLog, setShowAddLog] = useState(false)
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [logForm, setLogForm] = useState({ nom: '', type: 'chambre', capacite: '1' })
  const setLog = (f: string) => (v: string) => setLogForm((p) => ({ ...p, [f]: v }))

  // Tarif form
  const [showTarifFor, setShowTarifFor] = useState<number | null>(null)
  const [editingTarifId, setEditingTarifId] = useState<number | null>(null)
  const [tarifForm, setTarifForm] = useState({
    logementId: 0, type_tarif: 'nuitee', prix: '', avec_clim: false, avec_buffet: false,
  })

  const fetchVilla = () => {
    setIsLoading(true)
    api.get(`/villas/${id}`)
      .then((res) => setVilla(res.data))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { fetchVilla() }, [id])

  // ── Logement ──────────────────────────────────────────────
  const startEditLog = (l: Logement) => {
    setEditingLogId(l.id)
    setLogForm({ nom: l.nom, type: l.type, capacite: l.capacite.toString() })
    setShowAddLog(false)
  }

  const saveLogement = async () => {
    const payload = { nom: logForm.nom, type: logForm.type, capacite: parseInt(logForm.capacite) || 1 }
    try {
      if (editingLogId) {
        await api.put(`/villas/${id}/logements/${editingLogId}`, payload)
      } else {
        await api.post(`/villas/${id}/logements`, payload)
      }
      setShowAddLog(false); setEditingLogId(null); setLogForm({ nom: '', type: 'chambre', capacite: '1' })
      fetchVilla()
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Une erreur est survenue.')
    }
  }

  const deleteLogement = (logId: number) => {
    Alert.alert('Supprimer ce logement ?', 'Ses tarifs seront aussi supprimés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await api.delete(`/villas/${id}/logements/${logId}`).catch(() => {})
        fetchVilla()
      }},
    ])
  }

  // ── Tarif ─────────────────────────────────────────────────
  const startAddTarif = (logementId: number) => {
    setShowTarifFor(logementId); setEditingTarifId(null)
    setTarifForm({ logementId, type_tarif: 'nuitee', prix: '', avec_clim: false, avec_buffet: false })
  }

  const startEditTarif = (logementId: number, t: Tarif) => {
    setEditingTarifId(t.id); setShowTarifFor(logementId)
    setTarifForm({ logementId, type_tarif: t.type_tarif, prix: t.prix.toString(), avec_clim: t.avec_clim, avec_buffet: t.avec_buffet })
  }

  const saveTarif = async () => {
    const payload = {
      type_tarif: tarifForm.type_tarif, prix: parseFloat(tarifForm.prix) || 0,
      avec_clim: tarifForm.avec_clim, avec_buffet: tarifForm.avec_buffet,
    }
    try {
      if (editingTarifId) {
        await api.put(`/logements/${tarifForm.logementId}/tarifs/${editingTarifId}`, payload)
      } else {
        await api.post(`/logements/${tarifForm.logementId}/tarifs`, payload)
      }
      setShowTarifFor(null); setEditingTarifId(null); fetchVilla()
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Une erreur est survenue.')
    }
  }

  const deleteTarif = (logementId: number, tarifId: number) => {
    Alert.alert('Supprimer ce tarif ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await api.delete(`/logements/${logementId}/tarifs/${tarifId}`).catch(() => {})
        fetchVilla()
      }},
    ])
  }

  const s = makeStyles(colors)

  if (isLoading) return <View style={s.center}><ActivityIndicator color={colors.text1} /></View>
  if (!villa)   return <View style={s.center}><Text style={{ color: colors.text3 }}>Villa introuvable.</Text></View>

  const logFormOpen = showAddLog || editingLogId !== null

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <Text style={s.villaName}>{villa.nom}</Text>
      <Text style={s.villaVille}>{villa.ville}</Text>

      {/* ── Logements ───────────────────────────────── */}
      <View style={s.sectionHeader}>
        <Text style={s.section}>Logements</Text>
        <TouchableOpacity onPress={() => {
          setShowAddLog(true); setEditingLogId(null); setLogForm({ nom: '', type: 'chambre', capacite: '1' })
        }}>
          <Text style={s.addLink}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {logFormOpen && (
        <View style={s.formBox}>
          <Text style={s.formTitle}>{editingLogId ? 'Modifier le logement' : 'Nouveau logement'}</Text>
          <Text style={s.fieldLabel}>Nom</Text>
          <TextInput style={s.input} placeholder="Suite Royale..." placeholderTextColor={colors.text3}
            value={logForm.nom} onChangeText={setLog('nom')} />
          <Text style={s.fieldLabel}>Type</Text>
          <View style={s.segRow}>
            {TYPES_LOGEMENT.map((t) => (
              <TouchableOpacity key={t}
                style={[s.seg, logForm.type === t && { borderColor: colors.text1, backgroundColor: colors.elevated }]}
                onPress={() => setLogForm((p) => ({ ...p, type: t }))}>
                <Text style={[s.segText, { color: logForm.type === t ? colors.text1 : colors.text3 },
                  logForm.type === t && { fontWeight: '600' }]}>
                  {t.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.fieldLabel}>Capacité (personnes)</Text>
          <TextInput style={s.input} value={logForm.capacite} onChangeText={setLog('capacite')} keyboardType="number-pad" />
          <View style={s.formActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowAddLog(false); setEditingLogId(null) }}>
              <Text style={s.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={saveLogement}>
              <Text style={s.saveBtnText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {villa.logements.length === 0 && !logFormOpen && (
        <Text style={{ color: colors.text3, fontSize: 13, marginBottom: 12 }}>
          Aucun logement. Ajoutez-en un ci-dessus.
        </Text>
      )}

      {villa.logements.map((l) => (
        <View key={l.id} style={s.logementCard}>
          <View style={s.logementHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.logementNom}>{l.nom}</Text>
              <Text style={s.logementInfo}>{l.type.replace('_', ' ')} · {l.capacite} pers.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={() => startEditLog(l)}>
                <Text style={s.editLink}>Éditer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteLogement(l.id)}>
                <Text style={s.deleteLink}>Suppr.</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tarifs */}
          <View style={s.tarifsSection}>
            <View style={s.tarifHeader}>
              <Text style={s.tarifTitle}>Tarifs</Text>
              <TouchableOpacity onPress={() => startAddTarif(l.id)}>
                <Text style={s.addLink}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>

            {showTarifFor === l.id && (
              <View style={s.formBox}>
                <Text style={s.formTitle}>{editingTarifId ? 'Modifier le tarif' : 'Nouveau tarif'}</Text>
                <Text style={s.fieldLabel}>Type</Text>
                <View style={s.segRow}>
                  {TYPES_TARIF.map((t) => (
                    <TouchableOpacity key={t}
                      style={[s.seg, tarifForm.type_tarif === t && { borderColor: colors.text1, backgroundColor: colors.elevated }]}
                      onPress={() => setTarifForm((p) => ({ ...p, type_tarif: t }))}>
                      <Text style={[s.segText, { color: tarifForm.type_tarif === t ? colors.text1 : colors.text3 },
                        tarifForm.type_tarif === t && { fontWeight: '600' }]}>
                        {tarifLabel[t]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.fieldLabel}>Prix (FCFA)</Text>
                <TextInput style={s.input} placeholder="50000" placeholderTextColor={colors.text3}
                  value={tarifForm.prix}
                  onChangeText={(v) => setTarifForm((p) => ({ ...p, prix: v }))}
                  keyboardType="decimal-pad" />
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Avec climatisation</Text>
                  <Switch value={tarifForm.avec_clim}
                    onValueChange={(v) => setTarifForm((p) => ({ ...p, avec_clim: v }))}
                    trackColor={{ false: colors.border, true: colors.text1 }}
                    thumbColor={colors.bg} />
                </View>
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Avec buffet</Text>
                  <Switch value={tarifForm.avec_buffet}
                    onValueChange={(v) => setTarifForm((p) => ({ ...p, avec_buffet: v }))}
                    trackColor={{ false: colors.border, true: colors.text1 }}
                    thumbColor={colors.bg} />
                </View>
                <View style={s.formActions}>
                  <TouchableOpacity style={s.cancelBtn}
                    onPress={() => { setShowTarifFor(null); setEditingTarifId(null) }}>
                    <Text style={s.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={saveTarif}>
                    <Text style={s.saveBtnText}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {l.tarifs.length === 0 && showTarifFor !== l.id && (
              <Text style={{ color: colors.text3, fontSize: 13 }}>Aucun tarif.</Text>
            )}

            {l.tarifs.map((t) => (
              <View key={t.id} style={s.tarifRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.tarifNom}>
                    {tarifLabel[t.type_tarif]}{t.avec_clim ? ' + clim' : ''}{t.avec_buffet ? ' + buffet' : ''}
                  </Text>
                  <Text style={s.tarifPrix}>{t.prix.toLocaleString('fr-FR')} FCFA</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity onPress={() => startEditTarif(l.id, t)}>
                    <Text style={s.editLink}>Éditer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteTarif(l.id, t.id)}>
                    <Text style={s.deleteLink}>Suppr.</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: c.bg, padding: 16 },
    center:        { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
    villaName:     { color: c.text1, fontSize: 20, fontWeight: '600', letterSpacing: -0.5, marginBottom: 2 },
    villaVille:    { color: c.text2, fontSize: 14, marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    section:       { color: c.text1, fontSize: 17, fontWeight: '600' },
    addLink:       { color: c.text1, fontSize: 14, fontWeight: '600' },
    editLink:      { color: c.text2, fontSize: 13 },
    deleteLink:    { color: '#ef4444', fontSize: 13 },
    formBox:       { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 12 },
    formTitle:     { color: c.text1, fontWeight: '600', fontSize: 15, marginBottom: 12 },
    fieldLabel:    { color: c.text2, fontSize: 12, marginBottom: 6 },
    input:         { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: c.text1, fontSize: 14, marginBottom: 10 },
    segRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    seg:           { borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    segText:       { fontSize: 12 },
    switchRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, marginBottom: 4 },
    switchLabel:   { color: c.text2, fontSize: 14 },
    formActions:   { flexDirection: 'row', gap: 10, marginTop: 12 },
    cancelBtn:     { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    cancelBtnText: { color: c.text2, fontWeight: '600', fontSize: 14 },
    saveBtn:       { flex: 1, backgroundColor: c.text1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
    saveBtnText:   { color: c.bg, fontWeight: '600', fontSize: 14 },
    logementCard:  { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 12 },
    logementHeader:{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    logementNom:   { color: c.text1, fontWeight: '600', fontSize: 15, marginBottom: 2 },
    logementInfo:  { color: c.text2, fontSize: 13 },
    tarifsSection: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    tarifHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    tarifTitle:    { color: c.text2, fontSize: 13, fontWeight: '600' },
    tarifRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
    tarifNom:      { color: c.text2, fontSize: 13 },
    tarifPrix:     { color: c.text1, fontWeight: '600', fontSize: 14 },
  })
}
