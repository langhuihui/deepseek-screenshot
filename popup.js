document.getElementById('captureBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = '正在截图...';

  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 确保内容脚本已注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // 如果脚本已经注入，会抛出错误，我们可以忽略它
      console.log('Content script may already be injected');
    }

    // 发送消息到 content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'capture' });
    
    if (response && response.success) {
      statusDiv.textContent = '截图已复制到剪贴板！';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    } else {
      throw new Error(response?.error || '截图失败');
    }
  } catch (error) {
    console.error('Screenshot error:', error);
    statusDiv.textContent = `错误: ${error.message}`;
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
  }
});
