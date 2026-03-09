import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './profile.css'
import { supabase } from './components/supaBaseClient.ts'

type ProfileProps = {
	email: string
	onBack: () => void
	onLogout: () => Promise<void> | void
}

function Profile({ email, onBack, onLogout }: ProfileProps) {
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showNewPassword, setShowNewPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [isUpdating, setIsUpdating] = useState(false)
	const [errorText, setErrorText] = useState('')
	const [noticeText, setNoticeText] = useState('')

	const avatarLetter = useMemo(() => {
		const base = email.trim()
		return base ? base[0]!.toUpperCase() : 'U'
	}, [email])

	const hasMinLength = newPassword.length >= 8
	const hasUppercase = /[A-Z]/.test(newPassword)
	const hasNumber = /\d/.test(newPassword)
	const matchesConfirm = newPassword.length > 0 && newPassword === confirmPassword
	const canSubmit = hasMinLength && hasUppercase && hasNumber && matchesConfirm && !isUpdating

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!canSubmit) {
			setErrorText('Use at least 8 chars, 1 uppercase letter, 1 number, and matching confirm password.')
			return
		}

		setIsUpdating(true)
		setErrorText('')
		setNoticeText('')

		const { error } = await supabase.auth.updateUser({ password: newPassword })

		if (error) {
			setErrorText(error.message)
			setIsUpdating(false)
			return
		}

		setNoticeText('Password updated successfully.')
		setIsUpdating(false)
		setNewPassword('')
		setConfirmPassword('')
		setShowNewPassword(false)
		setShowConfirmPassword(false)
	}

	return (
		<main className="profile-page">
			<section className="profile-card">
				<div className="profile-layout">
					<div className="profile-overview">
						<div className="profile-header">
							<div className="profile-identity">
								<p className="profile-eyebrow">Account Page</p>
								<h1>My Profile</h1>
								<p className="profile-email">{email}</p>
							</div>
							<div className="profile-avatar-top" aria-hidden="true">
								<div className="profile-avatar-frame">
									<span>{avatarLetter}</span>
								</div>
							</div>
						</div>
						<div className="profile-overview-card">
							<p className="profile-overview-title">Security Center</p>
							<p className="profile-overview-copy">
								Keep your account safe by using a strong password and updating it regularly.
							</p>
						</div>
					</div>

					<form className="profile-password-form" onSubmit={handleSubmit}>
						<h2>Change Password</h2>
						<p className="profile-form-copy">Use a unique password that only you know.</p>

						<label>
							New password
							<div className="profile-password-wrap">
								<input
									type={showNewPassword ? 'text' : 'password'}
									value={newPassword}
									onChange={(event) => setNewPassword(event.target.value)}
									autoComplete="new-password"
									required
								/>
								<button
									type="button"
									className="profile-toggle-btn"
									onClick={() => setShowNewPassword((prev) => !prev)}
								>
									{showNewPassword ? 'Hide' : 'Show'}
								</button>
							</div>
						</label>

						<label>
							Confirm password
							<div className="profile-password-wrap">
								<input
									type={showConfirmPassword ? 'text' : 'password'}
									value={confirmPassword}
									onChange={(event) => setConfirmPassword(event.target.value)}
									autoComplete="new-password"
									required
								/>
								<button
									type="button"
									className="profile-toggle-btn"
									onClick={() => setShowConfirmPassword((prev) => !prev)}
								>
									{showConfirmPassword ? 'Hide' : 'Show'}
								</button>
							</div>
						</label>

						<div className="profile-password-rules" aria-live="polite">
							<span className={hasMinLength ? 'pass' : 'fail'}>8+ chars</span>
							<span className={hasUppercase ? 'pass' : 'fail'}>Uppercase</span>
							<span className={hasNumber ? 'pass' : 'fail'}>Number</span>
							<span className={matchesConfirm ? 'pass' : 'fail'}>Match</span>
						</div>

						{errorText ? <p className="profile-error">{errorText}</p> : null}
						{noticeText ? <p className="profile-notice">{noticeText}</p> : null}

						<div className="profile-actions">
							<button type="button" className="secondary" onClick={onBack}>
								Back to app
							</button>
							<button type="submit" disabled={!canSubmit}>
								{isUpdating ? 'Updating...' : 'Change password'}
							</button>
							<button type="button" className="danger" onClick={() => void onLogout()}>
								Logout
							</button>
						</div>
					</form>
				</div>
			</section>
		</main>
	)
}

export default Profile
