from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://user:password@127.0.0.1:5433/lenny_db?client_encoding=utf8"
    pi_bridge_url: str = "http://127.0.0.1:3001"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:1.7b"
    llm_provider: str = "ollama"
    llm_model: str = "qwen3:1.7b"
    model_request_timeout: int = 120
    environment: str = "development"
    port: int = 8000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
