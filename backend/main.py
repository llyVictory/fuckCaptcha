import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import ddddocr
from pydantic import BaseModel
from typing import Optional
from fastapi import Header

# 这里的暗号你可以自己随意修改，只要跟油猴脚本对齐即可
FUCK_CAPTCHA_TOKEN = "fc_auth_token_pocapola_9527"

# 初始化 ddddocr 并关闭控制台广告信息展示
ocr_engine = ddddocr.DdddOcr(show_ad=False)

app = FastAPI(title="FuckCaptcha OCR API", description="极其轻量的验证码识别微服务")

# 必须配置全局跨域资源共享 (CORS)
# 因为我们的前端是油猴脚本，它注入在任意网站页面上。
# 如果不放行跨域，这些随意域名的网站是无法将验证码图发送给你的服务器的。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许任何源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法包括 POST/OPTIONS
    allow_headers=["*"],
)

class ImageRequest(BaseModel):
    image_base64: str

@app.post("/base64")
async def ocr_by_base64(req: ImageRequest, x_token: Optional[str] = Header(None)):
    """
    接受客户端传递的验证码图片 Base64 编码，执行识别并返回。
    """
    # 如果暗号不对，直接拦截并报 403 权限错误
    if x_token != FUCK_CAPTCHA_TOKEN:
        print(f"[拒绝访问] 检测到非法请求尝试，提供的 Token 是: {x_token}")
        raise HTTPException(status_code=403, detail="非法请求，暗号不对")

    try:
        b64_data = req.image_base64
        
        # 很多前端 canvas/img 获取到的 base64 带有类似于 data:image/png;base64, 的头部
        # 如果有，我们在后端为其清理拆分
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]
            
        img_bytes = base64.b64decode(b64_data)
        
        # 调用核心推演引擎
        result_text = ocr_engine.classification(img_bytes)
        
        # 详细日志打印，提供全流程节点供追踪反馈
        print(f"\n[验证码追踪] ---> 收到前台发来图片数据，大小: {len(b64_data)} bytes")
        print(f"[验证码追踪] ---> 本地模型解析计算出的字符结果为: '{result_text}'")
        print("[验证码追踪] ---> 正在将结果回传给浏览器脚本...\n")
        
        return {
            "status": "success", 
            "result": result_text,
            "message": "解算成功"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"图片解析失败由于: {str(e)}")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "云端识别引擎活体检测正常"}

if __name__ == "__main__":
    import uvicorn
    # 本地启动测试时默认端口为8000
    uvicorn.run(app, host="0.0.0.0", port=8005)
