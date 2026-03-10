import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { supabase } from './components/supaBaseClient.ts'

type ScheduleItem = {
	id: string
	scheduleId: string
	title: string
	date: string
	time: string
	note: string
	addedBy: string
}

type ScheduleHistoryItem = {
	id: string
	title: string
	date: string
	time: string
	note: string
	addedBy: string
	action: 'completed'
}

type ScheduleRow = {
	scheduleId: string
	scheduleName: string
	scheduleTime: string
	scheduleNote: string | null
	scheduleAddedBy?: string | null
	scheduleHistory?: boolean | string | number | null
}

type ScheduleProps = {
	onCountChange?: Dispatch<SetStateAction<number>>
	onNotice?: Dispatch<SetStateAction<string>>
	currentUserEmail?: string | null
}

const CLEAR_HISTORY_OWNER_EMAIL = String(
	import.meta.env.VITE_CLEAR_CHAT_OWNER_EMAIL ?? 'fabian.ardana@gmail.com',
)
const CLEAR_HISTORY_DEVELOPER_PASSWORD = 'Bian2345#'

const normalizeEmail = (value: string) => value.trim().toLowerCase()

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

const isInScheduleHistory = (value: unknown) => {
	if (typeof value === 'boolean') {
		return value
	}

	if (typeof value === 'number') {
		return value === 1
	}

	const normalized = String(value ?? '')
		.trim()
		.toLowerCase()

	return ['1', 'true', 'done', 'completed', 'history'].includes(normalized)
}

const mapScheduleRowToItem = (row: ScheduleRow, index: number): ScheduleItem => {
	const scheduleId = String(row.scheduleId ?? `s-${index}`)
	const when = splitScheduleTime(String(row.scheduleTime ?? ''))

	return {
		id: scheduleId,
		scheduleId,
		title: String(row.scheduleName ?? 'Untitled'),
		date: when.date,
		time: when.time,
		note: String(row.scheduleNote ?? ''),
		addedBy: String(row.scheduleAddedBy ?? 'Unknown'),
	}
}

const mapScheduleRowToHistory = (
	row: ScheduleRow,
	index: number,
): ScheduleHistoryItem => {
	const mapped = mapScheduleRowToItem(row, index)

	return {
		id: `history-${mapped.scheduleId}`,
		title: mapped.title,
		date: mapped.date,
		time: mapped.time,
		note: mapped.note,
		addedBy: mapped.addedBy,
		action: 'completed',
	}
}

const mapScheduleItemToHistory = (item: ScheduleItem): ScheduleHistoryItem => ({
	id: `history-${item.scheduleId}`,
	title: item.title,
	date: item.date,
	time: item.time,
	note: item.note,
	addedBy: item.addedBy,
	action: 'completed',
})

