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
	currentUserEmail?: string | null
}

const MAX_FILES_PER_UPLOAD = 8
const MAX_SINGLE_FILE_SIZE_BYTES = 5 * 1024 * 1024
const DEFAULT_VISIBLE_MEMORIES = 4
// ...existing code...

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

function MemoriesPhotos({ onCountChange, currentUserEmail }: MemoriesPhotosProps) {
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
	 // ...existing code...
	const VIEWED_MEM_KEY = 'viewedMemoryIds'
	const [viewedMemoryIds, setViewedMemoryIds] = useState<string[]>(() => {
		try {
			const stored = localStorage.getItem(VIEWED_MEM_KEY)
			return stored ? JSON.parse(stored) : []
		} catch {
			return []
		}
	})

	useEffect(() => {
		try {
			localStorage.setItem(VIEWED_MEM_KEY, JSON.stringify(viewedMemoryIds))
		} catch {}
	}, [viewedMemoryIds])

	// Removed comment-related functions and logic

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
			 // Optionally handle error
		 }

		 if (error) {
			 // Optionally handle error
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

	// Removed comment-related useEffect

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

	 // ...existing code...

	// Removed submitComment function

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
			 event.target.value = ''
			 return
		 }

		const tooLarge = imageFiles.filter((file) => file.size > MAX_SINGLE_FILE_SIZE_BYTES)
		 if (tooLarge.length > 0) {
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
		 // ...existing code...

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
				 // Optionally handle error
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
					.eq('id', target.id)
					.select('memoryId')
				: await supabase
					.from('memory')
					.delete()
					.eq('id', numericId)
					.select('memoryId')

			if (deleteOld.error || (deleteOld.data ?? []).length === 0) {
				const fallbackDeleteOld = await supabase
					.from('memory')
					.delete()
					.eq('memoryName', target.caption)
					.eq('memoryPhotosUrl', target.src)
					.select('memoryId')

				 if (fallbackDeleteOld.error || (fallbackDeleteOld.data ?? []).length === 0) {
					 // Optionally handle error
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

			 // ...existing code...

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

		 // ...existing code...
		let deletedCommitted = false;
		const numericId = Number(target.memoryId);

		 // ...existing code...

		// Now delete the memory row
		const primaryDelete = Number.isNaN(numericId)
			? await supabase
				.from('memory')
				.delete()
				.eq('memoryId', target.memoryId)
				.select('memoryId')
			: await supabase
				.from('memory')
				.delete()
				.eq('memoryId', numericId)
				.select('memoryId');

		if (primaryDelete.error) {
			// Optionally handle error
		} else if ((primaryDelete.data ?? []).length > 0) {
			deletedCommitted = true;
		}

		 if (!deletedCommitted) {
			 const fallbackDelete = await supabase
				 .from('memory')
				 .delete()
				 .eq('memoryName', target.caption)
				 .eq('memoryPhotosUrl', target.src)
				 .select('memoryId');
			 if (fallbackDelete.error) {
				 // Optionally handle error
				 return;
			 }
			 if ((fallbackDelete.data ?? []).length > 0) {
				 deletedCommitted = true;
			 }
		 }

		 if (!deletedCommitted) {
			 // Optionally handle error
			 return;
		 }

		 setMemories((prev) => prev.filter((photo) => photo.id !== id))
		 setTotalMemoryCount((prev) => Math.max(0, prev - 1))
		 // ...existing code...

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
										<div style={{ position: 'relative', minHeight: 0 }}>
											<button
												type="button"
												className="memory-msg-btn"
												style={{
													position: 'absolute',
													top: 0,
													right: 0,
													background: 'transparent',
													border: 'none',
													cursor: 'pointer',
													padding: 0,
													zIndex: 2,
												}}
												onClick={() => {
													setActiveMemoryPhoto(photo);
													setViewedMemoryIds((prev) => prev.includes(photo.memoryId) ? prev : [...prev, photo.memoryId]);
												}}
											>
												
					
											</button>
											<p style={{ marginRight: 28 }}>{photo.caption}</p>
										</div>
										<small>
											{photo.date}
											{photo.uploaded ? ' · uploaded' : ''}
											{` · added by ${photo.addedBy}`}
										</small>
										<div className="memory-actions">
											<button
												type="button"
												style={{
													background: '#4b6e47',
													border: 'none',
													color: '#fff',
													fontSize: '0.88em',
													fontWeight: 600,
													padding: '2px 10px',
													borderRadius: '10px',
													cursor: 'pointer',
													minWidth: '40px',
													marginRight: '0px',
													boxShadow: '0 2px 8px rgba(46,125,50,0.13)',
													letterSpacing: '0.01em',
												}}
												onClick={() => startEditMemory(photo)}
											>
												Edit
											</button>
											<button
												type="button"
												style={{
													background: '#4b6e47',
													border: 'none',
													color: '#fff',
													fontSize: '0.75em',
													fontWeight: 600,
													padding: '2px 8px',
													borderRadius: '10px',
													cursor: 'pointer',
													minWidth: '40px',
													boxShadow: '0 2px 8px rgba(46,125,50,0.13)',
													letterSpacing: '0.01em',
												}}
												onClick={() => deleteMemory(photo.id)}
											>
												Delete
											</button>
											<span
												className="memory-size-badge"
												style={{
													display: 'inline-block',
													fontSize: '0.75em',
													background: 'rgba(205,237,194,0.18)',
													color: '#2e7d32',
													borderRadius: '8px',
													padding: '2px 8px',
													marginLeft: 'auto',
													fontWeight: 500,
													minWidth: '40px',
													float: 'right',
												}}
											>
												{photo.sizeLabel}
											</span>
										</div>
										{/* Comments hidden from main card, shown in overlay/modal */}
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
					className="hero-lightbox memory-modal-overlay"
					onClick={() => setActiveMemoryPhoto(null)}
					role="dialog"
					aria-modal="true"
				>
					<div
						className="hero-lightbox-card memory-lightbox-card memory-modal-card"
						onClick={(event) => event.stopPropagation()}
						style={{ width: 'min(900px, 90vw)', maxWidth: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
					>
						<button
							type="button"
							className="hero-lightbox-close memory-modal-close"
							onClick={() => setActiveMemoryPhoto(null)}
							style={{ alignSelf: 'flex-end', marginBottom: 8, background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontWeight: 600, cursor: 'pointer' }}
						>
							Close
						</button>
						<div style={{ width: '100%' }}>
							<SmartImage src={activeMemoryPhoto.src} alt={activeMemoryPhoto.caption} />
						</div>
						<p style={{ margin: '16px 0 8px', fontWeight: 600, fontSize: '1.1em', textAlign: 'center', color: '#222' }}>
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