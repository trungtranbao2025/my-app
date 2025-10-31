import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function TaskManager({ userId }) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*, projects(name, code), assignee:users(full_name)")
        .eq("assignee_id", userId)
        .order("due_date", { ascending: true });
      setTasks(data);
    };
    fetchTasks();

    const sub = supabase
      .channel("realtime:tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, [userId]);

  const toggleDone = async (task) => {
    const newStatus = task.is_completed ? "dangthuchien" : "hoanthanh";
    await supabase.from("tasks").update({
      is_completed: !task.is_completed,
      status: newStatus
    }).eq("id", task.id);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Công việc của bạn</h2>
      <div className="grid gap-3">
        {tasks.map((t) => (
          <div key={t.id} className="border rounded-xl p-3 shadow-sm bg-white">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{t.title}</h3>
              <span className={`px-2 py-1 text-sm rounded-full ${
                t.status === "trehan"
                  ? "bg-red-200 text-red-800"
                  : t.status === "sapdenhan"
                  ? "bg-yellow-200 text-yellow-800"
                  : t.status === "hoanthanh"
                  ? "bg-green-200 text-green-800"
                  : "bg-blue-200 text-blue-800"
              }`}>
                {t.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-600">{t.description}</p>
            <p className="text-xs text-gray-500">Hạn: {new Date(t.due_date).toLocaleDateString()}</p>
            <button
              className={`mt-2 px-3 py-1 rounded ${
                t.is_completed ? "bg-green-500 text-white" : "bg-gray-300"
              }`}
              onClick={() => toggleDone(t)}
            >
              {t.is_completed ? "Đã hoàn thành" : "Đánh dấu hoàn thành"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}