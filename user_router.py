import uuid
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(
    prefix="/auth",
    tags=["用户认证接口 (注册/登录)"]
)

def get_password_hash(password: str, salt: str) -> str:
    """计算加盐哈希值"""
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()


# 1. 用户注册
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user_data: schemas.UserAuth, db: Session = Depends(get_db)):
    # 检查用户名是否已存在
    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已被注册")

    # 生成随机盐值并加密密码
    salt = uuid.uuid4().hex
    password_hash = get_password_hash(user_data.password, salt)

    # 存入数据库
    new_user = models.User(
        username=user_data.username,
        password_hash=password_hash,
        salt=salt
    )
    db.add(new_user)
    db.commit()
    return {"message": "注册成功"}


# 2. 用户登录
@router.post("/login", response_model=schemas.TokenResponse)
def login(user_data: schemas.UserAuth, db: Session = Depends(get_db)):
    # 查找用户
    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="用户名或密码错误")

    # 验证密码：用数据库里存的 salt 和输入的密码再次哈希
    computed_hash = get_password_hash(user_data.password, db_user.salt)
    if computed_hash != db_user.password_hash:
        raise HTTPException(status_code=400, detail="用户名或密码错误")

    # 登录成功，生成会话 Token 并写入 session 表
    token = uuid.uuid4().hex
    expire_at = datetime.utcnow() + timedelta(hours=2)

    # 清理该用户旧的 session（防止多端重复登录，可选）
    db.query(models.Session).filter(models.Session.user_id == db_user.id).delete()

    db_session = models.Session(
        user_id=db_user.id,
        token=token,
        expire_at=expire_at
    )
    db.add(db_session)
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": db_user.username
    }
