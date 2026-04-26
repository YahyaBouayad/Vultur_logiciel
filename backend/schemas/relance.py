from pydantic import BaseModel
from typing import Optional
from datetime import date


class RelanceCreate(BaseModel):
    date: date
    notes: Optional[str] = None


class RelanceOut(BaseModel):
    id: int
    facture_id: int
    date: date
    notes: Optional[str]

    class Config:
        from_attributes = True
