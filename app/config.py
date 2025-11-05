"""설정 관리 모듈"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """애플리케이션 설정"""
    
    # Supabase 설정
    supabase_url: str
    supabase_key: str
    supabase_table_name: str = "bible_chunks"
    
    # OpenAI 설정
    openai_api_key: str
    
    # FastAPI 설정
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # CORS 설정
    allowed_origins: str = "http://localhost:3000"
    
    # 임베딩 모델 설정
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536
    
    # LLM 설정
    llm_model: str = "gpt-4-turbo-preview"
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """허용된 오리진 리스트 반환"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()

