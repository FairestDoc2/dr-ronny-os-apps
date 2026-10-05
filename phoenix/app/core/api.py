from app.core.registry import get_core


def get_api_data():
    """
    Zentrale API-Schnittstelle für den Phoenix Core.
    Alle zukünftigen Module greifen über diese Funktion
    auf die Core-Daten zu.
    """
    return get_core()
