/** Single-user mode: sign-up is closed unless ALLOW_REGISTRATION=true (accounts are created with `npm run user:create`). */
export const registrationOpen = () => process.env.ALLOW_REGISTRATION === "true";
