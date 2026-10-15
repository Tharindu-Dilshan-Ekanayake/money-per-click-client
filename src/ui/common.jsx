import { useGame } from '../game/core/store'
import { uiSound } from './uiUtils'

/** Chunky outlined button. `color` is one of the grad-* classes in index.css. */
export function GameButton({ color = 'green', className = '', children, onClick, disabled, size = 'md', ...rest }) {
  const sizes = {
    sm: 'px-3 py-1 text-base',
    md: 'px-4 py-2 text-lg',
    lg: 'px-6 py-3 text-2xl',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        uiSound()
        onClick?.(e)
      }}
      className={`btn-game grad-${color} stroke-1 ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ProgressBar({ value, max, className = '', fillClass = '', label }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0
  return (
    <div className={`bar-track relative ${className}`}>
      <div className={`bar-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      {label && (
        <div className="game-font stroke-2 absolute inset-0 flex items-center justify-center text-white">{label}</div>
      )}
    </div>
  )
}

/** Modal panel shell with a colored header and close button. */
export function Panel({ title, icon, headerClass = 'grad-blue', width = 720, children, footer }) {
  const closePanel = useGame((s) => s.closePanel)
  const close = () => {
    uiSound('close')
    closePanel()
  }
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-2 sm:p-3"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="panel flex max-h-[94vh] w-full flex-col supports-[height:100dvh]:max-h-[94dvh]" style={{ maxWidth: width }}>
        <div className={`panel-header ${headerClass} flex items-center gap-3 px-4 py-3`}>
          <span className="text-4xl drop-shadow">{icon}</span>
          <h2 className="game-font stroke-2 min-w-0 flex-1 truncate text-3xl text-white sm:text-4xl">{title}</h2>
          <button
            type="button"
            onClick={close}
            className="btn-game grad-red stroke-2 h-12 w-12 shrink-0 text-3xl leading-none"
            aria-label="Close"
          >
            X
          </button>
        </div>
        <div className="scroll-area flex-1 p-4">{children}</div>
        {footer && <div className="border-t-4 border-[#1b1b2f] p-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => {
            uiSound()
            onChange(tab.id)
          }}
          className={`btn-game stroke-1 relative px-4 py-2 text-lg ${value === tab.id ? 'grad-yellow' : 'grad-gray'}`}
        >
          {tab.label}
          {tab.badge && <span className="tab-badge" aria-label="new" />}
        </button>
      ))}
    </div>
  )
}
