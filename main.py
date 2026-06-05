import time
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import models
from database import engine
import DB_router
import user_router
import redis_router

app = FastAPI(title="Todo List 后端系统")

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
    """启动时建表，带重试，适应 Railway 等平台数据库延迟就绪的场景"""
    max_retries = 10
    for i in range(max_retries):
        try:
            models.Base.metadata.create_all(bind=engine)
            return
        except Exception:
            if i < max_retries - 1:
                time.sleep(3)
            else:
                raise


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
