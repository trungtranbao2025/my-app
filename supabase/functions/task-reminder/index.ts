import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_completed", false);

  for (const task of tasks) {
    const due = new Date(task.due_date);
    const reminderTimes = task.reminder_times || [];

    for (const time of reminderTimes) {
      const remindAt = new Date(`${today}T${time}:00Z`);
      const diff = Math.abs(remindAt.getTime() - now.getTime());

      // Nhắc trong vòng 15 phút
      if (diff < 15 * 60 * 1000) {
        console.log(`Nhắc việc: ${task.title} cho nhân sự ${task.assignee_id}`);
        await supabase.from("reminders").insert({
          task_id: task.id,
          remind_time: remindAt
        });
      }
    }

    if (due < now && task.status !== "trehan") {
      await supabase.from("tasks").update({ status: "trehan" }).eq("id", task.id);
    } else if (
      due.getTime() - now.getTime() < 2 * 24 * 60 * 60 * 1000 &&
      task.status === "dangthuchien"
    ) {
      await supabase.from("tasks").update({ status: "sapdenhan" }).eq("id", task.id);
    }
  }

  return res.status(200).json({ message: "Reminders processed" });
}