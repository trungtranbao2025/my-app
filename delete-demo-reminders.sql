-- Delete demo reminders and optionally demo tasks.
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- Preview counts first (no deletes)
WITH demo_tasks AS (
  SELECT id FROM public.tasks
  WHERE title ILIKE 'DEMO%Nhắc%'
     OR (title ILIKE '%Nhắc việc%' AND title ILIKE 'DEMO%')
     OR (description ILIKE '%demo%' AND description ILIKE '%nhắc%')
)
SELECT 'reminders' AS item, COUNT(*) AS count
FROM public.task_reminders r WHERE r.task_id IN (SELECT id FROM demo_tasks)
UNION ALL
SELECT 'settings' AS item, COUNT(*) AS count
FROM public.task_reminder_settings s WHERE s.task_id IN (SELECT id FROM demo_tasks)
UNION ALL
SELECT 'notifications' AS item, COUNT(*) AS count
FROM public.notifications n WHERE n.type='task_reminder' AND n.related_id IN (SELECT id FROM demo_tasks)
UNION ALL
SELECT 'tasks' AS item, COUNT(*) AS count
FROM demo_tasks;

-- 1) Remove only reminders/settings/notifications for demo tasks (keep tasks)
BEGIN;
  DELETE FROM public.task_reminders
  WHERE task_id IN (
    SELECT id FROM public.tasks
    WHERE title ILIKE 'DEMO%Nhắc%'
       OR (title ILIKE '%Nhắc việc%' AND title ILIKE 'DEMO%')
       OR (description ILIKE '%demo%' AND description ILIKE '%nhắc%')
  );

  DELETE FROM public.task_reminder_settings
  WHERE task_id IN (
    SELECT id FROM public.tasks
    WHERE title ILIKE 'DEMO%Nhắc%'
       OR (title ILIKE '%Nhắc việc%' AND title ILIKE 'DEMO%')
       OR (description ILIKE '%demo%' AND description ILIKE '%nhắc%')
  );

  DELETE FROM public.notifications
  WHERE type='task_reminder'
    AND related_id IN (
      SELECT id FROM public.tasks
      WHERE title ILIKE 'DEMO%Nhắc%'
         OR (title ILIKE '%Nhắc việc%' AND title ILIKE 'DEMO%')
         OR (description ILIKE '%demo%' AND description ILIKE '%nhắc%')
    );
COMMIT;

-- 2) Optional: also delete the demo tasks themselves (will cascade any remaining reminders)
-- Uncomment to use:
-- BEGIN;
--   DELETE FROM public.tasks
--   WHERE id IN (
--     SELECT id FROM public.tasks
--     WHERE title ILIKE 'DEMO%Nhắc%'
--        OR (title ILIKE '%Nhắc việc%' AND title ILIKE 'DEMO%')
--        OR (description ILIKE '%demo%' AND description ILIKE '%nhắc%')
--   );
-- COMMIT;
