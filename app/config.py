"""설정 관리 모듈"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # Supabase 설정
    supabase_url: str
    supabase_key: str
    supabase_table_name: str = "bible_chunks"
    
    # Google Generative AI 설정
    google_api_key: str
    
    # FastAPI 설정
    api_host: str = "localhost"  # Windows에서는 localhost 사용 권장
    api_port: int = 8000
    
    # CORS 설정
    allowed_origins: str = "http://localhost:3000"
    
    # 임베딩 모델 설정 (Google Gemini)
    embedding_model: str = "models/gemini-embedding-001"
    embedding_dimension: int = 1536  # output_dimensionality 파라미터로 설정할 차원 (기본값: 1536)
    
    # LLM 설정 (Google Gemini)
    llm_model: str = "gemini-pro"  # 또는 "gemini-1.5-pro", "gemini-1.5-flash" 등
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """허용된 오리진 리스트 반환"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # .env 파일의 추가 필드 무시


settings = Settings()

