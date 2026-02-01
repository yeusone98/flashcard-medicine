import {
  Card,
  type Grade,
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type FSRSParameters,
  type Steps,
  type StepUnit,
} from "ts-fsrs"

export type DeckOptions = {
  newPerDay: number
  reviewPerDay: number
  learningSteps: string[]
  relearningSteps: string[]
}

const DEFAULT_LEARNING_STEPS: string[] = ["1m", "10m"]
const DEFAULT_RELEARNING_STEPS: string[] = ["10m"]

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  newPerDay: 20,
  reviewPerDay: 200,
  learningSteps: DEFAULT_LEARNING_STEPS,
  relearningSteps: DEFAULT_RELEARNING_STEPS,
}

export type FsrsQueue = "new" | "learn" | "review"

const STEP_PATTERN = /^\s*\d+\s*(m|h|d)\s*$/i

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const parseNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

const normalizeStep = (value: string): StepUnit | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!STEP_PATTERN.test(trimmed)) return null
  return trimmed.toLowerCase() as StepUnit
}

export const normalizeSteps = (
  input: unknown,
  fallback: string[],
): string[] => {
  if (input === undefined || input === null) {
    return [...fallback]
  }

  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[,\\n]/)
      : []

  const parsed = raw
    .map((item) => (typeof item === "string" ? normalizeStep(item) : null))
    .filter((step): step is StepUnit => Boolean(step))

  return parsed.length > 0 ? parsed : []
}

export const normalizeDeckOptions = (
  input?: Partial<DeckOptions> | null,
): DeckOptions => {
  const base = DEFAULT_DECK_OPTIONS
  const newPerDay = clampNumber(parseNumber(input?.newPerDay, base.newPerDay), 0, 9999)
  const reviewPerDay = clampNumber(
    parseNumber(input?.reviewPerDay, base.reviewPerDay),
    0,
    9999,
  )
  const learningSteps = normalizeSteps(input?.learningSteps, base.learningSteps)
  const relearningSteps = normalizeSteps(
    input?.relearningSteps,
    base.relearningSteps,
  )

  return {
    newPerDay,
    reviewPerDay,
    learningSteps,
    relearningSteps,
  }
}

export const getDefaultDeckOptions = (): DeckOptions => ({
  newPerDay: DEFAULT_DECK_OPTIONS.newPerDay,
  reviewPerDay: DEFAULT_DECK_OPTIONS.reviewPerDay,
  learningSteps: [...DEFAULT_DECK_OPTIONS.learningSteps],
  relearningSteps: [...DEFAULT_DECK_OPTIONS.relearningSteps],
})

export const createFsrsParams = (options: DeckOptions): FSRSParameters =>
  generatorParameters({
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: options.learningSteps as Steps,
    relearning_steps: options.relearningSteps as Steps,
  })

export const mapStateToQueue = (state?: number): FsrsQueue => {
  switch (state) {
    case State.Learning:
    case State.Relearning:
      return "learn"
    case State.Review:
      return "review"
    case State.New:
    default:
      return "new"
  }
}

export const mapStateToLabel = (state: State): "new" | "learning" | "review" | "relearning" => {
  switch (state) {
    case State.Learning:
      return "learning"
    case State.Review:
      return "review"
    case State.Relearning:
      return "relearning"
    case State.New:
    default:
      return "new"
  }
}

export const mapRatingToLabel = (
  rating: Grade,
): "again" | "hard" | "good" | "easy" => {
  switch (rating) {
    case Rating.Hard:
      return "hard"
    case Rating.Good:
      return "good"
    case Rating.Easy:
      return "easy"
    case Rating.Again:
    default:
      return "again"
  }
}

export const mapFlashcardRating = (
  rating: "hard" | "medium" | "easy",
): Grade => {
  if (rating === "hard") return Rating.Hard
  if (rating === "medium") return Rating.Good
  return Rating.Easy
}

export const mapReviewRating = (
  rating: "again" | "hard" | "good" | "easy",
): Grade => {
  switch (rating) {
    case "again":
      return Rating.Again
    case "hard":
      return Rating.Hard
    case "good":
      return Rating.Good
    case "easy":
    default:
      return Rating.Easy
  }
}

export type FsrsCardInput = {
  fsrsState?: number
  fsrsStability?: number
  fsrsDifficulty?: number
  fsrsElapsedDays?: number
  fsrsScheduledDays?: number
  fsrsLearningSteps?: number
  fsrsReps?: number
  fsrsLapses?: number
  dueAt?: Date | null
  lastReviewedAt?: Date | null
}

export const buildFsrsCard = (input: FsrsCardInput, now: Date): Card => {
  const card = createEmptyCard(now)

  if (typeof input.fsrsState === "number") {
    card.state = input.fsrsState as State
  }
  if (typeof input.fsrsStability === "number") {
    card.stability = input.fsrsStability
  }
  if (typeof input.fsrsDifficulty === "number") {
    card.difficulty = input.fsrsDifficulty
  }
  if (typeof input.fsrsElapsedDays === "number") {
    card.elapsed_days = input.fsrsElapsedDays
  }
  if (typeof input.fsrsScheduledDays === "number") {
    card.scheduled_days = input.fsrsScheduledDays
  }
  if (typeof input.fsrsLearningSteps === "number") {
    card.learning_steps = input.fsrsLearningSteps
  }
  if (typeof input.fsrsReps === "number") {
    card.reps = input.fsrsReps
  }
  if (typeof input.fsrsLapses === "number") {
    card.lapses = input.fsrsLapses
  }
  if (input.dueAt instanceof Date) {
    card.due = input.dueAt
  }
  if (input.lastReviewedAt instanceof Date) {
    card.last_review = input.lastReviewedAt
  }

  return card
}

export const scheduleFsrsReview = (
  card: Card,
  rating: Grade,
  now: Date,
  options: DeckOptions,
) => {
  const scheduler = fsrs(createFsrsParams(options))
  return scheduler.next(card, now, rating)
}
