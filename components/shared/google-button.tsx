"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { signInWithGoogle } from "@/app/(auth)/actions"

export function GoogleButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          void signInWithGoogle()
        })
      }
    >
      <svg viewBox="0 0 24 24" className="size-4">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.48a5.54 5.54 0 0 1-2.4 3.64v3h3.88c2.27-2.09 3.56-5.17 3.56-8.82Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.96-2.91l-3.88-3c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.96H1.24v3.11A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.25 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.24a12 12 0 0 0 0 10.78l4.01-3.11Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.24 6.61l4.01 3.11C6.2 6.87 8.86 4.75 12 4.75Z"
        />
      </svg>
      Continue with Google
    </Button>
  )
}
