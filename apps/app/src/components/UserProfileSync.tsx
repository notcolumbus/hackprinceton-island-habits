import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { usePhoneNumber } from '../hooks/usePhoneNumber'

// Writes the signed-in user's Clerk display name into the Convex `users` table
// so other clients can resolve a human name from just a phone number. Mounted
// once inside RequireAuth — runs opportunistically when the Clerk user loads.
export function UserProfileSync() {
  const { user, isLoaded } = useUser()
  const phone = usePhoneNumber()
  const upsert = useMutation((api as any).users.upsertProfile)
  const didRunFor = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !user) return
    const icloud = (user.unsafeMetadata?.icloudEmail as string | undefined) ?? undefined
    const primaryEmail = user.primaryEmailAddress?.emailAddress ?? undefined
    const email = icloud ?? primaryEmail
    const displayName =
      user.fullName?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.username ||
      ''
    if (!displayName) return
    if (!phone && !email) return
    const key = `${phone || ''}|${email || ''}|${displayName}`
    if (didRunFor.current === key) return
    didRunFor.current = key
    upsert({
      phoneNumber: phone || undefined,
      email,
      clerkUserId: user.id,
      displayName,
    }).catch((err) => console.error('UserProfileSync failed', err))
  }, [isLoaded, user, phone, upsert])

  return null
}
