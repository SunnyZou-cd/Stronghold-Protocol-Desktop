# 皮肤特效与多模组干员兼容更新

当前桌面引擎基线：Forge 0.19.1 / upstream 0.3.1。非官方、非商业修改版。

## 更新内容

- 已安装的303套时装全部接入官方外观配置：248套独立特效、55套官方复用默认特效。覆盖普攻、弹道、命中、技能、天赋、嵌套效果及召唤物。真实可达资源没有缺失。
- 从本机合法客户端及热更新提取4,676条本体替换声明。使用实际召唤者实例关联41类召唤物的65条外观映射、79组模型；切换皮肤或隐藏队友皮肤时同步更新本体与召唤物。
- 按规范化名称标签、charId和形态模板合并同一干员的身份。逻各斯、谬因只保留唯一可购买身份；塞雷娅保留原版与已启用莱茵模组的盟约和特质。未启用的模组不赋予成员资格，旧棋子ID保留解析兼容。
- 提供相对路径桌面宿主、源码与无官方美术便携包、白名单本地素材导入工具和可重复构建脚本。

## 验证

- 本次相关联合回归558/558通过，涵盖六个模组的全部64种启用子集、普通/精锐/自选、房间隔离、特效计划与缓存、召唤者归属和模型查询。
- 另外5组真实WebSocket房间与HTTP数据逐表一致；助战目录按其正式WebSocket通道核对。
- 19,040个素材文件及10,047个特效描述的可达闭包检查通过，缺文件、坏文件、纹理、网格和嵌套引用缺失均为0。
- 实际作战、便携包移动启动、发布文件SHA256结果见随发布的验收摘要。
- 本次修改文件ESLint为0 errors（保留既有warnings）；setup、服务smoke、导入边界和类型检查通过。

全库CI没有全绿：历史数据夹具缺失等测试失败且部分失败测试留下打开句柄；全库lint也有本次范围外错误。4个自选golden场景已有快照差异，经独立副本仅撤回本次DIY投影后，完整digest仍相同，未重写golden掩盖差异。上述情况不作为本次功能回归通过的替代证明，原始检查记录保存在本地验收目录。

## 素材与表现边界

GitHub公开包不内置官方美术、模型、音频、字体或截图。使用者需导入本人合法持有的素材；已有旧完整包可运行import-local-assets.mjs，也可按README及engines/forge/docs/SKIN-EFFECTS.md从本机客户端重建。源码、构建脚本、依赖锁定和许可声明一并提供。

303套覆盖表示配置与实际资源链路接通；现有WebGL渲染器对4类Unity shader使用basic兼容家族，原版屏幕扭曲等效果不保证逐像素相同。具体shader、材质数量和受影响效果见SKIN-EFFECTS.md与机器覆盖报告。

## 来源

- 官方客户端skin_table.json、battle skin prefab的_replaceEffectPairs、_fakeProjectileConfigs及tokenSkinMap。
- [PRTS时装回廊](https://prts.wiki/w/时装一览)与干员Spine页用于归属及模型核对。
- [官方客户端数据公开镜像](https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/skin_table.json)。
- [原始项目](https://github.com/sganggs/Stronghold-Protocol)及[Forge分支](https://github.com/XiaMo233M/Stronghold-Protocol-Forge)。

所有原作者与第三方声明继续有效；GPL代码许可不授予官方游戏素材的权利。
