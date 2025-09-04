import Link from "next/link";

export function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav className="text-sm text-muted-foreground mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center gap-1">
            {it.href ? (
              <Link href={it.href} className="hover:underline">
                {it.label}
              </Link>
            ) : (
              <span className="text-foreground">{it.label}</span>
            )}
            {idx < items.length - 1 && <span className="opacity-60">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}


