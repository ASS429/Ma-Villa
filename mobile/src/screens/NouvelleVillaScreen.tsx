import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import api from '../services/api'
import { useTheme, Colors } from '../context/ThemeContext'

interface MediaItem { uri: string; name: string; type: string }

async function uploadFile(uri: string, name: string, type: string): Promise<string> {
  const token = await AsyncStorage.getItem('token')
  const form = new FormData()
  form.append('file', { uri, name, type } as any)
  const res = await fetch(`${(api.defaults.baseURL ?? '').replace('/api', '')}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}`, Accept: 'application/json' },
    body: form,
  })
  if (!res.ok) throw new Error('Upload échoué')
  const data = await res.json()
  return data.url
}

export default function NouvelleVillaScreen({ navigation }: any) {
  const { colors } = useTheme()
  const [form, setForm] = useState({
    nom: '', description: '', adresse: '', ville: '', telephone: '',
    latitude: '', longitude: '',
  })
  const [media, setMedia] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const set = (field: string) => (value: string) => setForm((f) => ({ ...f, [field]: value }))

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission refusée'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.85,
    })
    if (!result.canceled) {
      const items = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo_${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }))
      setMedia((prev) => [...prev, ...items])
    }
  }

  const removeMedia = (idx: number) => setMedia((prev) => prev.filter((_, i) => i !== idx))

  const [locLoading, setLocLoading] = useState(false)
  const useCurrentLocation = async () => {
    setLocLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Autorisez l\'accès à la localisation dans les paramètres de l\'application.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      setForm((f) => ({
        ...f,
        latitude: loc.coords.latitude.toFixed(6),
        longitude: loc.coords.longitude.toFixed(6),
      }))
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer la position.')
    } finally {
      setLocLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.nom || !form.description || !form.adresse || !form.ville || !form.telephone) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.'); return
    }
    setIsLoading(true)
    try {
      const payload = {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      }
      const res = await api.post('/villas', payload)
      const villaId = res.data.id

      if (media.length > 0) {
        const photos = []
        setProgress({ current: 0, total: media.length })
        for (let i = 0; i < media.length; i++) {
          setProgress({ current: i + 1, total: media.length })
          const url = await uploadFile(media[i].uri, media[i].name, media[i].type)
          photos.push({ url, alt: media[i].name, ordre: i })
        }
        await api.post(`/villas/${villaId}/photos`, { photos })
      }

      Alert.alert('Succès', 'Villa créée ! Elle sera publiée après validation.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } catch (e: any) {
      const errors = e.response?.data?.errors
      const first = errors ? Object.values(errors).flat()[0] as string : null
      Alert.alert('Erreur', first || e.response?.data?.message || 'Une erreur est survenue.')
    } finally {
      setIsLoading(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  const s = makeStyles(colors)
  const isUploading = progress.total > 0

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container}>

        <Text style={s.section}>Informations générales</Text>
        <TextInput style={s.input} placeholder="Nom de la villa *" placeholderTextColor={colors.text3}
          value={form.nom} onChangeText={set('nom')} />
        <TextInput style={[s.input, s.textarea]} placeholder="Description *" placeholderTextColor={colors.text3}
          value={form.description} onChangeText={set('description')} multiline numberOfLines={4} textAlignVertical="top" />
        <View style={s.row}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Ville *" placeholderTextColor={colors.text3}
            value={form.ville} onChangeText={set('ville')} />
          <View style={{ width: 10 }} />
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Téléphone *" placeholderTextColor={colors.text3}
            value={form.telephone} onChangeText={set('telephone')} keyboardType="phone-pad" />
        </View>
        <TextInput style={s.input} placeholder="Adresse *" placeholderTextColor={colors.text3}
          value={form.adresse} onChangeText={set('adresse')} />

        <Text style={s.section}>Localisation <Text style={s.optional}>(optionnel)</Text></Text>

        <TouchableOpacity
          style={[s.locBtn, { borderColor: colors.border, opacity: locLoading ? 0.6 : 1 }]}
          onPress={useCurrentLocation}
          disabled={locLoading}
        >
          <Text style={{ fontSize: 16, marginRight: 8 }}>📍</Text>
          <Text style={[s.locBtnText, { color: colors.text1 }]}>
            {locLoading ? 'Localisation en cours...' : 'Utiliser ma position actuelle'}
          </Text>
        </TouchableOpacity>

        {(form.latitude || form.longitude) && (
          <View style={[s.locPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>✅</Text>
            <Text style={{ color: colors.text2, fontSize: 13 }}>
              {form.latitude}, {form.longitude}
            </Text>
            <TouchableOpacity
              onPress={() => setForm((f) => ({ ...f, latitude: '', longitude: '' }))}
              style={{ marginLeft: 'auto' }}
            >
              <Text style={{ color: colors.text3, fontSize: 18, lineHeight: 20 }}>×</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[s.locManualLabel, { color: colors.text3 }]}>Ou saisir manuellement :</Text>
        <View style={s.row}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Latitude" placeholderTextColor={colors.text3}
            value={form.latitude} onChangeText={set('latitude')} keyboardType="decimal-pad" />
          <View style={{ width: 10 }} />
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Longitude" placeholderTextColor={colors.text3}
            value={form.longitude} onChangeText={set('longitude')} keyboardType="decimal-pad" />
        </View>

        <Text style={s.section}>Photos & Vidéos <Text style={s.optional}>(optionnel)</Text></Text>
        <TouchableOpacity style={s.pickBtn} onPress={pickImages}>
          <Text style={s.pickBtnText}>+ Ajouter des photos / vidéos</Text>
        </TouchableOpacity>

        {media.length > 0 && (
          <View style={s.mediaGrid}>
            {media.map((m, i) => (
              <View key={i} style={s.mediaThumb}>
                <Image source={{ uri: m.uri }} style={s.mediaImg} />
                {i === 0 && (
                  <View style={s.coverBadge}><Text style={s.coverText}>Couv.</Text></View>
                )}
                <TouchableOpacity style={s.removeMedia} onPress={() => removeMedia(i)}>
                  <Text style={s.removeMediaText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {isUploading && (
          <View style={s.progressBox}>
            <Text style={s.progressText}>Envoi... {progress.current}/{progress.total}</Text>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${(progress.current / progress.total) * 100}%` as any }]} />
            </View>
          </View>
        )}

        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={s.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.submitBtn, { opacity: isLoading ? 0.5 : 1 }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={s.submitBtnText}>
              {isLoading ? (isUploading ? 'Upload...' : 'Enregistrement...') : 'Créer la villa'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap:          { flex: 1, backgroundColor: c.bg },
    container:     { padding: 16, paddingBottom: 40 },
    section:       { color: c.text1, fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8 },
    optional:      { color: c.text3, fontWeight: '400', fontSize: 13 },
    input:         { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: c.text1, fontSize: 14, marginBottom: 10 },
    textarea:      { minHeight: 100, paddingTop: 13 },
    row:           { flexDirection: 'row' },
    locBtn:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 10 },
    locBtnText:    { fontSize: 14, fontWeight: '500' },
    locPreview:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
    locManualLabel:{ fontSize: 12, marginBottom: 6, marginTop: 2 },
    pickBtn:       { borderWidth: 2, borderColor: c.border, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 20, alignItems: 'center', marginBottom: 12 },
    pickBtnText:   { color: c.text3, fontSize: 14 },
    mediaGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    mediaThumb:    { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', position: 'relative' },
    mediaImg:      { width: '100%', height: '100%', resizeMode: 'cover' },
    coverBadge:    { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
    coverText:     { color: '#fff', fontSize: 9, fontWeight: '600' },
    removeMedia:   { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    removeMediaText: { color: '#fff', fontSize: 14, lineHeight: 20 },
    progressBox:   { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 12 },
    progressText:  { color: c.text2, fontSize: 13, marginBottom: 8 },
    progressBar:   { height: 4, backgroundColor: c.elevated, borderRadius: 2, overflow: 'hidden' },
    progressFill:  { height: '100%', backgroundColor: c.text1, borderRadius: 2 },
    btnRow:        { flexDirection: 'row', gap: 10, marginTop: 8 },
    cancelBtn:     { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    cancelBtnText: { color: c.text2, fontWeight: '600', fontSize: 15 },
    submitBtn:     { flex: 1, backgroundColor: c.text1, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    submitBtnText: { color: c.bg, fontWeight: '600', fontSize: 15 },
  })
}
