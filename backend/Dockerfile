# 使用轻量级 Python 基础镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 安装必要的系统库 (ddddocr 依赖 opencv，需要一些系统级图形库支持)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 拷贝依赖文件并安装
COPY requirements.txt .
# 使用阿里云镜像源加速安装过程
RUN pip install --no-cache-dir -r requirements.txt
# 拷贝所有后端代码
COPY . .

# 暴露 FastAPI 默认启动端口
EXPOSE 8005

# 启动命令
CMD ["python", "main.py"]
