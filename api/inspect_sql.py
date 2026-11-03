
try:
    with open("sqldumps/sqldb-workflow-prod-ase-01-09282025-ALL.sql", "r", encoding="utf-16") as f:
        content = f.read(1000)
        print("Successfully read with utf-16")
        print("First 100 chars:", repr(content[:100]))
        if "GO\n" in content or "\nGO\n" in content:
            print("Found GO batch separator")
        else:
            print("Did not find GO in first 1000 chars")
except Exception as e:
    print("Failed with utf-16:", e)
    try:
        with open("sqldumps/sqldb-workflow-prod-ase-01-09282025-ALL.sql", "r", encoding="utf-8") as f:
            content = f.read(1000)
            print("Successfully read with utf-8")
            print("First 100 chars:", repr(content[:100]))
    except Exception as e2:
        print("Failed with utf-8:", e2)
