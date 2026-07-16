import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { UserMenu } from "@/components/shared/user-menu"

type DashboardTopbarProps = {
  email: string
  name?: string | null
  avatarUrl?: string | null
}

export function DashboardTopbar({ email, name, avatarUrl }: DashboardTopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center justify-end gap-2">
        <ThemeToggle />
        <UserMenu email={email} name={name} avatarUrl={avatarUrl} />
      </div>
    </header>
  )
}
