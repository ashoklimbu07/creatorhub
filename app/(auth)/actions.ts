"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { loginSchema, registerSchema } from "@/lib/validations/auth"

export type AuthActionState = {
  error?: string
} | null

async function syncUser(id: string, email: string, name?: string | null) {
  await prisma.user.upsert({
    where: { id },
    update: { email, ...(name ? { name } : {}) },
    create: { id, email, name: name ?? null },
  })
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await syncUser(
      data.user.id,
      data.user.email ?? parsed.data.email,
      data.user.user_metadata?.name
    )
  }

  redirect("/dashboard")
}

export async function register(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await syncUser(data.user.id, data.user.email ?? parsed.data.email, parsed.data.name)
  }

  redirect("/dashboard")
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const origin = (await headers()).get("origin")

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
