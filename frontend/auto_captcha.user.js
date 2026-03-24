// ==UserScript==
// @name         fuckCaptcha - 自动验证码识别填入
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动在验证码图片边上悬浮“一键识别”交互按键，对接了极低能耗的私人服务器搭建接口，面向小白免去了本地配置烦恼。
// @author       Antigravity (针对纯非技术受众版)
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // 【！在此填入你的云服务器的 OCR 接口地址！】
    // 如果部署在你自己的服务器上，修改这里，例如："http://123.45.67.89:8000"
    // 注意结尾不要有反斜杠 "/"
    let OCR_SERVER_URL = GM_getValue("ocr_server_host", "http://127.0.0.1:8005");

    // 为懂行的稍微进阶的用户配置一个注册表单弹框可以直接改后台 IP
    GM_registerMenuCommand("网络项: 设置你的自用主推服务器 IP", () => {
        let newUrl = prompt("请填写您的独立 IP 及端口后台地址 (例如 http://192.168.1.1:8000):", OCR_SERVER_URL);
        if (newUrl) {
            let processedUrl = newUrl.trim();
            if (processedUrl.endsWith('/')) {
                processedUrl = processedUrl.slice(0, -1);
            }
            GM_setValue("ocr_server_host", processedUrl);
            OCR_SERVER_URL = processedUrl;
            alert("[成功] 后台服务器定位更换成功！请按 F5 刷新重载此页。");
        }
    });

    // 第一大系统：仿生视觉侦测系统（寻找可疑的是验证码的地方）
    function isProbableCaptcha(img) {
        const src = (img.src || "").toLowerCase();
        const alt = (img.alt || "").toLowerCase();
        const id = (img.id || "").toLowerCase();
        const className = (img.className || "").toLowerCase();
        
        // 我们利用词根词缀去瞎猜
        const keywords = ['captcha', 'vcode', 'verify', 'code', 'auth', 'safecode', 'login', 'yanzheng'];
        const hasKeyword = keywords.some(kw => src.includes(kw) || alt.includes(kw) || id.includes(kw) || className.includes(kw));
        
        const rect = img.getBoundingClientRect();
        // 因为验证码绝不可能超级巨大！也不可能如同微尘。
        const isSizeMatch = rect.width > 40 && rect.width < 350 && rect.height > 15 && rect.height < 150;
        
        return hasKeyword && isSizeMatch;
    }

    // 第二大系统：几何定位距离求算器（通过平面二维坐标盲找附近存在的白底密码区或者一般空槽）
    function findNearestInput(imgElem) {
        // 先找出所有可视且具备人类输入可能的控件
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'));
        if (inputs.length === 0) return null;

        const imgRect = imgElem.getBoundingClientRect();
        const imgCenter = { x: imgRect.left + imgRect.width / 2, y: imgRect.top + imgRect.height / 2 };

        let nearest = null;
        let minDistance = Infinity;

        // 优化：计算平面几何距离，同时加大对垂直距离（Y轴）的惩罚权重，防止串岗到了上方的其他密码框
        inputs.forEach(input => {
            const rect = input.getBoundingClientRect();
            // 排除隐藏、只读、禁用以及【密码框】（验证码通常不会填入 type=password 的框）
            if (rect.width === 0 || rect.height === 0 || input.disabled || input.readOnly || input.type === 'password') return;
            
            const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            
            // 语义化得分：如果 input 的属性里明显带有 "code", "captcha", "valid" 等字样，极大增加其优先级
            const attrs = (input.placeholder + input.id + input.className + input.name).toLowerCase();
            const semanticBonus = (attrs.includes('code') || attrs.includes('captcha') || attrs.includes('valid')) ? 0.2 : 1.0;

            // Y坐标偏差乘3，且乘以语义奖励系数
            const distance = (Math.pow(center.x - imgCenter.x, 2) + Math.pow(center.y - imgCenter.y, 2) * 5) * semanticBonus;
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = input;
            }
        });
        return nearest;
    }

    // 第三大系统：抗画布污染提取器（如果同源就画板拓印，如果跨域拦截就发包下载解析成 Base64）
    function getBase64Image(img, callback) {
        // 如果网页天然是用 base64 加载的这个验证图片，那直接剥开取用
        if (img.src.startsWith('data:image')) {
            callback(img.src);
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || img.getBoundingClientRect().width;
        canvas.height = img.naturalHeight || img.height || img.getBoundingClientRect().height;
        const ctx = canvas.getContext("2d");
        
        // 使用油猴提供的强权接口强行无视源来提取图像 blob 数据以躲开普通 Canvas 的 Tainted 检测机制
        GM_xmlhttpRequest({
            method: 'GET',
            url: img.src,
            responseType: 'blob',
            onload: function(response) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    callback(reader.result);
                }
                reader.readAsDataURL(response.response);
            },
            onerror: function(err) {
                console.error("跨域图片Blob流拉取彻底失败，启动 Canvas 强绘作为最终退路", err);
                try {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    callback(canvas.toDataURL("image/jpeg"));
                } catch(e) {
                    alert("[拦截警告] 跨域安全极高，拦截了对图片的获取！请尝试通过插件改写 CORS 响应头后再次使用。");
                }
            }
        });
    }

    // 第四大系统：超吸附 UI 渲染引擎
    function injectButton(img) {
        if (img.dataset.fckInjected) return;
        img.dataset.fckInjected = "1";

        const btn = document.createElement('div');
        btn.innerText = "[一键识别填入]";
        btn.title = "点击自动将图片转发到您的个人服务器处理，结果会自动输入旁边的框哦~";
        Object.assign(btn.style, {
            position: 'absolute',
            zIndex: 999999,
            background: 'linear-gradient(135deg, #00C9FF 0%, #92FE9D 100%)',
            color: '#002E5D',
            padding: '4px 10px',
            fontSize: '13px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
            userSelect: 'none',
            fontWeight: '900',
            opacity: 0.9,
            transition: 'all 0.2s ease',
            border: '1px solid white'
        });
        
        btn.onmouseover = () => { btn.style.transform = 'scale(1.05)'; btn.style.opacity = '1'; };
        btn.onmouseout = () => { btn.style.transform = 'scale(1)'; btn.style.opacity = '0.9'; };

        // 使用计算属性跟踪其兄弟的位置底限
        const updatePos = () => {
            const rect = img.getBoundingClientRect();
            // 在图片正下方左贴齐渲染
            btn.style.top = (window.scrollY + rect.top - 28) + 'px';
            btn.style.left = (window.scrollX + rect.left) + 'px';
        };
        
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.innerText = "[正在等待云端计算...]";
            
            getBase64Image(img, (base64) => {
                // 向远端 FastAPI 的端口发冲锋信标
                GM_xmlhttpRequest({
                    method: "POST",
                    url: OCR_SERVER_URL + "/api/ocr/base64",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    data: JSON.stringify({ image_base64: base64 }),
                    onload: function(res) {
                        try {
                            const json = JSON.parse(res.responseText);
                            if (json.status === "success" && json.result) {
                                btn.innerText = "[填充完毕]";
                                const resultText = json.result;
                                const nearestInput = findNearestInput(img);
                                if (nearestInput) {
                                    console.log("[fuckCaptcha] 准备填入: ", resultText);
                                    console.log("[fuckCaptcha] 定位到的周边表单节点: ", nearestInput);
                                    
                                    // 强效干涉突破（针对 Vue/React 的状态反叛防护机制）
                                    // 如果只是普通的 .value = xxx，现代带双向绑定的 JS 框架根本不会理会原生 DOM 的篡改并在提交时将其复原
                                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                                    nativeInputValueSetter.call(nearestInput, resultText);
                                    
                                    // 全要素分发事件钩子以打通所有绑定的 MVVM 框架模型
                                    nearestInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                                    nearestInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                                    
                                    // 修正 blur 派发，避免 Vue 校验报错（使用 FocusEvent）
                                    const blurEvent = new FocusEvent('blur', { bubbles: true, composed: true });
                                    nearestInput.dispatchEvent(blurEvent);
                                } else {
                                    console.warn("[fuckCaptcha] 周边不存在合法的输入框体系！");
                                    prompt("我算出来结果了，但是附近没带框的白板容器给我填！请你自己复制：", resultText);
                                }
                                setTimeout(() => { btn.innerText = "[一键识别填入]"; }, 2500);
                            } else {
                                btn.innerText = "[解析失败]";
                                console.error("服务器返回：", json);
                            }
                        } catch(err) {
                            btn.innerText = "[服务器异常抛出]";
                            console.error("响应错误报文段:", err, res.responseText);
                        }
                    },
                    onerror: function(err) {
                        btn.innerText = "[网络断点或服务器IP不对]";
                        console.error("无法推送到您的后端服务", err);
                    }
                });
            });
        };

        document.body.appendChild(btn);
        updatePos();
        
        // 绑定重绘监视，防止小白拖拽窗口导致悬浮球错乱
        window.addEventListener('resize', updatePos);
    }

    // 主调度任务：地毯式DOM查探
    function scan() {
        const imgs = document.querySelectorAll('img');
        imgs.forEach(img => {
            if (isProbableCaptcha(img)) {
                injectButton(img);
            }
        });
    }

    // 在页面载入周期的数个不同阶段发动，防止懒加载图片导致的漏网
    setTimeout(scan, 800);
    setTimeout(scan, 2500);

    // 发动高昂代价的 DOM 捕鼠器，不间断监控
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) shouldScan = true;
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') shouldScan = true;
        });
        if (shouldScan) {
            clearTimeout(window.scanTimeout);
            window.scanTimeout = setTimeout(scan, 300);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
})();
