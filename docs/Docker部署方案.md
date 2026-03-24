# 服务器端 Docker Compose 一键部署方案

针对您的私有服务器环境，推荐使用 Docker Compose。

## 1. 准备工作

将项目整体文件夹（包含 `backend` 文件夹和 `docker-compose.yml`）上传到服务器。

## 2. 极速启动 (Up)

在包含 `docker-compose.yml` 的目录下直接执行：

```bash
docker-compose up -d --build
```

*提示：`--build` 会强制重新构建镜像以应用您的代码修改。*

## 3. 日志与维护

服务会自动在 8005 端口跑起来并设置开机自启。

### 监控实时识别日志

```bash
docker-compose logs -f ocr-service
```

### 停止并移除容器

```bash
docker-compose down
```

---

### 最后一步 (修改脚本)

记得回到您的 `auto_captcha.user.js` 第 23 行，将 `http://127.0.0.1:8005` 里的 IP 换成您服务器的公网 IP，然后再次下发给您的小白朋友们即可。
