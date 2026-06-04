import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import redis
from database import get_db
from auth import get_current_user
import models

router = APIRouter(
    prefix="/redis",
    tags=["Redis 缓存接口"]
)

REDIS_URL = os.getenv("REDIS_URL")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
r = redis.Redis.from_url(REDIS_URL) if REDIS_URL else redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)


# 获取当前登录用户的未完成 Todo 数量（带 Redis 缓存）
@router.get("/todo-count")
def get_my_todo_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    redis_key = f"user:{current_user.id}:todo_count"

    cached_count = r.get(redis_key)
    if cached_count is not None:
        return {
            "user_id": current_user.id,
            "todo_count": int(cached_count),
            "source": "Redis Cache (内存缓存)"
        }

    todo_count = db.query(models.Todo).filter(
        models.Todo.user_id == current_user.id,
        models.Todo.is_completed == False
    ).count()

    r.setex(redis_key, 60, todo_count)

    return {
        "user_id": current_user.id,
        "todo_count": todo_count,
        "source": "PostgreSQL Database (持久化数据库)"
    }


# 手动清除当前用户的缓存
@router.delete("/clear-cache")
def clear_my_cache(
    current_user: models.User = Depends(get_current_user),
):
    redis_key = f"user:{current_user.id}:todo_count"
    r.delete(redis_key)
    return {"message": f"成功清除用户 {current_user.id} 的 Redis 缓存"}
