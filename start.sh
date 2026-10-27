#!/usr/bin/env bash
set -e

# AegisTilt Kill Switch Intelligence Layer Start Script
echo "=================================================="
echo " Starting AegisTilt Kill Switch Intelligence Layer"
echo "=================================================="

# Check Python venv
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv backend/venv
    backend/venv/bin/pip install --upgrade pip
    backend/venv/bin/pip install -r backend/requirements.txt
fi

# Check Node modules
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "Starting Backend on http://127.0.0.1:8000 ..."
PYTHONPATH=. backend/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

echo "Starting Frontend on http://localhost:5173 ..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" INT TERM EXIT

echo ""
echo "🚀 AegisTilt is live!"
echo "   - Web UI:  http://localhost:5173"
echo "   - API Docs: http://127.0.0.1:8000/docs"
echo "   - Real-time WebSocket: ws://127.0.0.1:8000/ws/tilt/trader_alpha"
echo ""
echo "Press Ctrl+C to stop both servers."

wait
