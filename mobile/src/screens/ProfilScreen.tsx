import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../services/api'

export default function ProfilScreen({ navigation }: any) {
  const { user, logout, updateUser } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()
  const insets = useSafeAreaInsets()

  const [infoForm, setInfoForm] = useState({ name: user?.name ?? '', phone: '' })
  const [pwForm, setPwForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const setInfo = (f: string) => (v: string) => setInfoForm((p) => ({ ...p, [f]: v }))
  const setPw = (f: string) => (v: string) => setPwForm((p) => ({ ...p, [f]: v }))

  const saveInfo = async () => {
    setSavingInfo(true)
    try {
      const res = await api.patch('/auth/profile', { name: infoForm.name, phone: infoForm.phone || undefined })
      await updateUser(res.data)
      Alert.alert('Succès', 'Profil mis à jour.')
    } catch (e: any) {
      const errors = e.response?.data?.errors
      const first = errors ? Object.values(errors).flat()[0] as string : null
      Alert.alert('Erreur', first || e.response?.data?.message || 'Une erreur est survenue.')
    } finally {
      setSavingInfo(false)
    }
  }

  const savePassword = async () => {
    if (!pwForm.current_password || !pwForm.password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.'); return
    }
    if (pwForm.password !== pwForm.password_confirmation) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return
    }
    setSavingPw(true)
    try {
      await api.patch('/auth/profile', pwForm)
      setPwForm({ current_password: '', password: '', password_confirmation: '' })
      Alert.alert('Succès', 'Mot de passe modifié.')
    } catch (e: any) {
      const errors = e.response?.data?.errors
      const first = errors ? Object.values(errors).flat()[0] as string : null
      Alert.alert('Erreur', first || e.response?.data?.message || 'Une erreur est survenue.')
    } finally {
      setSavingPw(false)
    }
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24, paddingTop: insets.top + 16 }}>
        <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 22, marginBottom: 32, textAlign: 'center' }}>Connectez-vous pour accéder à votre profil.</Text>
        <TouchableOpacity style={{ backgroundColor: colors.text1, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 }} onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: colors.bg, fontWeight: '600', fontSize: 15 }}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: 48 }}>
        {/* Header */}
        <Text style={{ color: colors.text1, fontSize: 24, fontWeight: '600', letterSpacing: -0.5, marginBottom: 4 }}>{user.name}</Text>
        <Text style={{ color: colors.text2, fontSize: 14, marginBottom: 12 }}>{user.email}</Text>
        <View style={{ backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 28 }}>
          <Text style={{ color: colors.text2, fontSize: 13 }}>{user.role === 'proprietaire' ? 'Propriétaire' : user.role === 'admin' ? 'Admin' : 'Client'}</Text>
        </View>

        {/* Theme toggle */}
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text1, fontWeight: '600', fontSize: 15 }}>Thème</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border2, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}
            onPress={toggleTheme}
          >
            <Text style={{ fontSize: 16 }}>{isDark ? '🌙' : '☀️'}</Text>
            <Text style={{ color: colors.text2, fontSize: 14 }}>{isDark ? 'Sombre' : 'Clair'}</Text>
          </TouchableOpacity>
        </View>

        {/* Infos générales */}
        <Text style={{ color: colors.text1, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Mes informations</Text>
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 5 }}>Nom</Text>
          <TextInput style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.text1, fontSize: 14, marginBottom: 12 }}
            value={infoForm.name} onChangeText={setInfo('name')} placeholderTextColor={colors.text3} />
          <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 5 }}>Téléphone</Text>
          <TextInput style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.text1, fontSize: 14, marginBottom: 12 }}
            placeholder="Non renseigné" placeholderTextColor={colors.text3}
            value={infoForm.phone} onChangeText={setInfo('phone')} keyboardType="phone-pad" />
          <TouchableOpacity style={[{ backgroundColor: colors.text1, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 }, savingInfo && { opacity: 0.5 }]} onPress={saveInfo} disabled={savingInfo}>
            <Text style={{ color: colors.bg, fontWeight: '600', fontSize: 15 }}>{savingInfo ? 'Enregistrement...' : 'Enregistrer'}</Text>
          </TouchableOpacity>
        </View>

        {/* Mot de passe */}
        <Text style={{ color: colors.text1, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Changer le mot de passe</Text>
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 24 }}>
          {[
            { label: 'Mot de passe actuel', field: 'current_password' },
            { label: 'Nouveau mot de passe', field: 'password' },
            { label: 'Confirmer', field: 'password_confirmation' },
          ].map(({ label, field }) => (
            <View key={field}>
              <Text style={{ color: colors.text2, fontSize: 12, marginBottom: 5 }}>{label}</Text>
              <TextInput style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.text1, fontSize: 14, marginBottom: 12 }}
                secureTextEntry value={(pwForm as any)[field]} onChangeText={setPw(field)}
                placeholderTextColor={colors.text3} placeholder="••••••••" />
            </View>
          ))}
          <TouchableOpacity style={[{ backgroundColor: colors.text1, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 }, savingPw && { opacity: 0.5 }]} onPress={savePassword} disabled={savingPw}>
            <Text style={{ color: colors.bg, fontWeight: '600', fontSize: 15 }}>{savingPw ? 'Modification...' : 'Changer le mot de passe'}</Text>
          </TouchableOpacity>
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }} onPress={logout}>
          <Text style={{ color: colors.text2, fontSize: 15 }}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
