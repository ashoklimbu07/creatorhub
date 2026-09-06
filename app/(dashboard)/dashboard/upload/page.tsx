"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { UploadCloud, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  videoMetadataSchema,
  type VideoMetadataInput,
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_BYTES,
} from "@/lib/validations/video"
import { formatFileSize } from "@/lib/utils"

type VideoFrameResult = {
  thumbnail: Blob | null
  width: number | null
  height: number | null
}

function captureVideoFrame(file: File): Promise<VideoFrameResult> {
  return new Promise((resolve) => {
    const video = document.createElement("video")
    const objectUrl = URL.createObjectURL(file)
    let settled = false
    let dimensions: { width: number; height: number } | null = null

    function finish(thumbnail: Blob | null) {
      if (settled) return
      settled = true
      URL.revokeObjectURL(objectUrl)
      video.remove()
      resolve({ thumbnail, width: dimensions?.width ?? null, height: dimensions?.height ?? null })
    }

    const timeout = window.setTimeout(() => finish(null), 10_000)
    video.muted = true
    video.preload = "metadata"
    video.playsInline = true
    video.onerror = () => {
      window.clearTimeout(timeout)
      finish(null)
    }
    video.onloadedmetadata = () => {
      dimensions = { width: video.videoWidth, height: video.videoHeight }
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = Math.min(1, Math.max(0, duration / 10))
    }
    video.onseeked = () => {
      window.clearTimeout(timeout)
      const maxWidth = 640
      const scale = Math.min(1, maxWidth / video.videoWidth)
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const context = canvas.getContext("2d")
      if (!context) return finish(null)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => finish(blob), "image/jpeg", 0.82)
    }
    video.src = objectUrl
  })
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [metadataPromise, setMetadataPromise] = useState<Promise<VideoFrameResult>>(
    () => Promise.resolve({ thumbnail: null, width: null, height: null })
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const form = useForm<VideoMetadataInput>({
    resolver: zodResolver(videoMetadataSchema),
    defaultValues: { title: "", description: "" },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!ACCEPTED_VIDEO_TYPES.includes(selected.type)) {
      setFileError("Please select a valid video file (mp4, mov, webm, mkv, mpeg).")
      setFile(null)
      setPreviewUrl(null)
      setMetadataPromise(Promise.resolve({ thumbnail: null, width: null, height: null }))
      return
    }

    if (selected.size > MAX_VIDEO_SIZE_BYTES) {
      setFileError("File is too large. Maximum size is 500MB.")
      setFile(null)
      setPreviewUrl(null)
      setMetadataPromise(Promise.resolve({ thumbnail: null, width: null, height: null }))
      return
    }

    setFileError(null)
    setFile(selected)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(selected)
    })
    setMetadataPromise(captureVideoFrame(selected))
  }

  function clearFile() {
    setFile(null)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setFileError(null)
    setMetadataPromise(Promise.resolve({ thumbnail: null, width: null, height: null }))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function putToR2(uploadUrl: string, fileToUpload: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", uploadUrl)
      xhr.setRequestHeader("Content-Type", fileToUpload.type)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error("Upload to storage failed. Please try again."))
      }
      xhr.onerror = () => reject(new Error("Upload failed. Please check your connection."))

      xhr.send(fileToUpload)
    })
  }

  async function onSubmit(values: VideoMetadataInput) {
    if (!file) {
      setFileError("Please select a video file to upload.")
      return
    }

    setIsUploading(true)
    setProgress(0)

    // Video files can far exceed the request body limits of serverless route
    // handlers, so the browser uploads straight to R2 with a presigned URL
    // instead of proxying the bytes through Next.js.
    let key: string | undefined
    let thumbnailKey: string | undefined
    try {
      const presignRes = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      })
      if (!presignRes.ok) {
        const data = (await presignRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Could not start the upload. Please try again.")
      }
      const presign = (await presignRes.json()) as { uploadUrl: string; key: string }
      key = presign.key

      await putToR2(presign.uploadUrl, file)

      const { thumbnail, width, height } = await metadataPromise
      if (thumbnail) {
        const thumbnailPresignRes = await fetch("/api/videos/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetType: "thumbnail",
            fileName: "thumbnail.jpg",
            fileType: "image/jpeg",
            fileSize: thumbnail.size,
          }),
        })
        if (thumbnailPresignRes.ok) {
          const thumbnailPresign = (await thumbnailPresignRes.json()) as {
            uploadUrl: string
            key: string
          }
          const thumbnailUploadRes = await fetch(thumbnailPresign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: thumbnail,
          })
          if (thumbnailUploadRes.ok) {
            thumbnailKey = thumbnailPresign.key
          }
        }
      }

      const finalizeRes = await fetch("/api/videos/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: presign.key,
          thumbnailKey,
          title: values.title,
          description: values.description || undefined,
          width: width ?? undefined,
          height: height ?? undefined,
        }),
      })
      if (!finalizeRes.ok) {
        const data = (await finalizeRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Upload failed. Please try again.")
      }

      const data = (await finalizeRes.json()) as { draftId: string }
      toast.success("Video uploaded", {
        description: "Your draft is ready to edit.",
      })
      router.push(`/dashboard/drafts/${data.draftId}`)
    } catch (err) {
      setIsUploading(false)
      toast.error(err instanceof Error ? err.message : "Upload failed. Please try again.")
      if (key) {
        fetch("/api/videos/finalize", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, thumbnailKey }),
        }).catch(() => {})
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload video</h1>
        <p className="text-muted-foreground">
          Upload a video once, then publish it to every platform from its draft.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Video file</CardTitle>
          <CardDescription>MP4, MOV, WebM, or MKV up to 500MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-10 text-center transition-colors hover:bg-muted/50"
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                Click to select a video file
              </span>
              <span className="text-xs text-muted-foreground">
                or drag and drop
              </span>
            </button>
          ) : (
            <div className="relative">
              <video
                src={previewUrl}
                controls
                className="aspect-video w-full rounded-lg bg-black"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="absolute right-2 top-2"
                onClick={clearFile}
                disabled={isUploading}
              >
                <X />
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {file && !fileError && (
            <p className="text-xs text-muted-foreground">
              {file.name} — {formatFileSize(file.size)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            You can fine-tune per-platform copy in the next step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="My awesome video"
                        disabled={isUploading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What's this video about?"
                        rows={4}
                        disabled={isUploading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isUploading && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">
                    Uploading… {progress}%
                  </p>
                </div>
              )}

              <Button type="submit" disabled={isUploading} className="w-full">
                {isUploading ? "Uploading…" : "Upload and continue"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
