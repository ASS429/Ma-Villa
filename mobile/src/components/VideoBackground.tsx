import { StyleSheet, View } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { useTheme } from '../context/ThemeContext'
import { VIDEO_URL } from '../config'

export default function VideoBackground() {
  const { colors } = useTheme()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Video
        source={{ uri: VIDEO_URL }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        onError={() => {}}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.videoOverlay }]} />
    </View>
  )
}
