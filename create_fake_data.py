import uuid
import hashlib
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Session, Todo

fake = Faker('zh_CN')

DATABASE_URL = "postgresql://postgres:password@localhost:5432/todo_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()


def hash_password(password: str, salt: str) -> str:
    """简易加盐加密函数"""
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()


def generate_data():
    Base.metadata.create_all(bind=engine)

    print("开始生成假数据...")

    for _ in range(5):
        salt = uuid.uuid4().hex
        raw_password = "password123"
        password_hash = hash_password(raw_password, salt)

        user = User(
            username=fake.user_name(),
            password_hash=password_hash,
            salt=salt
        )
        db.add(user)
        db.flush()

        user_session = Session(
            user_id=user.id,
            token=uuid.uuid4().hex,
            expire_at=datetime.utcnow() + timedelta(days=1)
        )
        db.add(user_session)

        for _ in range(fake.random_int(min=3, max=5)):
            todo = Todo(
                user_id=user.id,
                title=fake.sentence(nb_words=3),
                content=fake.paragraph(nb_sentences=2),
                is_completed=fake.boolean(chance_of_getting_true=30)
            )
            db.add(todo)

    db.commit()
    print("假数据导入成功！")


if __name__ == "__main__":
    generate_data()
