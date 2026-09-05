import { getDb, type MediaDoc } from "@/lib/mongodb"
export async function mediaIsReferenced(media: Pick<MediaDoc, "url" | "publicId">): Promise<boolean> {
  const db = await getDb()
  for (const [name, projection] of [
    ["decks", { description: 1 }],
    ["flashcards", { front: 1, back: 1, frontImage: 1, backImage: 1, frontAudio: 1, backAudio: 1, fields: 1, note: 1 }],
    ["questions", { question: 1, image: 1, explanation: 1, choices: 1 }],
    ["users", { image: 1 }],
  ] as const) {
    const cursor = db.collection(name).find({}, { projection })
    try {
      for await (const doc of cursor) {
        const text = JSON.stringify(doc)
        if (text.includes(media.url) || (media.publicId && text.includes(media.publicId))) return true
      }
    } finally { await cursor.close() }
  }
  return false
}
