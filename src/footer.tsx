function Footer() {
	const year = new Date().getFullYear()

	return (
		<footer className="site-footer">
			<div className="footer-brand">
				<p className="footer-eyebrow">Keluarga Cemara</p>
				<h3>Dibuat Sebagai Kenangan dan Friendship Keluarga Cemara</h3>
				<p className="footer-copy">
					Keep us connected with one place to share our circle updates, schedules, and memory photos together.
				</p>
			</div>

			<div className="footer-links">
				<p>Quick Access</p>
				<nav className="footer-link-grid" aria-label="Footer quick links">
					<a href="#schedule-section">Schedules</a>
					<a href="#memory-section">Memories</a>
					<a href="#profiles-section">Circle Profiles</a>
				</nav>
			</div>

			<div className="footer-meta">
				<div className="footer-pill-row">
					<span className="footer-pill">Green Theme</span>
					<span className="footer-pill">Fresh Memories</span>
				</div>
				<small>Always synced with our latest circle updates.</small>
			</div>

			<div className="footer-bottom">
				<small>Copyright {year} Keluarga Cemara.</small>
				<div className="author-center">
					<small>Author : Fabian Ardana</small>
				</div>
				<a href="#">Back to top</a>
			</div>
		</footer>
	)
}

export default Footer
