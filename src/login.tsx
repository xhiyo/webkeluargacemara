import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './components/supaBaseClient.ts'

type LoginProps = {
	onAuthenticated?: (email: string) => void
}

type LoginResult = {
	ok: boolean
	message: string
	requiresPasswordChange?: boolean
}

const fallbackAllowedMembers = [
	'fabian.ardana@gmail.com',
	'candice@keluargacemara.com',
	'adinda@keluargacemara.com',
	'fasa@keluargacemara.com',
	'arganta9917@gmail.com',
	'jonathan@keluargacemara.com',
]

const defaultMemberPassword = String(
	import.meta.env.VITE_DEFAULT_MEMBER_PASSWORD ?? 'Cemara123!',
)

const readAllowedMemberEmails = () => {
	const fromEnv = String(import.meta.env.VITE_ALLOWED_MEMBER_EMAILS ?? '').trim()

	if (!fromEnv) {
		return fallbackAllowedMembers
	}

	return fromEnv
		.split(',')
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean)
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const isInvalidCredentialsError = (message: string) =>
	message.toLowerCase().includes('invalid login credentials')

export async function loginMember(
	email: string,
	password: string,
	allowedMembers: string[],
): Promise<LoginResult> {
	const normalizedEmail = normalizeEmail(email)
	const normalizedAllowed = allowedMembers.map((member) => normalizeEmail(member))

	if (!normalizedAllowed.includes(normalizedEmail)) {
		return {
			ok: false,
			message: 'This account is not in the private 6-member list.',
		}
	}

	const { error } = await supabase.auth.signInWithPassword({
		email: normalizedEmail,
		password,
	})

	if (error && password === defaultMemberPassword && isInvalidCredentialsError(error.message)) {
		// First-time setup path: create the member account with default password, then sign in.
		const signUpResult = await supabase.auth.signUp({
			email: normalizedEmail,
			password,
		})

		if (signUpResult.error) {
			return {
				ok: false,
				message: `Login failed: ${signUpResult.error.message}`,
			}
		}

		const retry = await supabase.auth.signInWithPassword({
			email: normalizedEmail,
			password,
		})

		if (retry.error) {
			return {
				ok: false,
				message: 'Password Inccorect',
			}
		}
	}

	if (error && !(password === defaultMemberPassword && isInvalidCredentialsError(error.message))) {
		if (isInvalidCredentialsError(error.message)) {
			return {
				ok: false,
				message: 'Password Inccorect',
			}
		}

		return {
			ok: false,
			message: `Login failed: ${error.message}`,
		}
	}

	return {
		ok: true,
		message:
			password === defaultMemberPassword
				? 'Login success. Please change your default password before continuing.'
				: 'Login success. Welcome to Keluarga Cemara private area.',
		requiresPasswordChange: password === defaultMemberPassword,
	}
}

function Login({ onAuthenticated }: LoginProps) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmNewPassword, setConfirmNewPassword] = useState('')
	const [mustChangePassword, setMustChangePassword] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [notice, setNotice] = useState('')

	const allowedMembers = useMemo(() => readAllowedMemberEmails(), [])

	const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (isSubmitting) {
			return
		}

		setIsSubmitting(true)
		setNotice('')

		try {
			const result = await loginMember(email, password, allowedMembers)
			setNotice(result.message)

			if (result.ok) {
				if (result.requiresPasswordChange) {
					setMustChangePassword(true)
					return
				}

				onAuthenticated?.(normalizeEmail(email))
				setPassword('')
			}
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (isSubmitting) {
			return
		}

		if (newPassword.length < 8) {
			setNotice('New password must be at least 8 characters.')
			return
		}

		if (newPassword !== confirmNewPassword) {
			setNotice('Password confirmation does not match.')
			return
		}

		setIsSubmitting(true)

		try {
			const { error } = await supabase.auth.updateUser({
				password: newPassword,
			})

			if (error) {
				setNotice(`Password change failed: ${error.message}`)
				return
			}

			setNotice('Password updated. Access granted.')
			setPassword('')
			setNewPassword('')
			setConfirmNewPassword('')
			setMustChangePassword(false)
			onAuthenticated?.(normalizeEmail(email))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<section className="panel login-panel" aria-label="Private login">
			<div className="login-glow login-glow-one" aria-hidden="true" />
			<div className="login-glow login-glow-two" aria-hidden="true" />
			<div className="panel-head login-head">
				<h2>Private Login</h2>
				<p>Only Keluarga Cemara Can Access This.</p>
			</div>

			{mustChangePassword ? (
				<form className="schedule-form login-form" onSubmit={handleChangePassword}>
					<label>
						New password
						<input
							type="password"
							placeholder="New password"
							value={newPassword}
							onChange={(event) => setNewPassword(event.target.value)}
							required
						/>
					</label>

					<label>
						Confirm new password
						<input
							type="password"
							placeholder="Confirm new password"
							value={confirmNewPassword}
							onChange={(event) => setConfirmNewPassword(event.target.value)}
							required
						/>
					</label>

					<button type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Saving...' : 'Save New Password'}
					</button>
				</form>
			) : (
				<form className="schedule-form login-form" onSubmit={handleLogin}>
					<label>
						Email
						<input
							type="email"
							placeholder="name@email.com"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</label>

					<label>
						Password
						<input
							type="password"
							placeholder="Your password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
						/>
					</label>

					<button type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Signing in...' : 'Login'}
					</button>
				</form>
			)}

			{notice ? <p className="db-notice">{notice}</p> : null}
			<p className="login-footnote">Your private circle, your private memories.</p>
		</section>
	)
}

export default Login