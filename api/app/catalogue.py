import logging
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.VerifyHeaders import verify_headers
from app.audit import audit
from PortalLib.CatalogueLib import APIError, delete_portal_asset, find_portal_asset_by_name

_logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/Catalogue",
    tags=["Catalogue"],
)


@router.get("/Asset")
async def get_catalogue_asset(
    assetName: str = Query(..., min_length=1),
    entityType: str = Query(..., min_length=1),
    auth_info: dict = Depends(verify_headers),
) -> Any:
    try:
        return find_portal_asset_by_name(assetName, entityType)
    except (APIError, requests.exceptions.RequestException) as e:
        _logger.error(f"Catalogue asset lookup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to query the Portal Catalogue. Please try again.",
        )


@router.delete("/Asset/{asset_id}")
async def delete_catalogue_asset(
    asset_id: str,
    auth_info: dict = Depends(verify_headers),
) -> Any:
    path = f"/api/Catalogue/Asset/{asset_id}"
    try:
        result = delete_portal_asset(asset_id)
    except (APIError, requests.exceptions.RequestException) as e:
        _logger.error(f"Catalogue asset delete failed for {asset_id}: {e}")
        audit(
            event="catalogue.asset_delete",
            action="delete",
            result="failure",
            upn=auth_info["upn"],
            method="DELETE",
            path=path,
            item_type="CatalogueAsset",
            status_code=502,
            error_code="CATALOGUE_DELETE_ERROR",
            error_message=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to delete the Portal Catalogue asset. Please try again.",
        )

    audit(
        event="catalogue.asset_delete",
        action="delete",
        result="success",
        upn=auth_info["upn"],
        method="DELETE",
        path=path,
        item_type="CatalogueAsset",
        status_code=200,
    )
    return result
