-- Domio — quitar el campo emoji de missions y rewards
--
-- Decisión (2026-08-24): no se va a implementar selección de emoji por
-- ahora, así que se quita el campo por completo en vez de solo
-- esconderlo en el formulario (ya se había ocultado antes, ahora se
-- elimina la columna entera). Si en el futuro se retoma la idea, se
-- vuelve a agregar como columna nueva.
--
-- Aplica esto en el SQL Editor DESPUES de 0001-0004. Es seguro
-- correrlo una sola vez; `if exists` lo hace re-corrible sin error si
-- por algún motivo ya no está la columna.

alter table missions drop column if exists emoji;
alter table rewards drop column if exists emoji;
