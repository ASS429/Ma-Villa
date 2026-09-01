import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { fixUrl } from '../utils/url'

interface Villa {
  id: number
  nom: string
  ville: string
  vedette?: boolean
  photos: { url: string }[]
  avis: { note: number }[]
}

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { user } = useAuth()
  const [vedette, setVedette] = useState<Villa[]>([])

  useEffect(() => {
    api.get('/villas', { params: { vedette: true } })
      .then((res) => setVedette((res.data.data ?? res.data).slice(0, 5)))
      .catch(() => {})
  }, [])

  const note = (v: Villa) => {
    if (!v.avis?.length) return null
    return (v.avis.reduce((s, a) => s + a.note, 0) / v.avis.length).toFixed(1)
  }

  const s = makeStyles(colors)

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 24, paddingBottom: 56 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          <Text style={s.logoMark}>PASSETEMPS</Text>
          <Text style={s.tagline}>
            Trouvez la villa{'\n'}parfaite{'\n'}au Sénégal
          </Text>
          <Text style={s.sub}>
            Des villas de luxe à Saly, Mbour, Dakar et partout au Sénégal.
          </Text>

          <View style={s.heroButtons}>
            <TouchableOpacity
              style={[s.heroBtn, s.heroBtnPrimary, { backgroundColor: colors.accent }]}
              onPress={() => navigation.navigate('Villas')}
              activeOpacity={0.85}
            >
              <Text style={[s.heroBtnText, { color: '#fff' }]}>Parcourir les villas</Text>
            </TouchableOpacity>
            {!user && (
              <TouchableOpacity
                style={[s.heroBtn, s.heroBtnSecondary, { borderColor: colors.border2 }]}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.8}
              >
                <Text style={[s.heroBtnText, { color: colors.text1 }]}>Se connecter</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={[s.statsRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {[
            { value: '50+', label: 'Villas' },
            { value: '200+', label: 'Clients' },
            { value: '★ 4.8', label: 'Note moy.' },
          ].map((stat, i) => (
            <View
              key={i}
              style={[s.stat, i < 2 && { borderRightWidth: 1, borderRightColor: colors.border }]}
            >
              <Text style={[s.statValue, { color: colors.text1 }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: colors.text3 }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Villas vedette ── */}
        {vedette.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.text1 }]}>Villas en vedette</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Villas')}>
                <Text style={[s.sectionLink, { color: colors.accent }]}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={vedette}
              keyExtractor={(v) => v.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={220 + 12}
              decelerationRate="fast"
              contentContainerStyle={{ gap: 12, paddingRight: 4 }}
              renderItem={({ item: v }) => {
                const n = note(v)
                return (
                  <TouchableOpacity
                    style={[s.featuredCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => navigation.navigate('VillaDetail', { id: v.id, nom: v.nom })}
                    activeOpacity={0.92}
                  >
                    <View style={s.featuredPhotoWrapper}>
                      {v.photos[0] ? (
                        <Image
                          source={{ uri: fixUrl(v.photos[0].url) }}
                          style={s.featuredPhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[s.featuredPhoto, { backgroundColor: colors.elevated }]} />
                      )}
                      {/* Gradient overlay */}
                      <View style={s.featuredOverlay} />
                      {/* Vedette badge */}
                      {v.vedette ? (
                        <View style={s.vedetteBadge}>
                          <Text style={s.vedetteBadgeText}>Vedette</Text>
                        </View>
                      ) : null}
                      {/* Rating */}
                      {n ? (
                        <View style={s.ratingBadge}>
                          <Text style={s.ratingText}>★ {n}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={s.featuredBody}>
                      <Text style={[s.featuredNom, { color: colors.text1 }]} numberOfLines={1}>
                        {v.nom}
                      </Text>
                      <Text style={[s.featuredVille, { color: colors.text2 }]}>
                        📍 {v.ville}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        )}

        {/* ── Features ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text1, marginBottom: 14 }]}>
            Pourquoi PasseTemps ?
          </Text>
          {[
            {
              icon: '🏖️',
              title: 'Meilleurs emplacements',
              desc: 'Villas sélectionnées sur les plus belles plages du Sénégal.',
              accent: colors.accentBg,
            },
            {
              icon: '✅',
              title: 'Villas vérifiées',
              desc: 'Chaque villa est validée par notre équipe avant publication.',
              accent: 'rgba(34,135,90,0.10)',
            },
            {
              icon: '📅',
              title: 'Réservation simple',
              desc: 'Réservez en quelques taps, confirmation rapide.',
              accent: colors.elevated,
            },
          ].map((f, i) => (
            <View
              key={i}
              style={[s.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[s.featureIconWrap, { backgroundColor: f.accent }]}>
                <Text style={s.featureIcon}>{f.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.featureTitle, { color: colors.text1 }]}>{f.title}</Text>
                <Text style={[s.featureDesc, { color: colors.text2 }]}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── CTA ── */}
        {!user && (
          <View style={[s.ctaBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.ctaTitle, { color: colors.text1 }]}>Prêt à réserver ?</Text>
            <Text style={[s.ctaDesc, { color: colors.text2 }]}>
              Créez votre compte gratuitement et réservez dès maintenant.
            </Text>
            <TouchableOpacity
              style={[s.ctaBtn, { backgroundColor: colors.accent }]}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.85}
            >
              <Text style={s.ctaBtnText}>Créer un compte</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 20 },

    /* Hero */
    hero: { marginBottom: 28 },
    logoMark: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 3,
      color: colors.text3,
      marginBottom: 20,
    },
    tagline: {
      fontSize: 36,
      fontWeight: '300',
      lineHeight: 44,
      letterSpacing: -1,
      color: colors.text1,
      marginBottom: 14,
    },
    sub: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text2,
      marginBottom: 28,
    },
    heroButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    heroBtn: { borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14 },
    heroBtnPrimary: {},
    heroBtnSecondary: { borderWidth: 1 },
    heroBtnText: { fontWeight: '600', fontSize: 15 },

    /* Stats */
    statsRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: 16,
      marginBottom: 32,
      overflow: 'hidden',
    },
    stat: { flex: 1, paddingVertical: 16, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '500', letterSpacing: -0.5 },
    statLabel: { fontSize: 11, marginTop: 3 },

    /* Section */
    section: { marginBottom: 28 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 18, fontWeight: '600', letterSpacing: -0.4 },
    sectionLink: { fontSize: 14 },

    /* Featured villa cards */
    featuredCard: {
      width: 220,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
    },
    featuredPhotoWrapper: {
      position: 'relative',
      width: '100%',
      height: 200,
    },
    featuredPhoto: {
      width: '100%',
      height: '100%',
    },
    featuredOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      backgroundColor: 'transparent',
    },
    vedetteBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      backgroundColor: colors.accentGold,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    vedetteBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#fff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    ratingBadge: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 99,
    },
    ratingText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
    featuredBody: { padding: 12 },
    featuredNom: { fontWeight: '600', fontSize: 14, marginBottom: 4 },
    featuredVille: { fontSize: 12 },

    /* Feature cards */
    featureCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
    },
    featureIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    featureIcon: { fontSize: 20 },
    featureTitle: { fontWeight: '600', fontSize: 14, marginBottom: 4 },
    featureDesc: { fontSize: 13, lineHeight: 19 },

    /* CTA */
    ctaBox: {
      borderWidth: 1,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
    },
    ctaTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8, letterSpacing: -0.4 },
    ctaDesc: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
    ctaBtn: { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
    ctaBtnText: { fontWeight: '600', fontSize: 15, color: '#fff' },
  })
}
