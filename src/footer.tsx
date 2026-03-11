type FooterProps = {
	scheduleCount: number
	memoryCount: number
	onlineCount: number
}

function Footer({ scheduleCount, memoryCount, onlineCount }: FooterProps) {
	const year = new Date().getFullYear()
	const today = new Intl.DateTimeFormat('id-ID', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Jakarta',
	}).format(new Date())

	return (
		<footer className="site-footer">
			<div className="footer-brand">
				<p className="footer-eyebrow">Keluarga Cemara</p>
				<h3>Tempat Kenangan, Cerita, dan Rencana Keluarga Cemara</h3>
				<p className="footer-copy">
					Satu rumah digital untuk menyimpan momen, menyusun jadwal, dan tetap terhubung setiap hari.
				</p>
				<p className="footer-date">{today}</p>
			</div>

			<div className="footer-links">
				<p>Quick Access</p>
				<nav className="footer-link-grid" aria-label="Footer quick links">
					<a href="#schedule-section">Schedules</a>
					<a href="#memory-section">Memories</a>
					<a href="#chat-section">Global Chat</a>
					<a href="#profiles-section">Circle Profiles</a>
				</nav>
			</div>

			<div className="footer-meta">
				<p className="footer-meta-title">Live Snapshot</p>
				<div className="footer-stats-grid">
					<article className="footer-stat-card">
						<strong>{scheduleCount}</strong>
						<small>Jadwal aktif</small>
					</article>
					<article className="footer-stat-card">
						<strong>{memoryCount}</strong>
						<small>Foto memori</small>
					</article>
					<article className="footer-stat-card">
						<strong>{onlineCount}</strong>
						<small>Sedang online</small>
					</article>
				</div>
				<div className="footer-pill-row">
					<span className="footer-pill">Realtime Sync</span>
					<span className="footer-pill">Shared Memories</span>
				</div>
				<small>Selalu sinkron dengan update terbaru circle kamu.</small>
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