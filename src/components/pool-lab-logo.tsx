type PoolLabLogoProps = {
  className?: string;
};

export function PoolLabLogo({ className = "" }: PoolLabLogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative block h-10 w-56 shrink-0 overflow-hidden ${className}`}
    >
      <img
        alt=""
        className="absolute top-[-35px] left-0 block w-56 max-w-none"
        src="/brand/pool-lab-logo.png"
      />
    </span>
  );
}
