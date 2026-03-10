import { supabase } from '../components/supaBaseClient.ts'
import type { ActivityItem, MemoryActivityRow, ScheduleActivityRow } from '../types/activity'

const MIN_REASONABLE_TIMESTAMP = Date.UTC(2020, 0, 1)
const MAX_REASONABLE_TIMESTAMP = Date.now() + 1000 * 60 * 60 * 24 * 365
const UNKNOWN_TIME_LABEL = 'Date unavailable'
const WIB_TIMEZONE = 'Asia/Jakarta'

const isHistory = (value: unknown) => {
	if (typeof value === 'boolean') {
		return value
	}

	if (typeof value === 'number') {
		return value === 1
	}

	const normalized = String(value ?? '').trim().toLowerCase()
	return ['1', 'true', 'done', 'completed', 'history'].includes(normalized)
}

const parseTimestamp = (value: unknown) => {
	const text = String(value ?? '').trim()

	if (!text) {
		return null
	}

	// Ignore time-only values such as "19:30" that can parse to 1970-era dates.
	if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
		return null
	}

	const fromDate = Date.parse(text)
	if (!Number.isNaN(fromDate) && fromDate >= MIN_REASONABLE_TIMESTAMP && fromDate <= MAX_REASONABLE_TIMESTAMP) {
		return fromDate
	}

	const asNumber = Number(text)
	if (!Number.isNaN(asNumber)) {
		// Support epoch milliseconds.
		if (asNumber >= MIN_REASONABLE_TIMESTAMP && asNumber <= MAX_REASONABLE_TIMESTAMP) {
			return asNumber
		}

		// Support epoch seconds.
		const asMs = asNumber * 1000
		if (asMs >= MIN_REASONABLE_TIMESTAMP && asMs <= MAX_REASONABLE_TIMESTAMP) {
			return asMs
		}
	}

	return null
}

const formatTimeLabel = (timestamp: number | null) => {
	if (timestamp === null) {
		return UNKNOWN_TIME_LABEL
	}

	const diffMs = Date.now() - timestamp
	const diffMin = Math.floor(diffMs / 60000)

	if (diffMin < 1) {
		return 'less than 1 min ago'
	}

	if (diffMin < 60) {
		return `${diffMin}m ago`
	}

	const diffHours = Math.floor(diffMin / 60)
	if (diffHours < 24) {
		return `${diffHours}h ago`
	}

	const diffDays = Math.floor(diffHours / 24)
	if (diffDays < 8) {
		return `${diffDays}d ago`
	}

	return new Intl.DateTimeFormat('id-ID', {
		timeZone: WIB_TIMEZONE,
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(new Date(timestamp))
}

const scheduleTimestamp = (row: ScheduleActivityRow) => {
	const fromScheduleTimestamp = parseTimestamp(row.scheduleTimestamp)
	if (fromScheduleTimestamp) {
		return fromScheduleTimestamp
	}

	const explicit = parseTimestamp(row.createdAt ?? row.created_at)
	if (explicit) {
		return explicit
	}

	const fallback = parseTimestamp(row.scheduleTime)
	if (fallback) {
		return fallback
	}

	const fromId = parseTimestamp(row.scheduleId)
	if (fromId) {
		return fromId
	}

	return null
}

const memoryTimestamp = (row: MemoryActivityRow) => {
	const fromMemoryTimestamp = parseTimestamp(row.memoryTimestamp)
	if (fromMemoryTimestamp) {
		return fromMemoryTimestamp
	}

	const explicit = parseTimestamp(row.createdAt ?? row.created_at)
	if (explicit) {
		return explicit
	}

	const fromId = parseTimestamp(row.memoryId)
	if (fromId) {
		return fromId
	}

	return null
}

const mapScheduleActivities = (rows: ScheduleActivityRow[]): ActivityItem[] =>
	rows.map((row) => {
		const parsedTimestamp = scheduleTimestamp(row)
		const timestamp = parsedTimestamp ?? 0
		const completed = isHistory(row.scheduleHistory)
		const note = String(row.scheduleNote ?? '').trim()

		return {
			id: `schedule-${row.scheduleId}`,
			type: completed ? 'schedule-completed' : 'schedule-added',
			title: String(row.scheduleName ?? 'Untitled Schedule'),
			detail: note || 'No additional note',
			addedBy: String(row.scheduleAddedBy ?? 'Unknown'),
			timestamp,
			timeLabel: formatTimeLabel(parsedTimestamp),
		}
	})

const mapMemoryActivities = (rows: MemoryActivityRow[]): ActivityItem[] =>
	rows.map((row) => {
		const parsedTimestamp = memoryTimestamp(row)
		const timestamp = parsedTimestamp ?? 0

		return {
			id: `memory-${row.memoryId}`,
			type: 'memory-added',
			title: String(row.memoryName ?? 'Untitled Memory'),
			detail: 'Photo uploaded',
			addedBy: String(row.memoryAddedBy ?? 'Guest'),
			timestamp,
			timeLabel: formatTimeLabel(parsedTimestamp),
		}
	})

export const loadActivityFeed = async () => {
	const [scheduleQuery, memoryQuery] = await Promise.all([
		supabase.from('schedule').select('*'),
		supabase.from('memoryId').select('*'),
	])

	if (scheduleQuery.error) {
		throw new Error(`Activity schedule load failed: ${scheduleQuery.error.message}`)
	}

	if (memoryQuery.error) {
		throw new Error(`Activity memory load failed: ${memoryQuery.error.message}`)
	}

	const scheduleRows = (scheduleQuery.data ?? []) as ScheduleActivityRow[]
	const memoryRows = (memoryQuery.data ?? []) as MemoryActivityRow[]

	return [...mapScheduleActivities(scheduleRows), ...mapMemoryActivities(memoryRows)].sort(
		(a, b) => b.timestamp - a.timestamp,
	)
}
