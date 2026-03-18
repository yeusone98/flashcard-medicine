import fs from "node:fs"
import path from "node:path"

import { MongoClient, ObjectId } from "mongodb"

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return {}
  }

  const env = {}
  const content = fs.readFileSync(envPath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf("=")
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }

  return env
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function usageAndExit(message) {
  if (message) {
    console.error(message)
  }
  console.log("Usage:")
  console.log("  node scripts/backfill-orphan-decks.mjs --dry-run")
  console.log(
    "  node scripts/backfill-orphan-decks.mjs --apply --user-id <mongo_user_id>",
  )
  process.exit(message ? 1 : 0)
}

const args = new Set(process.argv.slice(2))
const mode = args.has("--apply") ? "apply" : "dry-run"
if (args.has("--help")) {
  usageAndExit()
}

const explicitUserId = getArgValue("--user-id")
if (explicitUserId && !ObjectId.isValid(explicitUserId)) {
  usageAndExit(`Invalid --user-id: ${explicitUserId}`)
}

const rootDir = process.cwd()
const fileEnv = readEnvFile(path.join(rootDir, ".env"))
const mongoUri = process.env.MONGODB_URI || fileEnv.MONGODB_URI
if (!mongoUri) {
  usageAndExit("Missing MONGODB_URI in environment or .env")
}

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 45000 })

try {
  await client.connect()
  const db = client.db("flashcard_medicine")

  const usersCol = db.collection("users")
  const decksCol = db.collection("decks")

  const users = await usersCol
    .find({}, { projection: { email: 1, name: 1, createdAt: 1 } })
    .sort({ createdAt: 1 })
    .toArray()

  let targetUserId = explicitUserId
  if (!targetUserId) {
    if (users.length !== 1) {
      throw new Error(
        `Found ${users.length} users. Pass --user-id to select the restore owner.`,
      )
    }
    targetUserId = users[0]._id.toString()
  }

  const targetUser = await usersCol.findOne(
    { _id: new ObjectId(targetUserId) },
    { projection: { email: 1, name: 1 } },
  )
  if (!targetUser) {
    throw new Error(`Target user not found: ${targetUserId}`)
  }

  const orphanDecks = await decksCol
    .find(
      {
        $or: [{ userId: { $exists: false } }, { userId: null }],
      },
      {
        projection: {
          name: 1,
          subject: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray()

  console.log(
    JSON.stringify(
      {
        mode,
        orphanDeckCount: orphanDecks.length,
        targetUser: {
          _id: targetUser._id.toString(),
          email: targetUser.email ?? null,
          name: targetUser.name ?? null,
        },
        orphanDecks: orphanDecks.map((deck) => ({
          _id: deck._id.toString(),
          name: deck.name ?? null,
          subject: deck.subject ?? null,
          createdAt: deck.createdAt ?? null,
        })),
      },
      null,
      2,
    ),
  )

  if (mode !== "apply" || orphanDecks.length === 0) {
    process.exit(0)
  }

  const orphanIds = orphanDecks.map((deck) => deck._id)
  const result = await decksCol.updateMany(
    {
      _id: { $in: orphanIds },
      $or: [{ userId: { $exists: false } }, { userId: null }],
    },
    {
      $set: { userId: new ObjectId(targetUserId) },
    },
  )

  console.log(
    JSON.stringify(
      {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      null,
      2,
    ),
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.close()
}
