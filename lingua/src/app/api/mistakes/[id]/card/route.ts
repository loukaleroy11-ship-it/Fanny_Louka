import { route, ok, ApiError } from "@/lib/api";
import { createMistakeCard } from "@/lib/mistakes";

/** "Add to my flashcards" for one mistake. */
export const POST = route<{ id: string }>(async ({ user, params }) => {
  const r = await createMistakeCard(user.id, params.id);
  if (!r) throw new ApiError(404, "Mistake not found");
  return ok(r, { status: r.created ? 201 : 200 });
});
