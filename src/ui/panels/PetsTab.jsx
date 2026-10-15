import { useMemo, useState } from 'react'

import { PET_RULES, PETS, RARITIES } from '../../game/core/config'
import { formatMult, formatPercent } from '../../game/core/format'
import { maxPetSlots, petMultiplier, petPower } from '../../game/core/formulas'
import { getGame, useGame } from '../../game/core/store'
import { GameButton } from '../common'
import { uiSound } from '../uiUtils'

const VARIANT_STYLE = [
  null,
  { label: 'GOLDEN', className: 'grad-yellow' },
  { label: 'RAINBOW', className: 'grad-rainbow' },
]

function PetCard({ pet, equipped, selected, onSelect }) {
  const def = PETS[pet.id]
  const rarity = RARITIES[def.rarity]
  const variant = VARIANT_STYLE[pet.variant || 0]
  return (
    <button
      type="button"
      onClick={() => {
        uiSound()
        onSelect(pet.uid)
      }}
      className={`card relative flex flex-col items-center p-2 transition ${selected ? 'scale-105 ring-4 ring-white' : ''} ${variant ? variant.className : ''}`}
      style={{ borderColor: equipped ? '#4ade80' : undefined }}
    >
      {equipped && <span className="game-font stroke-1 absolute -left-2 -top-2 rounded-lg border-2 border-[#1b1b2f] bg-green-500 px-1 text-sm text-white">✔</span>}
      <span className="text-5xl drop-shadow">{def.emoji}</span>
      <span className="game-font stroke-1 text-base leading-tight text-white">{def.name}</span>
      <span className="game-font stroke-1 text-xs" style={{ color: rarity.color }}>
        {variant ? variant.label : rarity.name}
      </span>
      <span className="game-font stroke-1 text-sm text-[#86efac]">{formatPercent(petPower(pet))}</span>
    </button>
  )
}

/** Pets tab of the Shop: inventory, equip, evolve and delete. */
export function PetsTab() {
  const pets = useGame((s) => s.data.pets)
  const equippedPets = useGame((s) => s.data.equippedPets)
  const slots = useGame((s) => maxPetSlots(s.data))
  const mult = useGame((s) => petMultiplier(s.data))
  const [selectedUid, setSelectedUid] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sorted = useMemo(() => [...pets].sort((a, b) => petPower(b) - petPower(a)), [pets])
  const equipped = new Set(equippedPets)
  const selected = pets.find((p) => p.uid === selectedUid) || null
  const sameCount = selected
    ? pets.filter((p) => p.id === selected.id && (p.variant || 0) === (selected.variant || 0)).length
    : 0
  const canEvolve = selected && (selected.variant || 0) < PET_RULES.variants.length - 1

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="game-font stroke-2 text-2xl text-white">
          Equipped {equippedPets.length}/{slots}
        </div>
        <div className="game-font stroke-2 text-2xl text-[#86efac]">Pet Money {formatMult(mult)}</div>
        <div className="game-font stroke-1 text-lg text-white/80">
          Inventory {pets.length}/{PET_RULES.maxInventory}
        </div>
        <div className="flex-1" />
        <GameButton color="green" onClick={() => getGame().equipBest()} disabled={!pets.length}>
          Equip Best
        </GameButton>
      </div>

      {selected && (
        <div className="card mb-3 flex flex-wrap items-center gap-3 p-3">
          <span className="text-6xl">{PETS[selected.id].emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="game-font stroke-2 text-2xl text-white">
              {PET_RULES.variants[selected.variant || 0].name !== 'Normal' && `${PET_RULES.variants[selected.variant || 0].name} `}
              {PETS[selected.id].name}
            </div>
            <div className="game-font stroke-1 text-lg text-[#86efac]">{formatPercent(petPower(selected))} money</div>
          </div>
          {equipped.has(selected.uid) ? (
            <GameButton color="gray" onClick={() => getGame().unequipPet(selected.uid)}>
              Unequip
            </GameButton>
          ) : (
            <GameButton color="green" onClick={() => getGame().equipPet(selected.uid)}>
              Equip
            </GameButton>
          )}
          {canEvolve && (
            <GameButton
              color={sameCount >= PET_RULES.evolveCost ? 'yellow' : 'gray'}
              disabled={sameCount < PET_RULES.evolveCost}
              onClick={() => {
                if (getGame().evolvePet(selected.id, selected.variant || 0)) setSelectedUid(null)
              }}
            >
              Evolve {Math.min(sameCount, PET_RULES.evolveCost)}/{PET_RULES.evolveCost} → {PET_RULES.variants[(selected.variant || 0) + 1].name}
            </GameButton>
          )}
          {confirmDelete ? (
            <GameButton
              color="red"
              onClick={() => {
                getGame().deletePet(selected.uid)
                setSelectedUid(null)
                setConfirmDelete(false)
              }}
            >
              Sure? Delete!
            </GameButton>
          ) : (
            <GameButton color="red" onClick={() => setConfirmDelete(true)}>
              Delete
            </GameButton>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="game-font stroke-2 py-10 text-center text-2xl text-white">
          No pets yet! Walk to the eggs in the PETS area (behind spawn) and open one with Wins. 🥚
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
          {sorted.map((pet) => (
            <PetCard
              key={pet.uid}
              pet={pet}
              equipped={equipped.has(pet.uid)}
              selected={pet.uid === selectedUid}
              onSelect={(uid) => {
                setSelectedUid(uid === selectedUid ? null : uid)
                setConfirmDelete(false)
              }}
            />
          ))}
        </div>
      )}
      <div className="game-font stroke-1 mt-3 text-center text-sm text-white/70">
        Evolve: {PET_RULES.evolveCost} identical pets → 1 Golden (x{PET_RULES.variants[1].mult}) · {PET_RULES.evolveCost} Golden → 1 Rainbow (x
        {PET_RULES.variants[2].mult})
      </div>
    </>
  )
}

export default PetsTab
