from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import redis
from database import get_db
import models

router = APIRouter(
    prefix="/redis",
    tags=["Redis 缓存接口"]
)

r = redis.Redis(host='127.0.0.1', port=6379, db=0, decode_responses=True)


# 1. 提取与存储综合演练：获取用户未完成的 Todo 数量（带 Redis 缓存控制）
@router.get("/user/{user_id}/todo-count")
def get_user_todo_count(user_id: int, db: Session = Depends(get_db)):
    redis_key = f"user:{user_id}:todo_count"

    # 【提取】尝试从 Redis 中获取数据
    cached_count = r.get(redis_key)

    if cached_count is not None:
        return {
            "user_id": user_id,
            "todo_count": int(cached_count),
            "source": "Redis Cache (内存缓存)"
        }

    # 如果 Redis 中没有，则去 PostgreSQL 数据库中提取
    todo_count = db.query(models.Todo).filter(
        models.Todo.user_id == user_id,
        models.Todo.is_completed == False
    ).count()

    # 【存储】将查到的结果写入 Redis，并设置 60 秒过期时间
    r.setex(redis_key, 60, todo_count)

    return {
        "user_id": user_id,
        "todo_count": todo_count,
        "source": "PostgreSQL Database (持久化数据库)"
    }


# 2. 提供一个手动清除缓存的接口（方便测试或数据更新时同步）
@router.delete("/user/{user_id}/clear-cache")
def clear_user_cache(user_id: int):
    redis_key = f"user:{user_id}:todo_count"
    r.delete(redis_key)
    return {"message": f"成功清除用户 {user_id} 的 Redis 缓存"}
