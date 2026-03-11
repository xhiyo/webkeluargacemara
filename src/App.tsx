import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import Footer from './footer'
import MemoriesPhotos from './memoriesPhotos.tsx'
import Schedule from './schedule.tsx'
import Login from './login.tsx'
import GlobalChat from './globalChat.tsx'
import { supabase } from './components/supaBaseClient.ts'
import coverCemara from './components/foto-cover-cemara.jpeg'
import cemaraOne from './components/cemara-1.jpeg'
import cemaraTwo from './components/cemara-2.jpeg'
import candicePhoto from './components/candice.jpeg'
import adindaPhoto from './components/adinda.jpeg'
import fasaPhoto from './components/fasa.jpeg'
import fabianPhoto from './components/fabian.jpeg'
import gantaPhoto from './components/ganta.jpeg'
import jonathanPhoto from './components/jonathan.PNG'

type FriendProfile = {
	id: number
	name: string
	role: string
	favoriteActivity: string
	avatar: string
}

type HeroPhoto = {
	src: string
	alt: string
	caption: string
}

type SmartImageProps = {
	src: string
	alt: string
	fallbackSrc?: string
	className?: string
}

const loadedImageSrcCache = new Set<string>()

const SmartImage = ({ src, alt, fallbackSrc, className }: SmartImageProps) => {
	const [currentSrc, setCurrentSrc] = useState(src)
	const [isLoaded, setIsLoaded] = useState(loadedImageSrcCache.has(src))

	useEffect(() => {
		setCurrentSrc(src)
		setIsLoaded(loadedImageSrcCache.has(src))
	}, [src])

	return (
		<span className={`smart-image ${isLoaded ? 'loaded' : ''} ${className ?? ''}`.trim()}>
			<span className="smart-image-loader" aria-hidden="true">
				<span className="smart-image-spinner" />
			</span>
			<img
				src={currentSrc}
				alt={alt}
				onLoad={() => {
					loadedImageSrcCache.add(currentSrc)
					setIsLoaded(true)
				}}
				onError={() => {
					if (fallbackSrc && currentSrc !== fallbackSrc) {
						setCurrentSrc(fallbackSrc)
						setIsLoaded(loadedImageSrcCache.has(fallbackSrc))
						return
					}

					setIsLoaded(true)
				}}
			/>
		</span>
	)
}

const friendProfiles: FriendProfile[] = [
	{
		id: 1,
		name: 'Candice',
		role: 'Member',
		favoriteActivity: 'Cari Matcha',
		avatar: candicePhoto,
	},
	{
		id: 2,
		name: 'Adinda',
		role: 'Member',
		favoriteActivity: 'Wombat Ngajleng',
		avatar: adindaPhoto,
	},
	{
		id: 3,
		name: 'Fasa',
		role: 'Member',
		favoriteActivity: 'Ibu Negara ',
		avatar: fasaPhoto,
	},
	{
		id: 4,
		name: 'Fabian',
		role: 'Member',
		favoriteActivity: 'Pemimpin Gereja Katolik Roma',
		avatar: fabianPhoto,
	},
	{
		id: 5,
		name: 'Ganta',
		role: 'Aktivis',
		favoriteActivity: 'Tukang Kebun, Supir TJ, Tukang Gali Kubur, Tukang Ngarit, Petani, Satpam, Tukang Fogging',
		avatar: gantaPhoto,
	},
	{
		id: 6,
		name: 'Jonathan',
		role: 'Admin Loh Ya',
		favoriteActivity: 'Gitaris NDC Terbaik Di Bumi',
		avatar: jonathanPhoto,
	},
]

