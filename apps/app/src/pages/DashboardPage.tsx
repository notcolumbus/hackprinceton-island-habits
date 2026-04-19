import { useState, useEffect, useMemo } from 'react'
import { useConvex, useMutation, useQuery } from 'convex/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { Canvas } from '@react-three/fiber'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { api } from '../../convex/_generated/api'
import { usePhoneNumber } from '../hooks/usePhoneNumber'

/* ── Cozy font loader ─────────────────────────────────── */
function useCozFont() {
  useEffect(() => {
    if (document.getElementById('island-fonts')) return
    const link = document.createElement('link')
    link.id = 'island-fonts'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@600;700;800;900&display=swap'
    document.head.appendChild(link)
  }, [])
}

/* ── Design tokens ────────────────────────────────────── */
const C = {
  bg:         'linear-gradient(180deg, #ecd8bf 0%, #b9e6ea 16%, #9ad3dd 62%, #89c8d6 100%)',
  card:       '#f8f3e6',
  cardBorder: '#d4b587',
  navy:       '#1d3451',
  navy2:      '#273f60',
  text:       '#223856',
  textMuted:  '#6d7b8f',
  textLabel:  '#6c86a4',
  green:      '#54c98a',
  softBlue:   '#dff2f7',
  cream:      '#fffaf0',
}

const fredoka = (size = 20): React.CSSProperties => ({
  fontFamily: "'Fredoka One', cursive",
  fontWeight: 400,
  fontSize: `${size}px`,
  color: C.text,
})

const nunito = (weight = 700, size = 14): React.CSSProperties => ({
  fontFamily: "'Nunito', sans-serif",
  fontWeight: weight,
  fontSize: `${size}px`,
})

/* ── Shared button primitives ─────────────────────────── */
const BtnPrimary = ({
  children, onClick, disabled, type = 'button', style,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  style?: React.CSSProperties
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled
        ? 'linear-gradient(135deg, #9fdbbc 0%, #8dc9a9 100%)'
        : 'linear-gradient(135deg, #57d196 0%, #3db97f 100%)',
      border: '2px solid rgba(27,64,45,0.16)',
      borderRadius: '16px',
      color: '#fff',
      padding: '10px 18px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 8px 18px -8px rgba(36,122,78,0.48)',
      transition: 'all 0.15s',
      ...nunito(900, 14),
      ...style,
    }}
  >
    {children}
  </button>
)

const BtnGhost = ({
  children, onClick, style,
}: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
}) => (
  <button
    onClick={onClick}
    style={{
      background: '#ffffff',
      border: '2px solid #d4e5ef',
      borderRadius: '16px',
      color: C.navy,
      padding: '10px 16px',
      cursor: 'pointer',
      boxShadow: '0 6px 12px -10px rgba(29,52,81,0.42)',
      transition: 'all 0.15s',
      ...nunito(800, 14),
      ...style,
    }}
  >
    {children}
  </button>
)

/* ── Ambient background glow ──────────────────────────── */
const GameBg = () => (
  <>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: C.bg,
    }} />
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse 82% 46% at 50% 83%, rgba(130,207,220,0.65) 0%, rgba(130,207,220,0.0) 100%)',
    }} />
    {[...Array(7)].map((_, i) => (
      <div key={i} style={{
        position: 'fixed',
        width: 180 + (i % 3) * 110,
        height: 180 + (i % 3) * 110,
        borderRadius: '50%',
        background: i % 2 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(199,236,243,0.34)',
        left: `${(i * 17 + i * i * 5) % 94}%`,
        top: `${2 + (i * 11 + i * 9) % 72}%`,
        opacity: 0.55,
        filter: 'blur(44px)',
        zIndex: 0,
        pointerEvents: 'none',
        transform: 'translate(-50%, -50%)',
      }} />
    ))}
  </>
)

const seededFrom = (text: string) => {
  let seed = 2166136261
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i)
    seed = Math.imul(seed, 16777619)
  }
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

