import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/clerk-react'
import KnotapiJS from 'knotapi-js'
import { usePhoneNumber } from '../hooks/usePhoneNumber'

const MERCHANT_ID = 19
const KnotCtor =
  (KnotapiJS as { default?: new () => { open: (options: unknown) => void } }).default ??
  (KnotapiJS as unknown as new () => { open: (options: unknown) => void })

type SessionResponse = { session: string }

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

/* ── Button primitives ────────────────────────────────── */
const BtnPrimary = ({
  children, onClick, disabled, style,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
}) => (
  <button
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
      width: '100%',
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
      width: '100%',
      ...nunito(800, 14),
      ...style,
    }}
  >
    {children}
  </button>
)

const BtnDanger = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <button
    onClick={onClick}
    style={{
      background: 'rgba(220,60,50,0.08)',
      border: '2px solid rgba(220,60,50,0.28)',
      borderRadius: '14px',
      color: '#b83732',
      padding: '12px 20px',
      cursor: 'pointer',
      transition: 'all 0.15s',
      width: '100%',
      ...nunito(800, 14),
    }}
  >
    {children}
  </button>
)

/* ── Card wrapper ─────────────────────────────────────── */
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: C.card,
    border: `2px solid ${C.cardBorder}`,
    borderRadius: '22px',
    padding: '22px 20px',
    boxShadow: '0 12px 20px -18px rgba(31,67,101,0.52)',
    ...style,
  }}>
    {children}
  </div>
)

const CardTitle = ({ emoji, children }: { emoji: string; children: React.ReactNode }) => (
  <h2 style={{ ...fredoka(20), margin: '0 0 18px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span>{emoji}</span>
    <span>{children}</span>
  </h2>
)

/* ── Info row ─────────────────────────────────────────── */
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{
    paddingBottom: '12px',
    marginBottom: '12px',
    borderBottom: '1px solid rgba(135,167,199,0.2)',
  }}>
    <p style={{ ...nunito(700, 11), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>
      {label}
    </p>
    <p style={{ ...nunito(800, 15), color: C.text, margin: 0 }}>{value}</p>
  </div>
)

/* ── Alert banners ────────────────────────────────────── */
const AlertSuccess = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: 'rgba(77,179,104,0.12)', border: '1px solid rgba(77,179,104,0.3)', borderRadius: '12px', padding: '10px 14px', marginTop: '10px' }}>
    <p style={{ ...nunito(700, 12), color: '#86efac', margin: 0 }}>✓ {children}</p>
  </div>
)

const AlertError = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '12px', padding: '10px 14px', marginTop: '10px' }}>
    <p style={{ ...nunito(700, 12), color: '#fca5a5', margin: 0 }}>⚠️ {children}</p>
  </div>
)

/* ── Styled input ─────────────────────────────────────── */
const GameInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    style={{
      width: '100%',
      boxSizing: 'border-box',
      background: '#ffffff',
      border: '2px solid #d6e5f2',
      borderRadius: '12px',
      color: C.navy,
      padding: '10px 14px',
      fontSize: '14px',
      fontFamily: "'Nunito', sans-serif",
      fontWeight: 700,
      outline: 'none',
      ...props.style,
    }}
  />
)

