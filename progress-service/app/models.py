from __future__ import annotations
from pydantic import BaseModel, Field, conlist
from typing import List, Optional

class MaterialItem(BaseModel):
    name: str
    planned_qty: float = Field(ge=0)
    actual_qty: float = Field(ge=0)

class ProgressInput(BaseModel):
    PV: float = Field(ge=0)
    EV: float = Field(ge=0)
    AC: float = Field(ge=0)
    T: float = Field(ge=0)
    E: float = Field(ge=0)
    p_recent: float = Field(ge=0)
    remain_days: float = Field(ge=0)
    safety_incidents: int = Field(ge=0)
    materials: List[MaterialItem] = Field(default_factory=list)

class KPI(BaseModel):
    name: str
    value: float
    unit: str = "%"
    label_vi: str

class Recommendation(BaseModel):
    category: str
    items: List[str]

class ProgressOutput(BaseModel):
    kpis: List[KPI]
    recommendations: List[Recommendation]
    email_message_vi: str
