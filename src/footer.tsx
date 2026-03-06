function Footer() {
	const year = new Date().getFullYear()

	return (
		<footer className="site-footer">
			<div className="footer-brand">
				<p className="footer-eyebrow">Friend Circle Hub</p>
				<h3>Built for plans that turn into memories.</h3>
				<p className="footer-copy">
					Keep your crew connected with one place to manage schedules and shared
					photo stories.
				</p>
			</div>

			<div className="footer-links">
				<p>Quick Access</p>
				<div>
					<a href="#">Schedules</a>
					<a href="#">Memories</a>
					<a href="#">Circle Profiles</a>
				</div>
			</div>

			<div className="footer-meta">
				<span className="footer-pill">Green Theme</span>
				<span className="footer-pill">Realtime Memories</span>
				<small>Copyright {year} Friend Circle.</small>
			</div>
		</footer>
	)
}

export default Footer
