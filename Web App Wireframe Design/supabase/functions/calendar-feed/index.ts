// Private iCalendar feed of a user's Calendar page, so Google Calendar (or Apple/Outlook) can subscribe by URL:
//   GET /functions/v1/calendar-feed?token=<calendar_feeds.token>
//
// Calendar apps fetch it with no Supabase session, so deploy it without the JWT check:
//   supabase functions deploy calendar-feed --no-verify-jwt
// The token is the only key: the service role reads the data, and every query is scoped to that token's user.
//
// Items match the in-app calendar (calendarItems in src/data/insights.ts): deadlines of applications that
// aren't rejected, dated interview stages, unfinished tasks with a due date, and the user's own events.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCalendar, type FeedItem } from "./ics.ts";

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const textResponse = (status: number, body: string) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return textResponse(405, "Method not allowed");

  const token = new URL(req.url).searchParams.get("token") ?? "";
  // A reset link fails here too, which is how the old URL stops working.
  if (!TOKEN.test(token)) return textResponse(404, "Calendar not found");

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: feed, error: feedError } = await supabase.from("calendar_feeds").select("user_id, timezone").eq("token", token).maybeSingle();
    if (feedError) throw feedError;
    if (!feed) return textResponse(404, "Calendar not found");

    const userId = feed.user_id;
    const [apps, tasks, events] = await Promise.all([
      supabase.from("applications").select("id, company, position, status, deadline, updated_at, interview_stages(id, name, date, notes, created_at)").eq("user_id", userId),
      supabase.from("tasks").select("id, text, due, created_at, applications(company)").eq("user_id", userId).eq("done", false).not("due", "is", null),
      supabase.from("calendar_events").select("id, title, date, start_time, notes, updated_at, applications(company, position)").eq("user_id", userId),
    ]);
    for (const result of [apps, tasks, events]) if (result.error) throw result.error;

    const items: FeedItem[] = [];
    for (const app of apps.data ?? []) {
      if (app.deadline && app.status !== "rejected") {
        items.push({ uid: `deadline-${app.id}@pipeline`, date: app.deadline, time: null, summary: `${app.company} deadline`, description: app.position, category: "Deadline", updated: app.updated_at });
      }
      for (const stage of app.interview_stages ?? []) {
        if (!stage.date) continue;
        items.push({
          uid: `stage-${stage.id}@pipeline`,
          date: stage.date,
          time: null,
          summary: `${app.company} · ${stage.name}`,
          description: [app.position, stage.notes].filter(Boolean).join("\n\n"),
          category: "Interview",
          updated: stage.created_at,
        });
      }
    }
    for (const task of tasks.data ?? []) {
      items.push({ uid: `task-${task.id}@pipeline`, date: task.due!, time: null, summary: task.text, description: task.applications?.company ?? "", category: "Task", updated: task.created_at });
    }
    for (const event of events.data ?? []) {
      const related = event.applications ? `${event.applications.company} · ${event.applications.position}` : "";
      items.push({
        uid: `event-${event.id}@pipeline`,
        date: event.date,
        time: event.start_time,
        summary: event.title,
        description: [event.notes, related].filter(Boolean).join("\n\n"),
        category: "Event",
        updated: event.updated_at,
      });
    }

    const body = buildCalendar(items, { name: "Pipeline", timezone: validTimezone(feed.timezone) ? feed.timezone : "UTC" });
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="pipeline.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error(e);
    return textResponse(500, "Couldn't load the calendar. Try again later.");
  }
});
