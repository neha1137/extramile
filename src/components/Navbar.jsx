import { useEffect, useState } from "react";
import Logo from "./Logo";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    ["Competition", "#competition"],
    ["Startups", "#startups"],
    ["Impact", "#impact"],
    ["Partners", "#partners"],
    ["Contact", "#contact"],
  ];

  return (
    <>
      <header className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
        <Logo />

        <nav className="nav-links" aria-label="Main navigation">
          {links.map(([label, href]) => (
            <a key={href} href={href} className="nav-link">
              {label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <a href="#competition" className="nav-button">
            Explore the program
          </a>
          <a href="/login" className="nav-login">
           Login
           </a>


          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {open && (
        <div className="mobile-nav">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="mobile-nav-link"
              onClick={() => setOpen(false)}
            >
              {label}
              <ArrowUpRight size={15} />
            </a>
          ))}

          <a
            href="#competition"
            className="mobile-nav-button"
            onClick={() => setOpen(false)}
          >
            Login
            <ArrowRight size={16} />
          </a>
        </div>
      )}
    </>
  );
}

export default Navbar;
