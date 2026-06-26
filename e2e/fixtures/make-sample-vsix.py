import io
import zipfile
from pathlib import Path

out = Path(__file__).resolve().parent / "sample.vsix"
out.parent.mkdir(parents=True, exist_ok=True)
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as zf:
    zf.writestr(
        "extension.vsixmanifest",
        '<?xml version="1.0" encoding="utf-8"?>'
        '<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">'
        '<Metadata><Identity Language="en-US" Id="e2e.sample" Version="1.0.0" Publisher="e2e"/>'
        "</Metadata></PackageManifest>",
    )
out.write_bytes(buf.getvalue())
print(f"Wrote {out} ({out.stat().st_size} bytes)")
