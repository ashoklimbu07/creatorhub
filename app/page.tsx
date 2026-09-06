import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">CreatorHub</h1>
          <p className="text-muted-foreground">
            Upload one video, publish it everywhere.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Sign up</Link>
          </Button>
        </div>
      </main>
      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/data-deletion" className="hover:text-foreground">Data deletion</Link>
      </footer>
    </div>
  )
}
