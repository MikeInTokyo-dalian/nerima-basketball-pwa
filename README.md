# 练马区体育馆空场查询

面向 Windows 的 Electron 桌面客户端，用于查询[练马区设施预约系统](https://shisetsuyoyaku.city.nerima.tokyo.jp/)公开的篮球场空闲信息。

## 桌面客户端

安装包位于：

```text
dist\体育馆空场查询 Setup 1.0.0.exe
```

客户端启动后会自动查询当前开放月份内全部场馆、全部星期和全部开始时间的空场。页面上方可以重新指定：

- 星期：支持多选；不选表示全部。
- 场馆：支持多选；不选表示全部。
- 开始时间：仅保留该时间及以后开始的场次，包含所选时间本身；留空表示全部。

查询期间会显示当前场馆、月份或日期进度，可以取消。单个场馆或日期失败时，其他结果仍会保留，并在结果上方显示警告。

## 开发与测试

需要当前 Node.js LTS 和 pnpm。

```powershell
pnpm install
pnpm dev
```

质量检查：

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

生成 Windows NSIS 安装包：

```powershell
pnpm dist:win
```

Electron 主进程负责访问公开 API；renderer 仅通过隔离的 preload IPC 获取场馆、启动/取消查询和接收进度。窗口启用了 sandbox 与 context isolation，并关闭 renderer 的 Node.js 权限。

## 旧版 PowerShell（保留兼容）

现有脚本和静态报告流程仍可使用。双击 `run.bat`，或运行：

```powershell
.\Get-GymAvailability.ps1
```

旧版会生成：

- `availability.csv`
- `availability.json`
- `availability.html`

示例：

```powershell
.\Get-GymAvailability.ps1 -FacilityName '平和台' -StartTime '9:00' -OpenReport
```

旧版 HTML 报告提供“星期”“场馆名”和“开始时间”组合过滤。CSV 和 JSON 中保留 `Weekday` 字段。

## 查询约束

- 利用种目固定为篮球，代码 `220020`。
- 查询网站当前开放的全部月份。
- 不需要登录，不执行预约，也不保存账号信息。
- 默认请求间隔为 250 毫秒，避免高频访问公开接口。
