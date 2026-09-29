using System.Diagnostics;
using System.Drawing;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

namespace CarpetazoMylDbUpdater;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new TcgSelectorForm());
    }
}

internal sealed class MainForm : Form
{
    private readonly string BaseDir;
    private readonly string TcgType;
    private const string BackendDir = @"C:\Users\Jeffry\Desktop\Carpetazo.cl\Publicar mis cartas\backend";

    private readonly CheckedListBox folderList = new();
    private readonly Button reloadButton = new();
    private readonly Button startButton = new();
    private readonly Button selectAllButton = new();
    private readonly Button loadJsonButton = new();
    private readonly CheckBox uploadCheck = new();
    private readonly CheckBox uploadR2Check = new();
    private readonly CheckBox syncCheck = new();
    private readonly CheckBox folderProductCheck = new();
    private readonly CheckBox repairImagesCheck = new();
    private readonly CheckBox diagnoseImagesCheck = new();
    private readonly CheckBox diagnoseHttpCheck = new();
    private readonly ComboBox fieldCombo = new();
    private readonly ComboBox valueCombo = new();
    private readonly TextBox searchBox = new();
    private readonly DataGridView cardsGrid = new();
    private readonly TextBox detailsBox = new();
    private readonly TextBox logBox = new();
    private readonly Label statusLabel = new();
    private readonly Label viewerStatusLabel = new();

    private readonly List<Dictionary<string, string>> loadedCards = [];
    private readonly SortedSet<string> loadedFields = [];

        public MainForm(string tcgType)
    {
        TcgType = tcgType;
        if (TcgType == "Pokemon") {
            BaseDir = @"C:\Users\Jeffry\Desktop\CarpetazoUpdater\Descargas\Pokemon";
            Text = "Carpetazo - Pokemon DB Updater";
        } else {
            BaseDir = @"C:\Users\Jeffry\Desktop\CarpetazoUpdater\Descargas\Mitos_y_Leyendas";
            Text = "Carpetazo - Mitos y Leyendas DB Updater";
        }
        MinimumSize = new Size(1220, 780);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(239, 246, 255);
        Font = new Font("Segoe UI", 9.5F);

        BuildLayout();
        LoadFolders();
    }

