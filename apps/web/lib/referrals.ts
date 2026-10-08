import "server-only";
import type { PoolClient } from "pg";
import { db, queryOne } from "@/lib/db";

export const referralConfig = {
  smsCreditsPerQualifiedReferral: Number(process.env.REFERRAL_SMS_CREDITS || 3),
  monthlySmsCreditCap: Number(process.env.REFERRAL_SMS_MONTHLY_CAP || 30)
};

export type ReferralSummary = {
  code: string;
  smsCredits: number;
  pending: number;
  qualified: number;
  rejected: number;
  creditsEarned: number;
};

function safePositiveInt(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function referralRewardCredits() {
  return safePositiveInt(referralConfig.smsCreditsPerQualifiedReferral, 3);
}

export function referralMonthlyCap() {
  return safePositiveInt(referralConfig.monthlySmsCreditCap, 30);
}

export async function getReferralSummary(code: string): Promise<ReferralSummary | null> {
  if (!code) return null;
  const row = await queryOne<any>(
    `select s.referral_code as code,
            s.sms_credits,
            count(r.id) filter (where r.status='pending')::int as pending,
            count(r.id) filter (where r.status='qualified')::int as qualified,
            count(r.id) filter (where r.status='rejected')::int as rejected,
            coalesce((
              select sum(greatest(rl.delta,0))::int
                from reward_ledger rl
               where rl.subscriber_id=s.id
                 and rl.reason='qualified_referral'
            ),0) as credits_earned
       from subscribers s
       left join referrals r on r.inviter_id=s.id
      where lower(s.referral_code)=lower($1)
      group by s.id, s.referral_code, s.sms_credits
      limit 1`,
    [code]
  );
  if (!row) return null;
  return {
    code: row.code,
    smsCredits: Number(row.sms_credits || 0),
    pending: Number(row.pending || 0),
    qualified: Number(row.qualified || 0),
    rejected: Number(row.rejected || 0),
    creditsEarned: Number(row.credits_earned || 0)
  };
}

async function monthlyCreditsEarned(client: PoolClient, subscriberId: string) {
  const result = await client.query(
    `select coalesce(sum(greatest(delta,0)),0)::int as total
       from reward_ledger
      where subscriber_id=$1
        and reason='qualified_referral'
        and created_at >= (
          date_trunc('month', now() at time zone 'Asia/Shanghai')
          at time zone 'Asia/Shanghai'
        )`,
    [subscriberId]
  );
  return Number(result.rows[0]?.total || 0);
}

export async function qualifyReferral(referralId: string) {
  const pool = db();
  if (!pool) throw new Error("Database unavailable");
  const client = await pool.connect();

  try {
    await client.query("begin");
    const referralResult = await client.query(
      `select r.id, r.inviter_id, r.invitee_id, r.status, s.status as invitee_status
         from referrals r
         join subscribers s on s.id=r.invitee_id
        where r.id=$1
        for update`,
      [referralId]
    );
    const referral = referralResult.rows[0];
    if (!referral) throw new Error("Referral not found");
    if (referral.status === "qualified") {
      await client.query("commit");
      return { qualified: true, awarded: 0, alreadyQualified: true };
    }
    if (referral.status === "rejected") throw new Error("Rejected referral cannot be qualified");
    if (referral.invitee_status !== "active") throw new Error("Invitee must be active");

    const reward = referralRewardCredits();
    const cap = referralMonthlyCap();
    const alreadyEarned = await monthlyCreditsEarned(client, referral.inviter_id);
    const awarded = Math.max(0, Math.min(reward, cap - alreadyEarned));

    await client.query(
      `update referrals
          set status='qualified', qualified_at=now(), reviewed_at=now()
        where id=$1`,
      [referralId]
    );

    if (awarded > 0) {
      const updated = await client.query(
        `update subscribers
            set sms_credits=sms_credits+$1, updated_at=now()
          where id=$2
          returning sms_credits`,
        [awarded, referral.inviter_id]
      );
      const balance = Number(updated.rows[0]?.sms_credits || 0);
      await client.query(
        `insert into reward_ledger(
           subscriber_id, referral_id, reward_type, delta, balance_after, reason, idempotency_key
         ) values($1,$2,'sms_credit',$3,$4,'qualified_referral',$5)
         on conflict(idempotency_key) where idempotency_key is not null do nothing`,
        [referral.inviter_id, referral.id, awarded, balance, "referral:" + referral.id]
      );
    }

    await client.query("commit");
    return { qualified: true, awarded, alreadyQualified: false };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectReferral(referralId: string) {
  const pool = db();
  if (!pool) throw new Error("Database unavailable");
  await pool.query(
    `update referrals
        set status='rejected', reviewed_at=now()
      where id=$1 and status='pending'`,
    [referralId]
  );
}

export async function reserveSmsCredit(subscriberId: string) {
  const pool = db();
  if (!pool) return { ok: false, balance: 0 };
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `update subscribers
          set sms_credits=sms_credits-1, updated_at=now()
        where id=$1 and sms_credits>0
        returning sms_credits`,
      [subscriberId]
    );
    if (!result.rowCount) {
      await client.query("rollback");
      return { ok: false, balance: 0 };
    }
    const balance = Number(result.rows[0].sms_credits || 0);
    await client.query(
      `insert into reward_ledger(subscriber_id, reward_type, delta, balance_after, reason)
       values($1,'sms_credit',-1,$2,'reset_sms_delivery')`,
      [subscriberId, balance]
    );
    await client.query("commit");
    return { ok: true, balance };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function refundSmsCredit(subscriberId: string) {
  const pool = db();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `update subscribers
          set sms_credits=sms_credits+1, updated_at=now()
        where id=$1
        returning sms_credits`,
      [subscriberId]
    );
    const balance = Number(result.rows[0]?.sms_credits || 0);
    await client.query(
      `insert into reward_ledger(subscriber_id, reward_type, delta, balance_after, reason)
       values($1,'sms_credit',1,$2,'sms_delivery_refund')`,
      [subscriberId, balance]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
