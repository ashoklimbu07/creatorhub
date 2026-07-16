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

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
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
      return
    }

    if (selected.size > MAX_VIDEO_SIZE_BYTES) {
      setFileError("File is too large. Maximum size is 500MB.")
      setFile(null)
      setPreviewUrl(null)
      return
    }

    setFileError(null)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  function clearFile() {
    setFile(null)
    setPreviewUrl(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function onSubmit(values: VideoMetadataInput) {
    if (!file) {
      setFileError("Please select a video file to upload.")
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("title", values.title)
    if (values.description) formData.append("description", values.description)

    setIsUploading(true)
    setProgress(0)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/videos/upload")

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      setIsUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { draftId: string }
        toast.success("Video uploaded", {
          description: "Your draft is ready to edit.",
        })
        router.push(`/dashboard/drafts/${data.draftId}`)
      } else {
        const data = JSON.parse(xhr.responseText) as { error?: string }
        toast.error(data.error ?? "Upload failed. Please try again.")
      }
    }

    xhr.onerror = () => {
      setIsUploading(false)
      toast.error("Upload failed. Please check your connection and try again.")
    }

    xhr.send(formData)
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
