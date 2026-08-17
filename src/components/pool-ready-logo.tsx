type PoolReadyLogoProps = {
  className?: string;
};

export function PoolReadyLogo({ className = "" }: PoolReadyLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`block h-10 w-28 shrink-0 ${className}`}
    >
      <img
        alt=""
        className="block h-10 w-auto max-w-none"
        src="/brand/pool-ready-logo.png"
      />
    </span>
  );
}