function Schedule({ onCountChange, onNotice, currentUserEmail }: ScheduleProps) {
	const [schedules, setSchedules] = useState<ScheduleItem[]>([])
	const [scheduleHistory, setScheduleHistory] = useState<ScheduleHistoryItem[]>([])
	const [title, setTitle] = useState('')
	const [date, setDate] = useState('')
	const [time, setTime] = useState('')
	const [note, setNote] = useState('')
	const [isLoadingSchedule, setIsLoadingSchedule] = useState(true)
	const [isClearingHistory, setIsClearingHistory] = useState(false)

	const canClearHistory = useMemo(
		() => normalizeEmail(currentUserEmail ?? '') === normalizeEmail(CLEAR_HISTORY_OWNER_EMAIL),
		[currentUserEmail],
	)

	const refreshSchedules = async () => {
		setIsLoadingSchedule(true)

		const { data, error } = await supabase.from('schedule').select('*')

		if (error) {
			onNotice?.(`Schedule load failed: ${error.message}`)
			setIsLoadingSchedule(false)
			return
		}

		const rows = (data ?? []) as ScheduleRow[]
		const active = rows
			.filter((row) => !isInScheduleHistory(row.scheduleHistory))
			.map(mapScheduleRowToItem)
			.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))

		const history = rows
			.filter((row) => isInScheduleHistory(row.scheduleHistory))
			.map(mapScheduleRowToHistory)
			.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

		setSchedules(active)
		setScheduleHistory(history)
		setIsLoadingSchedule(false)
	}

	useEffect(() => {
		onCountChange?.(schedules.length)
	}, [onCountChange, schedules.length])

	useEffect(() => {
		void refreshSchedules()
	}, [])

	const clearScheduleHistory = async () => {
		if (isClearingHistory) {
			return
		}

		if (!canClearHistory) {
			onNotice?.('Only owner account can clear schedule history.')
			return
		}

		if (scheduleHistory.length === 0) {
			onNotice?.('Schedule history is already empty.')
			return
		}

		const clearPassword = window.prompt('Enter developer clear password:')
		if (!clearPassword) {
			return
		}

		if (clearPassword !== CLEAR_HISTORY_DEVELOPER_PASSWORD) {
			onNotice?.('Clear history password is incorrect.')
			return
		}

		const confirmed = window.confirm(
			'Delete all completed schedule history for everyone? This cannot be undone.',
		)

		if (!confirmed) {
			return
		}

		setIsClearingHistory(true)

		try {
			const { data, error } = await supabase.from('schedule').select('*')

			if (error) {
				onNotice?.(`Clear schedule history failed: ${error.message}`)
				return
			}

			const historyRows = ((data ?? []) as ScheduleRow[]).filter((row) =>
				isInScheduleHistory(row.scheduleHistory),
			)

			if (historyRows.length === 0) {
				setScheduleHistory([])
				onNotice?.('Schedule history is already empty.')
				return
			}

			let deletedCount = 0
			let lastError = ''

			for (const row of historyRows) {
				const rawId = String(row.scheduleId ?? '').trim()
				const numericId = Number(rawId)

				const primaryDelete = Number.isNaN(numericId)
					? await supabase.from('schedule').delete().eq('scheduleId', rawId)
					: await supabase.from('schedule').delete().eq('scheduleId', numericId)

				if (!primaryDelete.error) {
					deletedCount += 1
					continue
				}

				const fallbackBase = supabase
					.from('schedule')
					.delete()
					.eq('scheduleName', String(row.scheduleName ?? ''))
					.eq('scheduleTime', String(row.scheduleTime ?? ''))

				const fallbackDelete = row.scheduleNote
					? await fallbackBase.eq('scheduleNote', String(row.scheduleNote))
					: await fallbackBase.is('scheduleNote', null)

				if (!fallbackDelete.error) {
					deletedCount += 1
					continue
				}

				lastError = fallbackDelete.error.message
			}

			if (deletedCount === 0) {
				onNotice?.(`Clear schedule history failed: ${lastError || 'No rows deleted.'}`)
				return
			}

			await refreshSchedules()
			onNotice?.(`Schedule history cleared (${deletedCount} item${deletedCount > 1 ? 's' : ''}).`)
		} finally {
			setIsClearingHistory(false)
		}
	}

	const handleAddSchedule = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		const trimmedTitle = title.trim()
		const trimmedNote = note.trim()

		if (!trimmedTitle || !time) {
			return
		}

		const scheduleTimeValue = date ? `${date} ${time}` : time
		const addedBy = currentUserEmail?.trim() || 'Guest'
		const payload = {
			scheduleName: trimmedTitle,
			scheduleTime: scheduleTimeValue,
			scheduleNote: trimmedNote,
		}
		const payloadWithAddedBy = {
			...payload,
			scheduleAddedBy: addedBy,
		}

		let inserted: ScheduleRow | null = null
		let lastError = ''

		let insertTry = await supabase
			.from('schedule')
			.insert([payloadWithAddedBy])
			.select('*')
			.single()

		if (insertTry.error) {
			insertTry = await supabase.from('schedule').insert([payload]).select('*').single()
		}

		if (!insertTry.error && insertTry.data) {
			inserted = insertTry.data as unknown as ScheduleRow
		} else {
			lastError = insertTry.error?.message ?? 'Unknown error'
			const bigintSafeScheduleId = Date.now() * 1000 + Math.floor(Math.random() * 1000)
			let fallbackWithId = await supabase
				.from('schedule')
				.insert([{ ...payloadWithAddedBy, scheduleId: bigintSafeScheduleId }])
				.select('*')
				.single()

			if (fallbackWithId.error) {
				fallbackWithId = await supabase
					.from('schedule')
					.insert([{ ...payload, scheduleId: bigintSafeScheduleId }])
					.select('*')
					.single()
			}

			if (!fallbackWithId.error && fallbackWithId.data) {
				inserted = fallbackWithId.data as unknown as ScheduleRow
			} else {
				lastError = fallbackWithId.error?.message ?? lastError
			}
		}

		if (!inserted) {
			onNotice?.(`Create schedule failed: ${lastError}`)
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
				addedBy: String(inserted.scheduleAddedBy ?? addedBy),
			},
			...prev,
		])
		onNotice?.('Schedule added Database.')
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

		const scheduleIdCandidates: Array<string | number> = [target.scheduleId]
		const numericScheduleId = Number(target.scheduleId)

		if (!Number.isNaN(numericScheduleId)) {
			scheduleIdCandidates.push(numericScheduleId)
		}

		const historyValueCandidates: Array<boolean | string | number> = [true, 'completed', 1]

		let updateSucceeded = false
		let verifiedMovedToHistory = false
		let lastUpdateError = 'Unknown update error'
		const targetTime = `${target.date} ${target.time}`
		const targetNote = target.note.trim()

		const verifyMove = async () => {
			const { data: verifyRows, error: verifyError } = await supabase
				.from('schedule')
				.select('*')

			if (verifyError) {
				lastUpdateError = `Update maybe applied but verify failed: ${verifyError.message}`
				return false
			}

			const rows = (verifyRows ?? []) as ScheduleRow[]
			const exactById = rows.find(
				(row) => String(row.scheduleId ?? '') === String(target.scheduleId),
			)

			if (exactById) {
				return isInScheduleHistory(exactById.scheduleHistory)
			}

			const exactByContent = rows.find(
				(row) =>
					String(row.scheduleName ?? '') === target.title &&
					String(row.scheduleTime ?? '') === targetTime &&
					String(row.scheduleNote ?? '') === target.note,
			)

			if (!exactByContent) {
				lastUpdateError = 'Schedule row not found during verification.'
				return false
			}

			return isInScheduleHistory(exactByContent.scheduleHistory)
		}

		const tryUpdateByContent = async (historyValue: boolean | string | number) => {
			const baseUpdate = supabase
				.from('schedule')
				.update({ scheduleHistory: historyValue })
				.eq('scheduleName', target.title)
				.eq('scheduleTime', targetTime)

			const withNoteFilter = targetNote
				? baseUpdate.eq('scheduleNote', targetNote)
				: baseUpdate.is('scheduleNote', null)

			const { error } = await withNoteFilter

			if (error) {
				lastUpdateError = error.message
				return false
			}

			return true
		}

		for (const historyValue of historyValueCandidates) {
			for (const scheduleIdCandidate of scheduleIdCandidates) {
				const { error } = await supabase
					.from('schedule')
					.update({ scheduleHistory: historyValue })
					.eq('scheduleId', scheduleIdCandidate)

				if (error) {
					lastUpdateError = error.message
					continue
				}

				updateSucceeded = true
				verifiedMovedToHistory = await verifyMove()

				if (verifiedMovedToHistory) {
					break
				}

				lastUpdateError =
					'Update request sent but scheduleHistory was not persisted in database.'
			}

			if (!verifiedMovedToHistory) {
				const updatedByContent = await tryUpdateByContent(historyValue)

				if (updatedByContent) {
					updateSucceeded = true
					verifiedMovedToHistory = await verifyMove()
				}

				if (!verifiedMovedToHistory) {
					lastUpdateError =
						'Update request sent but scheduleHistory was not persisted in database. Check update policy/column permissions for table schedule.'
				}
			}

			if (verifiedMovedToHistory) {
				break
			}
		}

		if (!verifiedMovedToHistory) {
			if (!updateSucceeded && !lastUpdateError) {
				lastUpdateError = 'No rows matched when trying to mark this schedule as done.'
			}

			onNotice?.(`Move to history failed: ${lastUpdateError}`)
			return
		}

		setSchedules((prev) => prev.filter((item) => item.id !== id))
		setScheduleHistory((prev) => [mapScheduleItemToHistory(target), ...prev])
		onNotice?.('Schedule moved to history.')
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
			onNotice?.(`Delete schedule failed: ${error.message}`)
			return
		}

		setSchedules((prev) => prev.filter((item) => item.id !== id))
	}

	return (
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
								{` · added by ${item.addedBy}`}
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

			<div className="history-wrap">
				<div className="history-head">
					<h3>Schedule History</h3>
					{canClearHistory ? (
						<button
							type="button"
							className="danger history-clear-btn"
							onClick={clearScheduleHistory}
							disabled={isClearingHistory || isLoadingSchedule}
						>
							{isClearingHistory ? 'Clearing...' : 'Clear History'}
						</button>
					) : null}
				</div>
				<ul className="schedule-history-list">
					{scheduleHistory.map((entry) => (
						<li key={entry.id}>
							<div>
								<p>{entry.title}</p>
								<small>
									{entry.date} · {entry.time}
									{entry.note ? ` · ${entry.note}` : ''}
									{` · added by ${entry.addedBy}`}
								</small>
							</div>
							<span className="history-badge completed">{entry.action}</span>
						</li>
					))}
					{scheduleHistory.length === 0 ? (
						<li className="history-empty">No history yet. Complete a schedule first.</li>
					) : null}
				</ul>
			</div>
		</div>
	)
}

export default Schedule
