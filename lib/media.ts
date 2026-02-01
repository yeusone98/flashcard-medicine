// lib/media.ts
import crypto from "crypto"
import cloudinary from "@/lib/cloudinary"
import { getMediaCollection, ObjectId, type MediaDoc } from "@/lib/mongodb"

export type MediaKind = "image" | "audio"

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_AUDIO_SIZE = 15 * 1024 * 1024

const inferKind = (mimeType: string | undefined): MediaKind | null => {
  if (!mimeType) return null
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("audio/")) return "audio"
  return null
}

const buildDataUri = (buffer: Buffer, mimeType: string) => {
  const base64 = buffer.toString("base64")
  return `data:${mimeType};base64,${base64}`
}

export type UploadMediaResult = {
  media: MediaDoc & { _id: ObjectId }
  reused: boolean
}

export async function uploadMediaFile(
  file: File,
  options?: {
    kind?: MediaKind
    ownerId?: string
  },
): Promise<UploadMediaResult> {
  const mimeType = file.type || "application/octet-stream"
  const kind = options?.kind ?? inferKind(mimeType)

  if (!kind) {
    throw new Error("Unsupported media type")
  }

  const maxSize = kind === "image" ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE
  if (file.size > maxSize) {
    throw new Error(
      kind === "image"
        ? "Image is too large (max 5MB)"
        : "Audio is too large (max 15MB)",
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex")

  const mediaCol = await getMediaCollection()
  const existing = await mediaCol.findOne({ sha256, kind })

  if (existing?._id) {
    return {
      media: existing as MediaDoc & { _id: ObjectId },
      reused: true,
    }
  }

  const baseFolder = process.env.CLOUDINARY_FOLDER || "flashcard-medicine"
  const folder = `${baseFolder}/media/${kind}`
  const resourceType = kind === "audio" ? "video" : "image"
  const dataUri = buildDataUri(buffer, mimeType)

  const uploadResult = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: sha256,
    overwrite: true,
    resource_type: resourceType,
  })

  const now = new Date()
  const ownerObjectId =
    options?.ownerId && ObjectId.isValid(options.ownerId)
      ? new ObjectId(options.ownerId)
      : undefined

  const doc: MediaDoc = {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    kind,
    resourceType: uploadResult.resource_type as "image" | "video",
    format: uploadResult.format,
    bytes: uploadResult.bytes,
    width: typeof uploadResult.width === "number" ? uploadResult.width : undefined,
    height:
      typeof uploadResult.height === "number" ? uploadResult.height : undefined,
    duration:
      typeof uploadResult.duration === "number"
        ? uploadResult.duration
        : undefined,
    sha256,
    ownerId: ownerObjectId,
    createdAt: now,
    updatedAt: now,
  }

  const result = await mediaCol.insertOne(doc)

  return {
    media: { ...doc, _id: result.insertedId },
    reused: false,
  }
}
