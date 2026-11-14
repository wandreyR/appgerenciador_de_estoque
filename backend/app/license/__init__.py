from .manager import LicenseError, LicenseManager, LicenseState

license_manager = LicenseManager()

__all__ = ["license_manager", "LicenseError", "LicenseManager", "LicenseState"]
