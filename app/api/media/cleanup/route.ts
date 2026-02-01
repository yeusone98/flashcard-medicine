import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/auth"
import cloudinary from "@/lib/cloudinary"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getMediaCollection,
  getQuestionsCollection,
  getUsersCollection,
} from "@/lib/mongodb"

export const runtime = "nodejs"

function getUserIdFromSession(session: Session | null): string | undefined {
  if (!session?.user) return undefined
  if ("id" in session.user && typeof session.user.id === "string") {
    return session.user.id
  }
  return undefined
}

const URL_REGEX = /https?:\/\/[^\s"'<>]+/gi

const cleanUrl = (value: string) => value.replace(/[),.;]+$/g, "")

const addUrl = (set: Set<string>, value?: string | null) => {
  if (!value) return
  set.add(cleanUrl(value))
}

const addUrlsFromText = (set: Set<string>, value?: string | null) => {
  if (!value) return
  const matches = value.match(URL_REGEX)
  if (!matches) return
  matches.forEach((url) => addUrl(set, url))
}

const addUrlsFromFields = (
  set: Set<string>,
  fields?: Record<string, string> | null,
) => {
  if (!fields) return
  Object.values(fields).forEach((val) => addUrlsFromText(set, val))
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1"

    const [mediaCol, decksCol, flashcardsCol, questionsCol, usersCol] =
      await Promise.all([
        getMediaCollection(),
        getDecksCollection(),
        getFlashcardsCollection(),
        getQuestionsCollection(),
        getUsersCollection(),
      ])

    const usedUrls = new Set<string>()

    const [decks, flashcards, questions, users, media] = await Promise.all([
      decksCol
        .find({}, { projection: { description: 1 } })
        .toArray(),
      flashcardsCol
        .find(
          {},
          {
            projection: {
              front: 1,
              back: 1,
              frontImage: 1,
              backImage: 1,
              frontAudio: 1,
              backAudio: 1,
              fields: 1,
            },
          },
        )
        .toArray(),
      questionsCol
        .find(
          {},
          {
            projection: {
              question: 1,
              explanation: 1,
              image: 1,
              choices: 1,
            },
          },
        )
        .toArray(),
      usersCol.find({}, { projection: { image: 1 } }).toArray(),
      mediaCol.find({}).toArray(),
    ])

    decks.forEach((deck) => {
      addUrlsFromText(usedUrls, deck.description ?? "")
    })

    flashcards.forEach((card) => {
      addUrl(usedUrls, card.frontImage ?? "")
      addUrl(usedUrls, card.backImage ?? "")
      addUrl(usedUrls, card.frontAudio ?? "")
      addUrl(usedUrls, card.backAudio ?? "")
      addUrlsFromText(usedUrls, card.front ?? "")
      addUrlsFromText(usedUrls, card.back ?? "")
      addUrlsFromFields(usedUrls, card.fields ?? null)
    })

    questions.forEach((question) => {
      addUrl(usedUrls, question.image ?? "")
      addUrlsFromText(usedUrls, question.question ?? "")
      addUrlsFromText(usedUrls, question.explanation ?? "")
      if (Array.isArray(question.choices)) {
        question.choices.forEach((choice) => {
          if (choice?.image) addUrl(usedUrls, choice.image)
          if (choice?.text) addUrlsFromText(usedUrls, choice.text)
        })
      }
    })

    users.forEach((user) => addUrl(usedUrls, user.image ?? ""))

    const usedList = Array.from(usedUrls)

    const orphans = media.filter((item) => {
      if (usedUrls.has(item.url)) return false
      if (!item.publicId) return true
      return !usedList.some((url) => url.includes(item.publicId))
    })

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        checked: media.length,
        orphanCount: orphans.length,
        orphans: orphans.map((item) => ({
          id: item._id?.toString(),
          url: item.url,
          kind: item.kind,
        })),
      })
    }

    const orphanIds = orphans
      .map((item) => item._id)
      .filter(Boolean)

    const deleteTargets = orphans.filter((item) => item.publicId)
    const deleteResults = await Promise.allSettled(
      deleteTargets.map((item) =>
        cloudinary.uploader.destroy(item.publicId, {
          resource_type: item.resourceType ?? "image",
          invalidate: true,
        }),
      ),
    )

    const failedDeletes = deleteResults.filter(
      (result) => result.status === "rejected",
    )

    if (orphanIds.length > 0) {
      await mediaCol.deleteMany({ _id: { $in: orphanIds } })
    }

    return NextResponse.json({
      dryRun: false,
      checked: media.length,
      removedCount: orphanIds.length,
      failedDeletes: failedDeletes.length,
    })
  } catch (error) {
    console.error("Media cleanup error", error)
    return NextResponse.json(
      { error: "Failed to cleanup media" },
      { status: 500 },
    )
  }
}
