from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List
import nh3
import models.models as models
from sqlalchemy import func, or_ # Make sure to import 'func' and 'or_'
from sqlalchemy.orm import Session
from app.VerifyHeaders import verify_headers
from .helper  import get_paged_result
from .audit import audit
import database
import models.models as models
from models.models import _INT32_POS
from .dbtables import (
    EmailTemplate
)

router = APIRouter(
    prefix="/api/EmailTemplate",
    tags=["EmailTemplate"],
)

@router.get("", response_model=models.EmailTemplatePagedResult)
async def get_all_email_templates(
    page: int = 1,
    pageSize: int = 5,
    search: str = Query(None),
    upn: str = None, 
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # --- 1. Build the base query and apply filters ---
    query = db.query(EmailTemplate)
    
    # --- 2. Apply search filter if provided ---
    if search:
        lower_search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(EmailTemplate.EmailTemplateType).like(lower_search_term) #,
                # func.lower(EmailTemplate.EmailTemplateSubject).like(lower_search_term)
            )
        ) 
    
    results = [
        models.EmailTemplate(
            # Fields from the Email Template class
            EmailTemplateID=et.EmailTemplateID,
            EmailTemplateType=et.EmailTemplateType,
            EmailTemplateSubject=et.EmailTemplateSubject,
            EmailTemplateText=et.EmailTemplateText,
            ModifiedDate=et.ModifiedDate
        )
        for et in query.all()
    ]

    return get_paged_result(results, page, pageSize)


@router.put("/Update/{id}", response_model=models.EmailTemplate)
async def update_email_template(
    id: _INT32_POS,
    email_template: models.EmailTemplate,
    upn: str = None,
    auth_info: dict = Depends(verify_headers),
    db: Session = Depends(database.get_db)
):
    # Find existing email template
    existing_template = db.query(EmailTemplate).filter(EmailTemplate.EmailTemplateID == id).first()
    
    if not existing_template:
        raise HTTPException(
            status_code=404,
            detail=f"Email template with ID {id} not found"
        )

    # Sanitize inputs before saving:
    # Subject is plain text — strip all HTML tags entirely
    clean_subject = nh3.clean(email_template.EmailTemplateSubject, tags=set())
    # Body supports a safe subset of HTML tags for formatting
    clean_body = nh3.clean(
        email_template.EmailTemplateText,
        tags={"p", "a", "b", "i", "u", "strong", "em", "ul", "ol", "li", "br", "span", "h1", "h2", "h3"},
        attributes={"a": {"href", "title", "target"}, "span": {"style"}},
    )

    try:
        # Update fields
        existing_template.EmailTemplateType = email_template.EmailTemplateType
        existing_template.EmailTemplateSubject = clean_subject
        existing_template.EmailTemplateText = clean_body
        existing_template.ModifiedDate = func.now()

        # Commit changes
        db.commit()
        db.refresh(existing_template)

        # Return updated record
        result = models.EmailTemplate(
            EmailTemplateID=existing_template.EmailTemplateID,
            EmailTemplateType=existing_template.EmailTemplateType,
            EmailTemplateSubject=existing_template.EmailTemplateSubject,
            EmailTemplateText=existing_template.EmailTemplateText,
            ModifiedDate=existing_template.ModifiedDate
        )
        audit(
            event="emailtemplate.update", action="update", result="success",
            upn=auth_info["upn"], method="PUT", path=f"/api/EmailTemplate/Update/{id}",
            item_type="EmailTemplate", item_id=id,
            status_code=200,
        )
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error updating email template: {str(e)}"
        )  


# @router.get("/GetEmailTemplateList", response_model=List[models.EmailTemplate])
# async def get_email_template_list():
#     return [
#         {
#             "emailTemplateID": 1,
#             "emailTemplateType": "Welcome Email",
#             "subject": "Welcome!",
#             "body": "Hello and welcome!",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# @router.get("/TypeAhead", response_model=List[models.EmailTemplate])
# async def type_ahead(name: str = None):
#     return [
#         {
#             "emailTemplateID": 1,
#             "emailTemplateType": "Welcome Email",
#             "subject": "Welcome!",
#             "body": "Hello and welcome!",
#             "modifiedDate": "2025-08-19T12:00:00Z",
#         }
#     ]

# @router.get("/{id}", response_model=models.EmailTemplate)
# async def get_email_template_by_id(id: int):
#     return {
#         "emailTemplateID": id,
#         "emailTemplateType": "Welcome Email",
#         "subject": "Welcome!",
#         "body": "Hello and welcome!",
#         "modifiedDate": "2025-08-19T12:00:00Z",
#     }

# @router.post("", response_model=models.EmailTemplate)
# async def create_email_template(email_template: models.EmailTemplate):
#     return email_template

# @router.put("/{id}")
# async def update_email_template(id: int, email_template: models.EmailTemplate):
#     return {"message": "EmailTemplate updated successfully"}

# @router.delete("/{id}")
# async def delete_email_template(id: int):
#     return {"message": "EmailTemplate deleted successfully"}
