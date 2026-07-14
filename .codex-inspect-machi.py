import json
from pathlib import Path

root = Path(r"E:\GitHub\esen-vault")
d = json.loads((root / "thinking-hub-data.json").read_text(encoding="utf-8"))
print(list(d)[:30])
p = d.get("project-hub-v1", {})
print("project root", type(p).__name__, list(p)[:20] if isinstance(p, dict) else len(p))
projects = p.get("projects", []) if isinstance(p, dict) else []
print("projects", len(projects))
print("sample keys", list(projects[0]) if projects else [])
print("sample goal", projects[0].get("goals", [None])[0] if projects and projects[0].get("goals") else None)
print("sample task", projects[0].get("tasks", [None])[0] if projects and projects[0].get("tasks") else None)
g = json.loads((root / "vault-graph.json").read_text(encoding="utf-8"))
print("graph counts", g["meta"].get("nodeCount"), g["meta"].get("edgeCount"), g["meta"].get("generated"))
print("node keys", list(g["elements"]["nodes"][0]["data"]))
print("edge keys", list(g["elements"]["edges"][0]["data"]))
decisions = d.get("decision-hub-v1", [])
print("decisions", type(decisions).__name__, len(decisions))
print("decision sample", decisions[0] if decisions else None)
goals = d.get("goals-hub-v1", {})
print("goals root", type(goals).__name__, list(goals)[:10] if isinstance(goals, dict) else len(goals))
print("project names", [x.get("name") for x in projects])
