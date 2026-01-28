@echo off
echo Starting Docker Rebuild for Backend...
docker-compose up --build -d backend
echo.
echo ===============================================
echo Backend Restarted!
echo Please wait 30 seconds, then check http://localhost:9000/app
echo ===============================================
pause
