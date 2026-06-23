#!/usr/bin/env bash
# Virtual LC-MS Platform — One-Command Startup
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

banner() {
  echo -e "${CYAN}"
  echo "  ██╗   ██╗██╗      ██████╗    ███╗   ███╗███████╗"
  echo "  ██║   ██║██║     ██╔════╝    ████╗ ████║██╔════╝"
  echo "  ██║   ██║██║     ██║         ██╔████╔██║███████╗"
  echo "  ╚██╗ ██╔╝██║     ██║         ██║╚██╔╝██║╚════██║"
  echo "   ╚████╔╝ ███████╗╚██████╗    ██║ ╚═╝ ██║███████║"
  echo "    ╚═══╝  ╚══════╝ ╚═════╝    ╚═╝     ╚═╝╚══════╝"
  echo ""
  echo -e "  ${BOLD}Virtual LC-MS Metabolomics Simulator v1.0.0${RESET}${CYAN}"
  echo "  Commercial-grade metabolomics simulation platform"
  echo -e "${RESET}"
}

banner

# --- Backend ---
echo -e "${YELLOW}[1/3] Starting FastAPI backend...${RESET}"
cd "$(dirname "$0")/backend"

if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "  Installing Python dependencies..."
  pip install -r requirements.txt --break-system-packages -q
fi

python3 -c "
from app.db.database import engine, Base
from app.db.seed import seed_database
Base.metadata.create_all(bind=engine)
seed_database()
print('  ✓ Database initialized')
"

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo -e "  ${GREEN}✓ Backend running at http://localhost:8000${RESET}"
echo -e "  ${GREEN}✓ API docs at http://localhost:8000/api/docs${RESET}"

# --- Frontend ---
echo ""
echo -e "${YELLOW}[2/3] Starting Next.js frontend...${RESET}"
cd "$(dirname "$0")/frontend"

if [ ! -d node_modules ]; then
  echo "  Installing Node dependencies..."
  npm install -q
fi

npm run dev -- --port 3000 &
FRONTEND_PID=$!
echo -e "  ${GREEN}✓ Frontend starting at http://localhost:3000${RESET}"

# --- Done ---
echo ""
echo -e "${YELLOW}[3/3] Platform ready!${RESET}"
echo ""
echo -e "  ${BOLD}🔬 Open http://localhost:3000 in your browser${RESET}"
echo ""
echo "  Demo login: demo@vlcms.io / demo1234"
echo ""
echo -e "  ${CYAN}Press Ctrl+C to stop all services${RESET}"
echo ""

# Wait and cleanup
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
