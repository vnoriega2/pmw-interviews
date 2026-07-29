# Precision Metal Works — Agenda de entrevistas

Sitio listo para publicarse con **Supabase + Vercel**.

## Qué incluye
- Flujo por Mexicali, puesto, datos, fecha y horario.
- Horarios de lunes a viernes, entrevistas de 30 minutos.
- Bloqueo real de dobles reservaciones.
- Confirmación, documentos y botón de Maps.
- Panel `admin.html` con inicio de sesión y exportación CSV.

## Para convertirlo en un link real
1. Crea un proyecto gratuito en Supabase.
2. En SQL Editor, pega y ejecuta `supabase.sql`.
3. En Authentication > Users, crea el usuario de Recursos Humanos.
4. En Project Settings > API, copia `Project URL` y `anon public key` dentro de `config.js`.
5. Sube esta carpeta a Vercel como proyecto estático.
6. El enlace de candidatos será la URL principal; el panel será `/admin.html`.

Nunca pongas la `service_role key` en `config.js`; solo usa la clave `anon public`.
