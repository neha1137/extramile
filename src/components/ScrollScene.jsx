import { useEffect, useRef, useState } from "react";

export default function ScrollScene({
  children,
  className = "",
  strength = 1,
  chapter = "",
  index = "01",
}) {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const raw = (viewport - rect.top) / (viewport + rect.height);
      const next = Math.max(0, Math.min(1, raw));
      setProgress(next);
      setActive(next > 0.18 && next < 0.86);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-scene ${active ? "is-story-active" : ""} ${className}`}
      style={{
        "--scroll-progress": progress,
        "--scroll-strength": strength,
      }}
    >
      {chapter && (
        <div className="story-marker" aria-hidden="true">
          <span className="story-marker-line" />
          <span className="story-marker-index">{index}</span>
          <span className="story-marker-label">{chapter}</span>
        </div>
      )}
      <div className="story-ambient" aria-hidden="true" />
      {children}
    </div>
  );
}
