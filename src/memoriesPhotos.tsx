import { useEffect, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
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
	const [caption, setCaption] = useState('')
	const [isLoadingMemories, setIsLoadingMemories] = useState(true)
	const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
	const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null)
	const [editingCaption, setEditingCaption] = useState('')
	const [activeMemoryPhoto, setActiveMemoryPhoto] = useState<MemoryPhoto | null>(null)
	const [selectedUploadInfo, setSelectedUploadInfo] = useState<string[]>([])

	const notify = (message: string) => {
		onNotice?.(message)
	}

	useEffect(() => {
		onCountChange?.(memories.length)
	}, [memories.length, onCountChange])

	useEffect(() => {
		const loadMemories = async () => {
			setIsLoadingMemories(true)

			const { data, error } = await supabase
				.from('memoryId')
				.select('*')

			if (error) {
				notify(`Memory load failed: ${error.message}`)
				setIsLoadingMemories(false)
				return
			}

			const mapped = sortMemoriesByNewest(
				((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto),
			)

			setMemories(mapped)
			setIsLoadingMemories(false)
		}

		void loadMemories()
	}, [])

	useEffect(() => {
		const refreshMemories = async () => {
			const { data, error } = await supabase
				.from('memoryId')
				.select('*')

			if (error) {
				notify(`Realtime memory sync failed: ${error.message}`)
				return
			}

			setMemories(
				sortMemoriesByNewest(((data ?? []) as MemoryRow[]).map(mapMemoryRowToPhoto)),
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
			.from('memoryId')
			.insert(uploadRows)
			.select('*')

		if (error) {
			const fallbackRows = uploadRows.map(({ memoryName, memoryPhotosUrl }) => ({
				memoryName,
				memoryPhotosUrl,
			}))

			const fallbackInsert = await supabase
				.from('memoryId')
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

		setMemories((prev) => sortMemoriesByNewest([...insertedMemories, ...prev]))
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
				.from('memoryId')
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
						.from('memoryId')
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
		notify('Memory deleted from Database.')

		if (editingMemoryId === id) {
			cancelEditMemory()
		}
	}

	return (
		<>
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
