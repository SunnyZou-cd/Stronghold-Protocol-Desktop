# 乐勒砳特供 · 可选拓展

三个 Mod 默认关闭：收藏品（39 件）、新干员包（结城理、娜仁图亚、予愿安洁莉娜、丰川祥子）、本轮伤害统计。
房主可以在等待室切换，改变设置清除玩家准备；开局后锁定。数据表按原版/莱茵 × 新干员关闭/开启隔离，互不污染。
统计沿用服务器实际扣血计数，每秒采样，只保存本轮和上一轮，不写战绩。没有引入六工作线程、超限难度、全局属性加成或敌人禁用。

来源（GPL-3.0-or-later，原文件与 LICENSE 保留）：
- https://github.com/UNDFFIO/Stronghold-Protocol-dlc @ 17691f155a8fe062d85aecfeec2abe50f0359009
- https://github.com/remember-4/Stronghold-Protocol-Rem @ df2488f021e1b069c22c9215f586559ec388b153
- https://github.com/Stardust-minus/Stronghold-Protocol @ 9bb6b2d833978c0aa9ef1713ef188d6c1588169f

更新方法：先应用莱茵补丁并生成原版/莱茵数据，再运行 +4 回合生成器，覆盖 data 及四个 overlay 文件；随后 git apply --check mods/party/party-code.patch 验证后应用补丁，运行 generate-data.mjs 生成额外干员的两个独立数据目录。最后应用 friends-profile.patch，增量下载干员模型与收藏品图标。
任何补丁冲突都停止暂存构建；测试通过并确认无对局后才切换 Compose 挂载。reapply.sh 不会改动线上或自动重启。
