# langstitch:node id=llm-1 kind=llm label="Assistant"
from demo.state import State

def llm_1(state: State) -> dict:
    # region CUSTOM
    return {"messages": []}
    # endregion CUSTOM
