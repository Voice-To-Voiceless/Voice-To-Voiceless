def make_nurse(index: int = 1) -> dict[str, str]:
    return {"full_name": "Asistenta de serviciu" if index == 1 else f"Development Nurse {index}"}
