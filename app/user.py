from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List
import models.models as models

router = APIRouter(
    prefix="/api/User",
    tags=["User"],
)

# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/User/logon")

# @router.get("", response_model=models.UserPagedResult)
# async def get_all_users(page: int = 1):
#     return {
#         "pageIndex": page,
#         "pageSize": 10,
#         "totalCount": 1,
#         "totalPages": 1,
#         "results": [
#             {
#                 "id": 1,
#                 "username": "johndoe",
#                 "firstName": "John",
#                 "lastName": "Doe",
#                 "email": "johndoe@example.com",
#             }
#         ],
#     }

# @router.get("/{id}", response_model=models.User)
# async def get_user_by_id(id: int):
#     return {
#         "id": id,
#         "username": "johndoe",
#         "firstName": "John",
#         "lastName": "Doe",
#         "email": "johndoe@example.com",
#     }

# @router.post("", response_model=models.User)
# async def create_user(user: models.User, token: str = Depends(oauth2_scheme)):
#     return user

# @router.put("/{id}")
# async def update_user(id: int, user: models.User, token: str = Depends(oauth2_scheme)):
#     return {"message": "User updated successfully"}

# @router.delete("/{id}")
# async def delete_user(id: int, token: str = Depends(oauth2_scheme)):
#     return {"message": "User deleted successfully"}

# @router.post("/logon", response_model=models.Token)
# async def logon(form_data: OAuth2PasswordRequestForm = Depends()):
#     # In a real application, you would verify the username and password
#     # and then create and return a real JWT token.
#     return {"token": "fake-jwt-token"}