const hashOf = (text: string) => {
  let seed = 5381
  for (let i = 0; i < text.length; i++) {
    seed = Math.trunc((seed << 5) + seed + text.charCodeAt(i))
  }
  return seed >>> 0
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

type IslandDetails = {
  island: Doc<'islands'>
  members: Doc<'islandMembers'>[]
  agents: Doc<'agents'>[]
}

type PreviewStructure3D = {
  id: string
  x: number
  z: number
  type: string
  state: Doc<'buildings'>['state']
}

type PreviewAgent3D = {
  id: string
  x: number
  z: number
  bodyColor: string
  hairColor: string
}

type PreviewTree3D = {
  id: string
  x: number
  z: number
  pine: boolean
}

const worldFromGrid = (gridX: number, gridY: number, width: number, height: number): [number, number] => {
  const safeW = Math.max(2, width)
  const safeH = Math.max(2, height)
  const nx = gridX / (safeW - 1)
  const nz = gridY / (safeH - 1)
  return [(nx - 0.5) * 8.2, (nz - 0.5) * 5.6]
}

const MiniTree3D = ({ x, z, pine }: { x: number; z: number; pine: boolean }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 0.34, 0]}>
      <cylinderGeometry args={[0.06, 0.08, 0.45, 6]} />
      <meshStandardMaterial color="#7f4e2f" flatShading />
    </mesh>
    {pine ? (
      <>
        <mesh position={[0, 0.72, 0]}>
          <coneGeometry args={[0.28, 0.45, 7]} />
          <meshStandardMaterial color="#2f7f49" flatShading />
        </mesh>
        <mesh position={[0, 0.89, 0]}>
          <coneGeometry args={[0.22, 0.34, 7]} />
          <meshStandardMaterial color="#2c7444" flatShading />
        </mesh>
      </>
    ) : (
      <mesh position={[0, 0.74, 0]}>
        <sphereGeometry args={[0.28, 10, 10]} />
        <meshStandardMaterial color="#4f9f53" flatShading />
      </mesh>
    )}
  </group>
)

const MiniStructure3D = ({ structure, index }: { structure: PreviewStructure3D; index: number }) => {
  const isGarden = structure.type === 'garden' || structure.type === 'zengarden'
  const muted = structure.state === 'constructing' || structure.state === 'damaged'
  const roofPalette = ['#c24f3c', '#bf5a41', '#b24a3c', '#c8684c']
  const roof = roofPalette[index % roofPalette.length]
  const bodyColor = muted ? '#c9bca9' : '#ead9c2'
  const opacity = muted ? 0.72 : 1

  if (isGarden) {
    return (
      <group position={[structure.x, 0, structure.z]}>
        <mesh position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.28, 0.34, 0.13, 14]} />
          <meshStandardMaterial color="#6b472d" flatShading opacity={opacity} transparent={muted} />
        </mesh>
        {['#e78cac', '#f4c57b', '#d8aef4'].map((c, i) => (
          <mesh key={`${structure.id}-flower-${i}`} position={[-0.1 + i * 0.1, 0.25, 0.06 - i * 0.02]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={c} flatShading />
          </mesh>
        ))}
      </group>
    )
  }

  return (
    <group position={[structure.x, 0, structure.z]}>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[0.74, 0.12, 0.74]} />
        <meshStandardMaterial color="#958775" flatShading opacity={opacity} transparent={muted} />
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <boxGeometry args={[0.64, 0.46, 0.64]} />
        <meshStandardMaterial color={bodyColor} flatShading opacity={opacity} transparent={muted} />
      </mesh>
      <mesh position={[0, 0.74, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.54, 0.28, 4]} />
        <meshStandardMaterial color={roof} flatShading opacity={opacity} transparent={muted} />
      </mesh>
      <mesh position={[0.18, 0.41, 0.33]}>
        <boxGeometry args={[0.12, 0.22, 0.04]} />
        <meshStandardMaterial color="#734c31" flatShading />
      </mesh>
    </group>
  )
}

