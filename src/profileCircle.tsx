import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { supabase } from './components/supaBaseClient.ts'

type ProfileCircleProps = {
	currentUserEmail?: string | null
	onNotice?: Dispatch<SetStateAction<string>>
}

type ProfileRow = {
	email?: string | null
	displayName?: string | null
	avatarUrl?: string | null
}

type CircleProfile = {
	email: string
	displayName: string
	avatarUrl: string
}

const fallbackAllowedMembers = [
	'fabian.ardana@gmail.com',
	'candice@keluargacemara.com',
	'adinda@keluargacemara.com',
	'fasa@keluargacemara.com',
	'arganta9917@gmail.com',
	'jonathan@keluargacemara.com',
]

const displayNameByEmail: Record<string, string> = {
	'fabian.ardana@gmail.com': 'Fabian',
	'candice@keluargacemara.com': 'Candice',
	'adinda@keluargacemara.com': 'Adinda',
	'fasa@keluargacemara.com': 'Fasa',
	'arganta9917@gmail.com': 'Ganta',
	'jonathan@keluargacemara.com': 'Jonathan',
}

const MAX_PROFILE_PHOTO_SIZE_BYTES = 3 * 1024 * 1024

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const readAllowedMemberEmails = () => {
	const fromEnv = String(import.meta.env.VITE_ALLOWED_MEMBER_EMAILS ?? '').trim()
	if (!fromEnv) {
		return fallbackAllowedMembers
	}

	return fromEnv
		.split(',')
		.map((email) => normalizeEmail(email))
		.filter(Boolean)
}

const nameFromEmail = (email: string) => {
	const normalized = normalizeEmail(email)
	if (displayNameByEmail[normalized]) {
		return displayNameByEmail[normalized]
	}

	const local = normalized.split('@')[0] ?? normalized
	return local
		.split(/[._-]/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}

const toDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result ?? ''))
		reader.onerror = () => reject(new Error('Failed reading image file.'))
		reader.readAsDataURL(file)
	})

function ProfileCircle({ currentUserEmail, onNotice }: ProfileCircleProps) {
	const [profiles, setProfiles] = useState<CircleProfile[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isSavingPhoto, setIsSavingPhoto] = useState(false)
	const fileInputRef = useRef<HTMLInputElement | null>(null)

	const allowedEmails = useMemo(() => readAllowedMemberEmails(), [])
	const currentEmail = currentUserEmail ? normalizeEmail(currentUserEmail) : null

	const notify = (message: string) => {
		onNotice?.(message)
	}

	const fallbackProfiles = useMemo(
		() =>
			allowedEmails.map((email) => ({
				email,
				displayName: nameFromEmail(email),
				avatarUrl: '',
			})),
		[allowedEmails],
	)

	const loadProfiles = async () => {
		setIsLoading(true)

		const { data, error } = await supabase
			.from('profiles')
			.select('email, displayName, avatarUrl')

		if (error) {
			setProfiles(fallbackProfiles)
			setIsLoading(false)

			if (error.message.toLowerCase().includes('relation') && error.message.toLowerCase().includes('profiles')) {
				notify('Table profiles not found. Create it first to sync profile photos for all users.')
				return
			}

			notify(`Profile load failed: ${error.message}`)
			return
		}

		const mapByEmail = new Map<string, CircleProfile>()
		for (const email of allowedEmails) {
			mapByEmail.set(email, {
				email,
				displayName: nameFromEmail(email),
				avatarUrl: '',
			})
		}

		for (const row of (data ?? []) as ProfileRow[]) {
			const email = normalizeEmail(String(row.email ?? ''))
			if (!email || !mapByEmail.has(email)) {
				continue
			}

			mapByEmail.set(email, {
				email,
				displayName: String(row.displayName ?? nameFromEmail(email)),
				avatarUrl: String(row.avatarUrl ?? ''),
			})
		}

		setProfiles(Array.from(mapByEmail.values()))
		setIsLoading(false)
	}

	useEffect(() => {
		void loadProfiles()
	}, [])

	useEffect(() => {
		const channel = supabase
			.channel('profiles-realtime-sync')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
				void loadProfiles()
			})
			.subscribe()

		return () => {
			void supabase.removeChannel(channel)
		}
	}, [])

	const openPhotoPicker = () => {
		if (!currentEmail) {
			return
		}

		fileInputRef.current?.click()
	}

	const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
		if (!currentEmail) {
			return
		}

		const file = event.target.files?.[0]
		if (!file) {
			return
		}

		if (!file.type.startsWith('image/')) {
			notify('Please choose an image file for profile photo.')
			event.target.value = ''
			return
		}

		if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
			notify('Profile photo max size is 3 MB.')
			event.target.value = ''
			return
		}

		setIsSavingPhoto(true)

		try {
			const avatarUrl = await toDataUrl(file)
			const displayName = nameFromEmail(currentEmail)

			const upsert = await supabase
				.from('profiles')
				.upsert(
					[
						{
							email: currentEmail,
							displayName,
							avatarUrl,
						},
					],
					{ onConflict: 'email' },
				)
				.select('email, displayName, avatarUrl')

			if (upsert.error) {
				notify(`Save profile photo failed: ${upsert.error.message}`)
				return
			}

			const updated = (upsert.data ?? [])[0] as ProfileRow | undefined
			if (updated) {
				const updatedProfile: CircleProfile = {
					email: normalizeEmail(String(updated.email ?? currentEmail)),
					displayName: String(updated.displayName ?? displayName),
					avatarUrl: String(updated.avatarUrl ?? avatarUrl),
				}

				setProfiles((prev) =>
					prev.map((profile) =>
						profile.email === updatedProfile.email ? updatedProfile : profile,
					),
				)
			} else {
				void loadProfiles()
			}

			notify('Profile photo updated.')
		} finally {
			setIsSavingPhoto(false)
			event.target.value = ''
		}
	}

	return (
		<section id="profiles-section" className="panel friend-panel">
			<div className="panel-head">
				<h2>Our Circle Profiles</h2>
				<p>Set your own photo based on your account.</p>
				{isLoading ? (
					<div className="section-loading-indicator" aria-live="polite">
						<span className="section-loading-dot" />
						<span>Loading profiles...</span>
					</div>
				) : null}
			</div>

			{currentEmail ? (
				<div className="profile-editor-row">
					<button
						type="button"
						className="profile-upload-btn"
						onClick={openPhotoPicker}
						disabled={isSavingPhoto}
					>
						{isSavingPhoto ? 'Saving...' : 'Change My Profile Photo'}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						onChange={handlePhotoChange}
						className="profile-hidden-input"
					/>
					<small>Max 3 MB image. This updates your account profile photo for all users.</small>
				</div>
			) : null}

			<div className="friend-circle" aria-label="Account profile circle">
				{profiles.map((profile) => {
					const initials = profile.displayName
						.split(' ')
						.filter(Boolean)
						.slice(0, 2)
						.map((part) => part[0]?.toUpperCase())
						.join('')

					return (
						<article key={profile.email} className="friend-card profile-card">
							<div className="profile-avatar-wrap">
								{profile.avatarUrl ? (
									<img
										src={profile.avatarUrl}
										alt={`${profile.displayName} profile`}
										className="profile-avatar-img"
									/>
								) : (
									<div className="profile-avatar-fallback" aria-hidden="true">
										{initials || 'CM'}
									</div>
								)}
							</div>
							<h3>{profile.displayName}</h3>
							<p>{profile.email === currentEmail ? 'You' : 'Member'}</p>
							<small>{profile.email}</small>
						</article>
					)
				})}
			</div>
		</section>
	)
}

export default ProfileCircle