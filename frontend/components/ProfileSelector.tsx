'use client'

import { PROFILES } from '../lib/profiles'

type ProfileSelectorProps = {
  onSelect: (profileKey: string) => void
}

export default function ProfileSelector({ onSelect }: ProfileSelectorProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      <h1 className="relative z-10 text-3xl md:text-5xl font-bold text-foreground mb-10 md:mb-14 tracking-tight">
        누가 질문하시나요?
      </h1>

      <div className="relative z-10 grid grid-cols-2 gap-6 md:flex md:gap-10">
        {PROFILES.map((profile) => (
          <button
            key={profile.key}
            onClick={() => onSelect(profile.key)}
            className="group flex flex-col items-center gap-4 focus:outline-none"
            aria-label={`${profile.name} 프로필 선택`}
          >
            <div
              className="relative w-28 h-28 md:w-40 md:h-40 rounded-2xl shadow-lg transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.35)]"
              style={{ background: profile.gradient }}
            >
              <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center text-4xl md:text-6xl drop-shadow-md">
                {profile.name.slice(0, 1)}
              </div>
            </div>
            <span className="text-sm md:text-lg font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {profile.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
