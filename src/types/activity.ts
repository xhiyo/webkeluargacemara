export type ActivityType = 'schedule-added' | 'schedule-completed' | 'memory-added'

export type ActivityItem = {
	id: string
	type: ActivityType
	title: string
	detail: string
	addedBy: string
	timestamp: number
	timeLabel: string
}

export type ScheduleActivityRow = {
	scheduleId: string | number
	scheduleName: string | null
	scheduleTime: string | null
	scheduleNote: string | null
	scheduleAddedBy?: string | null
	scheduleHistory?: boolean | string | number | null
	scheduleTimestamp?: string | number | null
	createdAt?: string | null
	created_at?: string | null
}

export type MemoryActivityRow = {
	memoryId: string | number
	memoryName: string | null
	memoryPhotosUrl: string | null
	memoryAddedBy?: string | null
	memoryTimestamp?: string | number | null
	createdAt?: string | null
	created_at?: string | null
}
