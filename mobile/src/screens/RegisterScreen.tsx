import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useTheme, Colors } from '../context/ThemeContext'
import api from '../services/api'

export default function RegisterScreen({ navigation }: any) {
  const { login } = useAuth()
  const { colors } = useTheme()
  const [form, setForm] = useState({
    name: '', email: '', password: '', password_confirmation: '', role: 'client' as 'client' | 'proprietaire',
  })
  const [isLoading, setIsLoading] = useState(false)

  const set = (field: string) => (value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleRegister = async () => {
    if (form.password !== form.password_confirmation) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return
    }
    setIsLoading(true)
    try {
      await api.post('/auth/register', form)
      await login(form.email, form.password)
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] })
    } catch (e: any) {
      const errors = e.response?.data?.errors
      const first = errors ? Object.values(errors).flat()[0] as string : null
      Alert.alert('Erreur', first || e.response?.data?.message || 'Une erreur est survenue.')
    } finally {
      setIsLoading(false)
    }
  }

  const s = makeStyles(colors)

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container}>
        <Image source={require('../../assets/icon.png')} style={s.logoImg} resizeMode="contain" />
        <Text style={s.subtitle}>Créer un compte</Text>

        <TextInput style={s.input} placeholder="Nom complet" placeholderTextColor={colors.text3}
          value={form.name} onChangeText={set('name')} />
        <TextInput style={s.input} placeholder="Email" placeholderTextColor={colors.text3}
          value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />

        <Text style={s.label}>Je suis</Text>
        <View style={s.roleRow}>
          {(['client', 'proprietaire'] as const).map((r) => (
            <TouchableOpacity key={r}
              style={[s.roleBtn, { borderColor: form.role === r ? colors.text1 : colors.border },
                form.role === r && { backgroundColor: colors.surface }]}
              onPress={() => setForm((f) => ({ ...f, role: r }))}>
              <Text style={[s.roleBtnText, { color: form.role === r ? colors.text1 : colors.text3 },
                form.role === r && { fontWeight: '600' }]}>
                {r === 'client' ? 'Client' : 'Propriétaire'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput style={s.input} placeholder="Mot de passe (min. 8 caractères)" placeholderTextColor={colors.text3}
          value={form.password} onChangeText={set('password')} secureTextEntry />
        <TextInput style={s.input} placeholder="Confirmer le mot de passe" placeholderTextColor={colors.text3}
          value={form.password_confirmation} onChangeText={set('password_confirmation')} secureTextEntry />

        <TouchableOpacity style={[s.button, { opacity: isLoading ? 0.6 : 1 }]} onPress={handleRegister} disabled={isLoading}>
          <Text style={s.buttonText}>{isLoading ? 'Création...' : 'Créer mon compte'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.link}>Déjà un compte ? Se connecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap:         { flex: 1, backgroundColor: c.bg },
    container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
    logoImg:      { width: 90, height: 90, marginBottom: 16, alignSelf: 'center', borderRadius: 20 },
    subtitle:     { fontSize: 14, color: c.text2, marginBottom: 28, textAlign: 'center' },
    label:        { color: c.text2, fontSize: 13, marginBottom: 8 },
    input:        { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: c.text1, fontSize: 15, marginBottom: 12 },
    roleRow:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
    roleBtn:      { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    roleBtnText:  { fontSize: 14 },
    button:       { backgroundColor: c.text1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
    buttonText:   { color: c.bg, fontWeight: '600', fontSize: 15 },
    link:         { color: c.text3, textAlign: 'center', fontSize: 14 },
  })
}
