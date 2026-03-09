import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'
import { supabase } from './components/supaBaseClient.ts'
import Footer from './footer'
import coverCemara from './components/foto-cover-cemara.jpeg'
import cemaraOne from './components/cemara-1.jpeg'
import cemaraTwo from './components/cemara-2.jpeg'
import candicePhoto from './components/candice.jpeg'
import adindaPhoto from './components/adinda.jpeg'
import fasaPhoto from './components/fasa.jpeg'
import fabianPhoto from './components/fabian.jpeg'
import gantaPhoto from './components/ganta.jpeg'
import jonathanPhoto from './components/jonathan.PNG'

type ScheduleItem = {
	id: string
	scheduleId: string
	title: string
	date: string
	time: string
	note: string
	done: boolean
}

type ScheduleHistoryItem = ScheduleItem & {
	completedAt: string
}

const SCHEDULE_HISTORY_KEY = 'keluarga-cemara-schedule-history'
const LOCAL_MEMORIES_KEY = 'keluarga-cemara-local-memories'

const readScheduleHistory = (): ScheduleHistoryItem[] => {
	try {
		const raw = localStorage.getItem(SCHEDULE_HISTORY_KEY)
		if (!raw) {
			return []
		}

		const parsed = JSON.parse(raw) as ScheduleHistoryItem[]
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

const writeScheduleHistory = (history: ScheduleHistoryItem[]) => {
	localStorage.setItem(SCHEDULE_HISTORY_KEY, JSON.stringify(history))
}

type MemoryPhoto = {
	id: string
	memoryId: string
	src: string
	caption: string
	date: string
	uploaded: boolean
}

type FriendProfile = {
	id: number
	name: string
	role: string
	favoriteActivity: string
	avatar: string
}

type AppProps = {
	sessionEmail: string
	onOpenProfile: () => void
}

type ScheduleRow = {
	scheduleId: string
	scheduleName: string
	scheduleTime: string
	scheduleNote: string | null
}

type MemoryRow = {
	memoryId: string
	memoryName: string
	memoryPhotosUrl: string
}

type MemoryInsertRow = {
	memoryId?: number
	memoryName: string
	memoryPhotosUrl: string
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

const mapMemoryRowToPhoto = (row: MemoryRow, index: number): MemoryPhoto => {
	const memoryId = String(row.memoryId ?? `m-${index}`)

	return {
		id: memoryId,
		memoryId,
		src: String(row.memoryPhotosUrl ?? ''),
		caption: String(row.memoryName ?? 'Memory'),
		date: '',
		uploaded: true,
	}
}

const sortMemoriesByNewest = (photos: MemoryPhoto[]) =>
	[...photos].sort((a, b) => {
		const aNum = Number(a.memoryId)
		const bNum = Number(b.memoryId)

		if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
			return bNum - aNum
		}

		return String(b.memoryId).localeCompare(String(a.memoryId))
	})

const readLocalMemories = (): MemoryPhoto[] => {
	try {
		const raw = localStorage.getItem(LOCAL_MEMORIES_KEY)
		if (!raw) {
			return []
		}

		const parsed = JSON.parse(raw) as MemoryPhoto[]
		if (!Array.isArray(parsed)) {
			return []
		}

		return parsed.map((memory, index) => ({
			id: String(memory.id ?? `local-${index}`),
			memoryId: String(memory.memoryId ?? memory.id ?? `local-${index}`),
			src: String(memory.src ?? ''),
			caption: String(memory.caption ?? 'Memory'),
			date: String(memory.date ?? ''),
			uploaded: false,
		}))
	} catch {
		return []
	}
}

const writeLocalMemories = (memories: MemoryPhoto[]) => {
	localStorage.setItem(LOCAL_MEMORIES_KEY, JSON.stringify(memories))
}

const mergeDbAndLocalMemories = (dbMemories: MemoryPhoto[], localMemories: MemoryPhoto[]) => {
	const byId = new Map<string, MemoryPhoto>()

	for (const memory of localMemories) {
		byId.set(memory.id, memory)
	}

	for (const memory of dbMemories) {
		byId.set(memory.id, memory)
	}

	return sortMemoriesByNewest(Array.from(byId.values()))
}

const keepOnlyLocalMemories = (memories: MemoryPhoto[]) => memories.filter((item) => !item.uploaded)

const fileToDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result ?? ''))
		reader.onerror = () => reject(new Error('Failed reading image file.'))
		reader.readAsDataURL(file)
	})

