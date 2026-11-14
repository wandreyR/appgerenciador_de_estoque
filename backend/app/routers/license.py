from fastapi import APIRouter, HTTPException

from ..license import LicenseError, license_manager
from ..schemas import ActivateIn

router = APIRouter(prefix="/api/license", tags=["licença"])


@router.get("/status")
def status():
    return license_manager.refresh().to_dict()


@router.post("/activate")
def activate(data: ActivateIn):
    try:
        return license_manager.activate(data.key).to_dict()
    except LicenseError as e:
        raise HTTPException(400, e.message)


@router.post("/check")
def check_now():
    """Força a verificação online (botão 'Verificar agora')."""
    result = license_manager.online_check(force=True)
    if result is False:
        raise HTTPException(503, "Não foi possível verificar a licença. Confira a conexão com a internet e tente novamente.")
    return license_manager.refresh().to_dict()
