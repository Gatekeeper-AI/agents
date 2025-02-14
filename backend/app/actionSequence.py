from dataclasses import dataclass
from typing import List, Optional

@dataclass
class Step:
    action: str
    description: str
    selector: Optional[str] = None
    selector_type: Optional[str] = None
    url: Optional[str] = None 
    text: Optional[str] = None

@dataclass
class ActionSequence:
    task: str
    steps: List[Step]

    @classmethod
    def from_json(cls, json_data: dict) -> 'ActionSequence':
        steps = [Step(**step) for step in json_data['steps']]
        return cls(
            task=json_data['task'],
            steps=steps
        )