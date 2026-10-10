from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session as DBSession
from config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={'client_encoding': 'utf8'},
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db: DBSession = SessionLocal()
    try:
        yield db
    finally:
        db.close()
