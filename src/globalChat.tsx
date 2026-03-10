import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './components/supaBaseClient.ts'

type GlobalChatProps = {
	currentUserEmail?: string | null
	onNotice?: Dispatch<SetStateAction<string>>
}

type ChatMessage = {
	id: string
	text: string
	sender: string
	timestamp: number
	timeLabel: string
}

const MIN_REASONABLE_TIMESTAMP = Date.UTC(2020, 0, 1)
const MAX_REASONABLE_TIMESTAMP = Date.now() + 1000 * 60 * 60 * 24 * 365
const WIB_TIMEZONE = 'Asia/Jakarta'

const normalizeTimestampText = (raw: string) => {
	let text = raw.trim().replace(' ', 'T')

	if (!text) {
		return text
	}

	// Convert +07 or -03 suffix into +07:00 / -03:00.
	text = text.replace(/([+-]\d{2})$/, '$1:00')

	// Convert +0700 or -0330 suffix into +07:00 / -03:30.
	text = text.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')

	const hasExplicitTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(text)
	if (!hasExplicitTimezone) {
		text = `${text}Z`
	}

	return text
}

const getWibDateKey = (timestamp: number) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: WIB_TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date(timestamp))

const parseTimestamp = (value: unknown) => {
	const text = String(value ?? '').trim()
	if (!text) {
		return null
	}

	const normalized = normalizeTimestampText(text)
	const normalizedParsed = Date.parse(normalized)
	if (!Number.isNaN(normalizedParsed) && normalizedParsed >= MIN_REASONABLE_TIMESTAMP && normalizedParsed <= MAX_REASONABLE_TIMESTAMP) {
		return normalizedParsed
	}

	const parsed = Date.parse(text)
	if (!Number.isNaN(parsed) && parsed >= MIN_REASONABLE_TIMESTAMP && parsed <= MAX_REASONABLE_TIMESTAMP) {
		return parsed
	}

	const asNumber = Number(text)
	if (!Number.isNaN(asNumber)) {
		if (asNumber >= MIN_REASONABLE_TIMESTAMP && asNumber <= MAX_REASONABLE_TIMESTAMP) {
			return asNumber
		}

		const asMs = asNumber * 1000
		if (asMs >= MIN_REASONABLE_TIMESTAMP && asMs <= MAX_REASONABLE_TIMESTAMP) {
			return asMs
		}
	}

	return null
}

