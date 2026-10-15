import { useGame } from '../../game/core/store'

const BANNER_COLORS = {
  level: 'text-[#fdba3b]',
  win: 'text-[#fde047]',
  rebirth: 'text-[#e879f9]',
  boost: 'text-[#38bdf8]',
}

const TOAST_COLORS = {
  info: 'text-white',
  success: 'text-[#86efac]',
  error: 'text-[#fca5a5]',
}

/** Big center text for level ups, wins and rebirths ("Level Up! (20 > 21)"). */
export function Banner() {
  const banner = useGame((s) => s.ui.banner)
  if (!banner) return null
  return (
    <div key={banner.id} className="anim-banner pointer-events-none flex flex-col items-center text-center" style={{ transform: 'scale(var(--ui-scale))' }}>
      <div
        className={`game-font stroke-3 text-balance text-6xl ${BANNER_COLORS[banner.kind] || 'text-white'}`}
        style={{ maxWidth: 'calc(94vw / var(--ui-scale))' }}
      >
        {banner.text}
      </div>
      {banner.sub && (
        <div className="game-font stroke-2 mt-1 text-balance text-2xl text-white" style={{ maxWidth: 'calc(94vw / var(--ui-scale))' }}>
          {banner.sub}
        </div>
      )}
    </div>
  )
}

/** Stacked short messages under the banner. */
export function Toasts() {
  const toasts = useGame((s) => s.ui.toasts)

  return (
    <div className="pointer-events-none flex flex-col items-center gap-1" style={{ transform: 'scale(var(--ui-scale))' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-toast game-font stroke-2 rounded-xl bg-black/35 px-4 py-1 text-center text-2xl ${TOAST_COLORS[t.kind] || 'text-white'}`}
          style={{ maxWidth: 'calc(94vw / var(--ui-scale))' }}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
