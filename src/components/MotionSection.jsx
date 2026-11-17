import { useEffect, useRef, useState } from "react";

export default function MotionSection({ children, className = "", delay = 0, intensity = "default" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -12% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-section motion-${intensity} ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--motion-delay": `${delay}ms` }}
    >
      <div className="motion-section-glow" aria-hidden="true" />
      {children}
    </div>
  );
}
