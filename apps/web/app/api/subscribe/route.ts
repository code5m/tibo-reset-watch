import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function clean(value: FormDataEntryValue | null, max = 200) {
  return String(value || "").trim().slice(0, max);
}

function validEmail(email: string) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPhone(phone: string) {
  return !phone || /^\+?[0-9\-\s]{6,24}$/.test(phone);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const website = clean(form.get("website"));
  if (website) return NextResponse.redirect(new URL("/subscribe?ok=1", request.url), 303);

  const email = clean(form.get("email")).toLowerCase();
  const phone = clean(form.get("phone"), 32);
  const name = clean(form.get("name"), 80);
  const wechatTarget = clean(form.get("wechatTarget"), 120);
  const alipayTarget = clean(form.get("alipayTarget"), 120);
  const source = clean(form.get("source"), 80) || "website";
  const referralCode = clean(form.get("referralCode"), 32);
  const interests = form.getAll("interests").map(value => clean(value, 40)).filter(Boolean);
  const requestedChannels = form.getAll("channels").map(value => clean(value, 20));

  if (!email && !phone && !wechatTarget && !alipayTarget) {
    return NextResponse.redirect(new URL("/subscribe?error=contact", request.url), 303);
  }
  if (!validEmail(email) || !validPhone(phone)) {
    return NextResponse.redirect(new URL("/subscribe?error=format", request.url), 303);
  }

  const channels = requestedChannels.filter(channel => {
    if (channel === "email") return Boolean(email);
    if (channel === "sms") return Boolean(phone);
    if (channel === "wechat") return Boolean(wechatTarget);
    if (channel === "alipay") return Boolean(alipayTarget);
    return false;
  });

  if (!channels.length) {
    if (email) channels.push("email");
    else if (phone) channels.push("sms");
    else if (wechatTarget) channels.push("wechat");
    else if (alipayTarget) channels.push("alipay");
  }

  const client = db();
  if (!client) {
    return NextResponse.redirect(new URL("/subscribe?error=database", request.url), 303);
  }

  try {
    let subscriber: { id: string; referral_code: string } | undefined;
    if (email) {
      const saved = await client.query(
        `insert into subscribers(email, phone, wechat_target, alipay_target, name, status, channels, interests, source)
         values($1,$2,$3,$4,$5,'active',$6::jsonb,$7::jsonb,$8)
         on conflict (lower(email)) where email is not null
         do update set
           phone = coalesce(excluded.phone, subscribers.phone),
           wechat_target = coalesce(excluded.wechat_target, subscribers.wechat_target),
           alipay_target = coalesce(excluded.alipay_target, subscribers.alipay_target),
           name = coalesce(excluded.name, subscribers.name),
           status = 'active',
           channels = excluded.channels,
           interests = excluded.interests,
           updated_at = now()
         returning id, referral_code`,
        [email, phone || null, wechatTarget || null, alipayTarget || null, name || null, JSON.stringify(channels), JSON.stringify(interests.length ? interests : ["reset"]), source]
      );
      subscriber = saved.rows[0];
    } else if (phone) {
      const saved = await client.query(
        `insert into subscribers(email, phone, wechat_target, alipay_target, name, status, channels, interests, source)
         values(null,$1,$2,$3,$4,'active',$5::jsonb,$6::jsonb,$7)
         on conflict (phone) where phone is not null
         do update set
           wechat_target = coalesce(excluded.wechat_target, subscribers.wechat_target),
           alipay_target = coalesce(excluded.alipay_target, subscribers.alipay_target),
           name = coalesce(excluded.name, subscribers.name),
           status = 'active',
           channels = excluded.channels,
           interests = excluded.interests,
           updated_at = now()
         returning id, referral_code`,
        [phone, wechatTarget || null, alipayTarget || null, name || null, JSON.stringify(channels), JSON.stringify(interests.length ? interests : ["reset"]), source]
      );
      subscriber = saved.rows[0];
    } else {
      const saved = await client.query(
        `insert into subscribers(wechat_target, alipay_target, name, status, channels, interests, source)
         values($1,$2,$3,'active',$4::jsonb,$5::jsonb,$6)
         returning id, referral_code`,
        [wechatTarget || null, alipayTarget || null, name || null, JSON.stringify(channels), JSON.stringify(interests.length ? interests : ["reset"]), source]
      );
      subscriber = saved.rows[0];
    }

    if (subscriber && referralCode) {
      const inviter = await client.query(
        `select id, referral_code
           from subscribers
          where lower(referral_code)=lower($1)
            and status='active'
          limit 1`,
        [referralCode]
      );
      const inviterRow = inviter.rows[0];
      if (inviterRow && inviterRow.id !== subscriber.id) {
        await client.query(
          `insert into referrals(inviter_id, invitee_id, referral_code, source)
           values($1,$2,$3,$4)
           on conflict(invitee_id) do nothing`,
          [inviterRow.id, subscriber.id, inviterRow.referral_code, "referral:" + source]
        );
      }
    }

    const code = subscriber?.referral_code || "";
    return NextResponse.redirect(
      new URL("/invite?joined=1" + (code ? "&code=" + encodeURIComponent(code) : ""), request.url),
      303
    );
  } catch (error) {
    console.error("subscribe failed", error);
    return NextResponse.redirect(new URL("/subscribe?error=server", request.url), 303);
  }
}
