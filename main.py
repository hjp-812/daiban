import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import models
from database import engine
import DB_router
import user_router
import redis_router

app = FastAPI(title="Todo List 后端系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(DB_router.router)
app.include_router(user_router.router)
app.include_router(redis_router.router)

# 挂载静态文件（CSS / JS）
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")


@app.on_event("startup")
def startup():
    """启动时建表，重试最多 60 秒"""
    from database import DATABASE_URL
    safe_url = DATABASE_URL.replace("://", "://***:***@") if "://" in DATABASE_URL else DATABASE_URL
    print(f"[startup] 连接数据库: {safe_url}")

    for i in range(20):
        try:
            models.Base.metadata.create_all(bind=engine)
            print("[startup] 数据库表创建成功")
            return
        except Exception as e:
            print(f"[startup] 数据库未就绪 (第 {i+1}/20 次): {e}")
            if i < 19:
                time.sleep(3)

    raise RuntimeError("数据库连接失败，已重试 20 次")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
