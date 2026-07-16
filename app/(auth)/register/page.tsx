"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GoogleButton } from "@/components/shared/google-button"
import { register } from "@/app/(auth)/actions"

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(register, null)

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Start publishing videos to every platform at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            {state?.error && (
              <p className="text-destructive text-sm">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="bg-card text-muted-foreground relative z-10 px-2">
              Or
            </span>
          </div>
          <GoogleButton />
        </CardContent>
        <CardFooter className="justify-center text-sm">
          Already have an account?&nbsp;
          <Link href="/login" className="underline underline-offset-4">
            Log in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
