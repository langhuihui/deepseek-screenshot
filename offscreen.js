// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'WRITE_TO_CLIPBOARD') {
    try {
      // 创建 Blob 对象
      const blob = new Blob([message.data], { type: 'image/png' });
      
      // 尝试使用 Clipboard API
      try {
        const clipboardItem = new ClipboardItem({
          'image/png': blob
        });
        await navigator.clipboard.write([clipboardItem]);
        
        // 发送成功响应
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_WRITE_RESULT',
          success: true
        });
        return;
      } catch (clipboardError) {
        console.log('Clipboard API failed:', clipboardError);
      }

      // 如果 Clipboard API 失败，尝试使用 execCommand
      // 创建一个图片元素
      const img = document.createElement('img');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 设置 canvas 尺寸
      const arrayBuffer = message.data;
      const uint8Array = new Uint8Array(arrayBuffer);
      const blob2 = new Blob([uint8Array], { type: 'image/png' });
      const url = URL.createObjectURL(blob2);

      // 等待图片加载
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      // 将图片绘制到 canvas
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // 创建一个可编辑的区域
      const editable = document.createElement('div');
      editable.contentEditable = true;
      editable.style.opacity = 0;
      editable.style.position = 'fixed';
      editable.style.zIndex = -1;
      document.body.appendChild(editable);

      // 将图片添加到可编辑区域
      editable.focus();
      canvas.toBlob(blob => {
        try {
          // 创建剪贴板数据
          const clipboardData = new ClipboardItem({
            'image/png': blob
          });

          // 尝试使用 Clipboard API
          navigator.clipboard.write([clipboardData]).then(() => {
            chrome.runtime.sendMessage({
              type: 'CLIPBOARD_WRITE_RESULT',
              success: true
            });
          }).catch(() => {
            // 如果还是失败，尝试使用 execCommand
            editable.innerHTML = `<img src="${canvas.toDataURL()}">`;
            document.execCommand('selectAll', false, null);
            document.execCommand('copy', false, null);
            chrome.runtime.sendMessage({
              type: 'CLIPBOARD_WRITE_RESULT',
              success: true
            });
          }).finally(() => {
            // 清理
            URL.revokeObjectURL(url);
            editable.remove();
          });
        } catch (error) {
          console.error('Failed to copy:', error);
          chrome.runtime.sendMessage({
            type: 'CLIPBOARD_WRITE_RESULT',
            success: false,
            error: error.message
          });
        }
      }, 'image/png');
    } catch (error) {
      // 发送错误响应
      chrome.runtime.sendMessage({
        type: 'CLIPBOARD_WRITE_RESULT',
        success: false,
        error: error.message
      });
    }
  }
});
