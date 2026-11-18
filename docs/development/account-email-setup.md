# Account email setup for two-device testing

Use the existing Travel Life project:
https://supabase.com/dashboard/project/fgmcnzxhbrtvjhtafort/auth/smtp

Enable custom SMTP and enter the values issued by your email provider:

| Supabase field | Value to obtain from provider |
| --- | --- |
| Sender email | Verified sender address on your domain |
| Sender name | Travel Life |
| Host | SMTP server hostname |
| Port | Provider's TLS/STARTTLS SMTP port |
| Username | SMTP username |
| Password | SMTP password or provider-specific SMTP credential |

Verify the sender domain with the provider's DNS records (SPF/DKIM and its
recommended DMARC configuration). Do not paste credentials into chat or commit
them to this repository. Use the Supabase dashboard's protected SMTP fields.

In Auth email templates, the email used by `signInWithOtp` must contain the code
`{{ .Token }}`; a link-only template cannot serve this app's code-entry flow.
The current project reports eight-digit codes and a one-minute request interval;
the app supports six to ten digits. Preserve confirmation and server rate limits.

The live Dashboard currently requires custom SMTP before it allows template
subject/body editing. After SMTP is saved, edit both Confirm sign up and Magic
link or OTP templates to include `{{ .Token }}` for new and returning accounts.

After saving, request one code from Settings → Account and sources with your own
email, enter the received code, then sign in with that same email on the second
phone. Actual delivery remains pending until this provider configuration exists.
No personal email or OTP is required in an automated test or chat.

Reference: https://supabase.com/docs/guides/auth/auth-smtp