    private void BuildLayout()
    {
        Controls.Clear();
        Padding = new Padding(18);

        var title = new Label
        {
            Text = "Actualizador de Mitos y Leyendas",
            Font = new Font("Segoe UI", 18F, FontStyle.Bold),
            ForeColor = Color.FromArgb(15, 36, 75),
            AutoSize = true,
            Dock = DockStyle.Fill
        };

        var subtitle = new Label
        {
            Text = "Selecciona carpetas, revisa los JSON localmente y luego sube o corrige la base.",
            ForeColor = Color.FromArgb(79, 92, 112),
            AutoSize = true,
            Dock = DockStyle.Fill
        };

        var basePath = new TextBox
        {
            Text = BaseDir,
            ReadOnly = true,
            BorderStyle = BorderStyle.FixedSingle,
            Dock = DockStyle.Fill
        };

        folderList.Dock = DockStyle.Fill;
        folderList.CheckOnClick = true;

        reloadButton.Text = "Recargar carpetas";
        reloadButton.Dock = DockStyle.Fill;
        reloadButton.Click += (_, _) => LoadFolders();

        selectAllButton.Text = "Seleccionar todo";
        selectAllButton.Dock = DockStyle.Fill;
        selectAllButton.Click += (_, _) => SelectAllFolders();

        uploadCheck.Text = "Subir / actualizar cartas desde data.json";
        uploadCheck.AutoSize = true;

        syncCheck.Text = "Corregir productos y ediciones para filtros";
        syncCheck.Checked = true;
        syncCheck.AutoSize = true;

        folderProductCheck.Text = "Usar carpetas *_Data como productos";
        folderProductCheck.AutoSize = true;

        repairImagesCheck.Text = "Reparar URLs de imágenes desde archivos locales";
        repairImagesCheck.AutoSize = true;

        diagnoseImagesCheck.Text = "Diagnosticar URLs corruptas DB vs local";
        diagnoseImagesCheck.AutoSize = true;

        diagnoseHttpCheck.Text = "Verificar HTTP en diagnóstico (más lento)";
        diagnoseHttpCheck.AutoSize = true;

        var note = new Label
        {
            Text = "Diagnosticar no modifica nada. Reparar imágenes y productos pide confirmación antes de actualizar la base.",
            ForeColor = Color.FromArgb(92, 106, 128),
            AutoSize = false,
            Dock = DockStyle.Fill
        };

        startButton.Text = "Empezar";
        startButton.Font = new Font("Segoe UI", 11F, FontStyle.Bold);
        startButton.BackColor = Color.FromArgb(31, 67, 191);
        startButton.ForeColor = Color.White;
        startButton.FlatStyle = FlatStyle.Flat;
        startButton.Dock = DockStyle.Fill;
        startButton.Height = 44;
        startButton.MinimumSize = new Size(0, 44);
        startButton.Click += async (_, _) => await StartAsync();

        statusLabel.Text = "Esperando selección...";
        statusLabel.ForeColor = Color.FromArgb(15, 36, 75);
        statusLabel.AutoSize = true;

        logBox.Dock = DockStyle.Fill;
        logBox.Multiline = true;
        logBox.ScrollBars = ScrollBars.Vertical;
        logBox.ReadOnly = true;
        logBox.BackColor = Color.FromArgb(7, 17, 38);
        logBox.ForeColor = Color.FromArgb(226, 238, 255);
        logBox.Font = new Font("Consolas", 8.5F);

        var viewerTitle = new Label
        {
            Text = "Vista previa local de data.json",
            Font = new Font("Segoe UI", 13F, FontStyle.Bold),
            ForeColor = Color.FromArgb(15, 36, 75),
            AutoSize = true,
            Dock = DockStyle.Fill
        };

        loadJsonButton.Text = "Cargar JSON de carpeta seleccionada";
        loadJsonButton.Dock = DockStyle.Fill;
        loadJsonButton.Click += (_, _) => LoadSelectedFolderJson();

        fieldCombo.DropDownStyle = ComboBoxStyle.DropDownList;
        fieldCombo.Dock = DockStyle.Fill;
        fieldCombo.SelectedIndexChanged += (_, _) => RefreshValueOptions();

        valueCombo.DropDownStyle = ComboBoxStyle.DropDownList;
        valueCombo.Dock = DockStyle.Fill;
        valueCombo.SelectedIndexChanged += (_, _) => ApplyPreviewFilter();

        searchBox.PlaceholderText = "Buscar carta, texto o código...";
        searchBox.Dock = DockStyle.Fill;
        searchBox.TextChanged += (_, _) => ApplyPreviewFilter();

        viewerStatusLabel.Text = "Selecciona una carpeta para leer sus data.json.";
        viewerStatusLabel.ForeColor = Color.FromArgb(79, 92, 112);
        viewerStatusLabel.AutoSize = true;

        cardsGrid.Dock = DockStyle.Fill;
        cardsGrid.ReadOnly = true;
        cardsGrid.AllowUserToAddRows = false;
        cardsGrid.AllowUserToDeleteRows = false;
        cardsGrid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        cardsGrid.MultiSelect = false;
        cardsGrid.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.DisplayedCells;
        cardsGrid.RowHeadersVisible = false;
        cardsGrid.SelectionChanged += (_, _) => ShowSelectedCardDetails();

        detailsBox.Dock = DockStyle.Fill;
        detailsBox.Multiline = true;
        detailsBox.ScrollBars = ScrollBars.Vertical;
        detailsBox.ReadOnly = true;
        detailsBox.Font = new Font("Consolas", 9F);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 4
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 360));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var headerLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Margin = new Padding(0) };
        headerLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        headerLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
        headerLayout.Controls.Add(title, 0, 0);
        var backBtn = new Button { Text = "<- Volver al Menú", Dock = DockStyle.Fill, BackColor = Color.FromArgb(226, 232, 240), FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9F, FontStyle.Bold) };
        backBtn.Click += (_, _) => { Hide(); var f = new TcgSelectorForm(); f.FormClosed += (s, e) => Close(); f.Show(); };
        headerLayout.Controls.Add(backBtn, 1, 0);
        root.Controls.Add(headerLayout, 0, 0);
        root.Controls.Add(subtitle, 0, 1);

        var topSplit = new SplitContainer
        {
            Dock = DockStyle.Fill,
            SplitterDistance = 790,
            FixedPanel = FixedPanel.None
        };

        var configPanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 2,
            Padding = new Padding(0, 6, 10, 8)
        };
        configPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 48));
        configPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 52));
        configPanel.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
        configPanel.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        configPanel.Controls.Add(basePath, 0, 0);
        configPanel.SetColumnSpan(basePath, 2);

        var foldersGroup = new GroupBox { Text = "Carpetas locales", Dock = DockStyle.Fill, Padding = new Padding(10) };
        var foldersLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2 };
        foldersLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        foldersLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
        foldersLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        foldersLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        foldersLayout.Controls.Add(folderList, 0, 0);
        foldersLayout.SetColumnSpan(folderList, 2);
        foldersLayout.Controls.Add(reloadButton, 0, 1);
        foldersLayout.Controls.Add(selectAllButton, 1, 1);
        foldersGroup.Controls.Add(foldersLayout);

        var actionsGroup = new GroupBox { Text = "Acciones", Dock = DockStyle.Fill, Padding = new Padding(12, 10, 12, 10) };
        uploadR2Check.Text = "Subir im�genes locales a Cloudflare R2";
        uploadR2Check.AutoSize = true;

        var actionsLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 10 };
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 54));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 50));
        actionsLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        actionsLayout.Controls.Add(uploadCheck, 0, 0);
        actionsLayout.Controls.Add(uploadR2Check, 0, 1);
        actionsLayout.Controls.Add(syncCheck, 0, 2);
        actionsLayout.Controls.Add(folderProductCheck, 0, 3);
        actionsLayout.Controls.Add(repairImagesCheck, 0, 4);
        actionsLayout.Controls.Add(diagnoseImagesCheck, 0, 5);
        actionsLayout.Controls.Add(diagnoseHttpCheck, 0, 6);
        actionsLayout.Controls.Add(note, 0, 7);
        actionsLayout.Controls.Add(startButton, 0, 8);
                actionsLayout.Controls.Add(statusLabel, 0, 9);
        if (TcgType == "Pokemon") {
            syncCheck.Visible = false;
            folderProductCheck.Visible = false;
            repairImagesCheck.Visible = false;
            diagnoseImagesCheck.Visible = false;
            diagnoseHttpCheck.Visible = false;
            note.Text = "Las herramientas de diagn�stico profundo y reparaci�n de URLs locales a�n no est�n activas para Pok�mon.";
        }
        actionsGroup.Controls.Add(actionsLayout); 

        configPanel.Controls.Add(foldersGroup, 0, 1);
        configPanel.Controls.Add(actionsGroup, 1, 1);

        var logLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2 };
        logLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        logLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        logLayout.Controls.Add(logBox, 0, 0);
        
        var copyLogBtn = new Button { Text = "Copiar Consola", Dock = DockStyle.Fill, BackColor = Color.FromArgb(226, 232, 240), FlatStyle = FlatStyle.Flat };
        copyLogBtn.Click += (_, _) => { if (!string.IsNullOrEmpty(logBox.Text)) Clipboard.SetText(logBox.Text); };
        logLayout.Controls.Add(copyLogBtn, 0, 1);
        
        var logGroup = new GroupBox { Text = "Consola", Dock = DockStyle.Fill, Padding = new Padding(10) };
        logGroup.Controls.Add(logLayout);

        topSplit.Panel1.Controls.Add(configPanel);
        topSplit.Panel2.Controls.Add(logGroup);
        root.Controls.Add(topSplit, 0, 2);

        var viewerSplit = new SplitContainer
        {
            Dock = DockStyle.Fill,
            SplitterDistance = 820,
            FixedPanel = FixedPanel.None
        };

        var viewerLeft = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            Padding = new Padding(0, 10, 8, 0)
        };
        viewerLeft.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
        viewerLeft.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
        viewerLeft.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var viewerHeader = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1 };
        viewerHeader.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        viewerHeader.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 280));
        viewerHeader.Controls.Add(viewerTitle, 0, 0);
        viewerHeader.Controls.Add(loadJsonButton, 1, 0);

        var filters = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 1 };
        filters.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24));
        filters.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 28));
        filters.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 34));
        filters.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 14));
        filters.Controls.Add(fieldCombo, 0, 0);
        filters.Controls.Add(valueCombo, 1, 0);
        filters.Controls.Add(searchBox, 2, 0);
        filters.Controls.Add(viewerStatusLabel, 3, 0);

        viewerLeft.Controls.Add(viewerHeader, 0, 0);
        viewerLeft.Controls.Add(filters, 0, 1);
        viewerLeft.Controls.Add(cardsGrid, 0, 2);

        var detailsGroup = new GroupBox { Text = "Detalle de carta", Dock = DockStyle.Fill, Padding = new Padding(10) };
        detailsGroup.Controls.Add(detailsBox);

        viewerSplit.Panel1.Controls.Add(viewerLeft);
        viewerSplit.Panel2.Controls.Add(detailsGroup);
        root.Controls.Add(viewerSplit, 0, 3);

        Controls.Add(root);
    }

    private void LoadFolders()
    {
        folderList.Items.Clear();
        loadedCards.Clear();
        loadedFields.Clear();
        cardsGrid.Columns.Clear();
        cardsGrid.Rows.Clear();
        detailsBox.Clear();
        fieldCombo.Items.Clear();
        valueCombo.Items.Clear();

        if (!Directory.Exists(BaseDir))
        {
            AppendLog($"No existe la ruta: {BaseDir}");
            return;
        }

        foreach (var directory in Directory.GetDirectories(BaseDir).OrderBy(Path.GetFileName))
        {
            folderList.Items.Add(Path.GetFileName(directory), false);
        }

        statusLabel.Text = $"Carpetas cargadas: {folderList.Items.Count}";
    }

    private void SelectAllFolders()
    {
        for (var i = 0; i < folderList.Items.Count; i++)
        {
            folderList.SetItemChecked(i, true);
        }
    }

    private void LoadSelectedFolderJson()
    {
        var dbName = folderList.SelectedItem as string
            ?? folderList.CheckedItems.Cast<string>().FirstOrDefault();

        if (string.IsNullOrWhiteSpace(dbName))
        {
            MessageBox.Show("Selecciona o marca una carpeta antes de cargar JSON.", "Falta carpeta", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        try
        {
            Cursor = Cursors.WaitCursor;
            loadedCards.Clear();
            loadedFields.Clear();
            cardsGrid.Columns.Clear();
            cardsGrid.Rows.Clear();
            detailsBox.Clear();
            fieldCombo.Items.Clear();
            valueCombo.Items.Clear();

            var dataRoot = TcgType == "Pokemon" ? Path.Combine(BaseDir, dbName, "Data") : Path.Combine(BaseDir, dbName, dbName.Replace("_DB", "_Data"));
            if (!Directory.Exists(dataRoot))
            {
                viewerStatusLabel.Text = $"No existe: {dataRoot}";
                return;
            }

            foreach (var dataPath in Directory.EnumerateFiles(dataRoot, "data.json", SearchOption.AllDirectories))
            {
                using var document = JsonDocument.Parse(File.ReadAllText(dataPath));
                var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["_db"] = dbName,
                    ["_dataFolderProduct"] = GetProductFolderFromPath(dataRoot, dataPath),
                    ["_path"] = dataPath
                };

                FlattenJson(document.RootElement, "", row);

                foreach (var field in row.Keys) loadedFields.Add(field);
                loadedCards.Add(row);
            }

            fieldCombo.Items.Add("(sin filtro)");
            foreach (var field in loadedFields) fieldCombo.Items.Add(field);
            fieldCombo.SelectedIndex = 0;

            viewerStatusLabel.Text = $"{loadedCards.Count} cartas leídas de {dbName}.";
            ApplyPreviewFilter();
        }
        catch (Exception ex)
        {
            viewerStatusLabel.Text = "Error leyendo JSON.";
            MessageBox.Show(ex.Message, "Error leyendo data.json", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            Cursor = Cursors.Default;
        }
    }

    private static string GetProductFolderFromPath(string dataRoot, string dataPath)
    {
        var relative = Path.GetRelativePath(dataRoot, dataPath);
        var parts = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return parts.Length > 0 ? parts[0] : "";
    }

    private static void FlattenJson(JsonElement element, string prefix, Dictionary<string, string> row)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    var key = string.IsNullOrWhiteSpace(prefix) ? property.Name : $"{prefix}.{property.Name}";
                    FlattenJson(property.Value, key, row);
                }
                break;
            case JsonValueKind.Array:
                row[prefix] = string.Join(", ", element.EnumerateArray().Select(JsonValueToString));
                break;
            default:
                row[prefix] = JsonValueToString(element);
                break;
        }
    }

    private static string JsonValueToString(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Null => "",
            JsonValueKind.Undefined => "",
            JsonValueKind.String => element.GetString() ?? "",
            JsonValueKind.Number => element.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Object => element.GetRawText(),
            JsonValueKind.Array => string.Join(", ", element.EnumerateArray().Select(JsonValueToString)),
            _ => element.ToString()
        };
    }

    private void RefreshValueOptions()
    {
        valueCombo.Items.Clear();
        valueCombo.Items.Add("(todos)");

        var field = fieldCombo.SelectedItem?.ToString();
        if (!string.IsNullOrWhiteSpace(field) && field != "(sin filtro)")
        {
            foreach (var value in loadedCards
                .Select((card) => card.TryGetValue(field, out var raw) ? raw : "")
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy((value) => value))
            {
                valueCombo.Items.Add(string.IsNullOrWhiteSpace(value) ? "(vacío)" : value);
            }
        }

        valueCombo.SelectedIndex = 0;
        ApplyPreviewFilter();
    }

    private void ApplyPreviewFilter()
    {
        var field = fieldCombo.SelectedItem?.ToString();
        var selectedValue = valueCombo.SelectedItem?.ToString();
        var search = searchBox.Text.Trim();

        var rows = loadedCards.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(field) && field != "(sin filtro)" && selectedValue != "(todos)")
        {
            rows = rows.Where((card) =>
            {
                var value = card.TryGetValue(field, out var raw) ? raw : "";
                var normalized = string.IsNullOrWhiteSpace(value) ? "(vacío)" : value;
                return string.Equals(normalized, selectedValue, StringComparison.OrdinalIgnoreCase);
            });
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            rows = rows.Where((card) => card.Values.Any((value) => value.Contains(search, StringComparison.OrdinalIgnoreCase)));
        }

        RenderPreviewRows(rows.Take(2000).ToList());
    }

    private void RenderPreviewRows(List<Dictionary<string, string>> rows)
    {
        cardsGrid.Columns.Clear();
        cardsGrid.Rows.Clear();

        var preferred = new[]
        {
            "id", "name", "set.name", "rarity", "hp", "types", "collectorCode", "edition.name", "productName", "_dataFolderProduct",
            "type", "cost", "attack", "frequency", "race", "format", "slug"
        };

        var columns = preferred
            .Where((field) => loadedFields.Contains(field))
            .Concat(loadedFields.Where((field) => !preferred.Contains(field)))
            .Take(28)
            .ToList();

        foreach (var column in columns) cardsGrid.Columns.Add(column, column);

        foreach (var card in rows)
        {
            var index = cardsGrid.Rows.Add(columns.Select((column) => card.TryGetValue(column, out var value) ? value : "").ToArray());
            cardsGrid.Rows[index].Tag = card;
        }

        viewerStatusLabel.Text = $"{rows.Count} cartas visibles de {loadedCards.Count} cargadas.";
        ShowSelectedCardDetails();
    }

    private void ShowSelectedCardDetails()
    {
        if (cardsGrid.SelectedRows.Count == 0 || cardsGrid.SelectedRows[0].Tag is not Dictionary<string, string> card)
        {
            detailsBox.Clear();
            return;
        }

        detailsBox.Text = string.Join(Environment.NewLine, card.OrderBy((pair) => pair.Key).Select((pair) => $"{pair.Key}: {pair.Value}"));
    }

    private async Task StartAsync()
    {
        var selectedFolders = folderList.CheckedItems.Cast<string>().ToArray();
        if (selectedFolders.Length == 0)
        {
            MessageBox.Show("Selecciona al menos una carpeta.", "Falta selección", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        if (folderProductCheck.Checked && !syncCheck.Checked)
        {
            MessageBox.Show("Para usar carpetas *_Data como productos debes marcar también la corrección de productos y ediciones.", "Falta acción", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        if (!uploadCheck.Checked && !uploadR2Check.Checked && !syncCheck.Checked && !repairImagesCheck.Checked && !diagnoseImagesCheck.Checked)
        {
            MessageBox.Show("Selecciona al menos una acción.", "Falta acción", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        if (!Directory.Exists(BackendDir))
        {
            MessageBox.Show($"No encuentro el backend:\n{BackendDir}", "Backend no encontrado", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        if (folderProductCheck.Checked)
        {
            var confirmation = MessageBox.Show(
                "Esta opción actualizará los productos físicos de las cartas usando el nombre de la carpeta inmediata dentro de *_Data.\n\n" +
                "Ejemplo: Imperio_Data\\2023\\... guardará el producto como \"2023\" y la edición seguirá saliendo de edition.name del data.json.\n\n" +
                $"Carpetas seleccionadas: {string.Join(", ", selectedFolders)}\n\n¿Confirmas aplicar este cambio en la base de datos?",
                "Confirmar productos desde carpetas",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2);

            if (confirmation != DialogResult.Yes) return;
        }

        if (repairImagesCheck.Checked)
        {
            var confirmation = MessageBox.Show(
                "Esta opción actualizará imageUrl en la base de datos usando el archivo .webp real encontrado dentro de cada carpeta local de imágenes.\n\n" +
                "Sirve para corregir casos como:\n" +
                "Biblioteca Eterna 2/Biblioteca Eterna 2.webp → Biblioteca Eterna 2/Biblioteca Eterna.webp\n\n" +
                $"Carpetas seleccionadas: {string.Join(", ", selectedFolders)}\n\n¿Confirmas reparar las URLs de imágenes en la base de datos?",
                "Confirmar reparación de imágenes",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2);

            if (confirmation != DialogResult.Yes) return;
        }

        ToggleUi(false);
        logBox.Clear();
        AppendLog($"Carpetas: {string.Join(", ", selectedFolders)}");

        try
        {
            if (TcgType == "Pokemon") 
            {
                if (uploadCheck.Checked) await RunNodeScriptAsync("upload_pokemon.cjs", selectedFolders);
                if (uploadR2Check.Checked) await RunNodeScriptAsync("upload_images_r2.cjs", selectedFolders, new[] { TcgType });
            } 
            else 
            {
                if (diagnoseImagesCheck.Checked)
                {
                    var extraArgs = diagnoseHttpCheck.Checked
                        ? new[] { "--http-concurrency=32" }
                        : new[] { "--skip-http" };
                    await RunNodeScriptAsync("diagnose_myl_image_urls.cjs", selectedFolders, extraArgs);
                }

                if (uploadCheck.Checked) await RunNodeScriptAsync("upload_myl_restante.cjs", selectedFolders);

                if (syncCheck.Checked)
                {
                    var extraArgs = folderProductCheck.Checked ? new[] { "--product-from-data-folder" } : Array.Empty<string>();
                    await RunNodeScriptAsync("sync_myl_physical_products.cjs", selectedFolders, extraArgs);
                }

                if (repairImagesCheck.Checked) await RunNodeScriptAsync("fix_myl_image_urls_from_local.cjs", selectedFolders);
                if (uploadR2Check.Checked) await RunNodeScriptAsync("upload_images_r2.cjs", selectedFolders, new[] { TcgType });
            }

            statusLabel.Text = "Terminado.";
            AppendLog("✅ Proceso terminado.");
        }
        catch (Exception ex)
        {
            statusLabel.Text = "Terminó con error.";
            AppendLog($"❌ {ex.Message}");
            MessageBox.Show(ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            ToggleUi(true);
        }
    }

    private async Task RunNodeScriptAsync(string scriptName, string[] selectedFolders, string[]? extraArgs = null)
    {
        statusLabel.Text = $"Ejecutando {scriptName}...";
        AppendLog("");
        var extraLog = extraArgs is { Length: > 0 } ? $" {string.Join(" ", extraArgs)}" : "";
        AppendLog($"> node {scriptName} --db={string.Join(",", selectedFolders)}{extraLog}");

        var nodePath = File.Exists(@"C:\Program Files\nodejs\node.exe") ? @"C:\Program Files\nodejs\node.exe" : "node";

        var psi = new ProcessStartInfo
        {
            FileName = nodePath,
            WorkingDirectory = BackendDir,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        psi.ArgumentList.Add(scriptName);
        psi.ArgumentList.Add($"--db={string.Join(",", selectedFolders)}");
        foreach (var arg in extraArgs ?? Array.Empty<string>()) psi.ArgumentList.Add(arg);

        using var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, eventArgs) => { if (eventArgs.Data != null) AppendLog(eventArgs.Data); };
        process.ErrorDataReceived += (_, eventArgs) => { if (eventArgs.Data != null) AppendLog(eventArgs.Data); };

        if (!process.Start()) throw new InvalidOperationException($"No se pudo iniciar {scriptName}.");
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync();

        if (process.ExitCode != 0) throw new InvalidOperationException($"{scriptName} terminó con código {process.ExitCode}.");
    }

    private void ToggleUi(bool enabled)
    {
        folderList.Enabled = enabled;
        reloadButton.Enabled = enabled;
        selectAllButton.Enabled = enabled;
        uploadCheck.Enabled = enabled;
        syncCheck.Enabled = enabled;
        folderProductCheck.Enabled = enabled;
        repairImagesCheck.Enabled = enabled;
        diagnoseImagesCheck.Enabled = enabled;
        diagnoseHttpCheck.Enabled = enabled;
        startButton.Enabled = enabled;
        loadJsonButton.Enabled = enabled;
        fieldCombo.Enabled = enabled;
        valueCombo.Enabled = enabled;
        searchBox.Enabled = enabled;
    }

    private void AppendLog(string message)
    {
        if (InvokeRequired)
        {
            BeginInvoke(() => AppendLog(message));
            return;
        }

        logBox.AppendText(message + Environment.NewLine);
    }
}













