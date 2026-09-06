import { redirect } from "next/navigation"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { getCurrentUser } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardTopbar
          email={user.email ?? ""}
          name={user.user_metadata?.name ?? user.user_metadata?.full_name}
          avatarUrl={user.user_metadata?.avatar_url}
        />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
