import type { Profile } from './profiles'
import { resolveProfile } from './profiles'

const STORAGE_KEY = 'bibleqa.profile'

export const getProfileFromUrl = (): Profile | null => {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return resolveProfile(params.get('user'))
}

export const getProfileFromStorage = (): Profile | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return resolveProfile(raw)
}

export const saveProfile = (profile: Profile) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, profile.key)
  const url = new URL(window.location.href)
  url.searchParams.set('user', profile.key)
  window.history.replaceState({}, '', url.toString())
}
