// 语言配置
// 加载动画 CSS
const loadingCSS = `
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    border-top-color: transparent;
    margin-right: 6px;
    vertical-align: -3px;
    animation: rotate 1s linear infinite;
  }
`;

// 添加样式到页面
const style = document.createElement('style');
style.textContent = loadingCSS;
document.head.appendChild(style);

const i18n = {
  'zh': {
    captureButton: '截图',
    capturing: '截图中...',
    copyButton: '复制到剪贴板',
    closeButton: '关闭',
    copied: '已复制！',
    copyFailed: '复制失败',
    noContent: '找不到有效的内容区域',
    previewTitle: '截图预览'
  },
  'en': {
    captureButton: 'Capture',
    capturing: 'Capturing...',
    copyButton: 'Copy to Clipboard',
    closeButton: 'Close',
    copied: 'Copied!',
    copyFailed: 'Copy failed',
    noContent: 'No valid content area found',
    previewTitle: 'Screenshot Preview'
  }
};

// 获取当前语言
function getCurrentLanguage() {
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

// 获取当前语言的文本
function getText(key) {
  const lang = getCurrentLanguage();
  return i18n[lang][key];
}

// 调试工具
const debug = {
  log: (...args) => console.log('[DeepSeek Snapshot]', ...args),
  error: (...args) => console.error('[DeepSeek Snapshot]', ...args)
};

// 加载 html2canvas
async function loadHtml2Canvas() {
  try {
    // 如果已经存在，直接返回
    if (window.html2canvas) {
      debug.log('html2canvas 已存在，版本:', window.html2canvas.version || '未知');
      return window.html2canvas;
    }

    // 发送消息给后台脚本注入 html2canvas
    debug.log('请求注入 html2canvas...');
    await chrome.runtime.sendMessage({ type: 'INJECT_HTML2CANVAS' });

    // 等待 html2canvas 加载完成
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 秒超时

      const checkLoaded = () => {
        attempts++;
        if (window.html2canvas) {
          debug.log('html2canvas 加载成功，版本:', window.html2canvas.version || '未知');
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('html2canvas 加载超时'));
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    });

    return window.html2canvas;
  } catch (error) {
    debug.error('html2canvas 加载失败:', error);
    throw error;
  }
}

