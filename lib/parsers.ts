// lib/parsers.ts
export function parseClozeFlashcards(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  const cards: { front: string; back: string; answer: string }[] = []
  const legacyPattern = /\{\{(?!c\d+::)(.+?)\}\}/g
  const clozePattern =
    /\{\{c\d+::([\s\S]+?)(?:::([\s\S]+?))?\}\}/gi

  for (const line of lines) {
    let normalized = line
    normalized = normalized.replace(legacyPattern, (_match, rawAnswer) => {
      const answer = String(rawAnswer || "").trim()
      return `{{c1::${answer}}}`
    })

    const matches = Array.from(normalized.matchAll(clozePattern))
    if (matches.length === 0) continue

    const answers = matches
      .map((match) => String(match[1] || "").trim())
      .filter(Boolean)

    if (answers.length === 0) continue

    cards.push({
      front: normalized,
      back: normalized,
      answer: answers[0],
    })
  }

  return cards
}

export function parseQAPairs(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  const cards: { front: string; back: string }[] = []

  let currentQ = ''
  let currentA = ''

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      // nếu đã có Q/A trước đó thì push
      if (currentQ && currentA) {
        cards.push({ front: currentQ, back: currentA })
      }
      currentQ = line.replace(/^Q:\s*/, '')
      currentA = ''
    } else if (line.startsWith('A:')) {
      currentA = line.replace(/^A:\s*/, '')
    }
  }

  // push cặp cuối
  if (currentQ && currentA) {
    cards.push({ front: currentQ, back: currentA })
  }

  return cards
}


// lib/parsers.ts

export function parseMCFromText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  type Choice = { label: string; text: string }

  const questions: {
    question: string
    choices: { text: string; isCorrect: boolean }[]
    explanation?: string
  }[] = []

  let currentQ = ''
  let options: Choice[] = []
  let correctLabel = ''
  let currentExplanation = ''

  const pushCurrent = () => {
    if (!currentQ || !options.length || !correctLabel) return

    const choices = options.map(o => ({
      text: o.text,
      isCorrect: o.label.toUpperCase() === correctLabel.toUpperCase(),
    }))

    questions.push({
      question: currentQ,
      choices,
      explanation: currentExplanation || undefined,
    })

    currentQ = ''
    options = []
    correctLabel = ''
    currentExplanation = ''
  }

  for (const line of lines) {
    if (line.startsWith('Q:')) {
      pushCurrent()
      currentQ = line.replace(/^Q:\s*/, '')
    } else if (/^[A-Za-z]\s*:/.test(line)) {
      const label = line[0].toUpperCase()
      const textPart = line.slice(2).trim()
      options.push({ label, text: textPart })
    } else if (line.toLowerCase().startsWith('correct')) {
      const match = line.match(/correct\s*:?\s*([A-Za-z])/i)
      if (match) correctLabel = match[1].toUpperCase()
    } else if (
      line.toLowerCase().startsWith('explain') ||
      line.toLowerCase().startsWith('giải thích')
    ) {
      currentExplanation = line.replace(/^(Explain|Giải thích)\s*:?\s*/i, '')
    }
  }

  pushCurrent()

  return questions
}

