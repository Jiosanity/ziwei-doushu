# Docker 部署

当前实例：http://192.168.31.108:3016

部署在本机 OrbStack 的 Debian（ARM64）虚拟机，源码及 Compose 文件位于
`/opt/1panel/docker/compose/ziwei-doushu`。可在该服务器的 1Panel「容器」中查看容器和日志。
3316 是 1Panel 管理端口，网站独立使用 3016。

## 从源码构建

在仓库根目录运行：

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail 100
```

构建时执行类型检查、项目自带回归测试及生产构建。运行镜像采用 Next.js standalone，
以非 root 用户启动，包含健康检查、自动重启及日志轮转。解读使用独立 SQLite 文件，
无需额外数据库服务。

## 修改端口或地址

在 Compose 文件同目录创建 `.env`：

```dotenv
PORT=3016
NEXT_PUBLIC_SITE_URL=http://192.168.31.108:3016
```

站点地址写入生产构建，修改后需要重新运行 `docker compose up -d --build`。
配置域名时，反向代理指向 `127.0.0.1:3016`，并将站点地址改为实际域名后重建。

## 当前服务器维护

```sh
ssh root@debian@orb
cd /opt/1panel/docker/compose/ziwei-doushu
docker compose restart
# 停止并删除此项目的容器和网络，保留源码与镜像
docker compose down
```

更新时先备份服务器项目目录，再将新源码同步至此目录并重新构建。
当前部署来自本地源码快照，服务器目录没有 Git 元数据，不会自动跟随 GitHub 更新。

## 开源版范围

支持排盘、命盘展示、古籍阅读等。仓库不包含 AI 解读后端、商业版断语库和用户系统；
单独设置模型 API Key 不会启用 AI 解读。本站额外接入 v4.0-13d 数据集，支持
1950—2026 年的十三维本命预生成解读，不提供即时 AI 问答。

## 十三维解读数据

数据目录：`/opt/ziwei-data/v4`，通过 Compose 只读挂载为 `/data`。
可通过 `.env` 的 `DATASET_DIR` 更换路径。数据不进入 Git 或网站镜像。

2026-10-18 已完成全部 77 年、674,976 张命盘（8,774,688 段）的导入，
数据库约 15.8 GiB。官方年度文件 SHA-256、每条字段和年度数量、SQLite 完整性检查通过。
381 个 1990 年样本的主星匹配、晚子时与经度跨日边界检查通过；
上线后按 77 年及闰日、年末抽查 79 组接口，返回十三维文字与存储原文一致。
类型检查、项目全部排盘回归及生产构建通过，容器健康检查通过。

导入工具支持逐年事务和断点续传；每年下载后验证官方 SHA-256，检查日期、唯一键、
十三个主题及全年条数。全部 674,976 条校验通过后才发布 `readings.sqlite`。
每张命盘内容独立 zlib 压缩，保留原始文本，查询时按唯一键定位并解压。

```sh
docker build -t ziwei-dataset-importer:local scripts/dataset
# 先验证单个年份，生成临时库，不发布
docker run --rm -v /opt/ziwei-data/v4:/data ziwei-dataset-importer:local --years 1990
# 全量导入，成功后发布数据库
docker run --rm -v /opt/ziwei-data/v4:/data ziwei-dataset-importer:local
```

首次发布后再次完整导入前，请选择新目录，例如 `/opt/ziwei-data/v4-rebuild`，
完成后切换 `DATASET_DIR` 并重建容器。不要直接覆盖正在使用的数据库。

前端使用实际参与排盘的公历日期、时辰索引及性别查询，服务器重新计算默认命盘，
核对页面命宫第一主星和数据集 `ms`。主星核对仅为粗粒度一致性校验，无法证明全部星曜
和断语规则一致；数据集来自作者私有站点引擎的固定版本，应以其生成口径为准。
不匹配、范围外、时辰不详时明确提示，不回退到近似命盘。

本命数据不会随运限切换更新。文本中的“当前大限”等是生成时固定内容，页面已注明。
来源及许可见官方 Release 和根目录 `DATASET-LICENSE`。

本次上线前源码备份：`/opt/ziwei-data/site-before-dataset.tar.gz`；旧镜像：
`ziwei-doushu:before-dataset`。回退时先停止项目，保留当前源码副本，再恢复备份并用旧镜像启动。