// 创建截图功能
// 创建预览弹框
function createPreviewModal(imageDataUrl) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999999;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    max-width: 90%;
    max-height: 90%;
    display: flex;
    flex-direction: column;
    gap: 15px;
  `;

  const preview = document.createElement('img');
  preview.src = imageDataUrl;
  preview.style.cssText = `
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
  `;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: center;
    gap: 10px;
  `;

  const copyButton = document.createElement('button');
  copyButton.textContent = '复制到剪贴板';
  copyButton.style.cssText = `
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;

  const closeButton = document.createElement('button');
  closeButton.textContent = getText('closeButton');
  closeButton.style.cssText = `
    padding: 8px 16px;
    background-color: #666;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;

  copyButton.addEventListener('mouseover', () => copyButton.style.backgroundColor = '#45a049');
  copyButton.addEventListener('mouseout', () => copyButton.style.backgroundColor = '#4CAF50');
  closeButton.addEventListener('mouseover', () => closeButton.style.backgroundColor = '#555');
  closeButton.addEventListener('mouseout', () => closeButton.style.backgroundColor = '#666');

  copyButton.addEventListener('click', async () => {
    try {
      const blob = await (await fetch(imageDataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      copyButton.textContent = getText('copied');
      setTimeout(() => {
        copyButton.textContent = getText('copyButton');
      }, 2000);
    } catch (error) {
      debug.error('复制失败:', error);
      copyButton.textContent = '复制失败';
      setTimeout(() => {
        copyButton.textContent = getText('copyButton');
      }, 2000);
    }
  });

  closeButton.addEventListener('click', () => {
    modal.remove();
  });

  buttonContainer.appendChild(copyButton);
  buttonContainer.appendChild(closeButton);
  container.appendChild(preview);
  container.appendChild(buttonContainer);
  modal.appendChild(container);
  document.body.appendChild(modal);

  // 点击弹框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function captureElement(element) {
  debug.log('开始截图过程...');
  debug.log('目标元素信息:', {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    width: element.offsetWidth,
    height: element.offsetHeight,
    display: window.getComputedStyle(element).display,
    position: window.getComputedStyle(element).position,
    visibility: window.getComputedStyle(element).visibility,
    zIndex: window.getComputedStyle(element).zIndex
  });

  try {
    debug.log('开始加载 html2canvas...');
    const html2canvas = await loadHtml2Canvas();
    if (typeof html2canvas !== 'function') {
      throw new Error('html2canvas 加载失败');
    }
    debug.log('html2canvas 加载成功，版本:', html2canvas.version || '未知');

    debug.log('开始调用 html2canvas...');
    const options = {
      scale: window.devicePixelRatio || 1,  // 使用设备的像素比，默认为 1
      useCORS: true,                       // 允许跨域资源
      logging: true,                       // 启用日志
      backgroundColor: '#ffffff',          // 使用白色背景
      width: element.offsetWidth,          // 使用元素实际宽度
      height: element.offsetHeight,        // 使用元素实际高度
      scrollX: 0,                          // 不考虑滚动位置
      scrollY: 0,
      x: 0,                                // 从页面左上角开始
      y: 0,
      windowWidth: element.offsetWidth,     // 设置窗口宽度
      windowHeight: element.offsetHeight,   // 设置窗口高度
      foreignObjectRendering: false,        // 禁用 foreignObject 渲染
      removeContainer: true,                // 移除临时容器
      ignoreElements: (element) => {
        // 忽略这些元素
        const ignoreList = [
          'intercom-frame',
          'intercom-lightweight-app',
          'ds-notification-container',
          'toast-container',
          'modal-container'
        ];

        return element.id && ignoreList.includes(element.id) ||
               element.classList && ignoreList.some(cls => element.classList.contains(cls));
      },
      onclone: (clonedDoc) => {
        debug.log('文档克隆成功');
        
        // 移除可能影响截图的元素
        const removeSelectors = [
          '.toast',
          '.modal',
          '.popup',
          '.overlay',
          '[role=\'dialog\']',
          '[aria-modal=\'true\']'
        ];
        
        removeSelectors.forEach(selector => {
          const elements = clonedDoc.querySelectorAll(selector);
          elements.forEach(el => el.remove());
        });
      }
    };
    
    debug.log('开始执行截图...');
    debug.log('目标元素尺寸:', element.offsetWidth, 'x', element.offsetHeight);
    debug.log('html2canvas 选项:', options);

    // 执行截图
    const canvas = await html2canvas(element, options);
    if (!canvas) {
      throw new Error('html2canvas 返回空画布');
    }
    debug.log('截图成功，画布尺寸:', canvas.width, 'x', canvas.height);
    
    // 创建预览弹框
    const dataUrl = canvas.toDataURL('image/png');
    createPreviewModal(dataUrl);
    
    // 创建 Blob
    debug.log('开始创建 Blob...');
    try {
      const blob = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('toBlob 超时'));
        }, 5000); // 5 秒超时

        canvas.toBlob(blob => {
          clearTimeout(timeout);
          if (blob) {
            debug.log('Blob 创建成功，大小:', blob.size, '类型:', blob.type);
            resolve(blob);
          } else {
            reject(new Error('Blob 创建失败'));
          }
        }, 'image/png', 1.0);
      });

      return blob;
    } catch (e) {
      debug.error('toBlob 转换错误:', e);
      
      // 如果 toBlob 失败，尝试使用 toDataURL
      try {
        const dataUrl = canvas.toDataURL('image/png');
        debug.log('DataURL 创建成功，长度:', dataUrl.length);
        
        // 将 DataURL 转换为 Blob
        const byteString = atob(dataUrl.split(',')[1]);
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], {type: mimeString});
        debug.log('Blob 从 DataURL 创建成功，大小:', blob.size);
        return blob;
      } catch (e2) {
        debug.error('DataURL 转换错误:', e2);
        throw e2;
      }
    }
  } catch (e) {
    debug.error('截图过程错误:', e);
    throw e;
  }
}

