import "server-only";

export type DeliveryResult = {
  ok: boolean;
  provider: string;
  messageId?: string;
  error?: string;
};

async function postJson(url: string, payload: unknown, headers: Record<string,string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });

  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!response.ok) {
    throw new Error("HTTP " + response.status + ": " + text.slice(0, 240));
  }
  return data;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, provider: "resend", error: "provider-not-configured" };

  try {
    const result = await postJson("https://api.resend.com/emails", {
      from,
      to: [to],
      subject,
      text: body
    }, { authorization: "Bearer " + apiKey });

    return { ok: true, provider: "resend", messageId: result?.id };
  } catch (error) {
    return { ok: false, provider: "resend", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendWechat(uid: string, title: string, body: string, url?: string): Promise<DeliveryResult> {
  const token = process.env.WXPUSHER_APP_TOKEN;
  if (!token) return { ok: false, provider: "wxpusher", error: "provider-not-configured" };

  try {
    const result = await postJson("https://wxpusher.zjiecode.com/api/send/message", {
      appToken: token,
      content: body,
      summary: title,
      contentType: 1,
      uids: [uid],
      url
    });

    if (Number(result?.code) !== 1000) throw new Error("WxPusher business error");
    return { ok: true, provider: "wxpusher", messageId: String(result?.data?.[0]?.messageId || "") };
  } catch (error) {
    return { ok: false, provider: "wxpusher", error: error instanceof Error ? error.message : String(error) };
  }
}

async function sendWebhook(
  provider: string,
  webhook: string | undefined,
  secret: string | undefined,
  payload: unknown
): Promise<DeliveryResult> {
  if (!webhook) return { ok: false, provider, error: "provider-not-configured" };
  try {
    const result = await postJson(webhook, payload, secret ? { authorization: "Bearer " + secret } : {});
    return { ok: true, provider, messageId: String(result?.id || result?.messageId || "") };
  } catch (error) {
    return { ok: false, provider, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendSms(phone: string, body: string): Promise<DeliveryResult> {
  return sendWebhook(
    "sms-webhook",
    process.env.SMS_WEBHOOK_URL,
    process.env.SMS_WEBHOOK_SECRET,
    { phone, body }
  );
}

export async function sendAlipay(target: string, title: string, body: string): Promise<DeliveryResult> {
  return sendWebhook(
    "alipay-webhook",
    process.env.ALIPAY_WEBHOOK_URL,
    process.env.ALIPAY_WEBHOOK_SECRET,
    { target, title, body }
  );
}
