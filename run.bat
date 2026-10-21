@echo off
rem Menjalankan backend + frontend di http://127.0.0.1:8000
rem Host/port bisa diubah lewat WAYANG_HOST / WAYANG_PORT (dibaca config.py).
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m backend.app
) else (
  echo Peringatan: .venv belum ada, memakai python global.
  echo Kalau gagal, jalankan setup.bat dulu.
  python -m backend.app
)
pause
