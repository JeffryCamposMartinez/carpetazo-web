# MylDbUpdater (Antigravity Fork)

Esta carpeta contiene la versin modificada del software original MylDbUpdater creado por Codex.

## Cambios realizados por Antigravity (28-09-2026):
1. **Selector inicial de TCG**:
   - Se cre un nuevo formulario TcgSelectorForm.cs que acta como men de inicio.
   - Permite al usuario elegir entre "Mitos y Leyendas" y "Pokmon" (este ltimo con un mensaje de "Prximamente").
2. **Botn de retroceso**:
   - Se modific Program.cs en la lnea donde se inyectaba el ttulo principal (oot.Controls.Add(title, 0, 0);).
   - Se reemplaz por un TableLayoutPanel que contiene el ttulo a la izquierda y un botn <- Volver al Men a la derecha.
   - El botn oculta el formulario principal y vuelve a abrir TcgSelectorForm.
3. **Punto de entrada (Main)**:
   - Se modific el Main() en Program.cs para que inicie Application.Run(new TcgSelectorForm()); en lugar de MainForm.

Codex: Puedes comparar el archivo Program.cs de esta carpeta con tu Program.cs original para ver exactamente el diff de los cambios en la UI.

4. **Integración de Previsualización para Pokémon**:
   - TcgSelectorForm.cs: Se habilitó el botón de Pokémon para que instancie 
ew MainForm("Pokemon").
   - Program.cs: MainForm ahora recibe 	cgType en el constructor.
   - Si 	cgType == "Pokemon", cambia el BaseDir a Descargas\Pokemon.
   - Se ajustó la ruta dinámica de carga de JSON para que busque en la subcarpeta Data en lugar de la lógica _Data de Mitos.
   - Se añadieron nuevas columnas preferidas (hp, 	ypes, set.name, arity) al renderizador dinámico.
   - Se deshabilitó el bloque de ctionsGroup temporalmente para Pokémon porque aún no existen los scripts de Node (ej. upload_pokemon.cjs).

5. **Funcionalidad de Subida a BD y Cloudflare R2**:
   - upload_pokemon.cjs: Script en el backend que toma las carpetas de Pokemon, lee el JSON y las inserta en Prisma bajo la categoría ID 1. También autogenera grupos (Sets).
   - upload_images_r2.cjs: Script universal para subir imágenes (.webp, .jpg, .png) a Cloudflare R2 manteniendo la estructura de directorios, tanto para Pokemon como para Myl.
   - UI de C#: Se agregó el checkbox uploadR2Check ("Subir imágenes locales a Cloudflare R2").
   - StartAsync: Ahora hace un routing correcto de las acciones, inyectando 
ew[] { TcgType } a los scripts universales para que el backend sepa de dónde sacar los datos (Pokemon o Myl).

6. **Separación de UI y Copiar Consola**:
   - Program.cs: Se ocultaron las casillas de acciones exclusivas de Mitos y Leyendas (syncCheck, olderProductCheck, epairImagesCheck, diagnoseImagesCheck, diagnoseHttpCheck) cuando TcgType == "Pokemon", logrando interfaces limpias y separadas para cada TCG.
   - Program.cs: Se reestructuró logGroup agregando un TableLayoutPanel para alojar tanto la caja de texto logBox como un nuevo botón "Copiar Consola" (copyLogBtn) que interactúa con Clipboard.SetText.
