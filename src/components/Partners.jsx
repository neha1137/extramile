const partnerNames = [
  "DARIAAN",
  "MINIONARTS",
  "PW INSTITUTE OF INNOVATION",
  "MARKEPRENEUR",
  "BHIVE WORKSPACE",
  "WADHWANI FOUNDATION",
  "CEDAT",
  "REAP BENEFIT",
  "HEADSTART NETWORKS",
];

function Partners() {
  const repeated = [...partnerNames, ...partnerNames];
  return (
    <section className="section partners" id="partners">
      <div className="section-inner">
        <div className="partners-heading">
          <div className="section-kicker">OUR PARTNERS</div>

          <h2 className="section-title">
            Built with
            <br />
            the <span className="accent-text">ecosystem.</span>
          </h2>
          <p className="section-subtitle">
            The people and organisations that help students find rooms,
            resources, conversations and opportunities to go further.
          </p>
        </div>
      </div>

      <div className="partner-marquee">
        <div className="partner-track">
          {repeated.map((partner, index) => (
            <div className="partner-item" key={`${partner}-${index}`}>
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Partners;
