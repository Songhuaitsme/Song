Option Explicit
Dim shell, files, root, script, command, result
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
script = files.BuildPath(root, "scripts\local-preview.ps1")
command = Quote(shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe") & _
  " -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Quote(script) & " -Action Start"
On Error Resume Next
result = shell.Run(command, 0, True)
If Err.Number <> 0 Then
  MsgBox "Unable to run the website launcher: " & Err.Description, 16, "Song"
  WScript.Quit 1
End If
WScript.Quit result

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
