function Footer() {
	const year = new Date().getFullYear()

	return (
		<footer className="site-footer">
			<p>Friend Circle Hub · Keep every plan and memory in one place.</p>
			<small>Copyright {year} Friend Circle.</small>
		</footer>
	)
}

export default Footer
