import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { sendAlipay, sendEmail, sendSms, sendWechat } from "@/lib/distribution";

type SubscriberRow = {
  id: string;
  email: string | null;
  phone: string | null;
  wechat_target: string | null;
  alipay_target: string | null;
  channels: string[];
  interests: string[];
};

async function deliver(
  channel: string,
  subscriber: SubscriberRow,
  title: string,
  body: string
) {
  if (channel === "email" && subscriber.email) return sendEmail(subscriber.email, title, body);
  if (channel === "wechat" && subscriber.wechat_target) return sendWechat(subscriber.wechat_target, title, body);
  if (channel === "sms" && subscriber.phone) return sendSms(subscriber.phone, body);
  if (channel === "alipay" && subscriber.alipay_target) return sendAlipay(subscriber.alipay_target, title, body);
  return { ok: false, provider: channel, error: "missing-target" };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });
  const client = db();
  if (!client) return new NextResponse("Database unavailable", { status: 503 });

  const { id } = await context.params;
  const campaignResult = await client.query(
    "select id, title, body, audience, channels, status from campaigns where id=$1 limit 1",
    [id]
  );
  const campaign = campaignResult.rows[0];
  if (!campaign) return new NextResponse("Campaign not found", { status: 404 });

  const subscriberResult = await client.query(
    `select id, email, phone, wechat_target, alipay_target, channels, interests
       from subscribers
      where status='active'
      order by created_at asc
      limit 500`
  );

  const channels = Array.isArray(campaign.channels) ? campaign.channels : [];
  const subscribers = subscriberResult.rows.filter((subscriber: SubscriberRow) => {
    if (campaign.audience === "all") return true;
    return Array.isArray(subscriber.interests) && subscriber.interests.includes(campaign.audience);
  });

  let sent = 0;
  let failed = 0;

  for (let offset = 0; offset < subscribers.length; offset += 10) {
    const batch = subscribers.slice(offset, offset + 10);
    await Promise.all(batch.flatMap((subscriber: SubscriberRow) =>
      channels.map(async (channel: string) => {
        const optedIn = Array.isArray(subscriber.channels) && subscriber.channels.includes(channel);
        if (!optedIn) return;

        const result = await deliver(channel, subscriber, campaign.title, campaign.body);
        await client.query(
          `insert into deliveries(campaign_id, subscriber_id, channel, provider, status, provider_message_id, error, sent_at)
           values($1,$2,$3,$4,$5,$6,$7,case when $5='sent' then now() else null end)`,
          [
            campaign.id,
            subscriber.id,
            channel,
            result.provider,
            result.ok ? "sent" : "failed",
            result.messageId || null,
            result.error || null
          ]
        );

        if (result.ok) sent++;
        else failed++;
      })
    ));
  }

  await client.query(
    "update campaigns set status='sent', sent_at=now(), updated_at=now() where id=$1",
    [campaign.id]
  );

  const url = new URL("/admin/campaigns", request.url);
  url.searchParams.set("sent", String(sent));
  url.searchParams.set("failed", String(failed));
  return NextResponse.redirect(url, 303);
}