const formatChatTime = (timestamp: number) => {
	const isToday = getWibDateKey(timestamp) === getWibDateKey(Date.now())

	if (isToday) {
		return new Intl.DateTimeFormat('id-ID', {
			timeZone: WIB_TIMEZONE,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		}).format(new Date(timestamp))
	}

	return new Intl.DateTimeFormat('id-ID', {
		timeZone: WIB_TIMEZONE,
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(new Date(timestamp))
}

const normalizeMessageRow = (row: Record<string, unknown>, index: number): ChatMessage => {
	const timestamp = parseTimestamp(row.createdAt) ?? Date.now()
	const idValue = row.id ?? `msg-${timestamp}-${index}`
	const textValue = row.messageText ?? ''
	const senderValue = row.senderEmail ?? 'Guest'

	return {
		id: String(idValue),
		text: String(textValue || 'Empty message'),
		sender: String(senderValue || 'Guest'),
		timestamp,
		timeLabel: formatChatTime(timestamp),
	}
}

function GlobalChat({ currentUserEmail, onNotice }: GlobalChatProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [draft, setDraft] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [isSending, setIsSending] = useState(false)
	const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
	const [openActionMessageId, setOpenActionMessageId] = useState<string | null>(null)
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
	const [editingDraft, setEditingDraft] = useState('')
	const [savingEditMessageId, setSavingEditMessageId] = useState<string | null>(null)
	const [typingUsers, setTypingUsers] = useState<string[]>([])
	const listRef = useRef<HTMLUListElement | null>(null)
	const typingChannelRef = useRef<RealtimeChannel | null>(null)
	const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const myIdentity = useMemo(
		() => (currentUserEmail?.trim() ? currentUserEmail.trim() : 'Guest'),
		[currentUserEmail],
	)

	const notify = (message: string) => {
		onNotice?.(message)
	}

	const loadMessages = async () => {
		setIsLoading(true)

		const { data, error } = await supabase
			.from('message')
			.select('id, senderEmail, messageText, createdAt')

		if (error) {
			notify(`Chat load failed: ${error.message}`)
			setIsLoading(false)
			return
		}

		const mapped = ((data ?? []) as Record<string, unknown>[])
			.map(normalizeMessageRow)
			.sort((a, b) => a.timestamp - b.timestamp)

		setMessages(mapped)
		setIsLoading(false)
	}

	useEffect(() => {
		void loadMessages()
	}, [])

	useEffect(() => {
		const channel = supabase
			.channel('global-chat-realtime')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'message' }, () => {
				void loadMessages()
			})
			.subscribe()

		return () => {
			void supabase.removeChannel(channel)
		}
	}, [])

	useEffect(() => {
		const typingChannel = supabase
			.channel('global-chat-typing')
			.on('broadcast', { event: 'typing' }, ({ payload }) => {
				const sender = String(payload?.sender ?? '').trim()
				const isTyping = Boolean(payload?.isTyping)

				if (!sender || sender.toLowerCase() === myIdentity.toLowerCase()) {
					return
				}

				setTypingUsers((prev) => {
					if (isTyping) {
						return prev.includes(sender) ? prev : [...prev, sender]
					}

					return prev.filter((name) => name !== sender)
				})
			})
			.subscribe()

		typingChannelRef.current = typingChannel

		return () => {
			if (typingStopTimerRef.current) {
				clearTimeout(typingStopTimerRef.current)
				typingStopTimerRef.current = null
			}

			setTypingUsers([])
			void supabase.removeChannel(typingChannel)
			typingChannelRef.current = null
		}
	}, [myIdentity])

	useEffect(() => {
		if (!listRef.current) {
			return
		}

		listRef.current.scrollTop = listRef.current.scrollHeight
	}, [messages.length])

	const sendTypingState = (isTyping: boolean) => {
		if (!typingChannelRef.current) {
			return
		}

		void typingChannelRef.current.send({
			type: 'broadcast',
			event: 'typing',
			payload: {
				sender: myIdentity,
				isTyping,
			},
		})
	}

	const typingLabel = useMemo(() => {
		if (typingUsers.length === 0) {
			return ''
		}

		if (typingUsers.length === 1) {
			return `${typingUsers[0]} is typing`
		}

		if (typingUsers.length === 2) {
			return `${typingUsers[0]} and ${typingUsers[1]} are typing`
		}

		return `${typingUsers.length} members are typing`
	}, [typingUsers])

	const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (isSending) {
			return
		}

		const text = draft.trim()
		if (!text) {
			return
		}

		if (text.length > 600) {
			notify('Message too long. Max 600 characters.')
			return
		}

		setIsSending(true)

		try {
			sendTypingState(false)
			if (typingStopTimerRef.current) {
				clearTimeout(typingStopTimerRef.current)
				typingStopTimerRef.current = null
			}

			const timestampIso = new Date().toISOString()

			const insertResult = await supabase
				.from('message')
				.insert([
					{
						senderEmail: myIdentity,
						messageText: text,
						createdAt: timestampIso,
					},
				])
				.select('id, senderEmail, messageText, createdAt')

			if (insertResult.error) {
				notify(`Send message failed: ${insertResult.error.message}`)
				return
			}

			setDraft('')

			const inserted = ((insertResult.data ?? []) as Record<string, unknown>[]).map(normalizeMessageRow)
			if (inserted.length > 0) {
				setMessages((prev) => [...prev, ...inserted].sort((a, b) => a.timestamp - b.timestamp))
			} else {
				void loadMessages()
			}
		} finally {
			setIsSending(false)
		}
	}

	const deleteMessage = async (message: ChatMessage) => {
		if (deletingMessageId === message.id) {
			return
		}

		setOpenActionMessageId(null)

		setDeletingMessageId(message.id)

		try {
			const numericId = Number(message.id)
			const deleteResult = Number.isNaN(numericId)
				? await supabase
						.from('message')
						.delete()
						.eq('id', message.id)
				: await supabase
						.from('message')
						.delete()
						.eq('id', numericId)

			if (deleteResult.error) {
				notify(`Delete message failed: ${deleteResult.error.message}`)
				return
			}

			setMessages((prev) => prev.filter((item) => item.id !== message.id))
		} finally {
			setDeletingMessageId((prev) => (prev === message.id ? null : prev))
		}
	}

	const startEditMessage = (message: ChatMessage) => {
		setEditingMessageId(message.id)
		setEditingDraft(message.text)
		setOpenActionMessageId(null)
	}

	const cancelEditMessage = () => {
		setEditingMessageId(null)
		setEditingDraft('')
	}

	const saveEditMessage = async (message: ChatMessage) => {
		if (savingEditMessageId === message.id) {
			return
		}

		const nextText = editingDraft.trim()
		if (!nextText) {
			notify('Message cannot be empty.')
			return
		}

		if (nextText.length > 600) {
			notify('Message too long. Max 600 characters.')
			return
		}

		setSavingEditMessageId(message.id)

		try {
			const numericId = Number(message.id)
			const updateResult = Number.isNaN(numericId)
				? await supabase
						.from('message')
						.update({ messageText: nextText })
						.eq('id', message.id)
						.select('id, senderEmail, messageText, createdAt')
				: await supabase
						.from('message')
						.update({ messageText: nextText })
						.eq('id', numericId)
						.select('id, senderEmail, messageText, createdAt')

			if (updateResult.error) {
				notify(`Edit message failed: ${updateResult.error.message}`)
				return
			}

			const updatedRows = (updateResult.data ?? []) as Record<string, unknown>[]
			if (updatedRows.length > 0) {
				const updated = normalizeMessageRow(updatedRows[0], 0)
				setMessages((prev) =>
					prev.map((item) => (item.id === message.id ? { ...item, text: updated.text } : item)),
				)
			} else {
				setMessages((prev) =>
					prev.map((item) => (item.id === message.id ? { ...item, text: nextText } : item)),
				)
			}

			cancelEditMessage()
		} finally {
			setSavingEditMessageId((prev) => (prev === message.id ? null : prev))
		}
	}

	return (
		<section className="panel chat-panel">
			<div className="panel-head">
				<h2>Global Circle Chat</h2>
				<p>Chat live with everyone in Keluarga Cemara.</p>
				{isLoading ? (
					<div className="section-loading-indicator" aria-live="polite">
						<span className="section-loading-dot" />
						<span>Loading chat...</span>
					</div>
				) : null}
			</div>

			<ul className="chat-list" ref={listRef}>
				{messages.map((message) => {
					const isMine = message.sender.toLowerCase() === myIdentity.toLowerCase()
					const isEditing = editingMessageId === message.id

					return (
						<li key={message.id} className={`chat-item${isMine ? ' mine' : ''}`}>
							<div className="chat-bubble">
								{isEditing ? (
									<div className="chat-edit-wrap">
										<input
											type="text"
											value={editingDraft}
											onChange={(event) => setEditingDraft(event.target.value)}
											maxLength={600}
											className="chat-edit-input"
										/>
										<div className="chat-edit-actions">
											<button
												type="button"
												onClick={() => saveEditMessage(message)}
												disabled={savingEditMessageId === message.id}
											>
												{savingEditMessageId === message.id ? 'Saving...' : 'Save'}
											</button>
											<button
												type="button"
												className="secondary"
												onClick={cancelEditMessage}
												disabled={savingEditMessageId === message.id}
											>
												Cancel
											</button>
										</div>
									</div>
								) : (
									<>
										<p>{message.text}</p>
										<div className="chat-meta-row">
											<small>
												{message.sender} · {message.timeLabel}
											</small>
											{isMine ? (
												<div className="chat-actions-anchor">
													<button
														type="button"
														className="chat-action-icon"
														onClick={() =>
															setOpenActionMessageId((prev) =>
																prev === message.id ? null : message.id,
															)
														}
														aria-label="Open message actions"
													>
														✎
													</button>
													{openActionMessageId === message.id ? (
														<div className="chat-actions-menu">
															<button type="button" onClick={() => startEditMessage(message)}>
																Edit
															</button>
															<button
																type="button"
																className="danger"
																onClick={() => deleteMessage(message)}
																disabled={deletingMessageId === message.id}
															>
																{deletingMessageId === message.id ? 'Deleting...' : 'Delete'}
															</button>
														</div>
													) : null}
												</div>
											) : null}
										</div>
									</>
								)}
							</div>
						</li>
					)
				})}
				{!isLoading && messages.length === 0 ? (
					<li className="chat-empty">No messages yet. Say hello to the circle.</li>
				) : null}
			</ul>

			<form className="chat-form" onSubmit={sendMessage}>
				<input
					type="text"
					value={draft}
					onChange={(event) => {
						const nextValue = event.target.value
						setDraft(nextValue)

						if (!nextValue.trim()) {
							sendTypingState(false)
							if (typingStopTimerRef.current) {
								clearTimeout(typingStopTimerRef.current)
								typingStopTimerRef.current = null
							}
							return
						}

						sendTypingState(true)
						if (typingStopTimerRef.current) {
							clearTimeout(typingStopTimerRef.current)
						}

						typingStopTimerRef.current = setTimeout(() => {
							sendTypingState(false)
							typingStopTimerRef.current = null
						}, 1500)
					}}
					placeholder="Type a message..."
					maxLength={600}
				/>
				<button type="submit" disabled={isSending}>
					{isSending ? 'Sending...' : 'Send'}
				</button>
			</form>
			{typingUsers.length > 0 ? (
				<p className="chat-typing" aria-live="polite">
					{typingLabel}
					<span className="typing-dots" aria-hidden="true" />
				</p>
			) : null}
		</section>
	)
}

export default GlobalChat
