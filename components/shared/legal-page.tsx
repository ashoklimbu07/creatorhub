import Link from "next/link"

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
      <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
        CreatorHub
      </Link>
      <article className="mt-8 space-y-8">
        <header className="space-y-2 border-b pb-6">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Effective {effectiveDate}</p>
        </header>
        <div className="space-y-7 text-sm leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:max-w-none [&_strong]:font-semibold [&_strong]:text-foreground">
          {children}
        </div>
      </article>
      <footer className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t pt-6 text-sm text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/data-deletion" className="hover:text-foreground">Data deletion</Link>
      </footer>
    </main>
  )
}
