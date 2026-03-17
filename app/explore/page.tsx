// app/explore/page.tsx
import type { Metadata } from "next"
import ExploreClient from "./explore-client"

export const metadata: Metadata = {
  title: "Khám phá | Flashcard Medicine",
  description: "Khám phá các bộ flashcard y học công khai từ cộng đồng.",
}

export default function ExplorePage() {
  return <ExploreClient />
}
