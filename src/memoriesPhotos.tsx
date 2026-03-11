import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react'
import { supabase } from './components/supaBaseClient.ts'

type MemoryPhoto = {
	id: string
	memoryId: string
	src: string
	caption: string
	date: string
	uploaded: boolean
	addedBy: string
	sizeLabel: string
}

type MemoryRow = {
	memoryId: string
	memoryName: string
	memoryPhotosUrl: string
	memoryAddedBy?: string | null
}

type MemoryCommentRow = {
	id?: string | number | null
	commentId?: string | number | null
	memoryId?: string | number | null
	comment?: string | null
	commentText?: string | null
	addedBy?: string | null
	commentBy?: string | null
	timestamp?: string | null
	createdAt?: string | null
}

type MemoryComment = {
	id: string
	memoryId: string
	text: string
	commentBy: string
	createdAtMs: number
	timeLabel: string
}

type SmartImageProps = {
	src: string
	alt: string
	fallbackSrc?: string
	className?: string
}

type MemoriesPhotosProps = {
	onCountChange?: Dispatch<SetStateAction<number>>
	onNotice?: Dispatch<SetStateAction<string>>
	currentUserEmail?: string | null
}

const MAX_FILES_PER_UPLOAD = 8
const MAX_SINGLE_FILE_SIZE_BYTES = 5 * 1024 * 1024
const DEFAULT_VISIBLE_MEMORIES = 4
const MAX_MEMORY_COMMENT_LENGTH = 220

