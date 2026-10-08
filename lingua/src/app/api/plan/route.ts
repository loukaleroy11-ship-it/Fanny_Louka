import { route, ok } from "@/lib/api";
import { generatePlan } from "@/lib/plan";

export const GET = route(async ({ user }) => ok(await generatePlan(user.id)));
