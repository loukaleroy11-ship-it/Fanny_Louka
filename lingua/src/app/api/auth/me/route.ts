import { route, ok } from "@/lib/api";
import { toClientUser } from "@/lib/clientuser";

export const GET = route(async ({ user }) => ok({ user: await toClientUser(user) }));