const sanitizeFileName = (rawName: string) =>
	rawName
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '') || 'photo'

const uploadMemoryPhotoToStorage = async (file: File) => {
	const extension = file.name.includes('.')
		? file.name.slice(file.name.lastIndexOf('.'))
		: ''
	const safeBaseName = sanitizeFileName(file.name.replace(/\.[^/.]+$/, ''))
	const path = `memories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBaseName}${extension}`

	const { error: uploadError } = await supabase.storage
		.from('memory-photos')
		.upload(path, file, {
			cacheControl: '3600',
			upsert: false,
			contentType: file.type,
		})

	if (uploadError) {
		throw new Error(uploadError.message)
	}

	const { data } = supabase.storage.from('memory-photos').getPublicUrl(path)
	return data.publicUrl
}

const resolveMemoryPhotoSource = async (file: File) => {
	try {
		return await uploadMemoryPhotoToStorage(file)
	} catch {
		return await fileToDataUrl(file)
	}
}

const splitScheduleTime = (value: string) => {
	if (!value) {
		return { date: '', time: '' }
	}

	if (value.includes('T')) {
		const [datePart, timePart] = value.split('T')
		return { date: datePart ?? '', time: (timePart ?? '').slice(0, 5) }
	}

	if (value.includes(' ')) {
		const [datePart, timePart] = value.split(' ')
		return { date: datePart ?? '', time: (timePart ?? '').slice(0, 5) }
	}

	return { date: '', time: value.slice(0, 5) }
}

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

