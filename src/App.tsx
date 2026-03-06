import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './App.css'
import { supabase } from './components/supaBaseClient.ts'
import Footer from './footer'
import coverCemara from './components/foto-cover-cemara.jpeg'
import cemaraOne from './components/cemara-1.jpeg'
import cemaraTwo from './components/cemara-2.jpeg'

type ScheduleItem = {
	id: string
	scheduleId: string
	title: string
	date: string
	time: string
	note: string
	done: boolean
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

type TitleRow = {
	titleId: string | number
	titleName: string | null
	titlePhotoUrl: string | null
}

type HeroPhoto = {
	titleId: string
	src: string
	alt: string
	caption: string
}

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

const fileToDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result ?? ''))
		reader.onerror = () => reject(new Error('Failed reading image file.'))
		reader.readAsDataURL(file)
	})

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

const friendProfiles: FriendProfile[] = [
	{
		id: 1,
		name: 'Alya',
		role: 'Planner',
		favoriteActivity: 'Picnic checklists',
		avatar:
			'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?auto=format&fit=crop&w=600&q=80',
	},
	{
		id: 2,
		name: 'Bima',
		role: 'Photographer',
		favoriteActivity: 'Golden hour portraits',
		avatar:
			'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80',
	},
	{
		id: 3,
		name: 'Citra',
		role: 'DJ',
		favoriteActivity: 'Road-trip playlists',
		avatar:
			'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
	},
	{
		id: 4,
		name: 'Dion',
		role: 'Chef',
		favoriteActivity: 'Cooking for hangouts',
		avatar:
			'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
	},
	{
		id: 5,
		name: 'Eka',
		role: 'Storykeeper',
		favoriteActivity: 'Memory journaling',
		avatar:
			'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=600&q=80',
	},
	{
		id: 6,
		name: 'Fajar',
		role: 'Navigator',
		favoriteActivity: 'Weekend route planning',
		avatar:
			'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
	},
]

