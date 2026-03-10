import { useEffect, useMemo, useState } from 'react'
import { supabase } from './components/supaBaseClient.ts'
import { loadActivityFeed } from './services/activityFeed'
import type { ActivityItem } from './types/activity'

type ActivityFeedProps = {
	onNotice?: (message: string) => void
}

const activityTypeLabel: Record<ActivityItem['type'], string> = {
	'schedule-added': 'Schedule Added',
	'schedule-completed': 'Schedule Completed',
	'memory-added': 'Memory Uploaded',
}

type ActivityFilter = 'all' | 'schedule' | 'memory'

const filterLabels: Record<ActivityFilter, string> = {
	all: 'All',
	schedule: 'Schedule',
	memory: 'Memory',
}

const groupActivities = (items: ActivityItem[]) => {
	const now = Date.now()
	const dayMs = 1000 * 60 * 60 * 24

	const grouped = {
		today: [] as ActivityItem[],
		thisWeek: [] as ActivityItem[],
		earlier: [] as ActivityItem[],
	}

	for (const item of items) {
		const age = now - item.timestamp

		if (age < dayMs) {
			grouped.today.push(item)
			continue
		}

		if (age < dayMs * 7) {
			grouped.thisWeek.push(item)
			continue
		}

		grouped.earlier.push(item)
	}

	return grouped
}

function ActivityFeed({ onNotice }: ActivityFeedProps) {
	const [activities, setActivities] = useState<ActivityItem[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all')

	const stats = useMemo(
		() => ({
			total: activities.length,
			schedule: activities.filter((item) => item.type !== 'memory-added').length,
			memory: activities.filter((item) => item.type === 'memory-added').length,
		}),
		[activities],
	)

	const filteredActivities = useMemo(() => {
		if (activeFilter === 'all') {
			return activities
		}

		if (activeFilter === 'memory') {
			return activities.filter((item) => item.type === 'memory-added')
		}

		return activities.filter((item) => item.type !== 'memory-added')
	}, [activeFilter, activities])

	const grouped = useMemo(() => groupActivities(filteredActivities), [filteredActivities])

	useEffect(() => {
		const refresh = async () => {
			setIsLoading(true)
			try {
				const next = await loadActivityFeed()
				setActivities(next)
			} catch (error) {
				onNotice?.(error instanceof Error ? error.message : 'Activity load failed.')
			} finally {
				setIsLoading(false)
			}
		}

		void refresh()

		const scheduleChannel = supabase
			.channel('activity-feed-schedule')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'schedule' },
				() => {
					void refresh()
				},
			)
			.subscribe()

		const memoryChannel = supabase
			.channel('activity-feed-memory')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'memoryId' },
				() => {
					void refresh()
				},
			)
			.subscribe()

		return () => {
			void supabase.removeChannel(scheduleChannel)
			void supabase.removeChannel(memoryChannel)
		}
	}, [onNotice])

	return (
		<section className="panel activity-panel">
			<div className="panel-head">
				<h2>Pulse Board</h2>
				<p>Live feed of what your circle is doing right now.</p>
				<div className="activity-topline">
					<span>{stats.total} total</span>
					<span>{stats.schedule} schedule</span>
					<span>{stats.memory} memory</span>
				</div>
				<div className="activity-filters" role="tablist" aria-label="Activity filter">
					{(['all', 'schedule', 'memory'] as ActivityFilter[]).map((filter) => (
						<button
							key={filter}
							type="button"
							className={activeFilter === filter ? 'active' : ''}
							onClick={() => setActiveFilter(filter)}
						>
							{filterLabels[filter]}
						</button>
					))}
				</div>
				{isLoading ? (
					<div className="section-loading-indicator" aria-live="polite">
						<span className="section-loading-dot" />
						<span>Refreshing activity...</span>
					</div>
				) : null}
			</div>

			<div className="activity-group-wrap">
				{[
					{ key: 'today', label: 'Today', items: grouped.today },
					{ key: 'thisWeek', label: 'This Week', items: grouped.thisWeek },
					{ key: 'earlier', label: 'Earlier', items: grouped.earlier },
				].map((group) =>
					group.items.length > 0 ? (
						<div key={group.key} className="activity-group">
							<p className="activity-group-title">{group.label}</p>
							<ul className="activity-list">
								{group.items.map((item) => (
									<li key={item.id} className={`activity-item ${item.type}`}>
										<div>
											<p>{item.title}</p>
											<small>
												{item.detail} · added by {item.addedBy}
											</small>
										</div>
										<div className="activity-meta">
											<span>{activityTypeLabel[item.type]}</span>
											<small>{item.timeLabel}</small>
										</div>
									</li>
								))}
							</ul>
						</div>
					) : null,
				)}
				{!isLoading && filteredActivities.length === 0 ? (
					<div className="activity-empty">No activity for this filter yet.</div>
				) : null}
			</div>
		</section>
	)
}

export default ActivityFeed
