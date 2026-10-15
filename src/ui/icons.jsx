import { useId } from 'react'

/*
 * Hand-drawn SVG icons in one cartoon style (thick ink outline, glossy
 * gradients), so the HUD looks the same on every device instead of depending
 * on each platform's emoji font. All take `className` (size them with CSS).
 */

const INK = '#1b1b2f'

function Svg({ className, children, label }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  )
}

/** Vertical gradient. */
function Grad({ id, top, bottom }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={top} />
      <stop offset="1" stopColor={bottom} />
    </linearGradient>
  )
}

/** A glossy highlight stroke. */
function Shine({ d, width = 3.5 }) {
  return <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth={width} strokeLinecap="round" />
}

/*
 * Rebirth: two chunky arrows chasing each other round a circle - pink over
 * the top pointing down on the right, white/sky-blue underneath pointing up on
 * the left - with a darker extruded edge, a black outline and a dark centre.
 * Each arrow is a curved band plus a long head that follows the circle; both
 * bands are drawn before both heads, so each head sits over the other's tail.
 */
const at = (r, deg) => {
  const a = (deg * Math.PI) / 180
  return `${(32 + r * Math.cos(a)).toFixed(2)} ${(32 - r * Math.sin(a)).toFixed(2)}`
}
const RB_OUTER = 22.5
const RB_INNER = 12
const RB_TAIL = 200
const RB_BASE = 32
const RB_TIP = -32
/** Band from the tail round the top to where the head starts. */
const REBIRTH_BAND = `M${at(RB_OUTER, RB_TAIL)} A${RB_OUTER} ${RB_OUTER} 0 0 1 ${at(RB_OUTER, RB_BASE)} L${at(RB_INNER, RB_BASE)} A${RB_INNER} ${RB_INNER} 0 0 0 ${at(RB_INNER, RB_TAIL)} Z`
/** Head: wider than the band, its tip further round the circle. */
const REBIRTH_HEAD = `M${at(28.5, RB_BASE)} L${at((RB_OUTER + RB_INNER) / 2, RB_TIP)} L${at(6, RB_BASE)} Z`
const FLIP = 'rotate(180 32 32)'
/** The darker "side" of the 3D arrows peeks out down-left. */
const DEPTH = 'translate(-1.6 2.6)'

function RebirthArrowPart({ d, fill, side, outline }) {
  return (
    <>
      {outline ? (
        <>
          <path d={d} transform={DEPTH} fill={INK} stroke={INK} strokeWidth="6.5" strokeLinejoin="round" />
          <path d={d} fill={INK} stroke={INK} strokeWidth="6.5" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d={d} transform={DEPTH} fill={side} />
          <path d={d} fill={fill} />
        </>
      )}
    </>
  )
}

export function IconRebirth({ className, label }) {
  const id = useId()
  const pink = `url(#${id}p)`
  const white = `url(#${id}w)`
  const parts = (outline) => (
    <>
      <RebirthArrowPart d={REBIRTH_BAND} fill={pink} side="#be185d" outline={outline} />
      <g transform={FLIP}>
        <RebirthArrowPart d={REBIRTH_BAND} fill={white} side="#7cc4f0" outline={outline} />
      </g>
      <RebirthArrowPart d={REBIRTH_HEAD} fill={pink} side="#be185d" outline={outline} />
      <g transform={FLIP}>
        <RebirthArrowPart d={REBIRTH_HEAD} fill={white} side="#7cc4f0" outline={outline} />
      </g>
    </>
  )
  return (
    <Svg className={className} label={label}>
      <defs>
        <radialGradient id={`${id}p`} gradientUnits="userSpaceOnUse" cx="32" cy="32" r="28">
          <stop offset="0.4" stopColor="#ec4899" />
          <stop offset="1" stopColor="#ffa8cf" />
        </radialGradient>
        <radialGradient id={`${id}w`} gradientUnits="userSpaceOnUse" cx="32" cy="32" r="28">
          <stop offset="0.4" stopColor="#d9f0ff" />
          <stop offset="1" stopColor="#ffffff" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="13" fill={INK} />
      {/* One ink silhouette under everything, then the colors on top. */}
      {parts(true)}
      {parts(false)}
      <path d="M17 21 A19 19 0 0 1 27.5 13.6" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2.6" strokeLinecap="round" />
    </Svg>
  )
}

