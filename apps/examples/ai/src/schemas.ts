import { z } from "zod"

export const CreateNote = z.object({
  title: z.string().min(1),
  content: z.string(),
})

export const SearchQuery = z.object({
  q: z.string().min(1),
})
