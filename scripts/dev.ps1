# Ambiente de desenvolvimento: FastAPI com reload (8000) + Vite (5173).
# Acesse http://localhost:5173
$Root = Split-Path -Parent $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\frontend'; npm run dev"
