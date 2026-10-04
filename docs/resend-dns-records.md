# DNS records to add for Resend email delivery

Add these four records for `muwatta.com.ng` at your domain host
(WhoGoHost — nameservers `nsa.whogohost.com` / `nsb.whogohost.com`).

The DKIM record is long. Copy it exactly, including the `p=` prefix and no
spaces or line breaks.

| Type | Name | Value | Notes |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvIr4ihXIrBlYTHnIvAJuM1e4v9cxQWxZr2Qtd/CgZMQArIhRErmklvXnVlyaGkA0woPBCB9Lmy0nXZ6IXde0GpEeBzOIgOD1btAtS7bG9cyNljvGLugEyBvMsBVSWAs3KBJgPL/c1AswmxL9E/J9VUMOya/V0CmCcyKzgBs9T3QIDAQAB` | DKIM public key |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | Priority `10` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF for the sending host |
| CNAME | `rsend` | `send.forge.rmta.net` | Return-path / bounce handling |

## Do not change the apex SPF or MX records

The existing apex records are correct and Resend does not need them altered:

- `muwatta.com.ng` TXT already reads
  `v=spf1 +a +mx +include:relay.mailchannels.net +include:spf.antispamcloud.com ~all`
  and is left exactly as it is.
- `muwatta.com.ng` MX is `0 muwatta.com.ng.`, a null MX. That is normal for a
  send-only transactional domain and should stay.

Resend sends from the `send` subdomain, which is why the apex `~all` does not
block it. Replacing the apex SPF with Resend's would break the existing
MailChannels and AntispamCloud sending.

## After adding

Resend usually verifies within a few minutes. The domain shows `verified` in
Resend under Domains. Only then should Supabase Auth be pointed at
`smtp.resend.com`, because sending before verification would hard-bounce, which
is the problem this is meant to fix.

Optional but worthwhile: a DMARC record at `_dmarc.muwatta.com.ng`, starting at
`v=DMARC1; p=none; rua=mailto:...` once SPF and DKIM are healthy. Add it last,
never `p=reject` on the first attempt.