import { site } from "@/lib/site";

export function GET() {
  const body = `# ResetWatch

> ResetWatch is an independent Chinese-language intelligence and notification service for Codex / ChatGPT Work usage-limit reset signals. It is not an OpenAI product.

## Canonical URL
${site.url}

## Primary topics
- Codex / ChatGPT Work reset signals
- completed vs scheduled vs banked reset classification
- PT / PST / PDT to China Standard Time conversion
- AI project discovery from Tibo (@thsottiaux)
- responsible usage planning before a reset

## Important pages
- ${site.url}/reset — verified reset timeline
- ${site.url}/guides/codex-reset — how to interpret reset signals
- ${site.url}/guides/banked-reset — banked reset explanation
- ${site.url}/guides/timezone — timezone conversion
- ${site.url}/faq — common questions
- ${site.url}/projects — project radar

## Source principles
Core reset claims should preserve the original public X permalink when available. Unknown or ambiguous reset times must not be presented as precise facts.

## Product disclosure
ResetWatch is independent and does not represent OpenAI or Tibo.
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