const formatFileSize = (bytes: number) => {
	if (!Number.isFinite(bytes) || bytes < 0) {
		return '0 B'
	}

	if (bytes < 1024) {
		return `${bytes} B`
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`
	}

	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const getDataUrlBytes = (src: string) => {
	if (!src.startsWith('data:')) {
		return null
	}

	const commaIndex = src.indexOf(',')
	if (commaIndex === -1) {
		return null
	}

	const header = src.slice(0, commaIndex)
	const payload = src.slice(commaIndex + 1)

	if (header.includes(';base64')) {
		const cleaned = payload.replace(/\s/g, '')
		const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0
		return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding)
	}

	try {
		return decodeURIComponent(payload).length
	} catch {
		return null
	}
}

const loadedImageSrcCache = new Set<string>()

const formatCommentTime = (timestamp: number) =>
	new Intl.DateTimeFormat('id-ID', {
		hour: '2-digit',
		minute: '2-digit',
		day: '2-digit',
		month: 'short',
		timeZone: 'Asia/Jakarta',
		hour12: false,
	}).format(new Date(timestamp))

const mapCommentRow = (row: MemoryCommentRow, index: number): MemoryComment => {
	const memoryId = String(row.memoryId ?? row.id ?? '')
	const baseId = (row.id ?? memoryId) || 'comment'
	const commentId =
		row.commentId ??
		`${String(baseId)}-${String(row.timestamp ?? row.createdAt ?? index)}`
	const createdAtMs = Date.parse(String(row.timestamp ?? row.createdAt ?? ''))
	const safeCreatedAt = Number.isNaN(createdAtMs) ? Date.now() : createdAtMs

	return {
		id: String(commentId),
		memoryId,
		text: String(row.comment ?? row.commentText ?? '').trim(),
		commentBy: String(row.addedBy ?? row.commentBy ?? 'Guest').trim() || 'Guest',
		createdAtMs: safeCreatedAt,
		timeLabel: formatCommentTime(safeCreatedAt),
	}
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
		addedBy: String(row.memoryAddedBy ?? 'Guest'),
		sizeLabel: (() => {
			const bytes = getDataUrlBytes(String(row.memoryPhotosUrl ?? ''))
			return bytes !== null ? formatFileSize(bytes) : 'Size Unavailable'
		})(),
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

const fileToDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result ?? ''))
		reader.onerror = () => reject(new Error('Failed reading image file.'))
		reader.readAsDataURL(file)
	})

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

function MemoriesPhotos({ onCountChange, onNotice, currentUserEmail }: MemoriesPhotosProps) {
	const [memories, setMemories] = useState<MemoryPhoto[]>([])
	const [totalMemoryCount, setTotalMemoryCount] = useState(0)
	const [caption, setCaption] = useState('')
	const [isLoadingMemories, setIsLoadingMemories] = useState(true)
	const [isLoadingMoreMemories, setIsLoadingMoreMemories] = useState(false)
	const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
	const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null)
	const [editingCaption, setEditingCaption] = useState('')
	const [activeMemoryPhoto, setActiveMemoryPhoto] = useState<MemoryPhoto | null>(null)
	const [selectedUploadInfo, setSelectedUploadInfo] = useState<string[]>([])
	const [commentsByMemoryId, setCommentsByMemoryId] = useState<Record<string, MemoryComment[]>>({})
	const [commentDraftByMemoryId, setCommentDraftByMemoryId] = useState<Record<string, string>>({})
	const [sendingCommentMemoryId, setSendingCommentMemoryId] = useState<string | null>(null)
	const [isCommentTableAvailable, setIsCommentTableAvailable] = useState(true)
	const hasShownCommentTableNoticeRef = useRef(false)

	const notify = (message: string) => {
		onNotice?.(message)
	}

	const markCommentTableUnavailable = (sourceMessage: string) => {
		setIsCommentTableAvailable(false)

		if (!hasShownCommentTableNoticeRef.current) {
			notify(`${sourceMessage}. Ensure table 'memoryComment' has memoryId, comment, addedBy, timestamp.`)
			hasShownCommentTableNoticeRef.current = true
		}
	}

	const isMissingCommentTableError = (message: string) => {
		const normalized = message.toLowerCase()
		return (
			normalized.includes('memorycomment') &&
			(normalized.includes('does not exist') ||
				normalized.includes('relation') ||
				normalized.includes('schema cache'))
		)
	}

	const isMissingCommentColumnError = (message: string) => {
		const normalized = message.toLowerCase()
		return (
			normalized.includes('column') &&
			(normalized.includes('memoryid') ||
				normalized.includes('comment') ||
				normalized.includes('addedby') ||
				normalized.includes('timestamp'))
		)
	}

	const loadCommentsForVisibleMemories = async () => {
		if (!isCommentTableAvailable) {
			return
		}

		const visibleIds = memories.map((photo) => photo.memoryId)
		if (visibleIds.length === 0) {
			setCommentsByMemoryId({})
			return
		}

		const queryIds = visibleIds.map((id) => {
			const asNumber = Number(id)
			return Number.isNaN(asNumber) ? id : asNumber
		})

		let { data, error } = await supabase
			.from('memoryComment')
			.select('*')
			.in('memoryId', queryIds)
			.order('timestamp', { ascending: true })

		if (error && isMissingCommentColumnError(error.message)) {
			const fallback = await supabase
				.from('memoryComment')
				.select('*')
				.order('timestamp', { ascending: true })

			data = fallback.data
			error = fallback.error
		}

		if (error) {
			if (isMissingCommentTableError(error.message)) {
				markCommentTableUnavailable('Comments are not available yet')
				return
			}

			if (isMissingCommentColumnError(error.message)) {
				markCommentTableUnavailable('Comments schema mismatch')
				return
			}

			notify(`Load comments failed: ${error.message}`)
			return
		}

		const grouped: Record<string, MemoryComment[]> = {}
		visibleIds.forEach((id) => {
			grouped[id] = []
		})

		;((data ?? []) as MemoryCommentRow[]).forEach((row, index) => {
			const mapped = mapCommentRow(row, index)
			if (!mapped.memoryId) {
				return
			}

			if (!visibleIds.includes(mapped.memoryId)) {
				return
			}

			if (!grouped[mapped.memoryId]) {
				grouped[mapped.memoryId] = []
			}

			grouped[mapped.memoryId].push(mapped)
		})

		setCommentsByMemoryId(grouped)
	}

	const hiddenMemoriesCount = Math.max(0, totalMemoryCount - memories.length)

	useEffect(() => {
		onCountChange?.(totalMemoryCount)
	}, [onCountChange, totalMemoryCount])

	const loadMemories = async (reset: boolean) => {
		if (reset) {
			setIsLoadingMemories(true)
		} else {
			setIsLoadingMoreMemories(true)
		}

		const startIndex = reset ? 0 : memories.length
		const endIndex = startIndex + DEFAULT_VISIBLE_MEMORIES - 1

		const [{ data, error }, { count, error: countError }] = await Promise.all([
			supabase
				.from('memory')
				.select('*')
				.order('memoryId', { ascending: false })
				.range(startIndex, endIndex),
			supabase
				.from('memory')
				.select('memoryId', { count: 'exact', head: true }),
		])

		if (countError) {
			notify(`Memory count load failed: ${countError.message}`)
		}

		if (error) {
			notify(`Memory load failed: ${error.message}`)
			setIsLoadingMemories(false)
			setIsLoadingMoreMemories(false)
			return
		}

		setTotalMemoryCount(count ?? 0)

		const mapped = ((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto)
		if (reset) {
			setMemories(mapped)
		} else {
			setMemories((prev) => {
				const seen = new Set(prev.map((item) => item.id))
				const next = mapped.filter((item) => !seen.has(item.id))
				return [...prev, ...next]
			})
		}

		setIsLoadingMemories(false)
		setIsLoadingMoreMemories(false)
	}

	useEffect(() => {
		void loadMemories(true)
	}, [])

	useEffect(() => {
		void loadCommentsForVisibleMemories()
	}, [memories, isCommentTableAvailable])

	useEffect(() => {
		const refreshMemories = async () => {
			await loadMemories(true)
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
		if (!isCommentTableAvailable) {
			return
		}

		const commentChannel = supabase
			.channel('memory-comment-realtime-sync')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'memoryComment' },
				() => {
					void loadCommentsForVisibleMemories()
				},
			)
			.subscribe()

		return () => {
			void supabase.removeChannel(commentChannel)
		}
	}, [isCommentTableAvailable, memories])

	const submitComment = async (event: FormEvent<HTMLFormElement>, memoryId: string) => {
		event.preventDefault()

		if (sendingCommentMemoryId === memoryId) {
			return
		}

		const draft = (commentDraftByMemoryId[memoryId] ?? '').trim()
		if (!draft) {
			return
		}

		if (draft.length > MAX_MEMORY_COMMENT_LENGTH) {
			notify(`Comment too long. Max ${MAX_MEMORY_COMMENT_LENGTH} characters.`)
			return
		}

		setSendingCommentMemoryId(memoryId)

		const writer = currentUserEmail?.trim() || 'Guest'
		const memoryIdNumeric = Number(memoryId)
		const payload = {
			memoryId: Number.isNaN(memoryIdNumeric) ? memoryId : memoryIdNumeric,
			comment: draft,
			addedBy: writer,
			timestamp: new Date().toISOString(),
		}

		// Optimistically update UI
		setCommentsByMemoryId((prev) => {
			const newComment: MemoryComment = {
				id: `optimistic-${Date.now()}`,
				memoryId: String(payload.memoryId),
				text: payload.comment,
				commentBy: writer,
				createdAtMs: Date.now(),
				timeLabel: formatCommentTime(Date.now()),
			}
			return {
				...prev,
				[memoryId]: [...(prev[memoryId] ?? []), newComment].slice(-10),
			}
		})

		setCommentDraftByMemoryId((prev) => ({
			...prev,
			[memoryId]: '',
		}))

		// Insert in background
		void (async () => {
			let inserted = await supabase
				.from('memoryComment')
				.insert([payload])
				.select('*')

			if (inserted.error) {
				if (isMissingCommentColumnError(inserted.error.message)) {
					inserted = await supabase
						.from('memoryComment')
						.insert([
							{
								memoryId: payload.memoryId,
								comment: payload.comment,
								addedBy: payload.addedBy,
								timestamp: payload.timestamp,
							},
						])
						.select('*')
				} else {
					inserted = await supabase
						.from('memoryComment')
						.insert([
							{
								memoryId: payload.memoryId,
								comment: payload.comment,
								addedBy: payload.addedBy,
							},
						])
						.select('*')
				}
			}

			if (inserted.error) {
				if (isMissingCommentTableError(inserted.error.message)) {
					markCommentTableUnavailable('Comments are not available yet')
				} else if (isMissingCommentColumnError(inserted.error.message)) {
					markCommentTableUnavailable('Comments schema mismatch')
				} else {
					notify(`Post comment failed: ${inserted.error.message}`)
				}
				setSendingCommentMemoryId(null)
				return
			}

			// Replace optimistic comment with real one
			await loadCommentsForVisibleMemories()
			setSendingCommentMemoryId(null)
		})()
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

		if (imageFiles.length > MAX_FILES_PER_UPLOAD) {
			notify(`Max ${MAX_FILES_PER_UPLOAD} images per upload to keep app stable.`)
			event.target.value = ''
			return
		}

		const tooLarge = imageFiles.filter((file) => file.size > MAX_SINGLE_FILE_SIZE_BYTES)
		if (tooLarge.length > 0) {
			notify(
				`These files are too large (max ${formatFileSize(MAX_SINGLE_FILE_SIZE_BYTES)} each): ${tooLarge
					.map((file) => file.name)
					.join(', ')}`,
			)
			event.target.value = ''
			return
		}

		setSelectedUploadInfo(
			imageFiles.map((file) => `${file.name} (${formatFileSize(file.size)})`),
		)

		const uploadRows = await Promise.all(
			imageFiles.map(async (file) => ({
				memoryName: caption.trim() || file.name.replace(/\.[^/.]+$/, ''),
				memoryPhotosUrl: await fileToDataUrl(file),
				memoryAddedBy: currentUserEmail?.trim() || 'Guest',
			})),
		)

		let { data, error } = await supabase
			.from('memory')
			.insert(uploadRows)
			.select('*')

		if (error) {
			const fallbackRows = uploadRows.map(({ memoryName, memoryPhotosUrl }) => ({
				memoryName,
				memoryPhotosUrl,
			}))

			const fallbackInsert = await supabase
				.from('memory')
				.insert(fallbackRows)
				.select('*')

			data = fallbackInsert.data
			error = fallbackInsert.error
		}

		if (error) {
			notify(`Create memory failed: ${error.message}`)
			event.target.value = ''
			return
		}

		const uploaderEmail = currentUserEmail?.trim() || 'Guest'
		const insertedMemories = ((data ?? []) as MemoryRow[]).map((row, index) => {
			const mapped = mapMemoryRowToPhoto(row, index)
			if (!row.memoryAddedBy) {
				return { ...mapped, addedBy: uploaderEmail }
			}

			return mapped
		})

		setMemories((prev) => {
			const dedupedPrev = prev.filter(
				(existing) => !insertedMemories.some((inserted) => inserted.id === existing.id),
			)
			const merged = sortMemoriesByNewest([...insertedMemories, ...dedupedPrev])
			return merged.slice(0, Math.max(DEFAULT_VISIBLE_MEMORIES, prev.length))
		})
		setTotalMemoryCount((prev) => prev + insertedMemories.length)
		setCaption('')
		notify(
			`Memory photo saved to Database (${imageFiles.length} file${imageFiles.length > 1 ? 's' : ''}).`,
		)

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

		setSavingMemoryId(id)

		try {
			const addedBy = target.addedBy || currentUserEmail?.trim() || 'Guest'
			const replacementInsert = await supabase
				.from('memory')
				.insert([
					{
						memoryName: nextCaption,
						memoryPhotosUrl: target.src,
						memoryAddedBy: addedBy,
					},
				])
				.select('*')
				.single()

			const safeReplacementInsert = replacementInsert.error
				? await supabase
						.from('memory')
						.insert([
							{
								memoryName: nextCaption,
								memoryPhotosUrl: target.src,
							},
						])
						.select('*')
						.single()
				: replacementInsert

			if (safeReplacementInsert.error || !safeReplacementInsert.data) {
				notify(
					`Edit memory failed: ${safeReplacementInsert.error?.message || 'Insert replacement failed.'}`,
				)
				return
			}

			const replacementRaw = safeReplacementInsert.data as MemoryRow
			const replacementPhoto = mapMemoryRowToPhoto(replacementRaw, 0)
			const replacementWithOwner = !replacementRaw.memoryAddedBy
				? { ...replacementPhoto, addedBy }
				: replacementPhoto
			const numericId = Number(target.memoryId)

			    const deleteOld = Number.isNaN(numericId)
				? await supabase
					.from('memory')
					.delete()
					.eq('memoryId', target.memoryId)
					.select('memoryId')
				: await supabase
					.from('memory')
					.delete()
					.eq('memoryId', numericId)
					.select('memoryId')

			if (deleteOld.error || (deleteOld.data ?? []).length === 0) {
				const fallbackDeleteOld = await supabase
					.from('memory')
					.delete()
					.eq('memoryName', target.caption)
					.eq('memoryPhotosUrl', target.src)
					.select('memoryId')

				if (fallbackDeleteOld.error || (fallbackDeleteOld.data ?? []).length === 0) {
					notify(
						'Title changed, but old memory row could not be removed. Please delete the duplicate old row manually.',
					)
				}
			}

			setMemories((prev) =>
				sortMemoriesByNewest([
					replacementWithOwner,
					...prev.filter((photo) => photo.id !== id),
				]),
			)

			setActiveMemoryPhoto((prev) => {
				if (!prev || prev.id !== id) {
					return prev
				}

				return replacementWithOwner
			})

			notify('Memory title updated Database.')

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
				notify(
					`Delete memory failed: ${deleteError} | fallback: ${fallbackDelete.error.message}`,
				)
				return
			}

			if ((fallbackDelete.data ?? []).length > 0) {
				deletedCommitted = true
			}
		}

		if (!deletedCommitted) {
			notify(
				'Delete was not committed in Database. Check RLS DELETE policy for table memoryId.',
			)
			return
		}

		setMemories((prev) => prev.filter((photo) => photo.id !== id))
		setCommentsByMemoryId((prev) => {
			const next = { ...prev }
			delete next[target.memoryId]
			return next
		})
		setCommentDraftByMemoryId((prev) => {
			const next = { ...prev }
			delete next[target.memoryId]
			return next
		})
		setTotalMemoryCount((prev) => Math.max(0, prev - 1))
		notify('Memory deleted from Database.')

		if (editingMemoryId === id) {
			cancelEditMemory()
		}
	}

	return (
		<>
			<div className="panel memory-panel">
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
						<input type="file" accept="image/*" multiple onChange={handlePhotoUpload} />
						<small className="upload-rules">
							Max {MAX_FILES_PER_UPLOAD} images per upload, max {formatFileSize(MAX_SINGLE_FILE_SIZE_BYTES)} each.
						</small>
						{selectedUploadInfo.length > 0 ? (
							<span className="upload-selected-info">
								{selectedUploadInfo.slice(0, 3).join(' | ')}
								{selectedUploadInfo.length > 3
									? ` | +${selectedUploadInfo.length - 3} more`
									: ''}
							</span>
						) : null}
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
											{` · added by ${photo.addedBy}`}
										</small>
										<div className="memory-actions">
											<button type="button" onClick={() => startEditMemory(photo)}>
												Edit
											</button>
											<button
												type="button"
												className="danger"
												onClick={() => deleteMemory(photo.id)}
											>
												Delete
											</button>
											<span className="memory-size-badge">{photo.sizeLabel}</span>
										</div>
										<div className="memory-comments">
											<p className="memory-comments-title">Comments</p>
											<ul className="memory-comment-list">
												{(commentsByMemoryId[photo.memoryId] ?? []).map((comment) => (
													<li key={comment.id}>
														<strong>{comment.commentBy}</strong>
														<span>{comment.text}</span>
														<small>{comment.timeLabel}</small>
													</li>
												))}
												{(commentsByMemoryId[photo.memoryId] ?? []).length === 0 ? (
													<li className="memory-comment-empty">No comments yet.</li>
												) : null}
											</ul>
											<form
												className="memory-comment-form"
												onSubmit={(event) => void submitComment(event, photo.memoryId)}
											>
												<input
													type="text"
													placeholder="Write a comment..."
													maxLength={MAX_MEMORY_COMMENT_LENGTH}
													value={commentDraftByMemoryId[photo.memoryId] ?? ''}
													onChange={(event) =>
														setCommentDraftByMemoryId((prev) => ({
															...prev,
															[photo.memoryId]: event.target.value,
														}))
													}
													disabled={(commentsByMemoryId[photo.memoryId]?.length ?? 0) >= 10}
												/>
												<button
													type="submit"
													disabled={sendingCommentMemoryId === photo.memoryId || (commentsByMemoryId[photo.memoryId]?.length ?? 0) >= 10}
												>
													{sendingCommentMemoryId === photo.memoryId ? 'Posting...' : 'Post'}
												</button>
												{(commentsByMemoryId[photo.memoryId]?.length ?? 0) >= 10 ? (
													<small className="memory-comment-limit">Max 10 comments reached for this photo.</small>
												) : null}
											</form>
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

				{!isLoadingMemories && totalMemoryCount > DEFAULT_VISIBLE_MEMORIES ? (
					<div className="memory-toggle-row">
						{hiddenMemoriesCount > 0 ? (
							<button
								type="button"
								className="secondary memory-toggle-btn"
								onClick={() => void loadMemories(false)}
								disabled={isLoadingMoreMemories}
							>
								{isLoadingMoreMemories
									? 'Loading more...'
									: `Show ${Math.min(DEFAULT_VISIBLE_MEMORIES, hiddenMemoriesCount)} more photo`}
								{Math.min(DEFAULT_VISIBLE_MEMORIES, hiddenMemoriesCount) > 1 ? 's' : ''}
							</button>
						) : null}
						{memories.length > DEFAULT_VISIBLE_MEMORIES ? (
							<button
								type="button"
								className="secondary memory-toggle-btn"
								onClick={() => setMemories((prev) => prev.slice(0, DEFAULT_VISIBLE_MEMORIES))}
							>
								Show less photos
							</button>
						) : null}
					</div>
				) : null}
			</div>

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
							{` · added by ${activeMemoryPhoto.addedBy}`}
						</p>
					</div>
				</div>
			) : null}
		</>
	)
}

export default MemoriesPhotos
