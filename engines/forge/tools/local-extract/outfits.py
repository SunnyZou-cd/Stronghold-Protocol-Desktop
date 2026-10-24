"""Export installed outfits' actual effect substitutions from an owner-owned Arknights client.

No download or invented colour mapping. Requires the existing full fx index/manifest in --out/--manifest.
The installed wardrobe and official skin_table select the exact skin prefab; all game art stays local.
"""
import argparse
import json
import subprocess
import re
from pathlib import Path
import fx
from client_overlay import client_overlay


def skin_config(env, root):
    """Read the actual skin component, not similarly named illustration/building prefabs."""
    replacements, fake, other, fields = {}, [], [], set()
    for c in env.tt(root).get('m_Component', []):
        f, o = env.resolve(root.assets_file, c.get('component'))
        if o is None or f == 'builtin' or o.type.name != 'MonoBehaviour':
            continue
        d = env.tt(o)
        if '_replaceEffectPairs' in d or '_fakeProjectileConfigs' in d:
            fields.update(k for k in d if not k.startswith('m_'))
        for p in d.get('_replaceEffectPairs') or []:
            a, b = p.get('fromEffect'), p.get('toEffect')
            if isinstance(a, str) and isinstance(b, str) and a:
                replacements[a.lower()] = b.lower()
        if d.get('_useFakeProjectile'):
            fake.extend(d.get('_fakeProjectileConfigs') or [])
        other.extend(k for k in d if ('replace' in k.lower() or 'effect' in k.lower()) and k != '_replaceEffectPairs')
    return replacements, fake, sorted(set(other)), sorted(fields)


def collect(game, table, wardrobe, index, log=print):
    cabs = fx.scan_cabs(game)
    result = {}
    for char, art in sorted(wardrobe.get('chars', {}).items()):
        if not art.get('skins'):
            continue
        rel = f'skinpack/{char}.ab'
        env = fx.AssetEnv(game, cabs)
        roots = env.prefabs(rel, full=True) if (game / rel).exists() else {}
        for sid, entry in sorted(art['skins'].items()):
            official = table.get('charSkins', {}).get(sid)
            row = {'charId': char, 'name': entry.get('name'), 'source': rel, 'replacements': {}}
            result[sid] = row
            if not official or (official.get('tmplId') or official.get('charId')) != char:
                row['status'] = 'missing-official-record'
                continue
            battle = official.get('battleSkin') or {}
            row['tokenSkinMap'] = official.get('tokenSkinMap') or []
            stem = (battle.get('skinOrPrefabId') or '').lower()
            path = next((p for p in roots if p.lower().endswith(f'/{char}/{stem}.prefab') and '/battle/prefabs/' in p), None)
            if path is None:
                row['status'] = 'missing-client-prefab'
                continue
            row['prefab'] = path
            row['overwritePrefab'] = bool(battle.get('overwritePrefab'))
            replacements, fake, other, fields = skin_config(env, roots[path])
            row.update(replacements=replacements, fakeProjectiles=fake, configFields=fields)
            row['unsupportedConfigFields'] = [k for k in fields if k not in ('_replaceEffectPairs', '_useFakeProjectile', '_fakeProjectileConfigs')]
            if other:
                row['otherEffectFields'] = other
            base = index.get('units', {}).get(char, {})
            points = fx.skin_points(env, rel, stem, base.get('graphic'), container=f'/{char}/{stem}.prefab')
            if points:
                row['mounts'] = {'source': path, 'graphic': base.get('graphic'), 'points': points}
            row['status'] = 'independent-effects' if replacements else 'shared-effects'
            if not base:
                row['status'] = 'missing-base-fx'
        log(f'outfits: {char}: {len(art["skins"])}')
    return result


