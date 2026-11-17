import { useState } from "react";
import { ArrowRight, Users } from "lucide-react";
const CONTACT_EMAIL = "ecellsmvit@gmail.com";
function Contact() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    if (!CONTACT_EMAIL) {
      setSubmitted(true);
      return;
    }

    const form = new FormData(event.currentTarget);
    const name = form.get("name") || "";
    const email = form.get("email") || "";
    const message = form.get("message") || "";

    const subject = encodeURIComponent(`Extra Mile enquiry from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    );

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <section className="section contact" id="contact">
      <div className="section-inner">
        <div className="contact-layout">
          <div className="contact-copy">
            <div className="section-kicker">LET&apos;S CONNECT</div>

            <h2 className="section-title">
              Have an
              <br />
              <span className="accent-text">idea?</span>
            </h2>

            <p>
              Whether you&apos;re a student, startup, mentor, partner or just
              curious about Extra Mile, we&apos;d love to hear from you.
            </p>

            <div className="contact-mini">
              <Users size={17} />
              <span>Students · Startups · Partners</span>
            </div>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
            <input
              className="form-field"
              name="name"
              type="text"
              placeholder="Your name"
              required
            />

            <input
              className="form-field"
              name="email"
              type="email"
              placeholder="Your email"
              required
            />

            <textarea
              className="form-field"
              name="message"
              placeholder="Your message"
              required
            />

            <button type="submit" className="primary-button form-submit">
              Send message
              <ArrowRight size={17} />
            </button>

          </form>
        </div>
      </div>
    </section>
  );
}

export default Contact;