// 获取实际的内容区域
async function getContentArea() {
  debug.log('开始查找内容区域...');

  // 输出页面结构信息
  const bodyClasses = document.body.className;
  const rootElement = document.getElementById('root');
  debug.log('页面结构:', {
    'body classes': bodyClasses,
    'has root': !!rootElement,
    'document.body size': `${document.body.offsetWidth}x${document.body.offsetHeight}`,
    'window size': `${window.innerWidth}x${window.innerHeight}`
  });

  // 找到所有可见的元素
  const allElements = Array.from(document.querySelectorAll('*')).filter(el => {
    if (!(el instanceof HTMLElement)) return false;
    
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    
    // 基本可见性检查
    const isVisible = style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      style.opacity !== '0' &&
                      rect.width > 0 &&
                      rect.height > 0;

    // 检查是否是主要内容区域
    const isMainContent = el.getAttribute('role') === 'main' ||
                         el.getAttribute('role') === 'article' ||
                         el.className.toLowerCase().includes('content') ||
                         el.className.toLowerCase().includes('main') ||
                         el.id.toLowerCase().includes('content') ||
                         el.id.toLowerCase().includes('main') ||
                         el.tagName.toLowerCase() === 'article' ||
                         el.tagName.toLowerCase() === 'main';

    // 检查是否有内容
    const hasContent = el.innerText.trim().length > 50;

    return isVisible && (hasContent || isMainContent);
  });

  const allDivs = allElements;

  debug.log(`找到 ${allDivs.length} 个可见的内容 div 元素`);

  // 计算每个 div 的分数
  const scoredDivs = allDivs.map(div => {
    const rect = div.getBoundingClientRect();
    const style = window.getComputedStyle(div);
    
    // 计算分数
    let score = 0;
    
    // 1. 大小分数
    score += div.offsetHeight * 0.5; // 高度影响分数
    score += div.offsetWidth * 0.3;  // 宽度也考虑
    
    // 2. 位置分数
    const centerY = rect.top + rect.height / 2;
    const distanceFromCenter = Math.abs(window.innerHeight / 2 - centerY);
    score -= distanceFromCenter * 0.2; // 距离中心越远分数越低
    
    // 3. 内容分数
    score += div.innerText.trim().length * 0.1; // 文本内容多的得分高
    
    // 4. 语义分数
    if (div.getAttribute('role') === 'main') score += 1000;
    if (div.getAttribute('role') === 'article') score += 800;
    if (div.className.toLowerCase().includes('content')) score += 500;
    if (div.className.toLowerCase().includes('main')) score += 500;
    
    return { div, score };
  });

  // 按分数排序
  scoredDivs.sort((a, b) => b.score - a.score);

  // 输出前 5 个得分最高的 div 的信息
  scoredDivs.slice(0, 5).forEach((item, index) => {
    const { div, score } = item;
    debug.log(`第 ${index + 1} 高分的 div:`, {
      score: Math.round(score),
      height: div.offsetHeight,
      width: div.offsetWidth,
      className: div.className,
      id: div.id,
      role: div.getAttribute('role'),
      'aria-label': div.getAttribute('aria-label'),
      text: div.innerText.slice(0, 100) + '...'
    });
  });

  // 选择得分最高的 div
  const bestDiv = scoredDivs[0]?.div;
  if (bestDiv) {
    debug.log('选择得分最高的 div:', {
      height: bestDiv.offsetHeight,
      width: bestDiv.offsetWidth,
      className: bestDiv.className,
      id: bestDiv.id,
      role: bestDiv.getAttribute('role')
    });
    return bestDiv;
  }

  // 如果没有找到合适的元素，尝试获取当前可见区域
  const visibleContent = document.querySelector('.conversation-content, .chat-content, #root, main, article') || document.body;
  if (visibleContent) {
    debug.log('使用可见区域作为内容区域:', {
      element: visibleContent.tagName,
      className: visibleContent.className,
      id: visibleContent.id
    });
    return visibleContent;
  }

  throw new Error(getText('noContent'));
}

