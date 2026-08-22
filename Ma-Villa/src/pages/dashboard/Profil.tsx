import { useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { messageErreur } from '../../lib/erreurs'
import ReglageNotifications from '../../components/app/ReglageNotifications'
import GrilleNotifications from '../../components/app/GrilleNotifications'

export default function Profil() {
  const { user, updateUser } = useAuth()
  const [info, setInfo] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '' })
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoSuccess, setInfoSuccess] = useState(false)
  const [infoError, setInfoError] = useState('')
  const [pwd, setPwd] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdError, setPwdError] = useState('')

  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setInfoLoading(true)
    setInfoError('')
    setInfoSuccess(false)
    try {
      const res = await api.patch('/auth/profile', {
        name: info.name,
        email: info.email,
        phone: info.phone || null,
      })
      updateUser(res.data)
      setInfoSuccess(true)
    } catch (err) {
      setInfoError(messageErreur(err))
    } finally {
      setInfoLoading(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdLoading(true)
    setPwdError('')
    setPwdSuccess(false)
    try {
      await api.patch('/auth/profile', pwd)
      setPwdSuccess(true)
      setPwd({ current_password: '', password: '', password_confirmation: '' })
    } catch (err) {
      setPwdError(messageErreur(err))
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-normal mb-8">Mon profil</h1>

      {/* Notifications : placées en tête parce que c'est le seul réglage qui
          change ce que l'utilisateur reçoit hors de l'application. Le composant
          ne rend rien si le serveur n'a pas de clés ou si le navigateur ne sait
          pas les gérer. */}
      <div className="mb-6">
        <ReglageNotifications />

        {/* L'un dit *où* l'on est prévenu — ce navigateur — l'autre *de
            quoi*. Les confondre donnerait un interrupteur unique qui ne
            dit ni l'un ni l'autre. */}
        <GrilleNotifications />
      </div>

      {/* Info */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-sm font-medium mb-5 th-text-1">Informations personnelles</h2>
        <form onSubmit={saveInfo} className="flex flex-col gap-4">
          {infoError && (
            <div className="console-erreur" role="alert">
              {infoError}
            </div>
          )}
          {infoSuccess && (
            <div className="console-succes" role="status">
              Profil mis à jour avec succès.
            </div>
          )}
          <div>
            <label className="text-xs th-text-2 mb-1.5 block">Nom</label>
            <input
              type="text"
              required
              value={info.name}
              onChange={(e) => { setInfo({ ...info, name: e.target.value }); setInfoSuccess(false) }}
              className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
            />
          </div>
          <div>
            <label className="text-xs th-text-2 mb-1.5 block">Email</label>
            <input
              type="email"
              required
              value={info.email}
              onChange={(e) => { setInfo({ ...info, email: e.target.value }); setInfoSuccess(false) }}
              className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
            />
          </div>
          <div>
            <label className="text-xs th-text-2 mb-1.5 block">Téléphone</label>
            <input
              type="tel"
              value={info.phone}
              onChange={(e) => { setInfo({ ...info, phone: e.target.value }); setInfoSuccess(false) }}
              placeholder="+221 77 000 00 00"
              className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
            />
          </div>
          <button
            type="submit"
            disabled={infoLoading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 self-start"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {infoLoading ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-sm font-medium mb-5 th-text-1">Changer le mot de passe</h2>
        <form onSubmit={savePassword} className="flex flex-col gap-4">
          {pwdError && (
            <div className="console-erreur" role="alert">
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="console-succes" role="status">
              Mot de passe modifié avec succès.
            </div>
          )}
          <div>
            <label className="text-xs th-text-2 mb-1.5 block">Mot de passe actuel</label>
            <input
              type="password"
              value={pwd.current_password}
              onChange={(e) => { setPwd({ ...pwd, current_password: e.target.value }); setPwdSuccess(false) }}
              className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
            />
          </div>
          <div>
            <label className="text-xs th-text-2 mb-1.5 block">Nouveau mot de passe</label>
            <input
              type="password"
              value={pwd.password}
              onChange={(e) => { setPwd({ ...pwd, password: e.target.value }); setPwdSuccess(false) }}
              className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
            />
          </div>
          <div>
            <label className="text-xs th-text-2 mb-1.5 block">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={pwd.password_confirmation}
              onChange={(e) => { setPwd({ ...pwd, password_confirmation: e.target.value }); setPwdSuccess(false) }}
              className="w-full rounded-xl px-4 py-2.5 text-sm th-input-field"
            />
          </div>
          <button
            type="submit"
            disabled={pwdLoading || !pwd.current_password || !pwd.password}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 self-start"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {pwdLoading ? 'Modification...' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
