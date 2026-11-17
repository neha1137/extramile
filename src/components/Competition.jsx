import { ArrowUpRight, CalendarDays } from "lucide-react";
function Competition() {
  return (
    <section className="section competition" id="competition">
      <div className="section-inner">
        <div className="competition-header">
          <div className="competition-copy">
            <div className="section-kicker">THE EXTRA MILE EXPERIENCE</div>

            <h2 className="section-title">
              From idea
              <br />
              to <span className="accent-text">action.</span>
            </h2>

            <p className="section-subtitle">
              A space where students get to test ideas, meet people, build
              something real and put themselves out there.
            </p>
          </div>

          <div className="competition-side">
            <CalendarDays size={18} />
            <span>COMPETITION / STARTUP</span>
          </div>
        </div>

        <div className="event-visual">
          <div className="event-background-image" aria-hidden="true" />
          <div className="event-image-overlay" aria-hidden="true" />
          <div className="event-grid" aria-hidden="true" />

          <div className="event-content">
            <div className="event-topline">
              <span>EXTRA MILE</span>
              <span>01</span>
            </div>

            <div className="event-center">
              <div className="event-small">STUDENT</div>
              <div className="event-big">START</div>
              <div className="event-big event-outline">SOMETHING.</div>
            </div>

            <div className="event-bottom">
              <span>IDEA → BUILD → GROW</span>
              <ArrowUpRight size={19} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Competition;