function App({ sessionEmail, onOpenProfile }: AppProps) {
	const [schedules, setSchedules] = useState<ScheduleItem[]>([])
	const [scheduleHistory, setScheduleHistory] = useState<ScheduleHistoryItem[]>(
		() => readScheduleHistory(),
	)
	const [title, setTitle] = useState('')
	const [date, setDate] = useState('')
	const [time, setTime] = useState('')
	const [note, setNote] = useState('')
	const [isLoadingSchedule, setIsLoadingSchedule] = useState(true)

	const [memories, setMemories] = useState<MemoryPhoto[]>([])
	const [caption, setCaption] = useState('')
	const [isLoadingMemories, setIsLoadingMemories] = useState(true)
	const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
	const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null)
	const [editingCaption, setEditingCaption] = useState('')
	const coverPhotoTitle = 'Ulang Tahun Candice'
	const cemaraOneTitle = 'Ulang Tahun Jonathan'
	const cemaraTwoTitle = 'Last Day'
	const [activeHeroPhoto, setActiveHeroPhoto] = useState<HeroPhoto | null>(null)
	const [activeFriendPhoto, setActiveFriendPhoto] = useState<FriendProfile | null>(null)
	const [activeMemoryPhoto, setActiveMemoryPhoto] = useState<MemoryPhoto | null>(null)
	const [dbNotice, setDbNotice] = useState('')
	const todayLabel = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	})

	const upcomingCount = useMemo(
		() => schedules.filter((item) => !item.done).length,
		[schedules],
	)

	const profileInitial = useMemo(() => {
		const cleanEmail = sessionEmail.trim()
		return cleanEmail ? cleanEmail[0]!.toUpperCase() : 'U'
	}, [sessionEmail])

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

	useEffect(() => {
		writeScheduleHistory(scheduleHistory)
	}, [scheduleHistory])

	useEffect(() => {
		const loadSchedules = async () => {
			setIsLoadingSchedule(true)

			const { data, error } = await supabase
				.from('schedule')
				.select('scheduleId, scheduleName, scheduleTime, scheduleNote')

			if (error) {
				setDbNotice(`Schedule load failed: ${error.message}`)
				setIsLoadingSchedule(false)
				return
			}

			const mapped = ((data ?? []) as ScheduleRow[])
				.map((row, index) => {
					const scheduleId = String(row.scheduleId ?? `s-${index}`)
					const when = splitScheduleTime(String(row.scheduleTime ?? ''))

					return {
						id: scheduleId,
						scheduleId,
						title: String(row.scheduleName ?? 'Untitled'),
						date: when.date,
						time: when.time,
						note: String(row.scheduleNote ?? ''),
						done: false,
					}
				})
				.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))

			setSchedules(mapped)
			setIsLoadingSchedule(false)
		}

		const loadMemories = async () => {
			setIsLoadingMemories(true)
			const localMemories = readLocalMemories()

			const { data, error } = await supabase
				.from('memoryId')
				.select('memoryId, memoryName, memoryPhotosUrl')

			if (error) {
				setDbNotice((prev) =>
					prev
						? `${prev} | Memory load failed: ${error.message}`
						: `Memory load failed: ${error.message}`,
				)
				setMemories(sortMemoriesByNewest(localMemories))
				setIsLoadingMemories(false)
				return
			}

			const mapped = ((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto)

			setMemories(mergeDbAndLocalMemories(mapped, localMemories))
			setIsLoadingMemories(false)
		}

		void loadSchedules()
		void loadMemories()
	}, [])

	useEffect(() => {
		const refreshMemories = async () => {
			const localMemories = readLocalMemories()
			const { data, error } = await supabase
				.from('memoryId')
				.select('memoryId, memoryName, memoryPhotosUrl')

			if (error) {
				setDbNotice(`Realtime memory sync failed: ${error.message}`)
				setMemories(sortMemoriesByNewest(localMemories))
				return
			}

			setMemories(
				mergeDbAndLocalMemories(
					((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto),
					localMemories,
				),
			)
		}

		const memoryChannel = supabase
			.channel('memory-realtime-sync')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'memoryId' },
				() => {
					void refreshMemories()
				},
			)
			.subscribe()

		return () => {
			void supabase.removeChannel(memoryChannel)
		}
	}, [])

	useEffect(() => {
		writeLocalMemories(keepOnlyLocalMemories(memories))
	}, [memories])

	const handleAddSchedule = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		const trimmedTitle = title.trim()
		const trimmedNote = note.trim()

		if (!trimmedTitle || !time) {
			return
		}

		const scheduleTimeValue = date ? `${date} ${time}` : time
		const payload = {
			scheduleName: trimmedTitle,
			scheduleTime: scheduleTimeValue,
			scheduleNote: trimmedNote,
		}

		let inserted: ScheduleRow | null = null
		let lastError = ''

		const insertTry = await supabase.from('schedule').insert([payload]).select('*').single()

		if (!insertTry.error && insertTry.data) {
			inserted = insertTry.data as unknown as ScheduleRow
		} else {
			lastError = insertTry.error?.message ?? 'Unknown error'
			const bigintSafeScheduleId = Date.now() * 1000 + Math.floor(Math.random() * 1000)
			const fallbackWithId = await supabase
				.from('schedule')
				.insert([{ ...payload, scheduleId: bigintSafeScheduleId }])
				.select('*')
				.single()

			if (!fallbackWithId.error && fallbackWithId.data) {
				inserted = fallbackWithId.data as unknown as ScheduleRow
			} else {
				lastError = fallbackWithId.error?.message ?? lastError
			}
		}

		if (!inserted) {
			setDbNotice(`Create schedule failed: ${lastError}`)
			return
		}

		const parsed = splitScheduleTime(String(inserted.scheduleTime ?? scheduleTimeValue))
		const scheduleId = String(inserted.scheduleId ?? `s-${Date.now()}`)

		setSchedules((prev) => [
			{
				id: scheduleId,
				scheduleId,
				title: String(inserted.scheduleName ?? trimmedTitle),
				date: parsed.date,
				time: parsed.time || time,
				note: String(inserted.scheduleNote ?? trimmedNote),
				done: false,
			},
			...prev,
		])
		setDbNotice('Schedule added Database.')
		setTitle('')
		setDate('')
		setTime('')
		setNote('')
	}

	const toggleDone = async (id: string) => {
		const target = schedules.find((item) => item.id === id)

		if (!target) {
			return
		}

		const { error } = await supabase
			.from('schedule')
			.delete()
			.eq('scheduleId', target.scheduleId)

		if (error) {
			setDbNotice(`Complete schedule failed: ${error.message}`)
			return
		}

		setSchedules((prev) => prev.filter((item) => item.id !== id))
		setScheduleHistory((prev) => [
			{
				...target,
				done: true,
				completedAt: new Date().toLocaleString(),
			},
			...prev.filter((item) => item.scheduleId !== target.scheduleId),
		])
		setDbNotice('Schedule moved to history.')
	}

	const deleteSchedule = async (id: string) => {
		const target = schedules.find((item) => item.id === id)

		if (!target) {
			return
		}

		const { error } = await supabase
			.from('schedule')
			.delete()
			.eq('scheduleId', target.scheduleId)

		if (error) {
			setDbNotice(`Delete schedule failed: ${error.message}`)
			return
		}

		setSchedules((prev) => prev.filter((item) => item.id !== id))
	}

	const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files

		if (!files || files.length === 0) {
			return
		}

		const imageFiles = Array.from(files).filter((file) =>
			file.type.startsWith('image/'),
		)

		if (imageFiles.length === 0) {
			event.target.value = ''
			return
		}

		const captionBase = caption.trim()
		const uploadRows: MemoryInsertRow[] = await Promise.all(
			imageFiles.map(async (file) => ({
				memoryName: captionBase || file.name.replace(/\.[^/.]+$/, ''),
				memoryPhotosUrl: await resolveMemoryPhotoSource(file),
			})),
		)

		let insertedData: MemoryRow[] = []
		let insertError = ''

		const insertTry = await supabase.from('memoryId').insert(uploadRows).select('*')

		if (!insertTry.error) {
			insertedData = (insertTry.data ?? []) as MemoryRow[]
		} else {
			insertError = insertTry.error.message

			const startId = Date.now() * 1000
			const fallbackRows: MemoryInsertRow[] = uploadRows.map((row, index) => ({
				...row,
				memoryId: startId + index,
			}))

			const fallbackInsert = await supabase
				.from('memoryId')
				.insert(fallbackRows)
				.select('*')

			if (!fallbackInsert.error) {
				insertedData = (fallbackInsert.data ?? []) as MemoryRow[]
			} else {
				insertError = `${insertError} | fallback: ${fallbackInsert.error.message}`
			}
		}

		if (insertedData.length === 0) {
			const now = Date.now()
			const localRows: MemoryPhoto[] = uploadRows.map((row, index) => {
				const localId = `local-${now}-${index}`
				return {
					id: localId,
					memoryId: localId,
					src: row.memoryPhotosUrl,
					caption: row.memoryName,
					date: '',
					uploaded: false,
				}
			})

			setMemories((prev) => sortMemoriesByNewest([...localRows, ...prev]))
			setCaption('')
			setDbNotice(
				`Saved locally on this device (DB insert blocked): ${insertError || 'Unknown insert error.'}`,
			)
			event.target.value = ''
			return
		}

		const insertedMemories = insertedData.map(mapMemoryRowToPhoto)

		setMemories((prev) => sortMemoriesByNewest([...insertedMemories, ...prev]))
		setCaption('')
		setDbNotice('Memory photo saved to Database.')

		event.target.value = ''
	}

	const startEditMemory = (memory: MemoryPhoto) => {
		setEditingMemoryId(memory.id)
		setEditingCaption(memory.caption)
	}

	const cancelEditMemory = () => {
		setEditingMemoryId(null)
		setEditingCaption('')
	}

	const saveEditMemory = async (id: string) => {
		if (savingMemoryId === id) {
			return
		}

		const nextCaption = editingCaption.trim()

		if (!nextCaption) {
			return
		}

		const target = memories.find((photo) => photo.id === id)

		if (!target) {
			return
		}

		if (!target.uploaded) {
			setMemories((prev) =>
				prev.map((photo) =>
					photo.id === id
						? {
							...photo,
							caption: nextCaption,
						}
						: photo,
				),
			)
			setActiveMemoryPhoto((prev) => {
				if (!prev || prev.id !== id) {
					return prev
				}

				return {
					...prev,
					caption: nextCaption,
				}
			})
			setDbNotice('Local memory title updated on this device.')
			cancelEditMemory()
			return
		}

		setSavingMemoryId(id)

		try {

			const replacementInsert = await supabase
				.from('memoryId')
				.insert([
					{
						memoryName: nextCaption,
						memoryPhotosUrl: target.src,
					},
				])
				.select('memoryId, memoryName, memoryPhotosUrl')
				.single()

			if (replacementInsert.error || !replacementInsert.data) {
				setDbNotice(
					`Edit memory failed: ${replacementInsert.error?.message || 'Insert replacement failed.'}`,
				)
				return
			}

			const replacementPhoto = mapMemoryRowToPhoto(replacementInsert.data as MemoryRow, 0)
			const numericId = Number(target.memoryId)

			const deleteOld = Number.isNaN(numericId)
				? await supabase
						.from('memoryId')
						.delete()
						.eq('memoryId', target.memoryId)
						.select('memoryId')
				: await supabase
						.from('memoryId')
						.delete()
						.eq('memoryId', numericId)
						.select('memoryId')

			if (deleteOld.error || (deleteOld.data ?? []).length === 0) {
				const fallbackDeleteOld = await supabase
					.from('memoryId')
					.delete()
					.eq('memoryName', target.caption)
					.eq('memoryPhotosUrl', target.src)
					.select('memoryId')

				if (fallbackDeleteOld.error || (fallbackDeleteOld.data ?? []).length === 0) {
					setDbNotice(
						'Title changed, but old memory row could not be removed. Please delete the duplicate old row manually.',
					)
				}
			}

			setMemories((prev) =>
				sortMemoriesByNewest([
					replacementPhoto,
					...prev.filter((photo) => photo.id !== id),
				]),
			)

			setActiveMemoryPhoto((prev) => {
				if (!prev || prev.id !== id) {
					return prev
				}

				return replacementPhoto
			})

			setDbNotice('Memory title updated Database.')

			cancelEditMemory()
		} finally {
			setSavingMemoryId((prev) => (prev === id ? null : prev))
		}
	}

	const deleteMemory = async (id: string) => {
		const target = memories.find((photo) => photo.id === id)

		if (!target) {
			return
		}

		if (!target.uploaded) {
			setMemories((prev) => prev.filter((photo) => photo.id !== id))
			setDbNotice('Local memory deleted from this device.')
			if (editingMemoryId === id) {
				cancelEditMemory()
			}
			return
		}

		let deleteError = ''
		let deletedCommitted = false
		const numericId = Number(target.memoryId)

		const primaryDelete = Number.isNaN(numericId)
			? await supabase
					.from('memoryId')
					.delete()
					.eq('memoryId', target.memoryId)
					.select('memoryId')
			: await supabase
					.from('memoryId')
					.delete()
					.eq('memoryId', numericId)
					.select('memoryId')

		if (primaryDelete.error) {
			deleteError = primaryDelete.error.message
		} else if ((primaryDelete.data ?? []).length > 0) {
			deletedCommitted = true
		}

		if (!deletedCommitted) {
			const fallbackDelete = await supabase
				.from('memoryId')
				.delete()
				.eq('memoryName', target.caption)
				.eq('memoryPhotosUrl', target.src)
				.select('memoryId')

			if (fallbackDelete.error) {
				setDbNotice(
					`Delete memory failed: ${deleteError} | fallback: ${fallbackDelete.error.message}`,
				)
				return
			}

			if ((fallbackDelete.data ?? []).length > 0) {
				deletedCommitted = true
			}
		}

		if (!deletedCommitted) {
			setDbNotice(
				'Delete was not committed in Database. Check RLS DELETE policy for table memoryId.',
			)
			return
		}

		setMemories((prev) => prev.filter((photo) => photo.id !== id))
		setDbNotice('Memory deleted from Database.')

		if (editingMemoryId === id) {
			cancelEditMemory()
		}
	}

	return (
		<main className="circle-app">
			<section className="hero">
				<button
					type="button"
					className="hero-profile-entry"
					onClick={onOpenProfile}
					aria-label="Open profile menu"
					title="Profile"
				>
					<span className="hero-profile-initial" aria-hidden="true">
						{profileInitial}
					</span>
					<span className="hero-profile-text">Profile</span>
				</button>
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
				</div>
				<div className="hero-stats">
					<article>
						<span>{upcomingCount}</span>
						<p>Upcoming plans</p>
					</article>
					<article>
						<span>{memories.length}</span>
						<p>Total memory photos</p>
					</article>
				</div>
				{dbNotice ? <p className="db-notice">{dbNotice}</p> : null}
			</section>

			<section id="profiles-section" className="panel friend-panel">
				<div className="panel-head">
					<h2>Our 6-Person Circle</h2>
					<p>Anggota Keluarga Cemara</p>
				</div>
				<p className="profile-change-note">
					Ges kalau mau ganti profile bilang aku ya "Fabian"
				</p>

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

			<section className="grid-area">
				<div className="panel schedule-panel">
				<div id="schedule-section" />
					<div className="panel-head">
						<h2>Keluarga Cemara Schedule</h2>
						<p>Ini Buat Schedule atau Jadwal Kita Main Yaaaa.</p>
						{isLoadingSchedule ? (
							<div className="section-loading-indicator" aria-live="polite">
								<span className="section-loading-dot" />
								<span>Loading schedules...</span>
							</div>
						) : null}
					</div>

					<form className="schedule-form" onSubmit={handleAddSchedule}>
						<label>
							Plan title
							<input
								type="text"
								placeholder="Text here..."
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								required
							/>
						</label>

						<label>
							Date
							<input
								type="date"
								value={date}
								onChange={(event) => setDate(event.target.value)}
								required
							/>
						</label>

						<label>
							Time
							<input
								type="time"
								value={time}
								onChange={(event) => setTime(event.target.value)}
								required
							/>
						</label>

						<label>
							Note
							<textarea
								placeholder="What should everyone bring?"
								value={note}
								onChange={(event) => setNote(event.target.value)}
								rows={3}
							/>
						</label>

						<button type="submit">Add schedule</button>
					</form>

					<ul className="schedule-list">
						{isLoadingSchedule
							? Array.from({ length: 3 }).map((_, index) => (
									<li
										key={`schedule-skeleton-${index}`}
										className="schedule-skeleton"
										aria-hidden="true"
									>
										<div className="schedule-skeleton-info">
											<div className="schedule-skeleton-line schedule-skeleton-title" />
											<div className="schedule-skeleton-line schedule-skeleton-subtitle" />
										</div>
										<div className="schedule-skeleton-actions">
											<div className="schedule-skeleton-btn" />
											<div className="schedule-skeleton-btn" />
										</div>
									</li>
								))
							: null}
						{schedules.map((item) => (
							<li key={item.id}>
								<div>
									<p>{item.title}</p>
									<small>
										{item.date} · {item.time}
										{item.note ? ` · ${item.note}` : ''}
									</small>
								</div>
								<div className="list-actions">
									<button type="button" onClick={() => toggleDone(item.id)}>
										Done
									</button>
									<button
										type="button"
										className="danger"
										onClick={() => deleteSchedule(item.id)}
									>
										Delete
									</button>
								</div>
							</li>
						))}
						{schedules.length === 0 && !isLoadingSchedule ? (
							<li className="empty">No plans yet. Add your first schedule.</li>
						) : null}
					</ul>

					<div className="schedule-history-block">
						<h3>Schedule History</h3>
						<ul className="schedule-history-list">
							{scheduleHistory.map((item) => (
								<li key={`${item.id}-${item.completedAt}`}>
									<p>{item.title}</p>
									<small>
										{item.date} · {item.time}
										{item.note ? ` · ${item.note}` : ''}
									</small>
									<small className="history-completed-at">
										Completed: {item.completedAt}
									</small>
								</li>
							))}
							{scheduleHistory.length === 0 ? (
								<li className="empty">No completed schedules yet.</li>
							) : null}
						</ul>
					</div>
				</div>

				<div className="panel memory-panel">
					<div id="memory-section" />
					<div className="panel-head">
						<h2>Keluarga Cemara Memory Photos</h2>
						<p>Foto Memori Kenangan Keluarga Cemara Disini Yaaa.</p>
						{isLoadingMemories ? (
							<div className="section-loading-indicator" aria-live="polite">
								<span className="section-loading-dot" />
								<span>Loading memory photos...</span>
							</div>
						) : null}
					</div>

					<div className="upload-row">
						<label>
							Title
							<input
								type="text"
								placeholder="Write ur caption here..."
								value={caption}
								onChange={(event) => setCaption(event.target.value)}
							/>
						</label>

						<label className="upload-input">
							<span>Add photos from device</span>
							<span className="upload-btn">+ Add New Memory Photo</span>
							<input
								type="file"
								accept="image/*"
								multiple
								onChange={handlePhotoUpload}
							/>
						</label>
					</div>

					<div className="memory-grid">
						{isLoadingMemories
							? Array.from({ length: 4 }).map((_, index) => (
									<figure
										key={`memory-skeleton-${index}`}
										className="memory-card memory-card-skeleton"
										aria-hidden="true"
									>
										<div className="memory-skeleton-image" />
										<figcaption>
											<div className="memory-skeleton-line memory-skeleton-title" />
											<div className="memory-skeleton-line memory-skeleton-subtitle" />
										</figcaption>
									</figure>
								))
							: null}
						{memories.map((photo) => (
							<figure key={photo.id} className="memory-card">
								<button
									type="button"
									className="memory-photo-trigger"
									onClick={() => setActiveMemoryPhoto(photo)}
								>
									<SmartImage src={photo.src} alt={photo.caption} />
									<span className="memory-hover-chip">View full photo</span>
								</button>
								<figcaption>
									{editingMemoryId === photo.id ? (
										<div className="memory-edit-form">
											<label>
												Caption
												<input
													type="text"
													value={editingCaption}
													disabled={savingMemoryId === photo.id}
													onChange={(event) => setEditingCaption(event.target.value)}
												/>
											</label>
											<div className="memory-actions">
												<button
													type="button"
													disabled={savingMemoryId === photo.id}
													onClick={() => saveEditMemory(photo.id)}
												>
													{savingMemoryId === photo.id ? 'Saving...' : 'Save'}
												</button>
												<button
													type="button"
													className="secondary"
													disabled={savingMemoryId === photo.id}
													onClick={cancelEditMemory}
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										<>
											<p>{photo.caption}</p>
											<small>
												{photo.date}
												{photo.uploaded ? ' · uploaded' : ''}
											</small>
											<div className="memory-actions">
												<button
													type="button"
													onClick={() => startEditMemory(photo)}
												>
													Edit
												</button>
												<button
													type="button"
													className="danger"
													onClick={() => deleteMemory(photo.id)}
												>
													Delete
												</button>
											</div>
										</>
									)}
								</figcaption>
							</figure>
						))}
						{memories.length === 0 ? (
							<div className="memory-empty">No memories yet. Upload a photo.</div>
						) : null}
					</div>
				</div>
			</section>
			<Footer />

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

			{activeMemoryPhoto ? (
				<div
					className="hero-lightbox"
					onClick={() => setActiveMemoryPhoto(null)}
					role="dialog"
					aria-modal="true"
				>
					<div
						className="hero-lightbox-card memory-lightbox-card"
						onClick={(event) => event.stopPropagation()}
					>
						<button
							type="button"
							className="hero-lightbox-close"
							onClick={() => setActiveMemoryPhoto(null)}
						>
							Close
						</button>
						<SmartImage src={activeMemoryPhoto.src} alt={activeMemoryPhoto.caption} />
						<p>
							{activeMemoryPhoto.caption}
							{activeMemoryPhoto.date ? ` · ${activeMemoryPhoto.date}` : ''}
						</p>
					</div>
				</div>
			) : null}
		</main>
	)
}

export default App