/** Gold trophy cup. */
export function IconTrophy({ className, label }) {
  const id = useId()
  return (
    <Svg className={className} label={label}>
      <defs>
        <Grad id={`${id}g`} top="#fde68a" bottom="#f59e0b" />
        <Grad id={`${id}b`} top="#b45309" bottom="#78350f" />
      </defs>
      {/* Handles: ink outline under a gold core. */}
      <path d="M19 17 H11 C11 27 15 31 21 32 M45 17 H53 C53 27 49 31 43 32" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 17 H11 C11 27 15 31 21 32 M45 17 H53 C53 27 49 31 43 32" fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 10 H47 V22 C47 33 40 40 32 40 C24 40 17 33 17 22 Z" fill={`url(#${id}g)`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="27.5" y="39" width="9" height="8" fill="#f59e0b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="18" y="46" width="28" height="11" rx="3" fill={`url(#${id}b)`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 16 L34.2 21 L39.5 21.4 L35.4 24.8 L36.7 30 L32 27.2 L27.3 30 L28.6 24.8 L24.5 21.4 L29.8 21 Z" fill="#fffbeb" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" />
      <Shine d="M21.5 15 V24" />
    </Svg>
  )
}

/** Pink shopping bag with a dollar sign - Shop. */
export function IconShop({ className, label }) {
  const id = useId()
  return (
    <Svg className={className} label={label}>
      <defs>
        <Grad id={`${id}p`} top="#f9a8d4" bottom="#db2777" />
      </defs>
      <path d="M22 24 V18 A10 10 0 0 1 42 18 V24" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M22 24 V18 A10 10 0 0 1 42 18 V24" fill="none" stroke="#fce7f3" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M11 22 H53 L49.5 56 Q49 59 46 59 H18 Q15 59 14.5 56 Z" fill={`url(#${id}p)`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <text x="32" y="50" textAnchor="middle" fontSize="25" fontWeight="800" fontFamily="Fredoka, system-ui, sans-serif" fill="#ffffff" stroke={INK} strokeWidth="2" paintOrder="stroke">
        $
      </text>
      <Shine d="M17 28 L16 40" />
    </Svg>
  )
}

/** Red gift box with a gold ribbon - Rewards. */
export function IconGift({ className, label }) {
  const id = useId()
  return (
    <Svg className={className} label={label}>
      <defs>
        <Grad id={`${id}r`} top="#f87171" bottom="#b91c1c" />
        <Grad id={`${id}l`} top="#fca5a5" bottom="#dc2626" />
        <Grad id={`${id}y`} top="#fef08a" bottom="#eab308" />
      </defs>
      <path d="M32 21 C24 8 12 13 19 21 Z M32 21 C40 8 52 13 45 21 Z" fill={`url(#${id}y)`} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="12" y="31" width="40" height="27" rx="3" fill={`url(#${id}r)`} stroke={INK} strokeWidth="4" />
      <rect x="8" y="21" width="48" height="12" rx="3" fill={`url(#${id}l)`} stroke={INK} strokeWidth="4" />
      <rect x="27.5" y="21" width="9" height="37" fill={`url(#${id}y)`} stroke={INK} strokeWidth="3.5" />
      <Shine d="M13 25 H22" width={3} />
    </Svg>
  )
}

/** Green banknote - money. */
export function IconCash({ className, label }) {
  const id = useId()
  return (
    <Svg className={className} label={label}>
      <defs>
        <Grad id={`${id}g`} top="#86efac" bottom="#16a34a" />
      </defs>
      <rect x="5" y="15" width="54" height="34" rx="6" fill={`url(#${id}g)`} stroke={INK} strokeWidth="4" />
      <rect x="11" y="21" width="42" height="22" rx="3" fill="none" stroke="#14532d" strokeWidth="2" strokeOpacity="0.6" />
      <circle cx="32" cy="32" r="9" fill="#dcfce7" stroke={INK} strokeWidth="3" />
      <text x="32" y="38.5" textAnchor="middle" fontSize="17" fontWeight="800" fontFamily="Fredoka, system-ui, sans-serif" fill="#15803d">
        $
      </text>
    </Svg>
  )
}

/** Speaker (with waves, or crossed out when muted) - Music. */
export function IconMusic({ className, label, muted = false }) {
  const id = useId()
  return (
    <Svg className={className} label={label}>
      <defs>
        <Grad id={`${id}b`} top="#93c5fd" bottom="#2563eb" />
      </defs>
      <path d="M8 25 H19 L32 14 V50 L19 39 H8 Z" fill={`url(#${id}b)`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {muted ? (
        <>
          <path d="M40 25 L54 39 M54 25 L40 39" stroke={INK} strokeWidth="8" strokeLinecap="round" />
          <path d="M40 25 L54 39 M54 25 L40 39" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M39 24 Q45 32 39 40 M45 17 Q56 32 45 47" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
          <path d="M39 24 Q45 32 39 40 M45 17 Q56 32 45 47" fill="none" stroke="#fde047" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
    </Svg>
  )
}

/** Grey cog - Settings. */
const GEAR_PATH = (() => {
  const teeth = 8
  const points = []
  for (let i = 0; i < teeth * 4; i += 1) {
    const a = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2
    const r = i % 4 === 1 || i % 4 === 2 ? 27 : 20
    points.push(`${(32 + Math.cos(a) * r).toFixed(1)} ${(32 + Math.sin(a) * r).toFixed(1)}`)
  }
  return `M${points.join(' L')} Z`
})()

export function IconGear({ className, label }) {
  const id = useId()
  return (
    <Svg className={className} label={label}>
      <defs>
        <Grad id={`${id}g`} top="#e2e8f0" bottom="#64748b" />
      </defs>
      <path d={GEAR_PATH} fill={`url(#${id}g)`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="8" fill="#334155" stroke={INK} strokeWidth="3" />
    </Svg>
  )
}

/** White feather wing - Jump. */
export function IconWing({ className, label }) {
  return (
    <Svg className={className} label={label}>
      <path
        d="M12 46 C11 28 26 13 50 11 C46 17 42 21 36 23 C44 23 49 25 53 29 C45 34 36 36 28 36 C32 38 34 42 32 47 C25 44 18 46 12 46 Z"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M15 43 C24 34 32 26 44 17 M24 38 C30 33 38 29 46 28" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  )
}