function App() {
	const [schedules, setSchedules] = useState<ScheduleItem[]>([])
	const [title, setTitle] = useState('')
	const [date, setDate] = useState('')
	const [time, setTime] = useState('')
	const [note, setNote] = useState('')
	const [isLoadingSchedule, setIsLoadingSchedule] = useState(true)

	const [memories, setMemories] = useState<MemoryPhoto[]>([])
	const [caption, setCaption] = useState('')
	const [isLoadingMemories, setIsLoadingMemories] = useState(true)
	const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
	const [editingCaption, setEditingCaption] = useState('')
	const [heroPhotos, setHeroPhotos] = useState<HeroPhoto[]>([
		{
			titleId: 'local-1',
			src: coverCemara,
			alt: 'Keluarga Cemara circle cover',
			caption: 'Foto Cover Keluarga Cemara',
		},
		{
			titleId: 'local-2',
			src: cemaraOne,
			alt: 'Keluarga Cemara photo 1',
			caption: 'Cemara 1',
		},
		{
			titleId: 'local-3',
			src: cemaraTwo,
			alt: 'Keluarga Cemara photo 2',
			caption: 'Cemara 2',
		},
	])
	const [editingHeroPhotoId, setEditingHeroPhotoId] = useState<string | null>(null)
	const [heroTitleDraft, setHeroTitleDraft] = useState('')
	const [activeHeroPhoto, setActiveHeroPhoto] = useState<HeroPhoto | null>(null)
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

	const saveHeroPhotoTitle = async () => {
		if (!editingHeroPhotoId) {
			return
		}

		const nextTitle = heroTitleDraft.trim()

		if (!nextTitle) {
			return
		}

		const targetPhoto = heroPhotos.find((photo) => photo.titleId === editingHeroPhotoId)

		if (!targetPhoto) {
			return
		}

		const numericId = Number(editingHeroPhotoId)
		const updateResult = Number.isNaN(numericId)
			? await supabase
					.from('title')
					.update({ titleName: nextTitle })
					.eq('titleId', editingHeroPhotoId)
			: await supabase
					.from('title')
					.update({ titleName: nextTitle })
					.eq('titleId', numericId)

		if (updateResult.error) {
			setDbNotice(`Update title failed: ${updateResult.error.message}`)
			return
		}

		setHeroPhotos((prev) =>
			prev.map((photo) =>
				photo.titleId === editingHeroPhotoId
					? {
							...photo,
							caption: nextTitle,
						}
					: photo,
			),
		)
		setEditingHeroPhotoId(null)
		setHeroTitleDraft('')
		setDbNotice('Cover title updated in database.')

		setActiveHeroPhoto((prev) => {
			if (!prev) {
				return prev
			}

			if (prev.titleId !== targetPhoto.titleId) {
				return prev
			}

			return {
				...prev,
				caption: nextTitle,
			}
		})
	}

	const cancelHeroPhotoTitleEdit = () => {
		setEditingHeroPhotoId(null)
		setHeroTitleDraft('')
	}

	const startHeroPhotoTitleEdit = (photo: HeroPhoto) => {
		setEditingHeroPhotoId(photo.titleId)
		setHeroTitleDraft(photo.caption)
	}

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

			const { data, error } = await supabase
				.from('memoryId')
				.select('memoryId, memoryName, memoryPhotosUrl')

			if (error) {
				setDbNotice((prev) =>
					prev
						? `${prev} | Memory load failed: ${error.message}`
						: `Memory load failed: ${error.message}`,
				)
				setIsLoadingMemories(false)
				return
			}

			const mapped = ((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto)

			setMemories(mapped)
			setIsLoadingMemories(false)
		}

		const loadHeroTitles = async () => {
			const { data, error } = await supabase
				.from('title')
				.select('titleId, titleName, titlePhotoUrl')
				.order('titleId', { ascending: true })

			if (error) {
				setDbNotice((prev) =>
					prev ? `${prev} | Title load failed: ${error.message}` : `Title load failed: ${error.message}`,
				)
				return
			}

			const rows = (data ?? []) as TitleRow[]

			if (rows.length === 0) {
				const seedRows = [
					{ titleName: 'Foto Cover Keluarga Cemara', titlePhotoUrl: coverCemara },
					{ titleName: 'Cemara 1', titlePhotoUrl: cemaraOne },
					{ titleName: 'Cemara 2', titlePhotoUrl: cemaraTwo },
				]

				const seedResult = await supabase
					.from('title')
					.insert(seedRows)
					.select('titleId, titleName, titlePhotoUrl')

				if (seedResult.error) {
					setDbNotice((prev) =>
						prev
							? `${prev} | Title seed failed: ${seedResult.error?.message ?? ''}`
							: `Title seed failed: ${seedResult.error?.message ?? ''}`,
					)
					return
				}

				const seeded = (seedResult.data ?? []) as TitleRow[]
				setHeroPhotos(
					seeded.map((row, index) => ({
						titleId: String(row.titleId ?? `title-${index}`),
						src: String(row.titlePhotoUrl ?? ''),
						alt: `Keluarga Cemara photo ${index + 1}`,
						caption: String(row.titleName ?? `Cemara ${index + 1}`),
					})),
				)
				return
			}

			setHeroPhotos(
				rows.map((row, index) => ({
					titleId: String(row.titleId ?? `title-${index}`),
					src: String(row.titlePhotoUrl ?? ''),
					alt: `Keluarga Cemara photo ${index + 1}`,
					caption: String(row.titleName ?? `Cemara ${index + 1}`),
				})),
			)
		}

		void loadSchedules()
		void loadMemories()
		void loadHeroTitles()
	}, [])

	useEffect(() => {
		const refreshMemories = async () => {
			const { data, error } = await supabase
				.from('memoryId')
				.select('memoryId, memoryName, memoryPhotosUrl')

			if (error) {
				setDbNotice(`Realtime memory sync failed: ${error.message}`)
				return
			}

			setMemories(((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto))
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
		setDbNotice('Schedule added to Supabase.')
		setTitle('')
		setDate('')
		setTime('')
		setNote('')
	}

	const toggleDone = async (id: string) => {
		const nextDone = !schedules.find((item) => item.id === id)?.done

		if (typeof nextDone !== 'boolean') {
			return
		}

		setSchedules((prev) =>
			prev.map((item) =>
				item.id === id
					? {
							...item,
							done: nextDone,
						}
					: item,
			),
		)
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

		const uploadRows = await Promise.all(
			imageFiles.map(async (file) => ({
				memoryName: caption.trim() || file.name.replace(/\.[^/.]+$/, ''),
				memoryPhotosUrl: await fileToDataUrl(file),
			})),
		)

		const { data, error } = await supabase
			.from('memoryId')
			.insert(uploadRows)
			.select('*')

		if (error) {
			setDbNotice(`Create memory failed: ${error.message}`)
			event.target.value = ''
			return
		}

		const insertedMemories = ((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto)

		setMemories((prev) => [...insertedMemories, ...prev])
		setCaption('')
		setDbNotice('Memory photo saved to Supabase.')

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
		const nextCaption = editingCaption.trim()

		if (!nextCaption) {
			return
		}

		const target = memories.find((photo) => photo.id === id)

		if (!target) {
			return
		}

		const { error } = await supabase
			.from('memoryId')
			.update({ memoryName: nextCaption })
			.eq('memoryId', target.memoryId)

		if (error) {
			setDbNotice(`Update memory failed: ${error.message}`)
			return
		}

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

		cancelEditMemory()
	}

	const deleteMemory = async (id: string) => {
		const target = memories.find((photo) => photo.id === id)

		if (!target) {
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
				'Delete was not committed in Supabase. Check RLS DELETE policy for table memoryId.',
			)
			return
		}

		setMemories((prev) => prev.filter((photo) => photo.id !== id))
		setDbNotice('Memory deleted from Supabase.')

		if (editingMemoryId === id) {
			cancelEditMemory()
		}
	}

	return (
		<main className="circle-app">
			<section className="hero">
				<p className="hero-tag">keluarga cemara circle</p>
				<h1>Keluarga Cemara: our circle of warmth, growth, and memories.</h1>
				<p className="hero-copy">
					This cover represents our friendship like a cedar tree: rooted in trust,
					standing through every season, and growing stronger together.
				</p>
				<p className="hero-intro">
					Here we plan our days, keep our promises, and store the moments that make
					our circle feel like home.
				</p>
				<div className="hero-photo-gallery" aria-label="Keluarga Cemara photos">
					{heroPhotos.map((photo) => (
						<figure key={photo.src} className="hero-photo-showcase">
							<button
								type="button"
								className="hero-photo-trigger"
								onClick={() => setActiveHeroPhoto(photo)}
							>
								<img src={photo.src} alt={photo.alt} />
							</button>
							<figcaption className="hero-photo-caption">
								{editingHeroPhotoId === photo.titleId ? (
									<div className="cover-title-edit">
										<input
											type="text"
											value={heroTitleDraft}
											onChange={(event) => setHeroTitleDraft(event.target.value)}
										/>
										<button type="button" onClick={saveHeroPhotoTitle}>
											Save
										</button>
										<button
											type="button"
											className="secondary"
											onClick={cancelHeroPhotoTitleEdit}
										>
											Cancel
										</button>
									</div>
								) : (
									<>
										<span>{photo.caption}</span>
										<button
											type="button"
											className="cover-title-btn"
											onClick={() => startHeroPhotoTitleEdit(photo)}
										>
											Edit title
										</button>
									</>
								)}
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
					<p>Everyone has a profile so plans and memories feel personal.</p>
				</div>

				<div className="friend-circle" aria-label="Friend circle profiles">
					{friendProfiles.map((friend) => (
						<article key={friend.id} className="friend-card">
							<img src={friend.avatar} alt={`${friend.name} profile`} />
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
						<h2>Circle Schedule</h2>
						<p>
							Capture every meetup and never miss your friend time.
							{isLoadingSchedule ? ' Loading from Supabase...' : ''}
						</p>
					</div>

					<form className="schedule-form" onSubmit={handleAddSchedule}>
						<label>
							Plan title
							<input
								type="text"
								placeholder="Movie night at Sinta's house"
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
						{schedules.map((item) => (
							<li key={item.id} className={item.done ? 'done' : ''}>
								<div>
									<p>{item.title}</p>
									<small>
										{item.date} · {item.time}
										{item.note ? ` · ${item.note}` : ''}
									</small>
								</div>
								<div className="list-actions">
									<button type="button" onClick={() => toggleDone(item.id)}>
										{item.done ? 'Undo' : 'Done'}
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
						{schedules.length === 0 ? (
							<li className="empty">No plans yet. Add your first schedule.</li>
						) : null}
					</ul>
				</div>

				<div className="panel memory-panel">
					<div id="memory-section" />
					<div className="panel-head">
						<h2>Memory Photos</h2>
						<p>
							Look back at shared moments and upload new ones anytime.
							{isLoadingMemories ? ' Loading from Supabase...' : ''}
						</p>
					</div>

					<div className="upload-row">
						<label>
							Caption (optional)
							<input
								type="text"
								placeholder="Camping under the stars"
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
						{memories.map((photo) => (
							<figure key={photo.id} className="memory-card">
								<img src={photo.src} alt={photo.caption} />
								<figcaption>
									{editingMemoryId === photo.id ? (
										<div className="memory-edit-form">
											<label>
												Caption
												<input
													type="text"
													value={editingCaption}
													onChange={(event) => setEditingCaption(event.target.value)}
												/>
											</label>
											<div className="memory-actions">
												<button type="button" onClick={() => saveEditMemory(photo.id)}>
													Save
												</button>
												<button
													type="button"
													className="secondary"
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
						<img src={activeHeroPhoto.src} alt={activeHeroPhoto.alt} />
						<p>{activeHeroPhoto.caption}</p>
					</div>
				</div>
			) : null}
		</main>
	)
}

export default App
