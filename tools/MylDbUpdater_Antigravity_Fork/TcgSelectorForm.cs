using System;
using System.Drawing;
using System.Windows.Forms;

namespace CarpetazoMylDbUpdater;

public class TcgSelectorForm : Form
{
    public TcgSelectorForm()
    {
        Text = "Carpetazo TCG Updater - Selección";
        Size = new Size(400, 300);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.White;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;

        var title = new Label
        {
            Text = "¿Qué TCG deseas gestionar?",
            Font = new Font("Segoe UI", 14F, FontStyle.Bold),
            ForeColor = Color.FromArgb(15, 36, 75),
            AutoSize = true,
            Location = new Point(50, 30)
        };
        Controls.Add(title);

        var btnMyl = new Button
        {
            Text = "Mitos y Leyendas",
            Size = new Size(250, 50),
            Location = new Point(65, 80),
            Font = new Font("Segoe UI", 11F, FontStyle.Bold),
            BackColor = Color.FromArgb(31, 67, 191),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };
        btnMyl.Click += (s, e) =>
        {
            Hide();
            var mainForm = new MainForm("Myl");
            mainForm.FormClosed += (s2, e2) => Close();
            mainForm.Show();
        };
        Controls.Add(btnMyl);

        var btnPokemon = new Button
        {
            Text = "Pokémon",
            Size = new Size(250, 50),
            Location = new Point(65, 150),
            Font = new Font("Segoe UI", 11F, FontStyle.Bold),
            BackColor = Color.FromArgb(239, 68, 68), // Red color for Pokemon
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };
        btnPokemon.Click += (s, e) =>
        {
            Hide();
            var mainForm = new MainForm("Pokemon");
            mainForm.FormClosed += (s2, e2) => Close();
            mainForm.Show();
        };
        Controls.Add(btnPokemon);
    }
}