// 创建悬浮截图按钮
function createCaptureButton() {
  const button = document.createElement('button');
  button.id = 'deepseek-capture-btn';
  button.innerHTML = getText('captureButton');
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
  `;

  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#45a049';
  });

  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#4CAF50';
  });

  // 创建 loading spinner 元素
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.style.display = 'none';
  button.insertBefore(spinner, button.firstChild);

  button.addEventListener('click', async () => {
    debug.log('截图按钮被点击');
    try {
      // 显示 loading 状态
      spinner.style.display = 'inline-block';
      const originalText = button.textContent;
      button.textContent = getText('capturing');
      button.style.pointerEvents = 'none';
      button.style.opacity = '0.7';

      const area = await getContentArea();
      if (area) {
        await captureElement(area);
      }
    } catch (error) {
      debug.error('截图失败:', error);
    } finally {
      // 恢复按钮状态
      spinner.style.display = 'none';
      button.textContent = getText('captureButton');
      button.style.pointerEvents = 'auto';
      button.style.opacity = '1';
    }
  });

  document.body.appendChild(button);
}

// 在页面加载完成后创建按钮
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createCaptureButton);
} else {
  createCaptureButton();
}

// 监听来自 popup 的消息（保留兼容性）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    debug.log('收到截图请求');
    
    (async () => {
      let wrapper = null;
      try {
        const contentArea = await getContentArea();
        debug.log('找到内容区域:', {
          tagName: contentArea.tagName,
          id: contentArea.id,
          className: contentArea.className,
          width: contentArea.offsetWidth,
          height: contentArea.offsetHeight
        });
        
        // 添加一个层来包裹内容，防止截图时包含其他元素
        wrapper = document.createElement('div');
        const rect = contentArea.getBoundingClientRect();
        wrapper.style.cssText = `
          position: fixed;
          top: ${rect.top}px;
          left: ${rect.left}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: white;
          z-index: 999999;
          overflow: hidden;
          pointer-events: none;
        `;
        
        // 克隆内容并添加到包裹层
        const clone = contentArea.cloneNode(true);
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);
        
        // 等待一帧以确保 DOM 已更新
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        debug.log('开始捕获元素...');
        const blob = await captureElement(wrapper);
        
        debug.log('开始写入剪贴板...');
        let tempCanvas = null;
        let img = null;

        try {
          // 创建预览窗口
          const previewContainer = document.createElement('div');
          previewContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          `;

          // 创建标题
          const title = document.createElement('div');
          title.textContent = getText('previewTitle');
          title.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            color: #333;
          `;
          previewContainer.appendChild(title);

          // 创建预览图片
          const previewImg = document.createElement('img');
          previewImg.style.cssText = `
            max-width: 300px;
            max-height: 200px;
            object-fit: contain;
            border-radius: 4px;
          `;
          previewImg.src = URL.createObjectURL(blob);
          previewContainer.appendChild(previewImg);

          // 创建按钮容器
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
          `;

          // 创建复制按钮
          const copyButton = document.createElement('button');
          copyButton.textContent = getText('copyButton');
          copyButton.style.cssText = `
            padding: 6px 12px;
            background: #1a73e8;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          `;
          buttonContainer.appendChild(copyButton);

          // 创建关闭按钮
          const closeButton = document.createElement('button');
          closeButton.textContent = getText('closeButton');
          closeButton.style.cssText = `
            padding: 6px 12px;
            background: #f1f3f4;
            color: #333;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          `;
          buttonContainer.appendChild(closeButton);

          previewContainer.appendChild(buttonContainer);
          document.body.appendChild(previewContainer);

          // 添加事件监听器
          copyButton.onclick = async () => {
            try {
              // 创建一个临时的 canvas 元素
              const canvas = document.createElement('canvas');
              canvas.width = previewImg.naturalWidth;
              canvas.height = previewImg.naturalHeight;
              const ctx = canvas.getContext('2d');
              
              // 将预览图片绘制到 canvas 上
              ctx.drawImage(previewImg, 0, 0);
              
              // 尝试使用后台脚本写入剪贴板
              debug.log('请求后台脚本写入剪贴板...');
              const response = await chrome.runtime.sendMessage({
                type: 'WRITE_TO_CLIPBOARD',
                dataUrl: canvas.toDataURL('image/png')
              });

              if (!response.success) {
                throw new Error(response.error || '未知错误');
              }

              debug.log('写入剪贴板成功');
              copyButton.textContent = getText('copied');
              copyButton.style.background = '#34a853';
              setTimeout(() => {
                copyButton.textContent = getText('copyButton');
                copyButton.style.background = '#1a73e8';
              }, 2000);

              // 清理
              canvas.remove();
            } catch (error) {
              debug.error('复制失败:', error);
              copyButton.textContent = '复制失败';
              copyButton.style.background = '#ea4335';
              setTimeout(() => {
                copyButton.textContent = getText('copyButton');
                copyButton.style.background = '#1a73e8';
              }, 2000);
            }
          };

          closeButton.onclick = () => {
            previewContainer.remove();
          };

          // 自动关闭预览窗口
          setTimeout(() => {
            if (previewContainer.parentNode) {
              previewContainer.remove();
            }
          }, 30000);  // 30 秒后自动关闭
        } catch (error) {
          debug.error('写入剪贴板失败:', error);
          throw error;
        } finally {
          // 清理资源
          if (img && img.src) {
            URL.revokeObjectURL(img.src);
          }
          if (tempCanvas && tempCanvas.parentNode) {
            tempCanvas.remove();
          }
        }
        
        debug.log('截图完成并已复制到剪贴板');
        sendResponse({ success: true });
      } catch (error) {
        debug.error('截图失败:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          stack: error.stack
        });
      } finally {
        // 确保包裹层被移除
        if (wrapper && wrapper.parentNode) {
          wrapper.remove();
        }
      }
    })();
    return true;  // 保持消息通道开启
  }
  return false;  // 不处理其他消息
});

debug.log('内容脚本已加载并准备就绪');

