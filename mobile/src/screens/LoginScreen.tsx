import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useTheme, Colors } from '../context/ThemeContext'

export default function LoginScreen({ navigation }: any) {
  const { login, isLoading } = useAuth()
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    try {
      await login(email, password)
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] })
    } catch {
      setError('Email ou mot de passe incorrect.')
    }
  }

  const s = makeStyles(colors)

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Image source={require('../../assets/icon.png')} style={s.logoImg} resizeMode="contain" />
      <Text style={s.subtitle}>Connectez-vous à votre compte</Text>

      {!!error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        style={s.input}
        placeholder="Email"
        placeholderTextColor={colors.text3}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={s.input}
        placeholder="Mot de passe"
        placeholderTextColor={colors.text3}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={[s.button, { opacity: isLoading ? 0.6 : 1 }]} onPress={handleLogin} disabled={isLoading}>
        <Text style={s.buttonText}>{isLoading ? 'Connexion...' : 'Se connecter'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register' as never)}>
        <Text style={s.link}>Pas encore de compte ? S'inscrire</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: c.bg, justifyContent: 'center', paddingHorizontal: 24 },
    logoImg:    { width: 90, height: 90, marginBottom: 16, alignSelf: 'center', borderRadius: 20 },
    subtitle:   { fontSize: 14, color: c.text2, marginBottom: 28, textAlign: 'center' },
    errorBox:   { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12, padding: 12, marginBottom: 12 },
    errorText:  { color: '#ef4444', fontSize: 13 },
    input:      { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: c.text1, fontSize: 15, marginBottom: 12 },
    button:     { backgroundColor: c.text1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
    buttonText: { color: c.bg, fontWeight: '600', fontSize: 15 },
    link:       { color: c.text3, textAlign: 'center', fontSize: 14 },
  })
}
