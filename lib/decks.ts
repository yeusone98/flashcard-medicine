import type { Collection, InsertOneResult } from "mongodb"

import { getDefaultDeckOptions } from "@/lib/fsrs"
import {
  type DeckDoc,
  getDecksCollection,
  ObjectId,
} from "@/lib/mongodb"

type CreateDeckInput = {
  userId: string
  name: string
  description?: string | null
  subject?: string | null
  options?: DeckDoc["options"] | null
  isPublic?: boolean
  shareToken?: string | null
  createdAt?: Date
  updatedAt?: Date
  decksCol?: Collection<DeckDoc>
}

const normalizeOptionalString = (value?: string | null) => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export async function createDeck(
  input: CreateDeckInput,
): Promise<InsertOneResult<DeckDoc>> {
  const normalizedUserId =
    typeof input.userId === "string" ? input.userId.trim() : ""
  if (!normalizedUserId || !ObjectId.isValid(normalizedUserId)) {
    throw new Error("createDeck requires a valid userId")
  }

  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name) {
    throw new Error("createDeck requires a non-empty deck name")
  }

  const now = input.createdAt ?? new Date()
  const updatedAt = input.updatedAt ?? now

  const doc: DeckDoc = {
    userId: new ObjectId(normalizedUserId),
    name,
    description: normalizeOptionalString(input.description),
    subject: normalizeOptionalString(input.subject),
    options: input.options ?? getDefaultDeckOptions(),
    createdAt: now,
    updatedAt,
  }

  if (typeof input.isPublic === "boolean") {
    doc.isPublic = input.isPublic
  }

  const shareToken = normalizeOptionalString(input.shareToken)
  if (shareToken) {
    doc.shareToken = shareToken
  }

  const decksCol = input.decksCol ?? (await getDecksCollection())
  return decksCol.insertOne(doc)
}