def collect_tokens(game, outfits, index, out):
    from extract import prefab_spine_nodes, pick_spine_node, write_spine
    safe_leaf = lambda value: re.sub(r'[^A-Za-z0-9_.-]', '_', value)
    cabs = fx.scan_cabs(game)
    groups, models, cache = {}, {}, {}
    targets = set()
    for sid, outfit in outfits.items():
        outfit['tokenLooks'] = {}
        for mapping in outfit.get('tokenSkinMap', []):
            base, variant = mapping['tokenId'], mapping['tokenSkinId']
            if variant not in cache:
                rel = f'skinpack/{base}.ab'
                env = fx.AssetEnv(game, cabs)
                roots = env.prefabs(rel, full=True) if (game / rel).exists() else {}
                path = next((p for p in roots if '/battle/' in p and p.lower().endswith(f'/{variant.lower()}.prefab')), None)
                look = {'variant': variant, 'source': rel, 'status': 'missing-client-prefab'}
                cache[variant] = (look, {})
                if path is None:
                    continue
                root = roots[path]
                replacements, fake, other, fields = skin_config(env, root)
                points = fx.skin_points(env, rel, variant, index.get('units', {}).get(base, {}).get('graphic'), container='/' + path.split('/')[-1])
                look.update(status='available', replacements=replacements, fakeProjectiles=fake, configFields=fields,
                            unsupportedConfigFields=[k for k in fields if k not in ('_replaceEffectPairs', '_useFakeProjectile', '_fakeProjectileConfigs')],
                            mounts={'source': path, 'graphic': index.get('units', {}).get(base, {}).get('graphic'), 'points': points or {}})
                objects = root.assets_file.objects
                nodes = prefab_spine_nodes(env.tt(root), objects)
                faces = {}
                for face in ('front', 'back'):
                    node = next((n for n in nodes if n[0].lower() == face), None)
                    if face == 'front' and node is None:
                        node = pick_spine_node(nodes)
                    sda = objects.get(node[2]['m_PathID']) if node and not node[2].get('m_FileID') else None
                    if sda is None:
                        continue
                    sub = f'spine/token-skin/{safe_leaf(variant)}/{face}'
                    if write_spine(objects, env.tt(sda), sub, variant, out, groups, print):
                        files = groups[sub]
                        renames = {name: safe_leaf(name) for name in files}
                        for name in files:
                            p = out / sub / name
                            if name.endswith('.atlas'):
                                lines = p.read_text(encoding='utf-8').splitlines()
                                p.write_text('\n'.join(renames.get(line, line) for line in lines) + '\n', encoding='utf-8')
                            if name != renames[name]:
                                p.replace(out / sub / renames[name])
                        groups[sub] = files = {renames[name]: {**entry, 'path': f'/assets/local/{sub}/{renames[name]}'} for name, entry in files.items()}
                        skel = next(k for k in files if k.endswith('.skel'))
                        meta = json.loads(subprocess.check_output(['node', str(Path(__file__).with_name('plugin-art.mjs')), '--spine', str(out / sub / skel)], timeout=30))
                        faces[face] = {**meta, 'skel': files[skel]['path'], 'atlas': files[skel[:-5] + '.atlas']['path'],
                                       'textures': [files[k]['path'] for k in sorted(files) if k.endswith('.png')]}
                cache[variant] = (look, faces)
            look, faces = cache[variant]
            outfit['tokenLooks'][base] = look
            targets.update(look.get('replacements', {}).values())
            if faces:
                models.setdefault(base, {})[sid] = faces
    return targets, {'version': 1, 'groups': groups, 'tokenSkins': models}


