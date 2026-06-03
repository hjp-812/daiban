from fastapi import FastAPI
import models
from database import engine
import DB_router
import user_router
import redis_router  # 引入 redis 路由

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Todo List 后端系统")

# 注册所有路由
app.include_router(DB_router.router)
app.include_router(user_router.router)
app.include_router(redis_router.router)  # 注册 Redis 路由

@app.get("/")
def root():
    return {"message": "欢迎来到 Todo List API 系统，请访问 /docs 查看接口文档"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
