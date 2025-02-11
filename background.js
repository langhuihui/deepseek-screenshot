// 创建或获取 offscreen 页面
async function setupOffscreenDocument() {
  try {
    // 检查是否已存在 offscreen 页面
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
      console.log('Offscreen document already exists');
      return; // 已存在，无需创建
    }

    // 创建新的 offscreen 页面
    console.log('Creating new offscreen document...');
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Write to clipboard'
    });
    console.log('Offscreen document created successfully');
  } catch (error) {
    console.error('Failed to setup offscreen document:', error);
    throw error;
  }
}

// 初始化 offscreen 页面
setupOffscreenDocument().catch(error => {
  console.error('Failed to initialize offscreen document:', error);
});

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('DeepSeek Snapshot extension installed');
  setupOffscreenDocument().catch(error => {
    console.error('Failed to setup offscreen document on install:', error);
  });
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);

  if (request.type === 'INJECT_HTML2CANVAS') {
    // 获取当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          console.log('Injecting html2canvas...');
          // 注入 html2canvas 脚本
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['html2canvas.min.js']
          });
          console.log('html2canvas injected successfully');
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to inject html2canvas:', error);
          sendResponse({ success: false, error: error.message });
        }
      }
    });
    return true; // 表示异步响应
  }

  if (request.type === 'WRITE_TO_CLIPBOARD') {
    console.log('Processing clipboard write request...');
    
    // 获取当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) {
        sendResponse({ success: false, error: '无法获取当前标签页' });
        return;
      }

      try {
        // 在标签页中执行剪贴板操作
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: async (dataUrl) => {
            console.log('Starting clipboard operation...');
            try {
              // 创建一个图片元素
              const img = new Image();
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              // 加载图片
              await new Promise((resolve, reject) => {
                img.onload = () => {
                  console.log('Image loaded:', { width: img.width, height: img.height });
                  resolve();
                };
                img.onerror = (error) => {
                  console.error('Image load error:', error);
                  reject(error);
                };
                img.src = dataUrl;
              });

              // 设置 canvas 尺寸并绘制图片
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              console.log('Image drawn to canvas');

              // 尝试使用 Clipboard API
              try {
                console.log('Attempting to use Clipboard API...');
                const blob = await new Promise(resolve => {
                  canvas.toBlob(resolve, 'image/png');
                });
                const clipboardItem = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([clipboardItem]);
                console.log('Clipboard API write successful');
                return { success: true };
              } catch (clipboardError) {
                console.log('Clipboard API failed:', clipboardError);
                
                // 如果 Clipboard API 失败，尝试使用 execCommand
                console.log('Falling back to execCommand method...');

                // 创建一个可编辑的区域
                const editable = document.createElement('div');
                editable.contentEditable = true;
                editable.style.cssText = 'position:fixed;left:0;top:0;opacity:0;z-index:99999;';
                document.body.appendChild(editable);
                console.log('Editable area created');

                // 将图片添加到可编辑区域
                editable.focus();
                editable.innerHTML = `<img src="${dataUrl}">`;

                // 等待一下确保图片加载完成
                await new Promise(resolve => setTimeout(resolve, 100));

                // 选中并复制
                const range = document.createRange();
                range.selectNode(editable);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                console.log('Content selected');

                const copyResult = document.execCommand('copy');
                console.log('execCommand result:', copyResult);

                // 清理
                selection.removeAllRanges();
                editable.remove();
                console.log('Cleanup completed');

                return { success: copyResult };
              }
            } catch (error) {
              console.error('Clipboard operation failed:', error);
              return { success: false, error: error.message };
            }
          },
          args: [request.dataUrl]
        });

        const result = results[0].result;
        console.log('Script execution result:', result);
        sendResponse(result);
      } catch (error) {
        console.error('Failed to execute script:', error);
        sendResponse({ success: false, error: error.message });
      }
    });

    return true; // 表示异步响应
  }
});