def reachable_effects(index, unit, replacements):
    """Only follow the selected skin's actual prefab graph, not dead replacement declarations."""
    pending = list(unit.get('refs') or [])
    visited, missing = set(), set()
    while pending:
        original = pending.pop().lower()
        resolved = replacements.get(original, original)
        if not resolved or resolved == 'common_empty' or resolved in visited:
            continue
        visited.add(resolved)
        prefab = index.get('prefabs', {}).get(resolved)
        if prefab is None:
            missing.add(resolved)
        else:
            pending.extend(prefab.get('refs') or [])
    return visited, missing


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--game', required=True, type=Path)
    ap.add_argument('--patch-game', action='append', default=[], type=Path, help='applied hot-update bundle root, later layers win')
    ap.add_argument('--skins', required=True, type=Path)
    ap.add_argument('--wardrobe', required=True, type=Path)
    ap.add_argument('--out', required=True, type=Path, help='existing assets/local directory')
    ap.add_argument('--manifest', required=True, type=Path, help='existing local-fx.json')
    ap.add_argument('--report', required=True, type=Path)
    ap.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--metadata-only', action='store_true')
    ap.add_argument('--reuse-report', action='store_true', help='explicitly reuse this installation\'s previous scan')
    ap.add_argument('--only-skins', default='', help='incrementally rescan exact comma-separated wardrobe keys')
    ap.add_argument('--merge-token-models', action='store_true', help='explicitly merge generated token models/groups into --wardrobe, preserving existing character art')
    args = ap.parse_args()
    if args.patch_game:
        args.game = client_overlay(args.game, args.patch_game, args.report.parent / 'client-view')
    read = lambda p: json.loads(p.read_text(encoding='utf-8'))
    index_path = args.out / 'fx/index.json'
    index = read(index_path)
    wardrobe = read(args.wardrobe)
    base_refs = set()
    missing_bases = [char for char, art in wardrobe.get('chars', {}).items() if art.get('skins') and char not in index.get('units', {})]
    if missing_bases and not args.metadata_only:
        cabs = fx.scan_cabs(args.game)
        eff = fx.container_index(args.game, fx.EFFECT_GLOBS, args.root / '.cache/fx/effects.json', args.jobs, print)
        gd = fx.game_data(args.root)
        units, projectiles, skills, mounts, base_refs = fx.crawl_units(args.game, cabs, missing_bases, gd, eff, {}, {}, print)
        index['units'].update(units)
        index['projectiles'].update(projectiles)
        index['skills'].update(skills)
        index['skins'].update(mounts)
    if args.only_skins:
        selected = set(args.only_skins.split(','))
        wardrobe = {'chars': {char: {'skins': {k: v for k, v in art.get('skins', {}).items() if k in selected}}
                              for char, art in wardrobe.get('chars', {}).items()}}
    outfits = read(args.report)['outfits'] if args.reuse_report else collect(args.game, read(args.skins), wardrobe, index)
    if args.only_skins:
        outfits = {**index.get('outfits', {}), **outfits}
    targets = {k for o in outfits.values() for k in o['replacements'].values() if k and k != 'common_empty'} | base_refs
    token_map = {p['tokenSkinId']: p['tokenId'] for o in outfits.values() for p in o.get('tokenSkinMap', [])
                 if p.get('tokenId') and p.get('tokenSkinId')}
    fake_keys = {p[k].lower() for o in outfits.values() for p in o.get('fakeProjectiles', [])
                 for k in ('graphicProjectileKey', 'logicProjecitleKey') if isinstance(p.get(k), str) and p[k]}
    if (fake_keys or token_map) and not args.metadata_only:
        cabs = fx.scan_cabs(args.game)
        eff = fx.container_index(args.game, fx.EFFECT_GLOBS, args.root / '.cache/fx/effects.json', args.jobs, print)
        token_index = fx.container_index(args.game, (fx.TOKEN_GLOB,), args.root / '.cache/fx/tokens.json', args.jobs, print)
        gd = fx.game_data(args.root)
        bases = sorted(set(token_map.values()) - set(index.get('units', {})))
        tokens, projectiles, skills, mounts, refs = fx.crawl_units(args.game, cabs, bases, gd, eff, {}, token_index, print, extra_projectiles=fake_keys)
        index['units'].update(tokens)
        index['skills'].update(skills)
        index['skins'].update(mounts)
        index['projectiles'].update(projectiles)
        targets.update(refs)
        fx.write_atomic(index_path, json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    if token_map:
        token_targets, token_models = collect_tokens(args.game, outfits, index, args.out)
        targets.update(k for k in token_targets if k and k != 'common_empty')
        args.report.with_name('token-skins.json').write_text(json.dumps(token_models, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        if args.merge_token_models:
            local = read(args.wardrobe)
            local['groups'] = {**local.get('groups', {}), **token_models['groups']}
            local['tokenSkins'] = {**local.get('tokenSkins', {}), **token_models['tokenSkins']}
            local['count'] = sum(len(g) for g in local['groups'].values())
            fx.write_atomic(args.wardrobe, json.dumps(local, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    needed = sorted(targets - set(index.get('prefabs', {})))
    if needed and not args.metadata_only:
        fx.export_fx(args.game, args.out, {}, print, keys=needed, jobs=args.jobs, root=args.root, fx_manifest=args.manifest)
        index = read(index_path)
    for o in outfits.values():
        o['tokenUnits'] = {base: base for base, look in o.get('tokenLooks', {}).items() if look['status'] == 'available' and base in index.get('units', {})}
        o['missingTokenUnits'] = sorted({p['tokenSkinId'] for p in o.get('tokenSkinMap', []) if p['tokenId'] not in o['tokenUnits']})
        declared = {k for k in o['replacements'].values() if k and k != 'common_empty' and k not in index.get('prefabs', {})}
        reachable, missing = reachable_effects(index, index.get('units', {}).get(o['charId'], {}), o['replacements'])
        for base, look in o.get('tokenLooks', {}).items():
            tr, tm = reachable_effects(index, index.get('units', {}).get(base, {}), {**o['replacements'], **look.get('replacements', {})})
            reachable.update(tr)
            missing.update(tm)
        o['declaredMissingEffects'] = sorted(declared)
        o['unreachableReplacementTargets'] = sorted(declared - reachable)
        o['missingEffects'] = sorted(missing)
        if o['missingEffects']:
            o['status'] = 'missing-effects'
        elif o['status'] == 'missing-effects':
            o['status'] = 'independent-effects' if o['replacements'] else 'shared-effects'
    index['outfits'] = outfits
    fx.write_atomic(index_path, json.dumps(index, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
    counts = {}
    for o in outfits.values():
        counts[o['status']] = counts.get(o['status'], 0) + 1
    report = {'total': len(outfits), 'counts': counts, 'replacementPairs': sum(len(o['replacements']) for o in outfits.values()),
              'targetEffects': len(targets), 'newTargetEffects': len(needed), 'outfits': outfits}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'outfits'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
