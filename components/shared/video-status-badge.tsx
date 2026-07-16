import { Badge } from "@/components/ui/badge"
import type { VideoStatus } from "@prisma/client"

const statusConfig: Record<
  VideoStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  READY: { label: "Ready", variant: "outline" },
  PUBLISHING: { label: "Publishing", variant: "default" },
  PUBLISHED: { label: "Published", variant: "default" },
  FAILED: { label: "Failed", variant: "destructive" },
}

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
