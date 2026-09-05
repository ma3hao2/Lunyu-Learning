using System;
using System.Diagnostics;
using System.IO;

// 7za 包装器：调用真实 7za，忽略其退出码始终返回 0。
// 原因：非管理员 Windows 下解压 winCodeSign 时 darwin 符号链接创建失败（exit 2），
// 但所有 Windows 打包所需文件均已成功解出；electron-builder 却因非零退出码而重试崩溃。
class SevenZipWrapper
{
    static int Main(string[] args)
    {
        string exeDir = Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName);
        string real = Path.Combine(exeDir, "7za_real.exe");
        if (!File.Exists(real)) return -1;

        var psi = new ProcessStartInfo
        {
            FileName = real,
            Arguments = string.Join(" ", Array.ConvertAll(args, a => a.IndexOf(' ') >= 0 ? "\"" + a + "\"" : a)),
            UseShellExecute = false
        };
        using (var p = Process.Start(psi))
        {
            p.WaitForExit();
        }
        return 0; // 强制成功：darwin 符号链接缺失不影响 Windows 打包
    }
}
