// app/decks/[deckId]/flashcards/page.tsx

import FlashcardStudyClient from "./FlashcardStudyClient"

interface PageProps {
    params: Promise<{ deckId: string }>
}

export default async function Page(props: PageProps) {
    const { deckId } = await props.params // unwrap Promise<{ deckId }>

    return <FlashcardStudyClient deckId={deckId} />
}
