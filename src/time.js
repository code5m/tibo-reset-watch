const CHINA_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function formatChinaTime(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "未知";
  return CHINA_FORMATTER.format(date).replace(/\//g, "-");
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function zoneOffsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

function localTimeToUtc({ year, month, day, hour, minute = 0 }, timeZone) {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const firstOffset = zoneOffsetMs(guess, timeZone);
  guess = new Date(guess.getTime() - firstOffset);
  const secondOffset = zoneOffsetMs(guess, timeZone);
  if (secondOffset !== firstOffset) {
    guess = new Date(guess.getTime() - (secondOffset - firstOffset));
  }
  return guess;
}

export function inferResetTime(text, createdAt) {
  const base = new Date(createdAt);
  if (Number.isNaN(base.getTime())) return null;
  const normalized = String(text).toLowerCase();

  const relative = normalized.match(/\bin\s+(\d+)\s+(minute|minutes|hour|hours|day|days)\b/);
  if (relative) {
    const count = Number(relative[1]);
    const unit = relative[2];
    const ms = unit.startsWith("minute")
      ? count * 60_000
      : unit.startsWith("hour")
        ? count * 3_600_000
        : count * 86_400_000;
    return new Date(base.getTime() + ms);
  }

  const clock = normalized.match(/\b(?:(tomorrow|today)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(pst|pdt|pt|utc|gmt)?\b/);
  if (!clock) return null;

  const [, dayWord, hh, mm = "0", ampm, zone] = clock;
  const hour = Number(hh) % 12 + (ampm === "pm" ? 12 : 0);
  const sourceZone = zone === "utc" || zone === "gmt"
    ? "UTC"
    : zone
      ? "America/Los_Angeles"
      : null;

  if (!sourceZone) return null;

  const p = zonedParts(base, sourceZone);
  let year = +p.year;
  let month = +p.month;
  let day = +p.day;

  if (dayWord === "tomorrow") {
    const tmp = new Date(Date.UTC(year, month - 1, day + 1));
    year = tmp.getUTCFullYear();
    month = tmp.getUTCMonth() + 1;
    day = tmp.getUTCDate();
  }

  return localTimeToUtc({
    year,
    month,
    day,
    hour,
    minute: +mm
  }, sourceZone);
}
