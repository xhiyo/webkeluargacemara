import { useState } from 'react'
import type { FormEvent } from 'react'
import './login.css'
import { supabase } from './components/supaBaseClient.ts'

function Login() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [errorText, setErrorText] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (isSubmitting) {
			return
		}

		setIsSubmitting(true)
		setErrorText('')

		const { error } = await supabase.auth.signInWithPassword({
			email: email.trim(),
			password: password.trim(),
		})

		if (error) {
			setErrorText(error.message)
			setIsSubmitting(false)
			return
		}

		setIsSubmitting(false)
	}

	return (
		<main className="login-screen">
			<section className="login-card" aria-labelledby="login-title">
				<p className="login-eyebrow">Keluarga Cemara Private Access</p>
				<h1 id="login-title">Sign in to continue</h1>
				<p className="login-copy">
					Only registered circle members can access this website. Sign in with your
					email and password.
				</p>

				<form className="login-form" onSubmit={handleSubmit}>
					<label>
						Email
						<input
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="your-email@example.com"
							autoComplete="email"
							required
						/>
					</label>

					<label>
						Password
						<div className="password-field-wrap">
							<input
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								placeholder="Your password"
								autoComplete="current-password"
								required
							/>
							<button
								type="button"
								className="password-toggle-btn"
								onClick={() => setShowPassword((prev) => !prev)}
							>
								{showPassword ? 'Hide' : 'Show'}
							</button>
						</div>
					</label>

					{errorText ? <p className="login-error">{errorText}</p> : null}

					<button type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Signing in...' : 'Login'}
					</button>
				</form>

				<div className="login-hint">
					<small>
						Use your account created in Supabase Authentication.
					</small>
				</div>
			</section>
		</main>
	)
}

export default Login
