import { ArrowRight, ArrowUpRight } from "lucide-react";
function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-shape hero-shape-purple" />
      <div className="hero-shape hero-shape-blue" />
      <div className="hero-shape hero-shape-lime" />
      <div className="hero-ring" />

      <div className="hero-content">
        <div className="hero-kicker">STUDENT ENTREPRENEURSHIP PROGRAM</div>

        <h1 className="hero-title">
          <span>EXTRA</span>
          <span className="hero-title-accent">MILE</span>
        </h1>

        <p className="hero-description">
          A platform for students who want to go beyond ideas, to explore,
          build, experiment and take their first steps into entrepreneurship.
        </p>

        <div className="hero-actions">
          <a href="#competition" className="primary-button">
            Explore the program
            <ArrowRight size={17} />
          </a>

          <a href="#startups" className="secondary-button">
            Discover the ecosystem
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

export default Hero;
