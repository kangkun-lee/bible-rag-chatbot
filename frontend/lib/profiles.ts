export interface Profile {
  id: string
  key: string
  name: string
  accent: string
  gradient: string
}

export const PROFILES: Profile[] = [
  {
    id: process.env.NEXT_PUBLIC_PROFILE_1_ID || '11111111-1111-1111-1111-111111111111',
    key: 'profile1',
    name: process.env.NEXT_PUBLIC_PROFILE_1_NAME || '프로필 1',
    accent: '#E76F51',
    gradient: 'linear-gradient(135deg, #FFE8D6 0%, #FBE3D4 45%, #F6C7B0 100%)',
  },
  {
    id: process.env.NEXT_PUBLIC_PROFILE_2_ID || '22222222-2222-2222-2222-222222222222',
    key: 'profile2',
    name: process.env.NEXT_PUBLIC_PROFILE_2_NAME || '프로필 2',
    accent: '#264653',
    gradient: 'linear-gradient(135deg, #E0FBFC 0%, #CAE9FF 55%, #B3E5FC 100%)',
  },
  {
    id: process.env.NEXT_PUBLIC_PROFILE_3_ID || '33333333-3333-3333-3333-333333333333',
    key: 'profile3',
    name: process.env.NEXT_PUBLIC_PROFILE_3_NAME || '프로필 3',
    accent: '#2A9D8F',
    gradient: 'linear-gradient(135deg, #E9F5DB 0%, #D4EDDA 50%, #C3EBD1 100%)',
  },
  {
    id: process.env.NEXT_PUBLIC_PROFILE_4_ID || '44444444-4444-4444-4444-444444444444',
    key: 'profile4',
    name: process.env.NEXT_PUBLIC_PROFILE_4_NAME || '프로필 4',
    accent: '#8A5A44',
    gradient: 'linear-gradient(135deg, #F3E9DC 0%, #EADBC8 55%, #D9BCA5 100%)',
  },
]

export const resolveProfile = (value?: string | null): Profile | null => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return (
    PROFILES.find((profile) => profile.key === normalized) ||
    PROFILES.find((profile) => profile.id === value) ||
    PROFILES.find((profile) => profile.name === value) ||
    null
  )
}
