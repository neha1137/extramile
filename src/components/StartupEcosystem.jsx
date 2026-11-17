import { useState } from "react";

const startups = [
  ["raahe.co", "orbit-node-1", "215px", "0deg", "26s"],
  ["solvia", "orbit-node-2", "215px", "180deg", "30s"],
  ["khethrakshak", "orbit-node-3", "285px", "60deg", "28s"],
  ["atlasfit", "orbit-node-4", "285px", "240deg", "32s"],
  ["tvara", "orbit-node-5", "355px", "120deg", "30s"],
  ["Aers", "orbit-node-6", "355px", "300deg", "34s"],
];

function StartupPill({ name, nodeClass, paused, onClick }) {
  return (
    <div className={`orbit-node ${nodeClass}`}>
      <button
        type="button"
        className={`startup-pill${paused ? " is-paused" : ""}`}
        onClick={onClick}
        aria-pressed={paused}
        title={paused ? `${name}, paused` : `Pause ${name}`}
      >
        <span className="startup-dot" />
        <span>{name}</span>
      </button>
    </div>
  );
}

function StartupEcosystem() {
  const [pausedStartup, setPausedStartup] = useState(null);

  return (
    <section className="section ecosystem" id="startups">
      <div className="section-inner">
        <div className="section-kicker">STARTUP ECOSYSTEM</div>

        <h2 className="section-title">
          Ideas become
          <br />
          <span className="accent-text">connections.</span>
        </h2>

        <p className="section-subtitle">
          From student ideas to ventures in motion, Extra Mile connects
          builders with people, startups and opportunities that can move an
          idea forward.
        </p>

        <div className="ecosystem-stage" aria-label="Extra Mile startup ecosystem">
          <div className="orbit orbit-one" aria-hidden="true" />
          <div className="orbit orbit-two" aria-hidden="true" />
          <div className="orbit orbit-three" aria-hidden="true" />

          <div className="ecosystem-center">
            <span className="ecosystem-pulse" />
            <img
              src="/extra-mile-logo.png"
              alt="Extra Mile Season 2"
              className="ecosystem-logo-image"
            />
          </div>

          {startups.map(([name, nodeClass, radius, angle, duration]) => {
            const isPaused = pausedStartup === name;
            return (
              <div
                className={`orbit-track orbit-track-single${isPaused ? " is-paused" : ""}`}
                key={name}
                style={{
                  "--orbit-radius": radius,
                  "--orbit-angle": angle,
                  "--orbit-duration": duration,
                }}
              >
                <StartupPill
                  name={name}
                  nodeClass={nodeClass}
                  paused={isPaused}
                  onClick={() => setPausedStartup((current) => (current === name ? null : name))}
                />
              </div>
            );
          })}

          <div className="ecosystem-caption">
            CLICK A STARTUP TO PAUSE IT IN PLACE
          </div>
        </div>
      </div>
    </section>
  );
}

export default StartupEcosystem;
