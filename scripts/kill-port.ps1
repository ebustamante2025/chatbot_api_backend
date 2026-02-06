# Script para detener procesos en el puerto 3001
$port = 3001
$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($pid in $processes) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Deteniendo proceso $pid ($($process.ProcessName)) en puerto $port..."
            Stop-Process -Id $pid -Force
            Write-Host "✓ Proceso detenido"
        }
    }
} else {
    Write-Host "No hay procesos usando el puerto $port"
}
