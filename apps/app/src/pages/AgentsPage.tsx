import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { api } from '../../convex/_generated/api'
import { usePhoneNumber } from '../hooks/usePhoneNumber'

/* ── Cozy font loader (shared with DashboardPage) ─────── */
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

/* ── Design tokens (identical to DashboardPage) ───────── */
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

/* ── Small helpers ────────────────────────────────────── */
const formatWhen = (ts: number) => {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `today, ${time}`
  const diffDays = Math.floor((now.getTime() - ts) / 86400000)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const prettyAddress = (raw: string) => {
  if (!raw) return 'unknown'
  if (raw.includes('@')) return raw
  if (raw.startsWith('+') && raw.length === 12) {
    return `(${raw.slice(2, 5)}) ${raw.slice(5, 8)}-${raw.slice(8)}`
  }
  return raw
}

const titleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((tok) => tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase())
    .join(' ')

// Mirrors IslandPage.participantDisplayName — used when Clerk's displayName
// hasn't been synced yet for a given participant.
const derivedNameFromIdentifier = (identifier: string, index: number): string => {
  if (!identifier) return `Player ${index + 1}`
  if (identifier.includes('@')) {
    const local = identifier.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? ''
    if (local) return titleCase(local)
  }
  const digits = identifier.replace(/\D/g, '')
  if (digits.length >= 4) return `Player ${digits.slice(-4)}`
  return `Player ${index + 1}`
}

const resolveName = (m: MemberInfo, index: number): string =>
  (m.displayName && m.displayName.trim()) ||
  derivedNameFromIdentifier(m.phoneNumber, index)

/* ── Character trait generator ─────────────────────────
   Mirrors the palette used by Agent3D.tsx so every agent on the /agents
   page shows the same chibi character it would render as on the island.
   Seeded by phoneNumber so a given agent is visually stable.         */
const SKIN_PALETTE   = ['#F4D7B5', '#E8C29A', '#EFC9A0', '#D9A878', '#C48B60']
const SHIRT_PALETTE  = ['#7AC5A0', '#6FA8DC', '#C9A0E0', '#E58F7B', '#F2C46C', '#8DB9D8']
const PANTS_PALETTE  = ['#3A4A6B', '#2A3550', '#5A4030', '#3A2A40', '#3A2A1A', '#4B3A2C']
const HAIR_PALETTE   = ['#3B2820', '#1F1410', '#5A3820', '#0F0A08', '#2A1810', '#7B5A3C']
const HAIR_STYLES    = ['short', 'long', 'bun', 'cap'] as const
type HairStyle = typeof HAIR_STYLES[number]

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function characterTraits(phone: string) {
  const h = hashSeed(phone || 'anon')
  return {
    skin:      SKIN_PALETTE[h % SKIN_PALETTE.length],
    shirt:     SHIRT_PALETTE[(h >>> 3) % SHIRT_PALETTE.length],
    pants:     PANTS_PALETTE[(h >>> 7) % PANTS_PALETTE.length],
    hair:      HAIR_PALETTE[(h >>> 11) % HAIR_PALETTE.length],
    hairStyle: HAIR_STYLES[(h >>> 17) % HAIR_STYLES.length] as HairStyle,
  }
}

/* ── Chibi SVG avatar ─────────────────────────────────── */
const ChibiAvatar = ({
  phone, size = 72,
}: { phone: string; size?: number }) => {
  const t = characterTraits(phone)
  // viewBox is 0..80. Scale to `size`.
  return (
    <svg viewBox="0 0 80 96" width={size} height={(size * 96) / 80} aria-hidden="true">
      {/* Ground shadow */}
      <ellipse cx="40" cy="90" rx="18" ry="3" fill="#2A3A20" opacity="0.2" />
      {/* Legs */}
      <rect x="30" y="68" width="8" height="18" rx="4" fill={t.pants} />
      <rect x="42" y="68" width="8" height="18" rx="4" fill={t.pants} />
      {/* Shoes */}
      <ellipse cx="34" cy="87" rx="5" ry="2.5" fill="#3A2418" />
      <ellipse cx="46" cy="87" rx="5" ry="2.5" fill="#3A2418" />
      {/* Torso */}
      <ellipse cx="40" cy="58" rx="16" ry="14" fill={t.shirt} />
      {/* Arms */}
      <circle cx="22" cy="54" r="6" fill={t.shirt} />
      <circle cx="22" cy="62" r="4.5" fill={t.skin} />
      <circle cx="58" cy="54" r="6" fill={t.shirt} />
      <circle cx="58" cy="62" r="4.5" fill={t.skin} />
      {/* Neck */}
      <rect x="36" y="40" width="8" height="6" fill={t.skin} />
      {/* Head */}
      <circle cx="40" cy="30" r="16" fill={t.skin} />
      {/* Cheek blush */}
      <circle cx="30" cy="34" r="2.5" fill="#F4A8A8" opacity="0.55" />
      <circle cx="50" cy="34" r="2.5" fill="#F4A8A8" opacity="0.55" />
      {/* Eyes */}
      <circle cx="34" cy="30" r="2.2" fill="#1A1410" />
      <circle cx="46" cy="30" r="2.2" fill="#1A1410" />
      <circle cx="34.6" cy="29.2" r="0.7" fill="#FFFFFF" />
      <circle cx="46.6" cy="29.2" r="0.7" fill="#FFFFFF" />
      {/* Mouth — smile */}
      <path d="M 35 37 Q 40 40 45 37" stroke="#5A3020" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      {/* Hair */}
      {t.hairStyle === 'short' && (
        <>
          <path d="M 24 24 Q 40 10 56 24 L 56 30 L 24 30 Z" fill={t.hair} />
          <circle cx="25" cy="28" r="4" fill={t.hair} />
          <circle cx="55" cy="28" r="4" fill={t.hair} />
        </>
      )}
      {t.hairStyle === 'long' && (
        <>
          <path d="M 22 22 Q 40 8 58 22 L 58 32 L 22 32 Z" fill={t.hair} />
          <rect x="23" y="26" width="6" height="22" rx="3" fill={t.hair} />
          <rect x="51" y="26" width="6" height="22" rx="3" fill={t.hair} />
        </>
      )}
      {t.hairStyle === 'bun' && (
        <>
          <path d="M 24 22 Q 40 12 56 22 L 56 30 L 24 30 Z" fill={t.hair} />
          <circle cx="40" cy="13" r="6" fill={t.hair} />
          <rect x="45" y="9" width="1.5" height="8" fill="#C9A55B" transform="rotate(25 45 13)" />
        </>
      )}
      {t.hairStyle === 'cap' && (
        <>
          <path d="M 22 22 Q 40 8 58 22 L 58 28 L 22 28 Z" fill={t.shirt} />
          <rect x="40" y="24" width="22" height="3" rx="1.5" fill={t.shirt} />
          <path d="M 28 32 Q 36 36 40 32 L 40 38 L 28 38 Z" fill={t.hair} />
        </>
      )}
    </svg>
  )
}

const motivationTone = (m: number) => {
  if (m >= 75) return { label: 'thriving',   color: '#3aa56d', bg: '#e4f5ec' }
  if (m >= 50) return { label: 'steady',     color: '#c88a2a', bg: '#fbf0dd' }
  if (m >= 25) return { label: 'struggling', color: '#c86a4a', bg: '#fbe4dc' }
  return        { label: 'slacking',   color: '#9a3a3a', bg: '#f7d9d5' }
}

/* ── Data shapes ──────────────────────────────────────── */
type IslandInfo = {
  _id: string
  name: string
  code: string
  islandLevel: number
  xp: number
}
type AgentInfo = {
  _id: string
  phoneNumber: string
  personalityProfile: string
  motivation: number
  reminderVariants: string[]
  createdAt: number
}
type MemberInfo = {
  _id: string
  islandId: string
  phoneNumber: string
  role: 'creator' | 'member'
  joinedAt: number
  displayName?: string | null
}
type MessageInfo = {
  _id: string
  channel: 'imessage_personal' | 'imessage_group'
  content: string
  context?: unknown
  sentAt: number
}
type Character = {
  member: MemberInfo
  agent: AgentInfo | null
  messages: MessageInfo[]
}
type IslandBundle = {
  island: IslandInfo
  characters: Character[]
}

/* ── Reasoning logs modal ─────────────────────────────── */
const ReasoningModal = ({
  name, character, island, onClose,
}: {
  name: string
  character: Character
  island: IslandInfo
  onClose: () => void
}) => {
  const { member, messages } = character
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(14,28,45,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'grid', placeItems: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 94vw)',
          maxHeight: '86vh',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #fffdf8 0%, #f5ecd8 100%)',
          border: `2px solid ${C.cardBorder}`,
          borderRadius: '22px',
          boxShadow: '0 30px 60px -24px rgba(14,28,45,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '10px',
          padding: '14px 18px',
          background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
          color: '#f6fbff',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
            <ChibiAvatar phone={member.phoneNumber} size={48} />
            <div style={{ minWidth: 0 }}>
              <p style={{ ...nunito(800, 10), color: '#a8bfd6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Reasoning logs
              </p>
              <p style={{ ...fredoka(22), margin: '2px 0 0', color: '#f6fbff', lineHeight: 1.1 }}>
                {name}
              </p>
              <p style={{ ...nunito(700, 12), color: '#c5d9ea', margin: '2px 0 0' }}>
                {island.name} · {prettyAddress(member.phoneNumber)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255,255,255,0.14)',
              border: '2px solid rgba(255,255,255,0.25)',
              color: '#f6fbff',
              borderRadius: '12px',
              width: '36px', height: '36px',
              cursor: 'pointer',
              ...nunito(900, 16),
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Scaffolded explainer */}
          <div style={{
            background: '#fffaf0',
            border: `1.5px solid ${C.cardBorder}`,
            borderRadius: '14px',
            padding: '12px 14px',
          }}>
            <p style={{ ...nunito(900, 10), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>
              How this view works
            </p>
            <p style={{ ...nunito(700, 13), color: C.text, margin: '4px 0 0', lineHeight: 1.45 }}>
              Each entry below is a message this agent has sent. Once we persist the
              K2 <code>&lt;think&gt;</code> blocks into <code>aiMessages.context</code>,
              the full chain-of-thought will render here.
            </p>
          </div>

          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 20px',
              border: '1.5px dashed #d9c8a8',
              borderRadius: '14px',
              background: '#fffdf5',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>💭</div>
              <p style={{ ...fredoka(18), margin: 0, color: C.navy }}>No traces yet</p>
              <p style={{ ...nunito(700, 13), color: C.textMuted, margin: '6px 0 0' }}>
                Reasoning logs will appear once this agent starts sending messages.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const ctxPreview = m.context
                ? (typeof m.context === 'string' ? m.context : JSON.stringify(m.context, null, 2))
                : null
              return (
                <div key={m._id} style={{
                  background: m.channel === 'imessage_group' ? '#f1f7ff' : '#fff',
                  border: `1.5px solid ${m.channel === 'imessage_group' ? '#c9dcef' : '#e6d8bb'}`,
                  borderRadius: '14px',
                  padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{
                      ...nunito(900, 10),
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: m.channel === 'imessage_group' ? '#31557d' : '#8a6a33',
                    }}>
                      Step {messages.length - idx} · {m.channel === 'imessage_group' ? 'Group chat' : 'DM'}
                    </span>
                    <span style={{ ...nunito(700, 11), color: C.textMuted }}>{formatWhen(m.sentAt)}</span>
                  </div>
                  <p style={{ ...nunito(800, 10), color: C.textLabel, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                    Output
                  </p>
                  <p style={{ ...nunito(700, 13), color: C.text, margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </p>
                  <p style={{ ...nunito(800, 10), color: C.textLabel, margin: '10px 0 2px', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                    Reasoning
                  </p>
                  {ctxPreview ? (
                    <pre style={{
                      ...nunito(600, 11),
                      color: '#3a4a63',
                      background: '#f6f0e1',
                      border: '1px solid #e4d5b3',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      margin: 0,
                      maxHeight: '220px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {ctxPreview}
                    </pre>
                  ) : (
                    <p style={{
                      ...nunito(600, 12), fontStyle: 'italic', color: C.textMuted, margin: 0,
                      padding: '8px 10px',
                      background: '#faf5e6', border: '1px dashed #e4d5b3', borderRadius: '10px',
                    }}>
                      No reasoning trace captured for this message yet.
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Gossip logs modal ─────────────────────────────── */
const GossipModal = ({
  name, character, island, allCharacters, onClose,
}: {
  name: string
  character: Character
  island: IslandInfo
  allCharacters: Character[]
  onClose: () => void
}) => {
  const { member } = character
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const gossips = useQuery(
    api.gossip.getGossipHistory as any,
    { islandId: island._id }
  ) as any[] | undefined

  const filteredGossips = useMemo(() => {
    if (!gossips) return undefined
    return gossips.filter(
      (g) => g.agentAPhone === member.phoneNumber || g.agentBPhone === member.phoneNumber
    )
  }, [gossips, member.phoneNumber])

  const resolveOtherName = (phone: string) => {
    const cIdx = allCharacters.findIndex((c) => c.member.phoneNumber === phone)
    if (cIdx === -1) return phone.slice(-4)
    return resolveName(allCharacters[cIdx].member, cIdx)
  }

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(14,28,45,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'grid', placeItems: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 94vw)',
          maxHeight: '86vh',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #fffdf8 0%, #f5ecd8 100%)',
          border: `2px solid ${C.cardBorder}`,
          borderRadius: '22px',
          boxShadow: '0 30px 60px -24px rgba(14,28,45,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '10px',
          padding: '14px 18px',
          background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
          color: '#f6fbff',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
            <ChibiAvatar phone={member.phoneNumber} size={48} />
            <div style={{ minWidth: 0 }}>
              <p style={{ ...nunito(800, 10), color: '#a8bfd6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Gossip logs
              </p>
              <p style={{ ...fredoka(22), margin: '2px 0 0', color: '#f6fbff', lineHeight: 1.1 }}>
                {name}
              </p>
              <p style={{ ...nunito(700, 12), color: '#c5d9ea', margin: '2px 0 0' }}>
                {island.name} · {prettyAddress(member.phoneNumber)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255,255,255,0.14)',
              border: '2px solid rgba(255,255,255,0.25)',
              color: '#f6fbff',
              borderRadius: '12px',
              width: '36px', height: '36px',
              cursor: 'pointer',
              ...nunito(900, 16),
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Scaffolded explainer */}
          <div style={{
            background: '#fffaf0',
            border: `1.5px solid ${C.cardBorder}`,
            borderRadius: '14px',
            padding: '12px 14px',
          }}>
            <p style={{ ...nunito(900, 10), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>
              How this view works
            </p>
            <p style={{ ...nunito(700, 13), color: C.text, margin: '4px 0 0', lineHeight: 1.45 }}>
              Agents naturally gossip when they cross paths on the island. This log tracks every conversation
              where {name} was a participant.
            </p>
          </div>

          {filteredGossips === undefined ? (
            <div style={{
              textAlign: 'center', padding: '32px 20px',
              border: '1.5px dashed #d9c8a8',
              borderRadius: '14px',
              background: '#fffdf5',
            }}>
              <p style={{ ...fredoka(18), margin: 0, color: C.navy }}>Loading gossip...</p>
            </div>
          ) : filteredGossips.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 20px',
              border: '1.5px dashed #d9c8a8',
              borderRadius: '14px',
              background: '#fffdf5',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>💬</div>
              <p style={{ ...fredoka(18), margin: 0, color: C.navy }}>No gossip yet</p>
              <p style={{ ...nunito(700, 13), color: C.textMuted, margin: '6px 0 0' }}>
                {name} hasn't had any conversations with other agents yet.
              </p>
            </div>
          ) : (
            filteredGossips.map((g) => {
              const nameA = resolveOtherName(g.agentAPhone)
              const nameB = resolveOtherName(g.agentBPhone)
              return (
                <div key={g._id} style={{
                  background: '#fff',
                  border: `1.5px solid #e6d8bb`,
                  borderRadius: '14px',
                  padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      ...nunito(900, 10),
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: '#8a6a33',
                    }}>
                      With {g.agentAPhone === member.phoneNumber ? nameB : nameA}
                    </span>
                    <span style={{ ...nunito(700, 11), color: C.textMuted }}>{formatWhen(g.timestamp)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {g.lines.map((line: any, i: number) => {
                      const isA = line.speaker === "a"
                      const isMe = (isA && g.agentAPhone === member.phoneNumber) || (!isA && g.agentBPhone === member.phoneNumber)
                      const speakerName = isA ? nameA : nameB
                      return (
                        <div key={i} style={{
                          display: 'flex', 
                          gap: '8px', 
                          flexDirection: isMe ? 'row-reverse' : 'row',
                        }}>
                          <div style={{
                            width: '20px', height: '20px', 
                            borderRadius: '50%', 
                            background: isMe ? C.navy : '#eaf2fa', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: '2px',
                          }}>
                            <span style={{ ...nunito(900, 9), color: isMe ? '#fff' : C.navy }}>
                              {speakerName[0]}
                            </span>
                          </div>
                          <div style={{
                            maxWidth: '85%',
                            background: isMe ? C.cream : '#f6fbff',
                            border: `1px solid ${isMe ? '#ecdcc0' : '#d4e5ef'}`,
                            padding: '6px 10px',
                            borderRadius: '12px',
                            borderTopRightRadius: isMe ? '2px' : '12px',
                            borderTopLeftRadius: isMe ? '12px' : '2px',
                            ...nunito(700, 12),
                            color: C.text,
                            lineHeight: 1.4,
                          }}>
                            <span style={{ ...nunito(900, 12), marginRight: '4px' }}>{speakerName}:</span>
                            {line.text}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {g.reasoning && (
                    <>
                      <button
                        onClick={() => setExpanded(expanded === g._id ? null : g._id)}
                        style={{
                          ...nunito(800, 11),
                          color: C.navy,
                          background: 'transparent',
                          border: 'none',
                          padding: '6px 0 0',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                        }}
                      >
                        {expanded === g._id ? 'Hide reasoning context' : 'Show reasoning context'}
                      </button>
                      {expanded === g._id && (
                        <pre style={{
                          ...nunito(600, 11),
                          color: '#3a4a63',
                          background: '#f6f0e1',
                          border: '1px solid #e4d5b3',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          margin: '6px 0 0',
                          maxHeight: '200px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {g.reasoning}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Per-character card ───────────────────────────────── */
const CharacterCard = ({ island, character, index, allCharacters }: { island: IslandInfo; character: Character; index: number; allCharacters: Character[] }) => {
  const { member, agent, messages } = character
  const tone = agent ? motivationTone(agent.motivation) : motivationTone(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showReasoning, setShowReasoning] = useState(false)
  const [showGossip, setShowGossip] = useState(false)
  const spawned = agent !== null
  const name = resolveName(member, index)

  return (
    <div style={{
      background: 'linear-gradient(160deg, #fffdf8 0%, #f8f4ea 100%)',
      border: `2px solid ${C.cardBorder}`,
      borderRadius: '22px',
      padding: '16px 16px 14px',
      boxShadow: '0 12px 20px -18px rgba(31,67,101,0.55)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
          <div style={{
            width: '72px',
            minWidth: '72px',
            height: '86px',
            borderRadius: '16px',
            background: 'linear-gradient(180deg, #fffaf0 0%, #f5ead2 100%)',
            border: '1.5px solid #ecdcc0',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '2px',
            boxShadow: 'inset 0 -8px 12px -10px rgba(31,67,101,0.25)',
          }}>
            <ChibiAvatar phone={member.phoneNumber} size={68} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...nunito(900, 10), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>
              {member.role === 'creator' ? 'Creator' : 'Member'} · Lv {island.islandLevel}
            </p>
            <button
              onClick={() => setShowReasoning(true)}
              title="View reasoning logs"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                margin: '3px 0 0',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'block',
                maxWidth: '100%',
                ...fredoka(20),
                color: C.navy,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: 'underline',
                textDecorationColor: 'rgba(29,52,81,0.25)',
                textUnderlineOffset: '3px',
              }}
            >
              {name}
            </button>
            <p style={{ ...nunito(700, 11), color: C.textMuted, margin: '2px 0 0' }}>
              {prettyAddress(member.phoneNumber)} · {island.name}
            </p>
          </div>
        </div>
        <span style={{
          borderRadius: '999px',
          padding: '4px 10px',
          background: spawned ? tone.bg : '#eef2f8',
          color: spawned ? tone.color : '#6d7b8f',
          ...nunito(900, 10),
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          alignSelf: 'flex-start',
        }}>
          {spawned ? tone.label : 'not spawned'}
        </span>
      </div>

      {/* Character traits */}
      {(() => {
        const t = characterTraits(member.phoneNumber)
        const swatch = (color: string, label: string) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: color, border: '1.5px solid rgba(0,0,0,0.12)',
              display: 'inline-block',
            }} />
            <span style={{ ...nunito(700, 11), color: C.textMuted }}>{label}</span>
          </span>
        )
        return (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 14px',
            padding: '8px 12px',
            background: '#fbf5e6',
            border: '1.5px solid #ecdcc0',
            borderRadius: '14px',
            alignItems: 'center',
          }}>
            {swatch(t.hair, `hair · ${t.hairStyle}`)}
            {swatch(t.shirt, 'shirt')}
            {swatch(t.pants, 'pants')}
          </div>
        )
      })()}

      {/* Motivation meter */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ ...nunito(800, 11), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Motivation
          </span>
          <span style={{ ...nunito(900, 12), color: C.navy }}>{agent?.motivation ?? 0}/100</span>
        </div>
        <div style={{
          height: '10px',
          borderRadius: '999px',
          background: '#eaf2fa',
          border: '1px solid #d6e5f2',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, agent?.motivation ?? 0))}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${tone.color} 0%, ${tone.color}cc 100%)`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Personality */}
      <div>
        <p style={{ ...nunito(900, 10), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 0 4px' }}>
          Personality
        </p>
        <p style={{
          ...nunito(700, 13),
          color: C.text,
          margin: 0,
          lineHeight: 1.45,
          background: '#fffaf0',
          border: '1.5px solid #ecdcc0',
          borderRadius: '14px',
          padding: '10px 12px',
        }}>
          {agent?.personalityProfile || '— no personality generated yet —'}
        </p>
      </div>

      {/* Recent reasoning / messages */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <p style={{ ...nunito(900, 10), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>
            Recent messages
          </p>
          <span style={{ ...nunito(700, 11), color: C.textMuted }}>
            {messages.length} shown
          </span>
        </div>

        {messages.length === 0 ? (
          <div style={{
            ...nunito(700, 12),
            color: C.textMuted,
            padding: '12px',
            border: '1.5px dashed #d9c8a8',
            borderRadius: '14px',
            background: '#fffdf5',
            textAlign: 'center',
          }}>
            No K2 messages logged yet for this agent.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((m) => {
              const ctxPreview = m.context
                ? (typeof m.context === 'string' ? m.context : JSON.stringify(m.context, null, 2))
                : null
              const isOpen = expanded === m._id
              return (
                <div key={m._id} style={{
                  background: m.channel === 'imessage_group' ? '#f1f7ff' : '#fff',
                  border: `1.5px solid ${m.channel === 'imessage_group' ? '#c9dcef' : '#e6d8bb'}`,
                  borderRadius: '14px',
                  padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      ...nunito(800, 10),
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: m.channel === 'imessage_group' ? '#31557d' : '#8a6a33',
                    }}>
                      {m.channel === 'imessage_group' ? 'Group chat' : 'DM'}
                    </span>
                    <span style={{ ...nunito(700, 11), color: C.textMuted }}>
                      {formatWhen(m.sentAt)}
                    </span>
                  </div>
                  <p style={{ ...nunito(700, 13), color: C.text, margin: 0, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </p>
                  {ctxPreview && (
                    <>
                      <button
                        onClick={() => setExpanded(isOpen ? null : m._id)}
                        style={{
                          ...nunito(800, 11),
                          color: C.navy,
                          background: 'transparent',
                          border: 'none',
                          padding: '6px 0 0',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                        }}
                      >
                        {isOpen ? 'Hide reasoning context' : 'Show reasoning context'}
                      </button>
                      {isOpen && (
                        <pre style={{
                          ...nunito(600, 11),
                          color: '#3a4a63',
                          background: '#f6f0e1',
                          border: '1px solid #e4d5b3',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          margin: '6px 0 0',
                          maxHeight: '240px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {ctxPreview}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
          <button
            onClick={() => setShowReasoning(true)}
            style={{
              ...nunito(900, 12),
              color: C.navy,
              background: '#ffffff',
              border: '2px solid #d4e5ef',
              borderRadius: '12px',
              padding: '8px 12px',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              boxShadow: '0 6px 12px -10px rgba(29,52,81,0.42)',
            }}
          >
            🧠 View reasoning logs
          </button>
          <button
            onClick={() => setShowGossip(true)}
            style={{
              ...nunito(900, 12),
              color: C.navy,
              background: '#ffffff',
              border: '2px solid #d4e5ef',
              borderRadius: '12px',
              padding: '8px 12px',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              boxShadow: '0 6px 12px -10px rgba(29,52,81,0.42)',
            }}
          >
            💬 View gossip logs
          </button>
        </div>
      </div>
      {showReasoning && (
        <ReasoningModal
          name={name}
          character={character}
          island={island}
          onClose={() => setShowReasoning(false)}
        />
      )}
      {showGossip && (
        <GossipModal
          name={name}
          character={character}
          island={island}
          allCharacters={allCharacters}
          onClose={() => setShowGossip(false)}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════ */
export function AgentsPage() { // NOSONAR
  useCozFont()
  const navigate = useNavigate()
  const phone = usePhoneNumber()
  const { user } = useUser()
  const userEmail = (user?.unsafeMetadata?.icloudEmail as string) ?? null

  const bundles = useQuery(
    (api.agents as any).getAgentDirectoryForUser,
    phone || userEmail
      ? { phoneNumber: phone || undefined, email: userEmail || undefined, messageLimit: 10 }
      : 'skip'
  ) as IslandBundle[] | undefined

  const [islandFilter, setIslandFilter] = useState<string>('all')
  const [characterFilter, setCharacterFilter] = useState<string>('all')

  const loading = bundles === undefined
  const islandCount = bundles?.length ?? 0
  const totalCharacters = (bundles ?? []).reduce((sum, b) => sum + b.characters.length, 0)

  const visibleBundles = useMemo(() => {
    const pool = (bundles ?? []).filter((b) => islandFilter === 'all' || b.island._id === islandFilter)
    if (characterFilter === 'all') return pool
    return pool
      .map((b) => ({ ...b, characters: b.characters.filter((c) => c.member._id === characterFilter) }))
      .filter((b) => b.characters.length > 0)
  }, [bundles, islandFilter, characterFilter])

  const characterOptions = useMemo(() => {
    const pool = (bundles ?? []).filter((b) => islandFilter === 'all' || b.island._id === islandFilter)
    return pool.flatMap((b) =>
      b.characters.map((c, idx) => ({
        id: c.member._id,
        label: `${resolveName(c.member, idx)} · ${b.island.name}`,
      }))
    )
  }, [bundles, islandFilter])

  const selectStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '2px solid #d4e5ef',
    borderRadius: '14px',
    padding: '8px 12px',
    color: C.navy,
    ...nunito(800, 13),
    cursor: 'pointer',
    outline: 'none',
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden auto' }}>
      <GameBg />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1060px', margin: '0 auto', padding: '22px 14px 60px' }}>

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
            border: '2px solid rgba(255,255,255,0.22)',
            borderRadius: '24px',
            padding: '14px 16px',
            color: '#f2f7ff',
            boxShadow: '0 14px 24px -18px rgba(14,34,55,0.75)',
          }}>
            <div>
              <p style={{ ...nunito(800, 11), color: '#a8bfd6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Agent Directory
              </p>
              <h1 style={{ ...fredoka(26), margin: '2px 0 0', lineHeight: 1.1, color: '#f6fbff' }}>
                Agents
              </h1>
            </div>
            <p style={{ ...nunito(700, 13), color: '#c5d9ea', margin: '8px 0 0' }}>
              {loading
                ? 'Loading agents…'
                : islandCount === 0
                  ? 'Join or start an island to see its characters here.'
                  : `${totalCharacters} character${totalCharacters === 1 ? '' : 's'} across ${islandCount} island${islandCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'stretch' }}>
            <BtnGhost onClick={() => navigate('/dashboard')} style={{ padding: '9px 14px', fontSize: '13px' }}>
              ← Dashboard
            </BtnGhost>
            <BtnGhost onClick={() => navigate('/settings')} style={{ padding: '9px 14px', fontSize: '13px' }}>
              ⚙️ Settings
            </BtnGhost>
          </div>
        </div>

        {/* Island tabs — primary filter */}
        {bundles && bundles.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '14px',
            alignItems: 'center',
          }}>
            <button
              onClick={() => { setIslandFilter('all'); setCharacterFilter('all') }}
              style={{
                ...selectStyle,
                background: islandFilter === 'all' ? C.navy : '#ffffff',
                color:      islandFilter === 'all' ? '#f6fbff' : C.navy,
                borderColor: islandFilter === 'all' ? C.navy : '#d4e5ef',
                border: '2px solid',
              }}
            >
              🗂️ All islands
            </button>
            {bundles.map((b) => {
              const active = islandFilter === b.island._id
              return (
                <button
                  key={b.island._id}
                  onClick={() => { setIslandFilter(b.island._id); setCharacterFilter('all') }}
                  style={{
                    ...selectStyle,
                    background: active ? C.navy : '#ffffff',
                    color: active ? '#f6fbff' : C.navy,
                    borderColor: active ? C.navy : '#d4e5ef',
                    border: '2px solid',
                  }}
                >
                  🏝️ {b.island.name}
                  <span style={{
                    marginLeft: '8px',
                    ...nunito(800, 11),
                    opacity: 0.8,
                  }}>
                    {b.characters.length}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Secondary character filter */}
        {bundles && bundles.length > 0 && characterOptions.length > 1 && (
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '18px',
            alignItems: 'center',
          }}>
            <span style={{ ...nunito(900, 11), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Character
            </span>
            <select
              value={characterFilter}
              onChange={(e) => setCharacterFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All characters</option>
              {characterOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '52px 24px',
            background: 'linear-gradient(180deg, #fffdf7 0%, #f8f2e8 100%)',
            border: `2px dashed ${C.cardBorder}`,
            borderRadius: '24px',
          }}>
            <p style={{ ...fredoka(20), margin: 0, color: C.navy }}>Loading agents…</p>
          </div>
        ) : islandCount === 0 ? (
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
            <p style={{ ...nunito(700, 13), color: C.textMuted, margin: 0 }}>
              Join or start an island from the dashboard to see its characters here.
            </p>
          </div>
        ) : visibleBundles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '52px 24px',
            background: 'linear-gradient(180deg, #fffdf7 0%, #f8f2e8 100%)',
            border: `2px dashed ${C.cardBorder}`,
            borderRadius: '24px',
          }}>
            <p style={{ ...fredoka(20), margin: 0, color: C.navy }}>No characters match your filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {visibleBundles.map((b) => (
              <section key={b.island._id}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '10px',
                  marginBottom: '10px',
                  padding: '0 4px',
                }}>
                  <h2 style={{ ...fredoka(22), margin: 0, color: C.navy }}>🏝️ {b.island.name}</h2>
                  <span style={{ ...nunito(800, 11), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    code {b.island.code} · lv {b.island.islandLevel} · {b.characters.length} char{b.characters.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '14px',
                }}>
                  {b.characters.map((c, idx) => (
                    <CharacterCard key={c.member._id} island={b.island} character={c} index={idx} allCharacters={b.characters} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
