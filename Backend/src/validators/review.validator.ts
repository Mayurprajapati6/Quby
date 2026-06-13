import { z } from "zod";

export const submitReviewSchema = z.object({
  booking_id: z
    .string({ required_error: "booking_id is required." })
    .uuid("booking_id must be a valid UUID."),
  rating: z.coerce
    .number({ required_error: "rating is required." })
    .int()
    .min(1, "rating must be at least 1.")
    .max(5, "rating must be at most 5."),
  comment: z.string().max(1000, "comment must be 1000 characters or fewer.").optional(),
});

export const respondToReviewSchema = z.object({
  response: z
    .string({ required_error: "response is required." })
    .min(1, "Response cannot be empty.")
    .max(1000, "Response must be 1000 characters or fewer."),
});

export const myReviewsQuerySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(50).default(10),
});

export type SubmitReviewInput     = z.infer<typeof submitReviewSchema>;
export type RespondToReviewInput  = z.infer<typeof respondToReviewSchema>;
export type MyReviewsQueryInput   = z.infer<typeof myReviewsQuerySchema>;
