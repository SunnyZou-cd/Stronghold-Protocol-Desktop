# Stronghold Protocol Desktop

非官方、非商业《明日方舟》卫戍协议同人桌面宿主。源码沿用 GPL-3.0-or-later 及所附 Spine 附加许可；官方角色、美术、模型、音效和数据的权利不因此转移。请阅读 LICENSE、NOTICE.md、THIRD-PARTY-NOTICES.md。

本公开包不含官方游戏美术、Spine、音频、字体及截图。生成的数据表仍保留其原始权属声明，不属于原创 GPL 代码。缺少本地素材时不能达到完整离线包的显示效果。

## 已有旧完整包时恢复素材

下面的脚本只在本机复制游戏素材和素材索引，会覆盖新包内同名素材；不会复制旧包代码、个人存档或密钥，不会联网。

1. 找到自己合法持有的旧完整包中 `engines/forge` 文件夹。成功标志：该文件夹内有 `server/index.js` 和 `public/assets`。
2. 在新包根目录打开 PowerShell，先检查将复制的数量：`node import-local-assets.mjs --from "C:/旧完整包/engines/forge" --dry-run`。成功标志：输出 `ok: true`、`dryRun: true`，且 `to` 为新包的 `engines/forge`。
3. 去掉 `--dry-run` 再执行一次。成功标志：输出 `ok: true`、`dryRun: false` 和大于零的 `fileCount`。公开无素材运行包未安装 Node.js 时，可用其内置运行时：先 `$env:ELECTRON_RUN_AS_NODE='1'`，再执行 `& './node_modules/electron/dist/electron.exe' './import-local-assets.mjs' --from 'C:/旧完整包/engines/forge'`，最后 `Remove-Item Env:ELECTRON_RUN_AS_NODE`。
4. 关闭并重新打开新包。成功标志：已导入的模型/皮肤能够显示；若旧包尚未包含时装特效，请继续按下文提取，导入不能凭空补齐旧包缺少的资源。

脚本仅复制 `public/assets`、`public/fonts`、`public/art`、`data/local-assets.json`、`data/local-fx.json` 和各 `workshop/包名/assets`，并拒绝符号链接/目录联接。源和目标必须是两个独立的引擎目录。可用 `--to` 指定新引擎目录。不要把恢复后的官方素材提交到 GitHub。

## 源码运行

1. 安装 Node.js 22 或更新版。在 engines/forge 中执行 `npm ci`。成功标志：依赖安装完成并生成 public/vendor。
2. 按 engines/forge/docs/ASSETS.md 与本地素材提取说明准备自己合法取得的素材；不要提交游戏素材。基础下载由 `npm run assets` 提供。已合法安装的游戏 AssetBundle 可用 `python tools/local-extract/extract.py --game "你的AssetBundle目录"` 提取；先按 tools/local-extract/requirements.txt 安装 Python 依赖。特效由同一提取器的 `--only fx` 生成，产物为 public/assets/local/fx 与 data/local-fx.json。成功标志：提取无错误，data/local-assets.json、data/local-fx.json及其引用文件存在。
3. 在本目录执行 `npm ci`、`npm start`。成功标志：独立窗口启动并显示本地服务器。
4. `state/` 是运行时生成的个人存档，不应纳入源码或分发包。

## Windows 本地构建

Launcher.cs 是独立启动器源码；使用 Windows .NET Framework 的 csc.exe，引用 System.Windows.Forms.dll，以 /target:winexe 编译为 Stronghold-Protocol.exe。图标可省略。Electron 完整运行时由宿主 package-lock.json 固定，并保留自己的版权及许可。

仓库内 build-release.mjs 为可重复打包入口。从发布源码根目录运行时，会以当前源码与 desktop/ 模板构建；首次先在根目录和 engines/forge 各执行 `npm ci`。`node build-release.mjs no-assets --zip --out "C:/codex/my-build"` 生成不含游戏美术的 Windows 包；`full` 模式仅用于已经恢复本地素材的个人完整包，`source` 模式生成源码包。SP_DESKTOP_SOURCE、SP_ENGINE_SOURCE、SP_WRAPPER_SOURCE 可指定其它来源。输出位置和名称由 --out 指定，脚本拒绝覆盖已有输出。需要 Windows .NET Framework 编译器及 7-Zip；不加 --zip 可仅生成目录。成功标志：生成 FILE-MANIFEST.json，再运行 `node verify-release.mjs "C:/codex/my-build"` 返回 ok 为 true。公开上传只使用 source 或 no-assets 模式。

完整皮肤的303套模型来源是本机整合的官方时装分包；本仓不分发这些模型或其缓存索引。基础下载与基础提取不保证自动恢复同样303套皮肤。先从本人合法持有的旧完整包导入已有模型与时装索引，再补齐时装专用特效。

## 补齐时装及召唤物特效

这一步会读取自己的游戏客户端，并在本机导出官方特效/召唤物模型，更新素材索引；它不会修改原客户端。运行前请先完成基础特效提取并保留好已有素材。下面命令在 `engines/forge` 目录中执行，示例路径要替换成自己的位置。

```powershell
python tools/local-extract/outfits.py --game "C:/合法客户端/AB/Windows" --skins ".cache/gamedata/excel/skin_table.json" --wardrobe "data/local-assets.json" --out "public/assets/local" --manifest "data/local-fx.json" --report "C:/codex/skin-fx-rebuild/coverage.json" --merge-token-models
```

若客户端还包含独立热更新目录，在同一命令加 `--patch-game "C:/合法客户端/热更新Bundles"`；多个补丁可重复提供，后面的版本覆盖前面的版本。成功标志：命令正常结束，覆盖报告中的已安装时装数量与自己的时装索引一致；其 `missingEffects`、`missingTokenUnits` 等实际调用链缺失列表为空，并且实际作战中时装特效与召唤物外观随所选皮肤变化。`--merge-token-models` 将生成的召唤物模型索引合入现有 `data/local-assets.json`，保留原角色模型；不指定该开关时生成的 `token-skins.json` 仅留在报告目录。详细数据边界见 `engines/forge/docs/SKIN-EFFECTS.md`。

上游：https://github.com/sganggs/Stronghold-Protocol 和 https://github.com/XiaMo233M/Stronghold-Protocol-Forge 。各目录内原始作者与第三方声明继续有效。
