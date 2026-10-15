import { useBloxity } from '../bloxity/BloxityContext'
import { TITLES } from '../game/core/config'
import { titleFor } from '../game/core/formulas'
import { useGame } from '../game/core/store'

/**
 * Name tag, top-right: picture, name and your current title.
 *
 * There are no log in / log out buttons: the Bloxity SDK signs you in with the
 * account you're logged in to on the site as soon as the game loads, and plays
 * you as a guest when you aren't (`getUser() || getGuest()`, surfaced as
 * `identity`). The HUD scales it with the rest of the top-right block.
 */
export function AuthHUD() {
  const { identity, isLoggedIn } = useBloxity()
  const titleIndex = useGame((s) => titleFor(s.data).index)
  const title = TITLES[titleIndex] || TITLES[0]
  const name = identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp

  return (
    <div className="nametag pointer-events-auto flex h-14 items-center gap-2.5 py-1 pl-1 pr-3 text-white">
      <div className="relative shrink-0">
        {pfp ? (
          <img src={pfp} alt="" className="nametag-pfp object-cover" />
        ) : (
          <div className="nametag-pfp game-font flex items-center justify-center text-xl">{name.charAt(0).toUpperCase()}</div>
        )}
        {isLoggedIn && (
          <span className="nametag-verified" title="Bloxity account">
            ✔
          </span>
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="game-font stroke-1 max-w-40 truncate text-lg">{name}</div>
        <div className="game-font stroke-1 max-w-40 truncate text-sm" style={{ color: title.color }}>
          {title.emoji} {title.name}
        </div>
      </div>
      {!isLoggedIn && <span className="nametag-guest game-font">GUEST</span>}
    </div>
  )
}

export default AuthHUD
