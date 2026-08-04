# PMW Interviews v2

1. Conserva `logo-pmw.jpg` de tu carpeta anterior.
2. Ejecuta `supabase_setup.sql` en Supabase SQL Editor.
3. En Supabase Authentication > Providers, habilita Anonymous Sign-Ins.
4. Confirma que el bucket `documents` sea privado.
5. Reemplaza en GitHub: index.html, app.js, admin.html, admin.js, styles.css y config.js.
6. Vercel volverá a publicar automáticamente.

La columna `document_url` guarda una ruta privada, no una URL pública.
El panel crea enlaces firmados temporales de 5 minutos.
