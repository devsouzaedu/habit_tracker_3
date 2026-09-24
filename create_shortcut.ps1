$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup\Mensuremi.lnk")
$Shortcut = $WshShell.CreateShortcut($StartupPath)
$Shortcut.TargetPath = "c:\Users\Eduardo\projetosdev\habit_tracker_v3\start.bat"
$Shortcut.WorkingDirectory = "c:\Users\Eduardo\projetosdev\habit_tracker_v3"
$Shortcut.Description = "Mensuremi - Evolua e Mensure sua vida com IA"
$Shortcut.WindowStyle = 7
$Shortcut.Save()
Write-Host "Atalho criado com sucesso na pasta de Inicializacao!"
Write-Host "Caminho: $StartupPath"
