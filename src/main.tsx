import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Login from './login.tsx'
import Profile from './profile.tsx'
import { supabase } from './components/supaBaseClient.ts'
import type { Session } from '@supabase/supabase-js'

function RootApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (isMounted) {
        setSession(data.session)
        setIsSessionLoading(false)
      }
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsSessionLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsProfileOpen(false)
  }

  if (isSessionLoading) {
    return <main className="login-screen">Loading...</main>
  }

  if (!session) {
    return <Login />
  }

  if (isProfileOpen) {
    return (
      <Profile
        email={session.user.email ?? 'member'}
        onBack={() => setIsProfileOpen(false)}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <>
      <App
        sessionEmail={session.user.email ?? 'member'}
        onOpenProfile={() => setIsProfileOpen(true)}
      />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