/* ══════════════════════════════════════════════════════ */
export function SettingsPage() {
  useCozFont()
  const navigate = useNavigate()
  const { user }    = useUser()
  const { signOut } = useClerk()
  const phoneNumber = usePhoneNumber()

  const [connectingMerchants, setConnectingMerchants] = useState(false)
  const [merchantConnected,   setMerchantConnected]   = useState(false)
  const [knotError,           setKnotError]           = useState<string | null>(null)
  const [editingEmail,        setEditingEmail]        = useState(false)
  const [emailValue,          setEmailValue]          = useState((user?.unsafeMetadata?.icloudEmail as string) ?? '')
  const [savingEmail,         setSavingEmail]         = useState(false)
  const [emailSaved,          setEmailSaved]          = useState(false)
  const [emailError,          setEmailError]          = useState<string | null>(null)

  const handleSaveEmail = async () => {
    try {
      setSavingEmail(true)
      setEmailError(null)
      if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        setEmailError('Invalid email format')
        setSavingEmail(false)
        return
      }
      await user?.update({
        unsafeMetadata: { ...(user?.unsafeMetadata || {}), icloudEmail: emailValue || null },
      })
      setEmailSaved(true)
      setTimeout(() => setEmailSaved(false), 3000)
      setEditingEmail(false)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to save email')
    } finally {
      setSavingEmail(false)
    }
  }

  const handleConnectMerchants = async () => {
    const backendBaseUrl  = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5001'
    const knotClientId    = import.meta.env.VITE_KNOT_CLIENT_ID ?? ''
    const knotEnvironment = (import.meta.env.VITE_KNOT_ENVIRONMENT as 'development' | 'production') ?? 'production'
    const userId = user?.id?.trim() ?? ''

    setKnotError(null)
    setConnectingMerchants(true)
    try {
      if (!knotClientId) throw new Error('Missing VITE_KNOT_CLIENT_ID in frontend env.')
      if (!userId) throw new Error('You must be signed in before connecting merchants.')
      const participantIds = [
        phoneNumber,
        (user?.unsafeMetadata?.icloudEmail as string | undefined) ?? '',
        user?.primaryEmailAddress?.emailAddress ?? '',
      ]
        .map((value) => value?.trim() ?? '')
        .filter(Boolean)

      const response = await fetch(`${backendBaseUrl}/api/knot/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          participantIds,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      const data = (await response.json()) as SessionResponse
      const knotapi = new KnotCtor()
      knotapi.open({
        sessionId: data.session, clientId: knotClientId,
        environment: knotEnvironment, entryPoint: 'settings',
        metadata: { appUserId: userId },
        merchantIds: [MERCHANT_ID], useCategories: false, useSearch: false,
        onSuccess: (details: unknown) => {
          setMerchantConnected(true); setConnectingMerchants(false)
          console.log('onSuccess', details)
        },
        onError: (errorCode: string, errorDescription: string) => {
          console.error('onError', errorCode, errorDescription)
          setKnotError(`${errorCode}: ${errorDescription}`)
          setConnectingMerchants(false)
        },
        onEvent: (event: string, merchant: string, payload: unknown, taskId: string) => {
          console.log('onEvent', event, merchant, payload, taskId)
          if (event === 'AUTHENTICATED') setMerchantConnected(true)
        },
        onExit: () => { console.log('onExit'); setConnectingMerchants(false) },
      })
    } catch (err) {
      setKnotError(err instanceof Error ? err.message : 'Failed to connect merchants.')
      setConnectingMerchants(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden auto' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: C.bg }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 82% 46% at 50% 83%, rgba(130,207,220,0.65) 0%, rgba(130,207,220,0.0) 100%)' }} />
      {[...Array(6)].map((_, i) => (
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

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '760px', margin: '0 auto', padding: '22px 14px 60px' }}>

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
            <h1 style={{ ...fredoka(30), margin: 0, color: '#f6fbff' }}>Settings</h1>
            <p style={{ ...nunito(700, 13), color: '#c5d9ea', marginTop: '4px' }}>
              Account &amp; connected services
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: '#ffffff',
              border: '2px solid #d4e5ef',
              borderRadius: '16px',
              color: C.navy,
              padding: '9px 14px',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 6px 12px -10px rgba(29,52,81,0.42)',
              ...nunito(800, 13),
            }}
          >
            ← Back
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── Account ── */}
          <Card>
            <CardTitle emoji="👤">Account</CardTitle>
            <InfoRow label="Phone" value={user?.phoneNumbers?.[0]?.phoneNumber ?? 'Not set'} />
            <InfoRow label="Name"  value={user?.fullName ?? 'Not set'} />

            {/* iCloud email */}
            <div>
              <p style={{ ...nunito(700, 11), color: C.textLabel, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>
                iCloud Email
              </p>
              <p style={{ ...nunito(600, 11), color: C.textMuted, margin: '0 0 10px' }}>
                Optional — lets party members find you via iMessage
              </p>

              {!editingEmail ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ ...nunito(800, 15), color: C.text, margin: 0 }}>
                    {emailValue || 'Not set'}
                  </p>
                  <button
                    onClick={() => setEditingEmail(true)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                      color: C.green, ...nunito(800, 13),
                    }}
                  >
                    {emailValue ? 'Edit' : '+ Add'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <GameInput
                    type="email"
                    value={emailValue}
                    onChange={e => setEmailValue(e.target.value)}
                    placeholder="you@icloud.com"
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <BtnPrimary onClick={handleSaveEmail} disabled={savingEmail} style={{ flex: 1, width: 'auto', padding: '10px' }}>
                      {savingEmail ? 'Saving...' : 'Save'}
                    </BtnPrimary>
                    <BtnGhost
                      onClick={() => { setEditingEmail(false); setEmailError(null); setEmailValue((user?.unsafeMetadata?.icloudEmail as string) ?? '') }}
                      style={{ flex: 1, width: 'auto', padding: '10px' }}
                    >
                      Cancel
                    </BtnGhost>
                  </div>
                  {emailError && <AlertError>{emailError}</AlertError>}
                </div>
              )}

              {emailSaved && <AlertSuccess>Email saved successfully</AlertSuccess>}
            </div>
          </Card>

          {/* ── Connected Services ── */}
          <Card>
            <CardTitle emoji="🔗">Connected Services</CardTitle>

            <div style={{
              background: '#fffaf1',
              border: `2px solid ${C.cardBorder}`,
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '10px',
            }}>
              {/* Service header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <p style={{ ...nunito(800, 14), color: C.text, margin: 0 }}>DoorDash</p>
                  <p style={{ ...nunito(600, 12), color: C.textMuted, marginTop: '2px' }}>
                    Link account to track spending habits
                  </p>
                </div>
                <span style={{
                  ...nunito(800, 11),
                  padding: '4px 10px',
                  borderRadius: '20px',
                  flexShrink: 0,
                  background: merchantConnected ? 'rgba(77,179,104,0.15)' : '#f3f8fd',
                  color:      merchantConnected ? '#3a7f56'                : C.textMuted,
                  border:     merchantConnected ? '1px solid rgba(77,179,104,0.3)' : '1px solid #d6e4f1',
                }}>
                  {merchantConnected ? '✓ Connected' : 'Not connected'}
                </span>
              </div>

              <BtnPrimary onClick={handleConnectMerchants} disabled={connectingMerchants || !user?.id} style={{ padding: '10px' }}>
                {connectingMerchants ? 'Connecting...' : merchantConnected ? 'Reconnect' : 'Connect DoorDash'}
              </BtnPrimary>
            </div>

            {merchantConnected && <AlertSuccess>Merchant connected successfully</AlertSuccess>}
            {knotError         && <AlertError>{knotError}</AlertError>}
          </Card>

          {/* ── Session ── */}
          <Card>
            <CardTitle emoji="🚪">Session</CardTitle>
            <BtnDanger onClick={() => signOut()}>Sign Out</BtnDanger>
          </Card>

        </div>
      </div>
    </main>
  )
}
