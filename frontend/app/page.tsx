'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProfileSelector from '../components/ProfileSelector'
import { resolveProfile } from '../lib/profiles'
import { getProfileFromStorage, getProfileFromUrl, saveProfile } from '../lib/profileStorage'

export default function Home() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const fromUrl = getProfileFromUrl()
    const fromStorage = getProfileFromStorage()
    const resolved = fromUrl || fromStorage
    if (resolved) {
      saveProfile(resolved)
      router.replace(`/chat?user=${resolved.key}`)
      return
    }
    setReady(true)
  }, [router])

  if (!ready) return null

  return (
    <ProfileSelector
      onSelect={(profileKey) => {
        const profile = resolveProfile(profileKey)
        if (!profile) return
        saveProfile(profile)
        router.push(`/chat?user=${profile.key}`)
      }}
    />
  )
}
