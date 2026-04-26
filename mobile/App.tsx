import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import VideoBackground from './src/components/VideoBackground'
import HomeScreen from './src/screens/HomeScreen'
import VillasScreen from './src/screens/VillasScreen'
import VillaDetailScreen from './src/screens/VillaDetailScreen'
import ProfilScreen from './src/screens/ProfilScreen'
import LoginScreen from './src/screens/LoginScreen'
import RegisterScreen from './src/screens/RegisterScreen'
import ReservationsScreen from './src/screens/ReservationsScreen'
import FavorisScreen from './src/screens/FavorisScreen'
import MesVillasScreen from './src/screens/MesVillasScreen'
import NouvelleVillaScreen from './src/screens/NouvelleVillaScreen'
import GererVillaScreen from './src/screens/GererVillaScreen'
import AdminVillasScreen from './src/screens/AdminVillasScreen'
import AdminUtilisateursScreen from './src/screens/AdminUtilisateursScreen'
import AdminAvisScreen from './src/screens/AdminAvisScreen'
import {
  Home, Building2, CalendarDays, User, Heart,
  LayoutDashboard, Users, MessageSquare,
  type LucideIcon,
} from 'lucide-react-native'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()

function TabIcon({ Icon, focused, color }: { Icon: LucideIcon; focused: boolean; color: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }}>
      <Icon
        size={focused ? 22 : 20}
        color={focused ? colors.accent : colors.text3}
        strokeWidth={focused ? 2 : 1.5}
      />
      {focused && (
        <View style={{
          position: 'absolute',
          bottom: -6,
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.accent,
        }} />
      )}
    </View>
  )
}

type TabDef = { name: string; component: any; Icon: LucideIcon; title: string }

function TabsBase({ screens }: { screens: TabDef[] }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const tabBarHeight = 58 + insets.bottom

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
          elevation: 20,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        sceneContainerStyle: { backgroundColor: 'transparent' },
      }}
    >
      {screens.map((s) => (
        <Tab.Screen
          key={s.name}
          name={s.name}
          component={s.component}
          options={{
            title: s.title,
            tabBarIcon: ({ focused, color }) => <TabIcon Icon={s.Icon} focused={focused} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
  )
}

const homeTab        : TabDef = { name: 'Accueil',    component: HomeScreen,              Icon: LayoutDashboard, title: 'Accueil'      }
const villasTab      : TabDef = { name: 'Villas',     component: VillasScreen,            Icon: Building2,       title: 'Villas'       }
const resaTab        : TabDef = { name: 'Resa',       component: ReservationsScreen,      Icon: CalendarDays,    title: 'Résa'         }
const profilTab      : TabDef = { name: 'Profil',     component: ProfilScreen,            Icon: User,            title: 'Profil'       }
const favorisTab     : TabDef = { name: 'Favoris',    component: FavorisScreen,           Icon: Heart,           title: 'Favoris'      }
const mesVillasTab   : TabDef = { name: 'MesVillas',  component: MesVillasScreen,         Icon: Home,            title: 'Mes villas'   }
const adminVillasTab : TabDef = { name: 'AdminVillas',component: AdminVillasScreen,        Icon: Building2,       title: 'Villas'       }
const adminUsersTab  : TabDef = { name: 'AdminUsers', component: AdminUtilisateursScreen,  Icon: Users,           title: 'Utilisateurs' }
const adminAvisTab   : TabDef = { name: 'AdminAvis',  component: AdminAvisScreen,          Icon: MessageSquare,   title: 'Avis'         }

function MainTabs() {
  const { user } = useAuth()
  if (user?.role === 'admin') {
    return <TabsBase screens={[homeTab, adminVillasTab, adminUsersTab, adminAvisTab, profilTab]} />
  }
  if (user?.role === 'proprietaire') {
    return <TabsBase screens={[homeTab, villasTab, mesVillasTab, resaTab, profilTab]} />
  }
  if (user?.role === 'client') {
    return <TabsBase screens={[homeTab, villasTab, favorisTab, resaTab, profilTab]} />
  }
  return <TabsBase screens={[homeTab, villasTab, profilTab]} />
}

function Navigation() {
  const { isLoading } = useAuth()
  const { colors } = useTheme()
  if (isLoading) return null

  return (
    <>
      <VideoBackground />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text1,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="Main"          component={MainTabs}            options={{ headerShown: false }} />
        <Stack.Screen name="VillaDetail"   component={VillaDetailScreen}   options={({ route }: any) => ({ title: route.params?.nom || 'Détail' })} />
        <Stack.Screen name="Login"         component={LoginScreen}         options={{ title: 'Connexion' }} />
        <Stack.Screen name="Register"      component={RegisterScreen}      options={{ title: 'Inscription' }} />
        <Stack.Screen name="NouvelleVilla" component={NouvelleVillaScreen} options={{ title: 'Nouvelle villa' }} />
        <Stack.Screen name="GererVilla"    component={GererVillaScreen}    options={({ route }: any) => ({ title: route.params?.nom || 'Gérer la villa' })} />
      </Stack.Navigator>
    </>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppInner />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function AppInner() {
  const { isDark } = useTheme()
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Navigation />
    </>
  )
}