const MiniAgent3D = ({ agent }: { agent: PreviewAgent3D }) => (
  <group position={[agent.x, 0, agent.z]}>
    <mesh position={[0, 0.22, 0]}>
      <sphereGeometry args={[0.14, 12, 12]} />
      <meshStandardMaterial color={agent.bodyColor} flatShading />
    </mesh>
    <mesh position={[0, 0.41, 0]}>
      <sphereGeometry args={[0.11, 12, 12]} />
      <meshStandardMaterial color="#f3ccae" flatShading />
    </mesh>
    <mesh position={[0, 0.45, 0.01]}>
      <sphereGeometry args={[0.08, 10, 10]} />
      <meshStandardMaterial color={agent.hairColor} flatShading />
    </mesh>
  </group>
)

const MiniIslandPreview = ({
  island,
  details,
  buildings,
  selected,
}: {
  island: Doc<'islands'>
  details: IslandDetails | undefined
  buildings: Doc<'buildings'>[] | undefined
  selected: boolean
}) => {
  const hasLiveData = !!details && !!buildings
  const scene = useMemo(() => {
    const realBuildings = buildings ?? []
    const grid = island.gridSize ?? { width: 10, height: 10 }

    const structures: PreviewStructure3D[] = realBuildings.slice(0, 9).map((building) => {
      const [x, z] = worldFromGrid(building.gridX, building.gridY, grid.width, grid.height)
      return {
        id: building._id,
        x,
        z,
        type: building.type,
        state: building.state,
      }
    })

    const participants =
      details?.agents.map((a) => a.phoneNumber) ??
      details?.members.map((m) => m.phoneNumber) ??
      island.phoneNumbers

    const fallbackRand = seededFrom(`${island.code}:${island._id}`)
    if (structures.length === 0) {
      const fallbackCount = clamp(Math.ceil(((island.islandLevel ?? 0) + 1) / 2), 1, 4)
      for (let i = 0; i < fallbackCount; i++) {
        structures.push({
          id: `${island._id}-fallback-${i}`,
          x: -2.8 + fallbackRand() * 5.8,
          z: -1.8 + fallbackRand() * 3.6,
          type: i % 3 === 0 ? 'garden' : 'house',
          state: 'complete',
        })
      }
    }

    const agents: PreviewAgent3D[] = participants.slice(0, 6).map((phone, index) => {
      const seed = hashOf(`${phone}:${island._id}:${index}`)
      const near = structures[index % structures.length]
      const x = clamp(near.x + ((((seed >>> 12) % 1000) / 1000) - 0.5) * 1.8, -3.9, 3.9)
      const z = clamp(near.z + ((((seed >>> 20) % 1000) / 1000) - 0.5) * 1.6 + 0.4, -2.9, 2.9)
      return {
        id: `${phone}-${index}`,
        x,
        z,
        bodyColor: `hsl(${seed % 360} 58% 64%)`,
        hairColor: ['#2a201c', '#513629', '#443126', '#302522', '#6d4b36'][(seed >>> 4) % 5],
      }
    })

    const treeRand = seededFrom(`${island.code}:${realBuildings.length}:${participants.length}`)
    const trees: PreviewTree3D[] = Array.from({ length: 8 }).map((_, index) => ({
      id: `${island._id}-tree-${index}`,
      x: -3.8 + treeRand() * 7.6,
      z: -2.8 + treeRand() * 5.6,
      pine: treeRand() > 0.45,
    }))

    return { structures, agents, trees }
  }, [buildings, details, island])

  return (
    <div style={{
      position: 'relative',
      height: '112px',
      borderRadius: '18px',
      overflow: 'hidden',
      border: `1.5px solid ${selected ? '#7ca4d1' : '#d3e3f0'}`,
      background: 'linear-gradient(180deg, #ecd3b2 0%, #b7e2e9 22%, #9fd6e2 100%)',
      boxShadow: 'inset 0 -26px 38px -30px rgba(36,80,108,0.46)',
    }}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [7.2, 5.0, 7.0], fov: 34 }}
      >
        <color attach="background" args={['#a9dce5']} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 8, 4]} intensity={1.1} color="#fff1dc" />
        <directionalLight position={[-4, 3, -3]} intensity={0.34} color="#9fccff" />

        <group rotation={[0, -0.6, 0]} position={[0, -0.25, 0]}>
          <mesh position={[0, -0.64, 0]}>
            <cylinderGeometry args={[6.55, 6.62, 0.54, 48]} />
            <meshStandardMaterial color="#8fd0de" flatShading />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[5.56, 5.72, 0.34, 48]} />
            <meshStandardMaterial color="#d8c6a8" flatShading />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[5.36, 5.48, 0.24, 48]} />
            <meshStandardMaterial color="#74ad57" flatShading />
          </mesh>
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[5.18, 48]} />
            <meshStandardMaterial color="#79b35b" flatShading />
          </mesh>

          {scene.trees.map((tree) => (
            <MiniTree3D key={tree.id} x={tree.x} z={tree.z} pine={tree.pine} />
          ))}
          {scene.structures.map((structure, index) => (
            <MiniStructure3D key={structure.id} structure={structure} index={index} />
          ))}
          {scene.agents.map((agent) => (
            <MiniAgent3D key={agent.id} agent={agent} />
          ))}
        </group>
      </Canvas>
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '10px',
        background: 'rgba(26,56,85,0.85)',
        color: '#edf7ff',
        borderRadius: '999px',
        padding: '2px 8px',
        ...nunito(900, 9),
        letterSpacing: '0.06em',
      }}>
        {hasLiveData ? '3D PREVIEW' : 'SYNCING 3D'}
      </div>
    </div>
  )
}

