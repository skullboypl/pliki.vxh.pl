type Props = {
  value: number;
  max?: number;
  size?: number;
  label?: string;
};

export default function StarRating({ value, max = 5, size = 18, label }: Props) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const stars = Array.from({ length: max }, (_, i) => {
    const filled = i < full || (i === full && half);
    return (
      <span
        key={i}
        className={`seo-star${filled ? ' seo-star--on' : ''}`}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <path
            d="M12 2.5l2.9 6.1 6.8.6-5.1 4.5 1.5 6.6L12 17.8 5.9 20.3l1.5-6.6-5.1-4.5 6.8-.6L12 2.5z"
            fill="currentColor"
          />
        </svg>
      </span>
    );
  });

  return (
    <span
      className="seo-stars"
      role="img"
      aria-label={label ?? `${value} / ${max}`}
      title={label}
    >
      {stars}
    </span>
  );
}
