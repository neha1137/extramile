import Logo from "./Logo";
function Footer() {
  return (
    <footer className="footer">
      <Logo />

      <div className="footer-center">
        © {new Date().getFullYear()} Extra Mile
      </div>

      <div className="footer-links">
        <a href="#top" className="footer-link">
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}

export default Footer;
