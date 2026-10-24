using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Launcher {
    [STAThread]
    static void Main() {
        var root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        var exe = Path.Combine(root, @"node_modules\electron\dist\electron.exe");
        if (!File.Exists(exe)) {
            MessageBox.Show("缺少 Electron 运行时，请在应用目录重新安装依赖。", "卫戍协议", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        try {
            var start = new ProcessStartInfo(exe, "\"" + root + "\"");
            start.WorkingDirectory = root;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            Process.Start(start);
        } catch (Exception error) {
            MessageBox.Show(error.Message, "卫戍协议启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
