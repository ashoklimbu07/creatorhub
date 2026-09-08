type VideoFrameResult = {
  thumbnail: Blob | null
  width: number | null
  height: number | null
}

type UploadVideoOptions = {
  file: File
  title: string
  description?: string
  onProgress?: (progress: number) => void
}

export type UploadedVideo = {
  videoId: string
  draftId: string
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
      resolve({
        thumbnail,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
      })
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

async function responseError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return new Error(data?.error ?? fallback)
}

function putVideo(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error("Upload to storage failed. Please try again."))
    }
    xhr.onerror = () =>
      reject(new Error("Upload failed. Please check your connection."))
    xhr.send(file)
  })
}

export async function uploadVideoFile({
  file,
  title,
  description,
  onProgress,
}: UploadVideoOptions): Promise<UploadedVideo> {
  const metadataPromise = captureVideoFrame(file)
  let key: string | undefined
  let thumbnailKey: string | undefined

  try {
    const presignResponse = await fetch("/api/videos/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    })
    if (!presignResponse.ok) {
      throw await responseError(
        presignResponse,
        "Could not start the upload. Please try again."
      )
    }

    const presign = (await presignResponse.json()) as {
      uploadUrl: string
      key: string
    }
    key = presign.key
    await putVideo(presign.uploadUrl, file, onProgress)

    const { thumbnail, width, height } = await metadataPromise
    if (thumbnail) {
      const thumbnailPresignResponse = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetType: "thumbnail",
          fileName: "thumbnail.jpg",
          fileType: "image/jpeg",
          fileSize: thumbnail.size,
        }),
      })

      if (thumbnailPresignResponse.ok) {
        const thumbnailPresign = (await thumbnailPresignResponse.json()) as {
          uploadUrl: string
          key: string
        }
        const thumbnailUploadResponse = await fetch(thumbnailPresign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: thumbnail,
        })
        if (thumbnailUploadResponse.ok) thumbnailKey = thumbnailPresign.key
      }
    }

    const finalizeResponse = await fetch("/api/videos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        thumbnailKey,
        title,
        description: description || undefined,
        width: width ?? undefined,
        height: height ?? undefined,
      }),
    })
    if (!finalizeResponse.ok) {
      throw await responseError(finalizeResponse, "Upload failed. Please try again.")
    }

    return (await finalizeResponse.json()) as UploadedVideo
  } catch (error) {
    if (key) {
      fetch("/api/videos/finalize", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, thumbnailKey }),
      }).catch(() => {})
    }
    throw error
  }
}
