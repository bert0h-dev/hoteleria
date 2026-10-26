-- Crea la tarea de salida de las habitaciones que ya estaban en Limpieza.
INSERT INTO "cleaning_tasks" ("id", "hotel_id", "room_id", "kind", "requested_by_id", "created_at")
SELECT gen_random_uuid(), r."hotel_id", r."id", 'DEPARTURE', l."changed_by_id", l."created_at"
FROM "rooms" r
JOIN LATERAL (
  SELECT "changed_by_id", "created_at"
  FROM "room_status_logs"
  WHERE "room_id" = r."id" AND "to_status" = 'CLEANING'
  ORDER BY "created_at" DESC
  LIMIT 1
) l ON TRUE
WHERE r."status" = 'CLEANING';
