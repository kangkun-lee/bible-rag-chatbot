# Bible QA - Backend

FastAPI backend service for Bible QA application.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```

## API Documentation

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## Environment Variables

Make sure to set up your `.env` file with necessary API keys (Supabase, OpenAI/Anthropic, etc.).
