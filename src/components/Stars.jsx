import { useMemo } from "react";
function Stars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 85 }, (_, index) => ({
        id: index,
        left: `${(index * 37) % 100}%`,
        top: `${(index * 61) % 100}%`,
        delay: `${(index % 9) * 0.45}s`,
        opacity: 0.25 + ((index * 13) % 60) / 100,
      })),
    []
  );

  return (
    <div className="star-field" aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            animationDelay: star.delay,
            opacity: star.opacity,
          }}
        />
      ))}

      <span className="shooting-star shooting-star-one" />
      <span className="shooting-star shooting-star-two" />
      <span className="shooting-star shooting-star-three" />
    </div>
  );
}

export default Stars;
