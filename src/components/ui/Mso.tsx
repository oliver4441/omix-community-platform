// Material Symbols Outlined icon (Omix design system)
// Lives in a .tsx module because it renders JSX (JSX isn't allowed in .ts files).
export function Mso({
  name,
  size = 20,
  fill = false,
  className = "",
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
