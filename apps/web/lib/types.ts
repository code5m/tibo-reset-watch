export type SubscriberChannel = "email" | "wechat" | "sms";

export type Subscriber = {
  id: string;
  email: string | null;
  phone: string | null;
  wechatTarget: string | null;
  name: string | null;
  status: "active" | "pending" | "unsubscribed";
  channels: SubscriberChannel[];
  interests: string[];
  source: string;
  createdAt: string;
};

export type Signal = {
  id: string;
  source: string;
  sourcePostId: string;
  kind: "completed" | "scheduled" | "banked" | "hint";
  title: string;
  body: string;
  sourceUrl: string;
  sourceCreatedAt: string;
  resetAt: string | null;
  createdAt: string;
};

export type ProjectLead = {
  id: string;
  sourcePostId: string;
  title: string;
  summary: string;
  sourceUrl: string;
  score: number;
  tags: string[];
  sourceCreatedAt: string;
  createdAt: string;
};

export type ContentItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "draft" | "published";
  contentType: "article" | "update" | "guide";
  publishedAt: string | null;
  createdAt: string;
};

export type Campaign = {
  id: string;
  title: string;
  body: string;
  audience: string;
  channels: string[];
  status: "draft" | "scheduled" | "sent";
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
};