const IslandCard = ({
  island,
  selected,
  onOpen,
}: {
  island: Doc<'islands'>
  selected: boolean
  onOpen: () => void
}) => {
  const details = useQuery(api.islands.getIslandDetails, { islandId: island._id })
  const buildings = useQuery(api.buildings.getBuildings, { islandId: island._id })

  const playerCount = details?.members.length ?? Math.max(1, island.phoneNumbers?.length ?? 1)

  return (
    <button
      onClick={onOpen}
      style={{
        background: selected
          ? 'linear-gradient(160deg, #fef5e8 0%, #f8efe0 100%)'
          : 'linear-gradient(160deg, #fffdf8 0%, #f8f4ea 100%)',
        border: `2px solid ${selected ? '#8fb2d9' : C.cardBorder}`,
        borderRadius: '22px',
        padding: '10px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: selected
          ? '0 16px 24px -18px rgba(31,67,101,0.65)'
          : '0 10px 18px -16px rgba(31,67,101,0.4)',
      }}
    >
      <MiniIslandPreview island={island} details={details} buildings={buildings} selected={selected} />
      <div style={{ marginTop: '10px', padding: '0 2px 2px' }}>
        <p style={{ ...nunito(900, 14), color: C.navy, margin: 0 }}>{island.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          <span style={{
            borderRadius: '999px',
            padding: '3px 8px',
            background: '#eaf2fa',
            color: '#31557d',
            ...nunito(800, 11),
          }}>
            Lv {island.islandLevel}
          </span>
          <span style={{
            borderRadius: '999px',
            padding: '3px 8px',
            background: '#edf8f2',
            color: '#3a7f56',
            ...nunito(800, 11),
          }}>
            {playerCount} players
          </span>
          {selected && (
            <span style={{
              borderRadius: '999px',
              padding: '3px 8px',
              background: '#203955',
              color: '#f1f7ff',
              ...nunito(900, 10),
              letterSpacing: '0.06em',
            }}>
              SELECTED
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ══════════════════════════════════════════════════════ */
export function DashboardPage() {
  useCozFont()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const islandIdParam = searchParams.get('islandId')
  const phone = usePhoneNumber()
  const islandId = islandIdParam as Id<'islands'> | null

  const [joinCode, setJoinCode]       = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError]     = useState<string | null>(null)
  const [showJoinDialog, setShowJoinDialog] = useState(false)

  const { user } = useUser()
  const convex = useConvex()
  const userEmail = (user?.unsafeMetadata?.icloudEmail as string) ?? null

  const islandsByPhone = useQuery(api.islands.getIslandsByPhone, phone     ? { phoneNumber: phone }     : 'skip')
  const islandsByEmail = useQuery(api.islands.getIslandsByPhone, userEmail ? { phoneNumber: userEmail } : 'skip')

  const islands = Array.from(
    new Map(
      [...(islandsByPhone ?? []), ...(islandsByEmail ?? [])]
        .map(island => [island._id, island])
    ).values()
  )

  const islandDetails = useQuery(api.islands.getIslandDetails, islandId ? { islandId } : 'skip')
  const joinIslandMut = useMutation(api.islands.joinIsland)

  const motivation =
    islandDetails?.agents?.length
      ? Math.round(islandDetails.agents.reduce((s, a) => s + a.motivation, 0) / islandDetails.agents.length)
      : 0

  const handleJoinIsland = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code)                        { setJoinError('Please enter a game code.');        return }
    if (!/^[A-Z0-9]{4,6}$/.test(code)) { setJoinError('Code must be 4–6 letters or numbers.'); return }
    if (!phone)                       { setJoinError('Phone number not found.');          return }

    setJoinLoading(true)
    setJoinError(null)
    try {
      const island = await convex.query(api.islands.getIslandByCode, { code })
      if (!island) throw new Error('Island code not found.')
      await joinIslandMut({ islandId: island._id, phoneNumber: phone })
      setJoinCode('')
      setShowJoinDialog(false)
      navigate(`/island?islandId=${island._id}`)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join island')
    } finally {
      setJoinLoading(false)
    }
  }

  const selectedIsland = islands.find(i => i._id === islandId)

  const stats = islandDetails
    ? [
        { icon: '🏝️', label: 'Level',      value: String(islandDetails.island.islandLevel ?? 0) },
        { icon: '⭐', label: 'XP',          value: String(islandDetails.island.xp ?? 0) },
        { icon: '🌟', label: 'Currency',    value: String(islandDetails.island.currency ?? 0) },
        { icon: '🔥', label: 'Motivation',  value: `${motivation}%` },
      ]
    : []

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden auto' }}>
      <GameBg />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1060px', margin: '0 auto', padding: '22px 14px 60px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
            border: '2px solid rgba(255,255,255,0.22)',
            borderRadius: '24px',
            padding: '14px 16px',
            color: '#f2f7ff',
            boxShadow: '0 14px 24px -18px rgba(14,34,55,0.75)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div>
                <p style={{ ...nunito(800, 11), color: '#a8bfd6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Islands</p>
                <h1 style={{ ...fredoka(26), margin: '2px 0 0', lineHeight: 1.1, color: '#f6fbff' }}>
                  {selectedIsland ? selectedIsland.name : 'Island Party'}
                </h1>
              </div>
            </div>
            <p style={{ ...nunito(700, 13), color: '#c5d9ea', margin: '8px 0 0' }}>
              {islands.length > 0
                ? `${islands.length} island${islands.length !== 1 ? 's' : ''} in your party`
                : 'No islands yet — join one to start!'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'stretch' }}>
            <BtnGhost onClick={() => navigate('/settings')} style={{ padding: '9px 14px', fontSize: '13px' }}>
              ⚙️ Settings
            </BtnGhost>
            <BtnPrimary onClick={() => setShowJoinDialog(true)} style={{ padding: '9px 14px', fontSize: '13px' }}>
              + Join
            </BtnPrimary>
          </div>
        </div>

        {/* ── Island cards grid ── */}
        {islands.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}>
            {islands.map(island => {
              const selected = island._id === islandId
              return (
                <IslandCard
                  key={island._id}
                  island={island}
                  selected={selected}
                  onOpen={() => navigate(`/island?islandId=${island._id}`)}
                />
              )
            })}
          </div>
        )}

        {/* ── Island stats ── */}
        {islandId && islandDetails && (
          <>
            <p style={{ ...nunito(900, 11), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 10px 4px' }}>
              Island Stats
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              marginBottom: '24px',
            }}>
              {stats.map(s => (
                <div key={s.label} style={{
                  background: C.cream,
                  border: `2px solid ${C.cardBorder}`,
                  borderRadius: '18px',
                  padding: '14px 10px',
                  textAlign: 'center',
                  boxShadow: '0 10px 18px -18px rgba(31,67,101,0.48)',
                }}>
                  <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
                  <p style={{ ...nunito(700, 10), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                    {s.label}
                  </p>
                  <p style={{ ...fredoka(22), margin: '4px 0 0', lineHeight: 1 }}>{s.value}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {islands.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '52px 24px',
            background: 'linear-gradient(180deg, #fffdf7 0%, #f8f2e8 100%)',
            border: `2px dashed ${C.cardBorder}`,
            borderRadius: '24px',
            boxShadow: '0 12px 20px -18px rgba(31,67,101,0.5)',
          }}>
            <div style={{ fontSize: '52px', marginBottom: '14px' }}>🏝️</div>
            <p style={{ ...fredoka(22), margin: '0 0 6px', color: C.navy }}>No islands yet</p>
            <p style={{ ...nunito(700, 13), color: C.textMuted, margin: '0 0 22px' }}>
              Join a party to start building habits together
            </p>
            <BtnPrimary onClick={() => setShowJoinDialog(true)} style={{ padding: '12px 32px', fontSize: '15px' }}>
              + Join Island
            </BtnPrimary>
          </div>
        )}
      </div>

      {/* ══ Join dialog ══ */}
      {showJoinDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(26,40,57,0.42)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #fffef8 0%, #f7f2e6 100%)',
            border: '2px solid #d7bc8f',
            borderRadius: '28px',
            padding: '28px 24px',
            width: '100%',
            maxWidth: '360px',
            boxShadow: '0 30px 64px -36px rgba(22,49,76,0.78)',
          }}>
            {/* Dialog header */}
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🗺️</div>
              <h2 style={{ ...fredoka(24), margin: 0, color: C.navy }}>Join Island</h2>
              <p style={{ ...nunito(700, 12), color: C.textMuted, marginTop: '4px' }}>
                Enter the code shared by your party leader
              </p>
            </div>

            <form onSubmit={handleJoinIsland}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...nunito(900, 11), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '8px' }}>
                  Game Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="A1B2C3"
                  maxLength={6}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    border: '2px solid #d6e5f2',
                    borderRadius: '14px',
                    color: C.navy,
                    padding: '12px 14px',
                    fontSize: '20px',
                    fontFamily: "'Fredoka One', cursive",
                    letterSpacing: '0.25em',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
                <p style={{ ...nunito(600, 11), color: C.textMuted, textAlign: 'center', marginTop: '6px' }}>
                  4–6 characters
                </p>
              </div>

              {joinError && (
                <div style={{
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.25)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                }}>
                  <p style={{ ...nunito(700, 12), color: '#fca5a5', margin: 0 }}>⚠️ {joinError}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <BtnPrimary type="submit" disabled={joinLoading} style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}>
                  {joinLoading ? 'Joining...' : 'Join 🏝️'}
                </BtnPrimary>
                <BtnGhost
                  onClick={() => { setShowJoinDialog(false); setJoinCode(''); setJoinError(null) }}
                  style={{ flex: 1, padding: '12px 8px', textAlign: 'center' }}
                >
                  Cancel
                </BtnGhost>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
