from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models, schemas
from typing import List

router = APIRouter(
    prefix="/todos",
    tags=["待办事项接口 (CRUD)"]
)


# 1. 增：创建 Todo
@router.post("/", response_model=schemas.TodoResponse)
def create_todo(
    todo: schemas.TodoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_todo = models.Todo(
        user_id=current_user.id,
        title=todo.title,
        content=todo.content,
    )
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo


# 2. 查：获取当前用户的所有 Todo
@router.get("/", response_model=List[schemas.TodoResponse])
def get_my_todos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Todo).filter(models.Todo.user_id == current_user.id).all()


# 3. 改：修改特定 Todo
@router.put("/{todo_id}", response_model=schemas.TodoResponse)
def update_todo(
    todo_id: int,
    todo_update: schemas.TodoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if not db_todo:
        raise HTTPException(status_code=404, detail="未找到该待办事项")
    if db_todo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改他人的待办事项")

    update_data = todo_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_todo, key, value)

    db.commit()
    db.refresh(db_todo)
    return db_todo


# 4. 删：删除特定 Todo
@router.delete("/{todo_id}")
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_todo = db.query(models.Todo).filter(models.Todo.id == todo_id).first()
    if not db_todo:
        raise HTTPException(status_code=404, detail="未找到该待办事项")
    if db_todo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除他人的待办事项")

    db.delete(db_todo)
    db.commit()
    return {"message": "删除成功", "todo_id": todo_id}
