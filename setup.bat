@echo off
rem Membuat virtual environment proyek lalu memasang semua dependensi.
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [1/4] membuat virtual environment .venv ...
  python -m venv .venv
  if errorlevel 1 goto :gagal
) else (
  echo [1/4] .venv sudah ada, dilewati.
)

echo [2/4] memperbarui pip ...
".venv\Scripts\python.exe" -m pip install --upgrade pip

echo [3/4] memasang dependensi (bisa beberapa menit, mediapipe cukup besar) ...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :gagal

echo [4/4] memastikan model pelacak tangan tersedia ...
".venv\Scripts\python.exe" backend\tools\download_hand_model.py

echo.
echo Selesai. Jalankan aplikasi dengan: run.bat
pause
exit /b 0

:gagal
echo.
echo Pemasangan gagal. Periksa pesan di atas.
pause
exit /b 1
