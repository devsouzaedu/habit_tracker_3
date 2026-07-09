$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup\HabitTracker.lnk")
$Shortcut = $WshShell.CreateShortcut($StartupPath)
$Shortcut.TargetPath = "c:\Users\Eduardo\projetosdev\habit_tracker_v3\start.bat"
$Shortcut.WorkingDirectory = "c:\Users\Eduardo\projetosdev\habit_tracker_v3"
$Shortcut.Description = "Sistema Integrado de Gestão de José Eduardo, versão b1,0.7"
$Shortcut.WindowStyle = 7
$Shortcut.Save()
Write-Host "Atalho criado com sucesso na pasta de Inicializacao!"
Write-Host "Caminho: $StartupPath"
