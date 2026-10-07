import { isAdmin } from "@/lib/admin-auth";
import { query } from "@/lib/db";

function csv(value: unknown) {
  const text = value == null ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const rows = await query<any>(
    `select id, email, phone, wechat_target, alipay_target, name, status, channels,
            interests, source, consent_at, created_at
       from subscribers
      order by created_at desc
      limit 10000`
  );

  const header = [
    "id","email","phone","wechat_target","alipay_target","name","status",
    "channels","interests","source","consent_at","created_at"
  ];

  const body = [
    header.join(","),
    ...rows.map(row => header.map(key => {
      const value = key === "channels" || key === "interests"
        ? JSON.stringify(row[key] || [])
        : row[key];
      return csv(value);
    }).join(","))
  ].join("\n");

  return new Response("\uFEFF" + body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="resetwatch-subscribers.csv"'
    }
  });
}
