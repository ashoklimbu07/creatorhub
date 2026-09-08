"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  FileVideo2,
  Pencil,
  Plus,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { formatFileSize } from "@/lib/utils"
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/validations/video"
import { uploadVideoFile } from "@/lib/video-upload-client"

const MAX_BULK_VIDEOS = 10
const PARALLEL_UPLOADS = 3

type UploadStatus = "queued" | "uploading" | "complete" | "error"

type UploadItem = {
  id: string
  file: File
  previewUrl: string
  title: string
  status: UploadStatus
  progress: number
  draftId?: string
  error?: string
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").slice(0, 200)
}

export default function BulkUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrls = useRef(new Set<string>())
  const [items, setItems] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [batchPosition, setBatchPosition] = useState({ current: 0, total: 0 })

  useEffect(() => {
    const urls = previewUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    const available = MAX_BULK_VIDEOS - items.length

    if (available <= 0) {
      toast.error(`You can upload up to ${MAX_BULK_VIDEOS} videos at once.`)
      return
    }

    const accepted: UploadItem[] = []
    let invalidCount = 0
    let oversizedCount = 0

    for (const file of incoming.slice(0, available)) {
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
        invalidCount += 1
        continue
      }
      if (file.size > MAX_VIDEO_SIZE_BYTES) {
        oversizedCount += 1
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        title: titleFromFileName(file.name),
        status: "queued",
        progress: 0,
      })
    }

    setItems((current) => [...current, ...accepted])

    if (incoming.length > available) {
      toast.error(`Only ${MAX_BULK_VIDEOS} videos can be added to one batch.`)
    } else if (invalidCount > 0 || oversizedCount > 0) {
      const reasons = [
        invalidCount > 0 ? `${invalidCount} unsupported file${invalidCount === 1 ? "" : "s"}` : "",
        oversizedCount > 0
          ? `${oversizedCount} file${oversizedCount === 1 ? "" : "s"} over 500MB`
          : "",
      ].filter(Boolean)
      toast.error(`Could not add ${reasons.join(" and ")}.`)
    }

    if (inputRef.current) inputRef.current.value = ""
  }

  function updateItem(id: string, update: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item))
    )
  }

  function removeItem(item: UploadItem) {
    URL.revokeObjectURL(item.previewUrl)
    previewUrls.current.delete(item.previewUrl)
    setItems((current) => current.filter((candidate) => candidate.id !== item.id))
  }

  async function uploadAll() {
    const pending = items.filter(
      (item) => item.status === "queued" || item.status === "error"
    )
    const missingTitle = pending.find((item) => !item.title.trim())

    if (missingTitle) {
      toast.error("Add a title for every video before uploading.")
      return
    }
    if (pending.length === 0) return

    setIsUploading(true)
    setBatchPosition({ current: 0, total: pending.length })
    let uploadedCount = 0

    let nextItemIndex = 0

    async function uploadNext() {
      while (nextItemIndex < pending.length) {
        const item = pending[nextItemIndex]
        nextItemIndex += 1
        updateItem(item.id, { status: "uploading", progress: 0, error: undefined })

        try {
          const result = await uploadVideoFile({
            file: item.file,
            title: item.title.trim(),
            onProgress: (progress) => updateItem(item.id, { progress }),
          })
          uploadedCount += 1
          updateItem(item.id, {
            status: "complete",
            progress: 100,
            draftId: result.draftId,
          })
        } catch (error) {
          updateItem(item.id, {
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed. Please try again.",
          })
        } finally {
          setBatchPosition((current) => ({
            ...current,
            current: current.current + 1,
          }))
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(PARALLEL_UPLOADS, pending.length) },
        () => uploadNext()
      )
    )

    setIsUploading(false)
    setBatchPosition({ current: 0, total: 0 })
    if (uploadedCount === pending.length) {
      toast.success(`${uploadedCount} video${uploadedCount === 1 ? "" : "s"} uploaded`, {
        description: "Your drafts are ready. Open Edit more to finish each one.",
      })
    } else {
      toast.warning(`${uploadedCount} of ${pending.length} videos uploaded`, {
        description: "Review the failed videos and retry them.",
      })
    }
  }

  const completedCount = items.filter((item) => item.status === "complete").length
  const failedCount = items.filter((item) => item.status === "error").length
  const queuedCount = items.filter((item) => item.status === "queued").length
  const pendingCount = items.length - completedCount

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold">Upload multiple videos</h1>
          <p className="text-muted-foreground">
            Add up to {MAX_BULK_VIDEOS} videos, give each one a title, and create all your drafts at once.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/upload">
            <FileVideo2 />
            Single video
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select videos</CardTitle>
          <CardDescription>
            MP4, MOV, WebM, MKV, or MPEG. Up to 500MB each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              if (!isUploading) setIsDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault()
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragging(false)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              if (!isUploading) addFiles(event.dataTransfer.files)
            }}
            disabled={isUploading || items.length >= MAX_BULK_VIDEOS}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            }`}
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              Choose videos or drag and drop them here
            </span>
            <span className="text-xs text-muted-foreground">
              {items.length} of {MAX_BULK_VIDEOS} videos selected
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(event) => event.target.files && addFiles(event.target.files)}
          />
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Video details</CardTitle>
              <CardDescription>
                Titles are prefilled from file names. Use Edit more after upload for captions and platform settings.
              </CardDescription>
            </div>
            {items.length < MAX_BULK_VIDEOS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                <Plus />
                Add videos
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y overflow-hidden rounded-xl border">
              {items.map((item, index) => (
                <div key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row">
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-black sm:w-40">
                    <video
                      src={item.previewUrl}
                      preload="metadata"
                      muted
                      className="size-full object-cover"
                      aria-label={`${item.title || item.file.name} preview`}
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                      {index + 1}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`title-${item.id}`} className="mb-1 block text-xs font-medium">
                          Title
                        </label>
                        <Input
                          id={`title-${item.id}`}
                          value={item.title}
                          maxLength={200}
                          disabled={isUploading || item.status === "complete"}
                          aria-invalid={!item.title.trim()}
                          onChange={(event) => updateItem(item.id, { title: event.target.value })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeItem(item)}
                        disabled={isUploading}
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <X />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="max-w-64 truncate">{item.file.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatFileSize(item.file.size)}</span>
                      {item.status === "queued" && <Badge variant="secondary">Ready</Badge>}
                      {item.status === "uploading" && <Badge variant="outline">Uploading</Badge>}
                      {item.status === "complete" && (
                        <Badge className="bg-emerald-600 text-white">
                          <CheckCircle2 /> Ready
                        </Badge>
                      )}
                      {item.status === "error" && (
                        <Badge variant="destructive">
                          <AlertCircle /> Failed
                        </Badge>
                      )}
                    </div>

                    {item.status === "uploading" && (
                      <div className="space-y-1">
                        <Progress value={item.progress} />
                        <p className="text-xs text-muted-foreground">{item.progress}% uploaded</p>
                      </div>
                    )}
                    {item.status === "error" && (
                      <p className="text-xs text-destructive">{item.error}</p>
                    )}
                    {item.status === "complete" && item.draftId && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/drafts/${item.draftId}`}>
                          <Pencil />
                          Edit more
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {isUploading
                  ? `${batchPosition.current} of ${batchPosition.total} uploads finished · up to ${PARALLEL_UPLOADS} running at once`
                  : completedCount > 0
                    ? `${completedCount} of ${items.length} drafts ready`
                    : `${items.length} video${items.length === 1 ? "" : "s"} ready to upload`}
              </p>
              <div className="flex gap-2">
                {completedCount > 0 && !isUploading && (
                  <Button asChild variant="outline">
                    <Link href="/dashboard/drafts">View drafts</Link>
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={uploadAll}
                  disabled={isUploading || pendingCount === 0}
                >
                  {failedCount > 0 && !isUploading ? <RotateCcw /> : <UploadCloud />}
                  {isUploading
                    ? `Uploading ${batchPosition.current}/${batchPosition.total}`
                    : failedCount > 0 && queuedCount === 0
                      ? `Retry ${failedCount} failed`
                      : `Upload ${pendingCount} video${pendingCount === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
