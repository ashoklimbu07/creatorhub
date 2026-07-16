import { ConnectedAccounts } from "@/components/shared/connected-accounts"

export default function AccountsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Connected accounts</h1>
        <p className="text-muted-foreground">
          Connect the platforms you want to publish to. Real OAuth connections
          arrive in Phase 3.
        </p>
      </div>
      <ConnectedAccounts />
    </div>
  )
}
