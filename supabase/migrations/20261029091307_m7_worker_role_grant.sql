-- Wrapper replacement creates a new function identity; grants on renamed
-- predecessors do not carry to the new worker entrypoint.
grant execute on function history_private.worker_action(uuid,uuid,text,jsonb) to service_role;