function App() {
	const [appView, setAppView] = useState<'home' | 'password'>('home')
	const [memoryCount, setMemoryCount] = useState(0)
	const [scheduleCount, setScheduleCount] = useState(0)
	const [onlineCount, setOnlineCount] = useState(0)
	const [isCheckingAuth, setIsCheckingAuth] = useState(true)
	const [memberEmail, setMemberEmail] = useState<string | null>(null)
	const coverPhotoTitle = 'Ulang Tahun Candice'
	const cemaraOneTitle = 'Ulang Tahun Jonathan'
	const cemaraTwoTitle = 'Last Day'
	const [activeHeroPhoto, setActiveHeroPhoto] = useState<HeroPhoto | null>(null)
	const [activeFriendPhoto, setActiveFriendPhoto] = useState<FriendProfile | null>(null)
	const [dbNotice, setDbNotice] = useState('')
	const [showProfileMenu, setShowProfileMenu] = useState(false)
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmNewPassword, setConfirmNewPassword] = useState('')
	const [isChangingPassword, setIsChangingPassword] = useState(false)
	const profileMenuRef = useRef<HTMLDivElement | null>(null)
	const todayLabel = new Date().toLocaleDateString('id-ID', {
		timeZone: 'Asia/Jakarta',
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	})

	const heroPhotos: HeroPhoto[] = useMemo(
		() => [
			{
				src: coverCemara,
				alt: '',
				caption: coverPhotoTitle,
			},
			{
				src: cemaraOne,
				alt: '',
				caption: cemaraOneTitle,
			},
			{
				src: cemaraTwo,
				alt: '',
				caption: cemaraTwoTitle,
			},
		],
		[coverPhotoTitle, cemaraOneTitle, cemaraTwoTitle],
	)

	const heroPhotoFallbacks = [coverCemara, cemaraOne, cemaraTwo]

	const profileInitials = useMemo(() => {
		if (!memberEmail) {
			return 'CM'
		}

		const local = memberEmail.split('@')[0] ?? ''
		const parts = local.split(/[._-]/g).filter(Boolean)

		if (parts.length >= 2) {
			return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
		}

		return local.slice(0, 2).toUpperCase() || 'CM'
	}, [memberEmail])

	useEffect(() => {
		const initAuth = async () => {
			const { data, error } = await supabase.auth.getSession()

			if (error) {
				setDbNotice(`Auth check failed: ${error.message}`)
				setIsCheckingAuth(false)
				return
			}

			setMemberEmail(data.session?.user?.email ?? null)
			setIsCheckingAuth(false)
		}

		void initAuth()

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setMemberEmail(session?.user?.email ?? null)
		})

		return () => {
			subscription.unsubscribe()
		}
	}, [])

	useEffect(() => {
		if (!showProfileMenu) {
			return
		}

		const onPointerDown = (event: MouseEvent) => {
			if (!profileMenuRef.current) {
				return
			}

			if (!profileMenuRef.current.contains(event.target as Node)) {
				setShowProfileMenu(false)
			}
		}

		document.addEventListener('mousedown', onPointerDown)

		return () => {
			document.removeEventListener('mousedown', onPointerDown)
		}
	}, [showProfileMenu])

	const handleSignOut = async () => {
		const { error } = await supabase.auth.signOut()

		if (error) {
			setDbNotice(`Sign out failed: ${error.message}`)
			return
		}

		setMemberEmail(null)
		setAppView('home')
		setShowProfileMenu(false)
		setCurrentPassword('')
		setNewPassword('')
		setConfirmNewPassword('')
		setDbNotice('Signed out successfully.')
	}

	const handleChangePassword = async () => {
		if (isChangingPassword) {
			return
		}

		if (!memberEmail) {
			setDbNotice('Session not found. Please sign in again.')
			return
		}

		if (!currentPassword) {
			setDbNotice('Please enter your current password.')
			return
		}

		if (newPassword.length < 8) {
			setDbNotice('New password must be at least 8 characters.')
			return
		}

		if (newPassword !== confirmNewPassword) {
			setDbNotice('Password confirmation does not match.')
			return
		}

		setIsChangingPassword(true)

		try {
			const { error: verifyError } = await supabase.auth.signInWithPassword({
				email: memberEmail,
				password: currentPassword,
			})

			if (verifyError) {
				setDbNotice('Current password is incorrect.')
				return
			}

			const { error } = await supabase.auth.updateUser({ password: newPassword })

			if (error) {
				setDbNotice(`Password change failed: ${error.message}`)
				return
			}

			setDbNotice('Password updated successfully.')
			setAppView('home')
			setCurrentPassword('')
			setNewPassword('')
			setConfirmNewPassword('')
		} finally {
			setIsChangingPassword(false)
		}
	}

	if (isCheckingAuth) {
		return (
			<main className="circle-app">
				<section className="panel">
					<div className="panel-head">
						<h2>Checking Access...</h2>
						<p>Verifying private session.</p>
					</div>
				</section>
			</main>
		)
	}

	if (!memberEmail) {
		return (
			<main className="circle-app">
				<Login
					onAuthenticated={(email) => {
						setMemberEmail(email)
						setDbNotice('Signed in Succesfully')
					}}
				/>
			</main>
		)
	}

	if (appView === 'password') {
		return (
			<main className="circle-app">
				<section className="panel password-panel">
					<div className="panel-head">
						<h2>Change Password</h2>
						<p>Update your account password from this page.</p>
					</div>

					<div className="password-page-layout">
						<div className="change-password-box">
							<label>
								Current password
								<input
									type="password"
									value={currentPassword}
									onChange={(event) => setCurrentPassword(event.target.value)}
									placeholder="Enter current password"
								/>
							</label>
							<label>
								New password
								<input
									type="password"
									value={newPassword}
									onChange={(event) => setNewPassword(event.target.value)}
									placeholder="Minimum 8 characters"
								/>
							</label>
							<label>
								Confirm new password
								<input
									type="password"
									value={confirmNewPassword}
									onChange={(event) => setConfirmNewPassword(event.target.value)}
									placeholder="Re-type password"
								/>
							</label>
							<div className="list-actions">
								<button type="button" onClick={handleChangePassword} disabled={isChangingPassword}>
									{isChangingPassword ? 'Saving...' : 'Save Password'}
								</button>
								<button
									type="button"
									className="secondary"
									onClick={() => setAppView('home')}
								>
									Back to Home
								</button>
								<button type="button" className="danger" onClick={handleSignOut}>
									Sign out
								</button>
							</div>
						</div>

						<figure className="password-side-photo" aria-hidden="true">
							<SmartImage src={cemaraTwo} alt="Keluarga Cemara" fallbackSrc={cemaraTwo} />
							<figcaption>Keluarga Cemara</figcaption>
						</figure>
					</div>

					{dbNotice ? <p className="db-notice">{dbNotice}</p> : null}
				</section>
			</main>
		)
	}

	return (
		<main className="circle-app">
			<section className="hero">
				{memberEmail ? (
						<div className="hero-actions-top" ref={profileMenuRef}>
							<button
								type="button"
								className="profile-circle-btn"
								onClick={() => setShowProfileMenu((prev) => !prev)}
								aria-label="Open account menu"
							>
								{profileInitials}
							</button>
							{showProfileMenu ? (
								<div className="profile-menu">
									<button
										type="button"
										onClick={() => {
											setShowProfileMenu(false)
											setAppView('password')
										}}
									>
										Change Password
									</button>
									<button type="button" className="danger" onClick={handleSignOut}>
										Sign out
									</button>
								</div>
							) : null}
						</div>
				) : null}
				<p className="hero-tag">keluarga cemara circle</p>
				<h1>Keluarga Cemara: Friendship, Together, Forever, Telaga</h1>
				<p className="hero-copy">
					Cover foto ini menampilkan perjalanan pertemanan Keluarga Cemara sekilas, seperti air di tengah telaga yang tidak akan pernah habis begitu juga pertemanan kita.
				</p>
				<p className="hero-intro">
					Here we plan our days, keep our promises, and store the moments that make
					our circle feel like home.
				</p>
				<div className="hero-photo-gallery" aria-label="Keluarga Cemara photos">
					{heroPhotos.map((photo, index) => (
						<figure key={`${photo.src}-${index}`} className="hero-photo-showcase">
							<button
								type="button"
								className="hero-photo-trigger"
								onClick={() => setActiveHeroPhoto(photo)}
							>
								<SmartImage
									src={photo.src || heroPhotoFallbacks[index]}
									alt={photo.alt}
									fallbackSrc={heroPhotoFallbacks[index]}
								/>
							</button>
							<figcaption className="hero-photo-caption">
								<span>{photo.caption}</span>
							</figcaption>
						</figure>
					))}
				</div>
				<div className="hero-row">
					<span className="hero-date">Today: {todayLabel}</span>
					<span className="hero-people">6 friends connected</span>
					<span className="hero-people">Online now: {onlineCount}</span>
					{memberEmail ? <span className="hero-people">Signed in: {memberEmail}</span> : null}
				</div>
				<div className="hero-stats">
					<article>
						<span>{scheduleCount}</span>
						<p>Upcoming plans</p>
					</article>
					<article>
						<span>{memoryCount}</span>
						<p>Total memory photos</p>
					</article>
				</div>
				{dbNotice ? <p className="db-notice">{dbNotice}</p> : null}
			</section>

			{memberEmail ? (
			<section id="profiles-section" className="panel friend-panel">
				<div className="panel-head">
					<h2>Our 6-Person Circle</h2>
					<p>Anggota Keluarga Cemara</p>
				</div>

				<div className="friend-circle" aria-label="Friend circle profiles">
					{friendProfiles.map((friend) => (
						<article
							key={friend.id}
							className={`friend-card${friend.id === 5 ? ' friend-card-ganta' : ''}`}
						>
							<button
								type="button"
								className="friend-photo-trigger"
								onClick={() => setActiveFriendPhoto(friend)}
							>
								<SmartImage src={friend.avatar} alt={`${friend.name} profile`} />
							</button>
							<h3>{friend.name}</h3>
							<p>{friend.role}</p>
							<small>{friend.favoriteActivity}</small>
						</article>
					))}
				</div>
			</section>
			) : null}

			<section className="grid-area">
				<div id="schedule-section">
					<Schedule
						onCountChange={setScheduleCount}
						onNotice={setDbNotice}
						currentUserEmail={memberEmail}
					/>
				</div>
				<div id="memory-section">
					<MemoriesPhotos
					 onCountChange={setMemoryCount}
					 currentUserEmail={memberEmail}
					 />
				</div>
			</section>

			<div id="chat-section">
				<GlobalChat
					onNotice={setDbNotice}
					currentUserEmail={memberEmail}
					onOnlineCountChange={setOnlineCount}
				/>
			</div>
			<Footer scheduleCount={scheduleCount} memoryCount={memoryCount} onlineCount={onlineCount} />

			{activeHeroPhoto ? (
				<div
					className="hero-lightbox"
					onClick={() => setActiveHeroPhoto(null)}
					role="dialog"
					aria-modal="true"
				>
					<div className="hero-lightbox-card" onClick={(event) => event.stopPropagation()}>
						<button
							type="button"
							className="hero-lightbox-close"
							onClick={() => setActiveHeroPhoto(null)}
						>
							Close
						</button>
						<SmartImage src={activeHeroPhoto.src} alt={activeHeroPhoto.alt} />
						<p>{activeHeroPhoto.caption}</p>
					</div>
				</div>
			) : null}

			{activeFriendPhoto ? (
				<div
					className="hero-lightbox"
					onClick={() => setActiveFriendPhoto(null)}
					role="dialog"
					aria-modal="true"
				>
					<div
						className="hero-lightbox-card friend-lightbox-card"
						onClick={(event) => event.stopPropagation()}
					>
						<button
							type="button"
							className="hero-lightbox-close"
							onClick={() => setActiveFriendPhoto(null)}
						>
							Close
						</button>
						<SmartImage
							src={activeFriendPhoto.avatar}
							alt={`${activeFriendPhoto.name} full photo`}
						/>
						<p>
							{activeFriendPhoto.name} · {activeFriendPhoto.role}
						</p>
					</div>
				</div>
			) : null}
		</main>
	)
}

export default App