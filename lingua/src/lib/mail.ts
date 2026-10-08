/**
 * Sends the password-reset e-mail through Resend (https://resend.com) when RESEND_API_KEY is set.
 * Returns false when no provider is configured — the caller then logs the link (dev only).
 */
export async function sendResetEmail(to: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[mail] RESEND_API_KEY not set — password reset link for ${to}: ${link}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Lingua <no-reply@example.com>",
      to,
      subject: "Réinitialisation de votre mot de passe Lingua",
      html: `<p>Bonjour,</p><p>Pour choisir un nouveau mot de passe, cliquez ici (valable 1 heure) :</p><p><a href="${link}">${link}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    }),
  });
  if (!res.ok) console.error("[mail] Resend error", res.status);
  return res.ok;
}
