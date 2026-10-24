Set fs = CreateObject("Scripting.FileSystemObject")
Set ws = CreateObject("WScript.Shell")
base = fs.GetParentFolderName(WScript.ScriptFullName)
exe = base & "\node_modules\electron\dist\electron.exe"
If Not fs.FileExists(exe) Then
  MsgBox "Electron runtime missing. Run npm install in: " & base, 16, "Stronghold Desktop"
  WScript.Quit 1
End If
ws.CurrentDirectory = base
ws.Environment("PROCESS").Remove "ELECTRON_RUN_AS_NODE"
ws.Run Chr(34) & exe & Chr(34) & " " & Chr(34) & base & Chr(34), 0, False
