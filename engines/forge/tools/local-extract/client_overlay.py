"""Build a local read-only-by-convention AssetBundle view with applied hot updates.

Hard links avoid copying gigabytes. Output must be a dedicated owner-chosen work directory;
only individual stale links are replaced, never a source file or a directory tree.
"""
import os
from pathlib import Path


def client_overlay(base, patches, out):
    out = Path(out).resolve()
    roots = [Path(base).resolve(), *(Path(p).resolve() for p in patches)]
    if any(out == r or out.is_relative_to(r) or r.is_relative_to(out) for r in roots):
        raise ValueError('Client overlay must be separate from the source client directories')
    for root in roots:
        for source in root.rglob('*'):
            if not source.is_file() or source.relative_to(root).parts[0] == 'audio':
                continue
            if source.suffix.lower() not in ('.ab', '.bin', '.ress') and source.name != 'hot_update_list.json':
                continue
            target = out / source.relative_to(root)
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                if os.path.samefile(source, target):
                    continue
                target.unlink()
            os.link(source, target)
    return out
