import Counter from "./Counter";

function Impact() {
  const metrics = [
    [10, "K+", "People reached"],
    [15, "K+", "Footfall"],
    [6, "K+", "Students"],
  ];

  return (
    <section className="section impact" id="impact">
      <div className="section-inner">
        <div className="section-kicker">GAIN VISIBILITY & NETWORK</div>

        <h2 className="section-title">
          Make your
          <br />
          <span className="accent-text">mark.</span>
        </h2>

        <p className="section-subtitle">
          A growing community where students get visibility, meet the ecosystem
          and take ideas beyond the classroom.
        </p>

        <div className="impact-grid impact-grid-three">
          {metrics.map(([value, suffix, label]) => (
            <div className="impact-item" key={label}>
              <div className="impact-number">
                <Counter value={value} suffix={suffix} />
              </div>
              <div className="impact-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Impact;
