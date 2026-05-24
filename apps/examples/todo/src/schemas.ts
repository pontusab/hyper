import { z } from "zod"

export const CreateTodo = z.object({
  title: z.string().min(1).max(256),
})

export const TodoParams = z.object({
  id: z.string().min(1),
})
