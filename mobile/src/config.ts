// En développement local : IP de ton PC sur le réseau Wi-Fi
// En production (APK) : URL du backend Render
const DEV_IP = '192.168.1.51'
const PROD_URL = 'https://ma-villa-production.up.railway.app'

export const API_BASE  = __DEV__ ? `http://${DEV_IP}:8000` : PROD_URL
export const WEB_BASE  = __DEV__ ? `http://${DEV_IP}:5173` : PROD_URL
export const VIDEO_URL = `${WEB_BASE}/video_backgroud.mp4`
