import { query, queryOne } from "@/lib/db";

export async function getDashboardMetrics() {
  const [subscribers, signals, projects, campaigns, deliveries, referrals, smsCredits] = await Promise.all([
    queryOne<any>("select count(*)::int as count from subscribers where status = 'active'"),
    queryOne<any>("select count(*)::int as count from signals"),
    queryOne<any>("select count(*)::int as count from project_leads"),
    queryOne<any>("select count(*)::int as count from campaigns"),
    queryOne<any>("select count(*)::int as count from deliveries where status = 'sent'"),
    queryOne<any>("select count(*)::int as count from referrals where status = 'qualified'"),
    queryOne<any>("select coalesce(sum(sms_credits),0)::int as count from subscribers where status='active'")
  ]);

  return {
    subscribers: subscribers?.count || 0,
    signals: signals?.count || 0,
    projects: projects?.count || 0,
    campaigns: campaigns?.count || 0,
    deliveries: deliveries?.count || 0,
    referrals: referrals?.count || 0,
    smsCredits: smsCredits?.count || 0
  };
}

export async function getSubscribers(limit = 100) {
  return query<any>(
    `select id, email, phone, wechat_target, alipay_target, name, status, channels, interests, source, created_at
       from subscribers
      order by created_at desc
      limit $1`,
    [limit]
  );
}

export async function getContentItems(limit = 100) {
  return query<any>(
    `select id, title, slug, excerpt, content_type, status, published_at, created_at
       from content_items
      order by created_at desc
      limit $1`,
    [limit]
  );
}

export async function getCampaigns(limit = 100) {
  return query<any>(
    `select id, title, audience, channels, status, scheduled_at, sent_at, created_at
       from campaigns
      order by created_at desc
      limit $1`,
    [limit]
  );
}


export async function getReferralMetrics() {
  const [pending, qualified, rejected, credits] = await Promise.all([
    queryOne<any>("select count(*)::int as count from referrals where status='pending'"),
    queryOne<any>("select count(*)::int as count from referrals where status='qualified'"),
    queryOne<any>("select count(*)::int as count from referrals where status='rejected'"),
    queryOne<any>("select coalesce(sum(greatest(delta,0)),0)::int as total from reward_ledger where reason='qualified_referral'")
  ]);
  return {
    pending: pending?.count || 0,
    qualified: qualified?.count || 0,
    rejected: rejected?.count || 0,
    credits: credits?.total || 0
  };
}

export async function getReferrals(limit = 100) {
  return query<any>(
    `select r.id, r.status, r.referral_code, r.source, r.created_at, r.qualified_at,
            inviter.id as inviter_id, inviter.name as inviter_name, inviter.email as inviter_email,
            inviter.phone as inviter_phone, inviter.sms_credits as inviter_sms_credits,
            invitee.id as invitee_id, invitee.name as invitee_name, invitee.email as invitee_email,
            invitee.phone as invitee_phone, invitee.status as invitee_status
       from referrals r
       join subscribers inviter on inviter.id=r.inviter_id
       join subscribers invitee on invitee.id=r.invitee_id
      order by r.created_at desc
      limit $1`,
    [limit]
  );
}
