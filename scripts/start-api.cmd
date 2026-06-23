@echo off
python -m pip install -r server\requirements.txt -q
python -m uvicorn server.main:app --host 127.0.0.1 --port 8787
